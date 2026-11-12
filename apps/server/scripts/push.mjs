/**
 * Rauchtest für Web Push (#242) gegen den laufenden lokalen Spieleserver, mit einer Attrappe als Push-Dienst.
 *
 * Vorbereitung (einmal):
 *   node apps/server/scripts/vapid.mjs --dev          legt apps/server/.dev.vars an (nicht im Repo)
 *   WRANGLER_SEND_METRICS=false corepack pnpm --filter @brett-und-blatt/server dev
 * Aufruf:
 *   node apps/server/scripts/push.mjs [http://127.0.0.1:8787]
 *
 * Geprüft wird: Abos nur von Teilnehmern bzw. in Fernpartien, Antwort `pushState`, Aufruf und Turnierbeginn im Turnier,
 * „Du bist am Zug“ für ein getrenntes Mitglied einer Fernpartie, Entschlüsseln der Meldung mit dem Schlüssel des
 * Empfängers (RFC 8291), VAPID-Kopf (RFC 8292), 410 entzieht das Abo, keine Namen im Inhalt.
 * Die Erinnerung zwei Stunden vor Fristende lässt sich hier nicht beschleunigen; sie deckt `tournament-push.test.ts` ab.
 * Loopback-Abos nimmt nur der Testserver an (`ROOM_JURISDICTION=none`).
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const origin = 'http://localhost:5173';
const wsBase = base.replace(/^http/, 'ws');
let failures = 0;
const check = (ok, text) => {
  console.log(`${ok ? '✓' : '✗'} ${text}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(what, test, ms = 15_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = test();
    if (value) return value;
    await sleep(25);
  }
  throw new Error(`Zeit abgelaufen: ${what}`);
}

// Öffentlicher Schlüssel des Servers (aus .dev.vars), um den VAPID-Kopf zu prüfen.
const devVars = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.dev.vars'), 'utf8');
const publicKey = /^VAPID_PUBLIC_KEY=(.+)$/m.exec(devVars)?.[1]?.trim();
if (!publicKey) throw new Error('Keine VAPID-Schlüssel in apps/server/.dev.vars – erst `node apps/server/scripts/vapid.mjs --dev` ausführen und den Server neu starten.');

const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
const unb64 = (text) => new Uint8Array(Buffer.from(text, 'base64url'));

// ---------------------------------------------------------------------------
// Attrappe eines Push-Dienstes und Empfänger mit eigenem Schlüsselpaar

const inbox = new Map(); // Name → [{ headers, body }]
const answers = new Map(); // Name → Statuscode (Standard 201)
const service = createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const name = decodeURIComponent(req.url.split('/').pop());
    inbox.set(name, [...(inbox.get(name) ?? []), { headers: req.headers, body: new Uint8Array(Buffer.concat(chunks)) }]);
    res.writeHead(answers.get(name) ?? 201).end();
  });
});
await new Promise((resolve) => service.listen(0, '127.0.0.1', resolve));
const servicePort = service.address().port;

async function newReceiver(name) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    name,
    privateKey: pair.privateKey,
    publicRaw,
    auth,
    subscription: { endpoint: `http://127.0.0.1:${servicePort}/push/${name}`, keys: { p256dh: b64(publicRaw), auth: b64(auth) } },
  };
}

/** Entschlüsselt eine Meldung wie der Browser (RFC 8291, Abschnitt 3.4). */
async function decrypt(receiver, body) {
  const salt = body.slice(0, 16);
  const idLength = body[20];
  const asPublic = body.slice(21, 21 + idLength);
  const cipher = body.slice(21 + idLength);
  const hkdf = async (ikm, s, info, bytes) =>
    new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bytes * 8));
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, receiver.privateKey, 256);
  const enc = new TextEncoder();
  const ikm = await hkdf(secret, receiver.auth, new Uint8Array([...enc.encode('WebPush: info\0'), ...receiver.publicRaw, ...asPublic]), 32);
  const cek = await hkdf(ikm, salt, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, enc.encode('Content-Encoding: nonce\0'), 12);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cipher));
  if (plain.at(-1) !== 2) throw new Error('Trennbyte fehlt');
  return JSON.parse(new TextDecoder().decode(plain.slice(0, -1)));
}

/** Prüft den VAPID-Kopf: Schlüssel, Empfänger (aud) und Signatur. */
async function vapidOk(headers) {
  const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(headers.authorization ?? '');
  if (!m || m[4] !== publicKey) return false;
  const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
  if (claims.aud !== `http://127.0.0.1:${servicePort}` || claims.exp <= Date.now() / 1000) return false;
  const raw = unb64(publicKey);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64(raw.slice(1, 33)), y: b64(raw.slice(33, 65)), ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64(m[3]), new TextEncoder().encode(`${m[1]}.${m[2]}`));
}

/** Wartet auf Meldungen an einen Empfänger und gibt sie entschlüsselt zurück. */
async function received(receiver, count, ms = 12_000) {
  await until(`${count} Meldung(en) an ${receiver.name}`, () => (inbox.get(receiver.name)?.length ?? 0) >= count, ms);
  const out = [];
  for (const item of inbox.get(receiver.name).slice(0, count)) out.push({ ...item, payload: await decrypt(receiver, item.body) });
  return out;
}

// ---------------------------------------------------------------------------
// Nachgebaute Browser

function open(url) {
  const ws = new WebSocket(url, { headers: { Origin: origin } });
  const box = { ws, messages: [], send: (m) => ws.send(JSON.stringify(m)), close: () => ws.close() };
  ws.addEventListener('message', (e) => e.data !== 'pong' && box.messages.push(JSON.parse(e.data)));
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve(box), { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
}
const latest = (box, type) => box.messages.filter((m) => m.type === type).at(-1);
const count = (box, type) => box.messages.filter((m) => m.type === type).length;

/** Nach `hello` meldet ein Server mit VAPID-Schlüsseln `pushState`; ohne bleibt es still. */
async function expectPushState(box, enabled, what, fresh = true) {
  const before = fresh ? count(box, 'pushState') : 0;
  await until(`pushState (${what})`, () => count(box, 'pushState') > before && latest(box, 'pushState').enabled === enabled, 8000).catch(() => {
    throw new Error(`${what}: kein pushState mit enabled=${enabled}. Hat der Server VAPID-Schlüssel (.dev.vars, Neustart)?`);
  });
}

// ---------------------------------------------------------------------------
// Turnier

console.log('— Turnier —');
const created = await fetch(`${base}/turniere`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'kennung-der-leitung-push1', name: 'Leitung', settings: { name: 'Pushtest', gameId: 'tic-tac-toe', format: 'knockout', time: 'relaxed', days: 7, thirdPlace: false } }),
});
if (created.status !== 201) throw new Error(`Turnier anlegen: ${created.status}`);
const { code: tCode } = await created.json();
const tUrl = `${wsBase}/turniere/${tCode}`;
const leader = await open(tUrl);
leader.send({ type: 'hello', token: 'kennung-der-leitung-push1', name: 'Leitung', avatar: '🦉' });
await expectPushState(leader, false, 'Leitung', false);

const names = ['Anna', 'Ben', 'Cara', 'Dora'];
const players = [];
for (const [i, name] of names.entries()) {
  const box = await open(tUrl);
  box.token = `kennung-push-spieler-${i}-0123456789`;
  box.name = name;
  box.send({ type: 'hello', token: box.token, name, avatar: '🦊' });
  await until('Sicht', () => latest(box, 'tournament'));
  box.send({ type: 'join' });
  await until('eingeschrieben', () => latest(box, 'tournament')?.view.you);
  players.push(box);
}

// Nur Teilnehmer dürfen Hinweise abonnieren.
const receivers = [];
for (const [i, box] of players.entries()) {
  const receiver = await newReceiver(`t-${names[i]}`);
  receivers.push(receiver);
  if (i === 3) answers.set(receiver.name, 410); // Dora: Push-Dienst meldet „Abo ungültig“
  box.send({ type: 'pushSubscribe', subscription: receiver.subscription });
  await expectPushState(box, true, names[i]);
}
check(true, 'vier Teilnehmer haben Hinweise eingeschaltet, der Server antwortet mit pushState');
const errorsBefore = count(leader, 'error');
leader.send({ type: 'pushSubscribe', subscription: (await newReceiver('t-leitung')).subscription });
await until('Fehler für Nicht-Teilnehmer', () => count(leader, 'error') > errorsBefore);
check(/Teilnehmer/.test(latest(leader, 'error').message), 'Leitung ohne Platz darf keine Hinweise abonnieren');
const evil = players[0];
const errorsEvil = count(evil, 'error');
evil.send({ type: 'pushSubscribe', subscription: { endpoint: 'https://evil.example/x', keys: (await newReceiver('x')).subscription.keys } });
await until('Fehler für fremden Host', () => count(evil, 'error') > errorsEvil);
check(true, 'ein Abo mit fremdem Host wird abgelehnt (SSRF-Schutz)');

leader.send({ type: 'start' });
await until('gestartet', () => latest(leader, 'tournament')?.view.phase === 'running');
for (const i of [0, 1, 2]) {
  const got = await received(receivers[i], 2);
  const kinds = got.map((g) => g.payload.k).sort();
  check(kinds.join() === 'matchCalled,tournamentStarted', `${names[i]} bekommt „Turnier begonnen“ und „Partie aufgerufen“`);
  check(got.every((g) => g.payload.u === `#/turnier/${tCode}`), `${names[i]}: Ziel ist die Turnierseite`);
  check(JSON.stringify(got.map((g) => g.payload)).match(/Anna|Ben|Cara|Dora|Leitung/) === null, `${names[i]}: Inhalt ohne Namen`);
  check(got.every((g) => g.headers['content-encoding'] === 'aes128gcm' && Number(g.headers.ttl) > 0), `${names[i]}: Kopfzeilen Content-Encoding und TTL`);
  check(await vapidOk(got[0].headers), `${names[i]}: VAPID-Kopf stimmt (Schlüssel, Empfänger, Signatur)`);
}
await sleep(500);
check((inbox.get(receivers[0].name)?.length ?? 0) === 2, 'nichts doppelt');

// Dora: Der Push-Dienst antwortete 410, das Abo ist weg.
await until('Doras Abo entzogen', async () => (inbox.get(receivers[3].name)?.length ?? 0) >= 1);
const dora = await open(tUrl);
dora.send({ type: 'hello', token: players[3].token, name: 'Dora', avatar: '🦊' });
await expectPushState(dora, false, 'Dora nach 410');
check(true, '410 vom Push-Dienst entzieht das Abo');

// Widerruf
players[1].send({ type: 'pushUnsubscribe' });
await expectPushState(players[1], false, 'Ben nach Widerruf');
check(true, 'Widerruf wird bestätigt');

for (const box of [leader, dora, ...players]) box.close();

// ---------------------------------------------------------------------------
// Fernpartie

console.log('— Fernpartie —');
async function newRoom() {
  const response = await fetch(`${base}/rooms`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic: false }) });
  return (await response.json()).code;
}
async function member(code, name) {
  const box = await open(`${wsBase}/rooms/${encodeURIComponent(code)}`);
  box.token = `kennung-push-${name}-0123456789`;
  box.send({ type: 'hello', protocol: 1, token: box.token, name, avatar: '🦊' });
  await until('welcome', () => latest(box, 'welcome'));
  return box;
}

const rCode = await newRoom();
const rAnna = await member(rCode, 'Anna');
const rBen = await member(rCode, 'Ben');
await expectPushState(rBen, false, 'Ben im Raum', false);
rAnna.send({ type: 'setGame', gameId: 'go' });
await until('Spiel Go', () => latest(rAnna, 'room')?.lobby.gameId === 'go');
rAnna.send({ type: 'setOption', id: 'correspondence', value: 'yes' });
await until('Fernpartie in der Lobby', () => latest(rAnna, 'room')?.correspondence === true);
check(true, 'der Raum meldet den Browsern, dass er eine Fernpartie ist');
rAnna.send({ type: 'takeSeat', index: 0 });
rBen.send({ type: 'takeSeat', index: 1 });
await until('Plätze', () => latest(rAnna, 'room')?.lobby.seats.every((s) => s.kind === 'human' && s.memberId));
rAnna.send({ type: 'start' });
await until('Partie läuft', () => latest(rAnna, 'game') && latest(rBen, 'game'));

const game = (box) => latest(box, 'game');
const mover = game(rAnna).current.includes(0) ? rAnna : rBen;
const waiter = mover === rAnna ? rBen : rAnna;
const waiterName = waiter === rAnna ? 'Anna' : 'Ben';
const receiver = await newReceiver(`r-${waiterName}`);
waiter.send({ type: 'pushSubscribe', subscription: receiver.subscription });
await expectPushState(waiter, true, `${waiterName} in der Fernpartie`);
waiter.close(); // Tab zu: keine Verbindung mehr
await sleep(300);
mover.send({ type: 'move', version: game(mover).version, move: game(mover).legalMoves[0] });
const [turn] = await received(receiver, 1);
check(turn.payload.k === 'yourTurn' && turn.payload.u === `#/raum/${rCode}`, '„Du bist am Zug“ erreicht das getrennte Mitglied der Fernpartie');
check(await vapidOk(turn.headers), 'VAPID-Kopf stimmt auch hier');
check(!/Anna|Ben/.test(JSON.stringify(turn.payload)), 'Inhalt ohne Namen');

// Ein normaler Raum nimmt keine Abos an.
const nCode = await newRoom();
const nAnna = await member(nCode, 'Anna');
nAnna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
await until('Spiel', () => latest(nAnna, 'room')?.lobby.gameId === 'tic-tac-toe');
check(latest(nAnna, 'room').correspondence === undefined, 'normaler Raum: kein Fernpartie-Schalter');
const nErrors = count(nAnna, 'error');
nAnna.send({ type: 'pushSubscribe', subscription: (await newReceiver('r-normal')).subscription });
await until('Fehler im normalen Raum', () => count(nAnna, 'error') > nErrors);
check(/Fernpartien/.test(latest(nAnna, 'error').message), 'normaler Raum lehnt Hinweise ab');

for (const box of [rAnna, rBen, nAnna, mover]) box.close();
service.close();
console.log(failures === 0 ? '✓ Push-Rauchtest bestanden' : `✗ ${failures} Prüfung(en) fehlgeschlagen`);
process.exit(failures === 0 ? 0 : 1);
