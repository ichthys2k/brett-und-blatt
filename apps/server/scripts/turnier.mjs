/**
 * Rauchtest gegen den laufenden Spieleserver: ein ganzes Turnier in WM-Form mit sechs
 * nachgebauten Browsern, jede Partie in einem echten Raum und durch Aufgeben entschieden.
 * Aufruf: node apps/server/scripts/turnier.mjs [Adresse] [world|knockout|double|swiss]
 */
const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const format = process.argv[3] ?? 'world';
const origin = 'http://localhost:5173';
const wsBase = base.replace(/^http/, 'ws');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(what, check, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = check();
    if (value) return value;
    await sleep(25);
  }
  throw new Error(`Zeit abgelaufen: ${what}`);
}

function open(url) {
  const ws = new WebSocket(url, { headers: { Origin: origin } });
  const box = { ws, messages: [], send: (m) => ws.send(JSON.stringify(m)) };
  ws.addEventListener('message', (e) => box.messages.push(JSON.parse(e.data)));
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve(box), { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
}

const latest = (box, type) => box.messages.filter((m) => m.type === type).at(-1);
const view = (box) => latest(box, 'tournament')?.view;

const created = await fetch(`${base}/turniere`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'kennung-der-leitung-0001', name: 'Leitung', settings: { name: 'Rauchtest', gameId: 'tic-tac-toe', format, time: 'relaxed', days: 7, thirdPlace: false } }),
});
if (created.status !== 201) throw new Error(`Anlegen: ${created.status}`);
const { code } = await created.json();
console.log('Turnier', code);

const foreign = await fetch(`${base}/turniere`, { method: 'POST', headers: { Origin: 'https://fremde-seite.example' }, body: '{}' });
if (foreign.status !== 403) throw new Error(`Fremde Herkunft: ${foreign.status}`);

const url = `${wsBase}/turniere/${code}`;
const leader = await open(url);
leader.send({ type: 'hello', token: 'kennung-der-leitung-0001', name: 'Leitung', avatar: '🦉' });
await until('Sicht der Leitung', () => view(leader));

const players = [];
for (let i = 0; i < 6; i++) {
  const box = await open(url);
  box.token = `kennung-spieler-${String(i).padStart(8, '0')}`;
  box.send({ type: 'hello', token: box.token, name: `Spieler${i}`, avatar: '🦊' });
  await until('Sicht', () => view(box));
  box.send({ type: 'join' });
  await until('eingeschrieben', () => view(box)?.you);
  players.push(box);
}
leader.send({ type: 'start' });
await until('gestartet', () => view(leader)?.phase === 'running');

const stranger = await open(url);
stranger.send({ type: 'hello', token: 'kennung-fremdes-geraet-1', name: 'Fremd', avatar: '🐱' });
await until('Fremde abgewiesen', () => latest(stranger, 'closed'));
stranger.ws.close();

const secret = JSON.stringify(view(players[0]));
if (secret.includes('kennung-')) throw new Error('Kennung in der Sicht!');

let played = 0;
while (view(leader).phase === 'running') {
  const match = view(leader).matches.find((m) => m.status === 'open');
  if (!match) throw new Error('Keine offene Partie, aber das Turnier läuft');
  const sides = match.slots.map((slot) => players.find((p) => view(p).you === slot.player));
  for (const side of sides) side.send({ type: 'ready', match: match.id, ready: true });
  const roomCode = await until('Raum', () => view(leader).matches.find((m) => m.id === match.id)?.roomCode);
  const seats = [];
  for (const side of sides) {
    const room = await open(`${wsBase}/rooms/${encodeURIComponent(roomCode)}`);
    room.send({ type: 'hello', protocol: 1, token: side.token, name: 'x', avatar: '🦊' });
    seats.push(room);
  }
  await until('Partie läuft', () => latest(seats[1], 'game'));
  seats[1].send({ type: 'resign' });
  await until('Ergebnis', () => view(leader).matches.find((m) => m.id === match.id)?.outcome);
  const outcome = view(leader).matches.find((m) => m.id === match.id).outcome;
  if (outcome.winner !== 0 || outcome.walkover) throw new Error(`Falsches Ergebnis ${JSON.stringify(outcome)}`);
  for (const room of seats) room.ws.close();
  played++;
}
const end = view(leader);
console.log(`${format}: ${played} Partien, Sieger: ${end.players.find((p) => p.id === end.podium[0])?.name}`);
const expected = { world: 9, knockout: 5, double: 10 }[format];
if ((expected && played !== expected) || end.podium.length < 2) throw new Error(`Unerwarteter Abschluss: ${played} Partien`);
for (const box of [leader, ...players]) box.ws.close();
console.log('✓ Turnier-Rauchtest bestanden');
process.exit(0);
