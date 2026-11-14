// Rauchtest „Schwarzes Brett“ (#65) gegen den laufenden Spieleserver.
// Aufruf (Server läuft, z. B. lokal mit `wrangler dev`):
//   node apps/server/scripts/spielersuche.mjs [http://127.0.0.1:8787]
// Zwei nachgebaute Browser: Anna hängt einen Zettel auf, Ben stimmt zu, beide bestätigen – der Raum steht,
// Anna wird Raumleitung (auch wenn Ben zuerst eintritt).

const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const origin = 'http://localhost:5173';
let failures = 0;

function check(ok, text) {
  console.log(`${ok ? '✓' : '✗'} ${text}`);
  if (!ok) failures++;
}

function socket(url, token, name) {
  const ws = new WebSocket(url, { headers: { Origin: origin } });
  const messages = [];
  const waiting = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    messages.push(message);
    for (const w of [...waiting]) if (w.test(message)) waiting.splice(waiting.indexOf(w), 1) && w.resolve(message);
  });
  const c = {
    messages,
    send: (m) => ws.send(JSON.stringify(m)),
    last: (type) => [...messages].reverse().find((m) => m.type === type),
    next: (test, timeoutMs = 10_000) =>
      new Promise((resolve, reject) => {
        const found = [...messages].reverse().find(test);
        if (found) return resolve(found);
        const entry = { test, resolve: (m) => (clearTimeout(timer), resolve(m)) };
        const timer = setTimeout(() => {
          waiting.splice(waiting.indexOf(entry), 1);
          reject(new Error(`${name}: Zeitüberschreitung beim Warten`));
        }, timeoutMs);
        waiting.push(entry);
      }),
    close: () => ws.close(),
    ready: new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    }),
  };
  return c;
}

const wsBase = base.replace(/^http/, 'ws');
const tokenA = 'anna-' + crypto.randomUUID().replaceAll('-', '') + 'xx';
const tokenB = 'ben-' + crypto.randomUUID().replaceAll('-', '') + 'xx';

const count0 = await (await fetch(`${base}/brett`, { headers: { Origin: origin } })).json();
check(typeof count0.count === 'number', 'GET /brett meldet die Zahl der Zettel');

const anna = socket(`${wsBase}/brett`, tokenA, 'Anna');
const ben = socket(`${wsBase}/brett`, tokenB, 'Ben');
await Promise.all([anna.ready, ben.ready]);
anna.send({ type: 'hello', token: tokenA });
ben.send({ type: 'hello', token: tokenB });
await anna.next((m) => m.type === 'board' && m.you);

anna.send({ type: 'post', name: 'Anna', avatar: '🦊', games: ['black-peter'], seats: 'any', mood: 'relaxed' });
const posted = await ben.next((m) => m.type === 'board' && m.notes.some((n) => n.name === 'Anna'));
const noteId = posted.notes.find((n) => n.name === 'Anna').id;
check(posted.notes.find((n) => n.id === noteId).mine === false, 'der Zettel hängt und gehört Ben nicht');

anna.send({ type: 'post', name: 'Anna', avatar: '🦊', games: ['black-peter'], seats: 'any', mood: 'relaxed' });
await anna.next((m) => m.type === 'boardError' && m.error === 'rate');
check(true, 'zu schnelles zweites Aufhängen wird gebremst');

ben.send({ type: 'join', noteId, gameId: 'gibt-es-nicht', name: 'Ben' });
await ben.next((m) => m.type === 'boardError' && m.error === 'games');
check(true, 'ein Spiel, das nicht auf dem Zettel steht, wird abgelehnt');

ben.send({ type: 'join', noteId, gameId: 'black-peter', name: 'Ben' });
const proposed = await ben.next((m) => m.type === 'board' && m.proposal);
check(proposed.proposal.gameId === 'black-peter' && proposed.proposal.total === 2 && proposed.proposal.names.join() === 'Anna,Ben', 'Zustimmung ergibt einen Vorschlag „Anna, Ben“');

const matchedA = anna.next((m) => m.type === 'matched');
const matchedB = ben.next((m) => m.type === 'matched');
ben.send({ type: 'confirm', noteId, ok: true });
const [a, b] = [await matchedA, await matchedB];
check(a.code === b.code && a.gameId === 'black-peter', `beide bestätigt: Raum ${a.code} steht`);

// Ben tritt zuerst ein, Anna danach: Anna wird trotzdem Raumleitung.
const roomUrl = `${wsBase}/rooms/${encodeURIComponent(a.code)}`;
const roomB = socket(roomUrl, tokenB, 'Ben im Raum');
await roomB.ready;
roomB.send({ type: 'hello', protocol: 1, token: tokenB, name: 'Ben', avatar: '🐼' });
await roomB.next((m) => m.type === 'welcome');
const roomA = socket(roomUrl, tokenA, 'Anna im Raum');
await roomA.ready;
roomA.send({ type: 'hello', protocol: 1, token: tokenA, name: 'Anna', avatar: '🦊' });
const welcome = await roomA.next((m) => m.type === 'welcome');
const lobby = await roomA.next((m) => m.type === 'room' && m.members.length === 2);
check(lobby.lobby.gameId === 'black-peter', 'der Raum ist auf das gewählte Spiel eingestellt');
check(lobby.hostId === welcome.you, 'Anna, die den Zettel geschrieben hat, ist Raumleitung');

const after = await ben.next((m) => m.type === 'board' && m.notes.every((n) => n.name !== 'Anna'));
check(Boolean(after), 'vermittelte Zettel verschwinden vom Brett');

anna.send({ type: 'withdraw' });

// Zettel für eine bestehende offene Runde („Mitspieler gesucht“): Cara leitet eine öffentliche Runde, Dora sieht den Zettel.
const created = await fetch(`${base}/rooms`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic: true }) });
const { code: openCode } = await created.json();
const tokenC = 'cara-' + crypto.randomUUID().replaceAll('-', '') + 'xx';
const tokenD = 'dora-' + crypto.randomUUID().replaceAll('-', '') + 'xx';
const caraRoom = socket(`${wsBase}/rooms/${encodeURIComponent(openCode)}`, tokenC, 'Cara im Raum');
await caraRoom.ready;
caraRoom.send({ type: 'hello', protocol: 1, token: tokenC, name: 'Cara', avatar: '🐸' });
await caraRoom.next((m) => m.type === 'welcome');
caraRoom.send({ type: 'setGame', gameId: 'black-peter' });
await caraRoom.next((m) => m.type === 'room' && m.lobby.gameId === 'black-peter');
const cara = socket(`${wsBase}/brett`, tokenC, 'Cara');
const dora = socket(`${wsBase}/brett`, tokenD, 'Dora');
await Promise.all([cara.ready, dora.ready]);
cara.send({ type: 'hello', token: tokenC });
dora.send({ type: 'hello', token: tokenD });
await cara.next((m) => m.type === 'board' && m.you);
cara.send({ type: 'postRoom', name: 'Cara', avatar: '🐸', code: '🐶🐶🐶🐶', seats: 'any', mood: 'relaxed' });
await cara.next((m) => m.type === 'boardError' && m.error === 'room');
check(true, 'ein Zettel für einen Raum, der nicht offen ist, wird abgelehnt');
// Das Verzeichnis meldet den Raum erst nach einer Weile; ein paar Versuche genügen.
let roomNote;
for (let attempt = 0; attempt < 10 && !roomNote; attempt++) {
  cara.send({ type: 'postRoom', name: 'Cara', avatar: '🐸', code: openCode, seats: '3-4', mood: 'kids' });
  roomNote = await dora.next((m) => m.type === 'board' && m.notes.some((n) => n.room === openCode), 1500).catch(() => null);
  if (!roomNote) await new Promise((r) => setTimeout(r, 1200));
}
check(Boolean(roomNote), 'die offene Runde hängt als Zettel „Mitspieler gesucht“ am Brett');
if (roomNote) {
  const note = roomNote.notes.find((n) => n.room === openCode);
  check(note.games[0] === 'black-peter' && note.mood === 'kids' && note.seats === '3-4', 'Spiel, Stimmung und Spielerzahl stehen auf dem Zettel');
  dora.send({ type: 'join', noteId: note.id, gameId: 'black-peter', name: 'Dora' });
  await dora.next((m) => m.type === 'boardError' && m.error === 'room');
  check(true, 'auf einem Raum-Zettel gibt es kein „Bin dabei“, nur den Weg in den Raum');
}
cara.close();
const stays = await dora.next((m) => m.type === 'board' && m.notes.some((n) => n.room === openCode), 1500).catch(() => null);
check(Boolean(stays), 'der Zettel bleibt hängen, auch wenn die Verfasserin die Brett-Verbindung schließt');

[anna, ben, roomA, roomB, caraRoom, dora].forEach((c) => c.close());
console.log(failures === 0 ? '\nAlles in Ordnung.' : `\n${failures} Prüfung(en) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
