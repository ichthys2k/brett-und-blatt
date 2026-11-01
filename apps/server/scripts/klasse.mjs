// Lastmessung für Klassenspiele: 30 nachgebaute Browser spielen eine Partie auf dem Spieleserver.
// Aufruf (Server läuft, z. B. lokal mit `wrangler dev`):
//   node apps/server/scripts/klasse.mjs [Adresse] [Spiel] [Plätze] [Runden]
// Misst Nachrichten, Datenmenge und wie lange es dauert, bis alle eine Änderung gesehen haben.

const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const gameId = process.argv[3] ?? 'majority';
const seats = Number(process.argv[4] ?? 30);
const rounds = Number(process.argv[5] ?? 5);
const origin = 'http://localhost:5173';

const errors = [];
let messages = 0;
let host;
let bytes = 0;

function client(code, name) {
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/rooms/${encodeURIComponent(code)}`, { headers: { Origin: origin } });
  const c = { name, game: null, room: null, send: (m) => ws.send(JSON.stringify(m)), close: () => ws.close(), onGame: null, you: null };
  ws.addEventListener('message', (event) => {
    messages++;
    bytes += event.data.length;
    const message = JSON.parse(event.data);
    if (message.type === 'welcome') c.you = message.you;
    if (message.type === 'room') c.room = message;
    if (message.type === 'game') {
      c.game = message;
      c.onGame?.(message);
    }
    if (message.type === 'error') errors.push(`${name}: ${message.code}`);
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => {
      c.send({ type: 'hello', protocol: 1, token: `${name}-${crypto.randomUUID()}`, name, avatar: '🦊' });
      resolve(c);
    });
    ws.addEventListener('error', reject);
  });
}

const until = async (test, ms = 20_000) => {
  const start = Date.now();
  while (!test()) {
    if (Date.now() - start > ms) {
      const v = host.game?.view;
      throw new Error(`Zeitüberschreitung: Phase ${v?.phase}, Runde ${v?.round}, fertig ${v?.answered?.filter(Boolean).length}, fehlt ${v?.answered?.flatMap((d, i) => (d ? [] : [i]))}, Fehlermeldungen ${errors.join(' | ')}`);
    }
    await new Promise((r) => setTimeout(r, 15));
  }
};

const response = await fetch(`${base}/rooms`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
const { code } = await response.json();
host = await client(code, 'Host');
await until(() => host.room);
host.send({ type: 'setGame', gameId });
host.send({ type: 'setOption', id: 'count', value: '5' });
await until(() => host.room.gameId === gameId || host.room.lobby?.gameId === gameId);
host.send({ type: 'setSeatCount', count: seats });
const all = [host];
for (let i = 1; i < seats; i++) all.push(await client(code, `K${i}`));
await until(() => all.every((c) => c.you));
await new Promise((r) => setTimeout(r, 300));
host.send({ type: 'fillSeats' });
await new Promise((r) => setTimeout(r, 500));
const joined = messages;
const before = bytes;
host.send({ type: 'start' });
await until(() => all.every((c) => c.game));
console.log(`${all.length} Browser im Raum ${code}, ${gameId}, ${seats} Plätze, ${rounds} Runden`);

const answerFor = (view) => {
  const q = view.questions[view.round];
  if (gameId === 'estimate') return q.min;
  if (gameId === 'timeline') return q.items.map((_, i) => i);
  return 0;
};

const lag = [];
const roundMs = [];
for (let round = 0; round < rounds; round++) {
  const start = Date.now();
  for (const c of all) {
    const g = c.game;
    if (g.yourSeat === null || g.yourSeat === undefined) continue;
    const sent = Date.now();
    c.send({ type: 'move', version: g.version, move: { type: 'answer', answer: answerFor(g.view) } });
    lag.push(sent);
    await new Promise((r) => setTimeout(r, 40));
  }
  await until(() => all.every((c) => c.game.view.phase !== 'answer'));
  roundMs.push(Date.now() - start);
  // Auflösung läuft 9 s von selbst weiter.
  await until(() => all.every((c) => c.game.view.phase === 'finished' || (c.game.view.phase === 'answer' && c.game.view.round > round)), 30_000);
}
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
console.log(`Alle Antworten bis Auflösung bei allen: Median ${median(roundMs)} ms (davon ${all.length * 40} ms künstlicher Abstand)`);
console.log(`Nachrichten je Runde: ${Math.round((messages - joined) / rounds)}, Daten je Runde: ${Math.round((bytes - before) / rounds / 1024)} KB`);
console.log(`Größte Nachricht je Browser: Sicht ${Math.round(JSON.stringify(host.game).length / 1024)} KB`);
if (errors.length) console.log(`Fehlermeldungen: ${errors.join(' | ')}`);
process.exit(0);
