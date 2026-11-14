// Rauchtest „Laufende Runde offen für Neue“ (#299) gegen den laufenden Spieleserver.
// Aufruf (Server läuft, z. B. lokal mit `wrangler dev`):
//   node apps/server/scripts/anfrage.mjs [http://127.0.0.1:8787]
// Drei nachgebaute Browser: Anna (Raumleitung) und Ben spielen Schwarzer Peter, Zoe schaut zu und fragt an.

const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const origin = 'http://localhost:5173';
let failures = 0;

function check(ok, text) {
  console.log(`${ok ? '✓' : '✗'} ${text}`);
  if (!ok) failures++;
}

async function client(code, name) {
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/rooms/${encodeURIComponent(code)}`, { headers: { Origin: origin } });
  const messages = [];
  const waiting = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    messages.push(message);
    for (const w of [...waiting]) if (w.test(message)) waiting.splice(waiting.indexOf(w), 1) && w.resolve(message);
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const c = {
    messages,
    send: (m) => ws.send(JSON.stringify(m)),
    last: (type) => [...messages].reverse().find((m) => m.type === type),
    next: (test, timeoutMs = 10_000) =>
      new Promise((resolve, reject) => {
        const entry = { test, resolve: (m) => (clearTimeout(timer), resolve(m)) };
        const timer = setTimeout(() => {
          waiting.splice(waiting.indexOf(entry), 1);
          reject(new Error(`${name}: Zeitüberschreitung beim Warten`));
        }, timeoutMs);
        waiting.push(entry);
      }),
    close: () => ws.close(),
  };
  const welcome = c.next((m) => m.type === 'welcome');
  c.send({ type: 'hello', protocol: 1, token: `${name}-${crypto.randomUUID()}`, name, avatar: '🦊' });
  c.you = (await welcome).you;
  return c;
}

const created = await fetch(`${base}/rooms`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic: true }) });
const { code } = await created.json();
const anna = await client(code, 'Anna');
const ben = await client(code, 'Ben');
const zoe = await client(code, 'Zoe');

anna.send({ type: 'setGame', gameId: 'black-peter' });
await anna.next((m) => m.type === 'room' && m.lobby.gameId === 'black-peter');
anna.send({ type: 'takeSeat', index: 0 });
await anna.next((m) => m.type === 'room' && m.lobby.seats[0]?.memberId === anna.you);
ben.send({ type: 'takeSeat', index: 1 });
await ben.next((m) => m.type === 'room' && m.lobby.seats[1]?.memberId === ben.you);
const started = zoe.next((m) => m.type === 'game');
anna.send({ type: 'start' });
await started;

const openList = await (await fetch(`${base}/rooms/open`, { headers: { Origin: origin } })).json();
check(openList.some((r) => r.code === code && r.running === true), 'laufende öffentliche Runde steht in /rooms/open mit „running“');

zoe.send({ type: 'askToJoin' });
const asking = await anna.next((m) => m.type === 'room' && m.members.some((x) => x.id === zoe.you && x.join === 'asking'));
check(Boolean(asking), 'Anfrage kommt bei der Raumleitung an');

ben.send({ type: 'answerJoin', memberId: zoe.you, ok: true });
await ben.next((m) => m.type === 'error' && m.code === 'notAllowed');
check(true, 'nur die Raumleitung darf entscheiden');

anna.send({ type: 'answerJoin', memberId: zoe.you, ok: true });
await zoe.next((m) => m.type === 'room' && m.members.some((x) => x.id === zoe.you && x.join === 'queued'));
check(true, 'angenommen: Zoe ist vorgemerkt');

anna.send({ type: 'resign' });
await anna.next((m) => m.type === 'room' && m.phase === 'finished');
const restarted = zoe.next((m) => m.type === 'game' && m.round === 2);
anna.send({ type: 'start' });
const game = await restarted;
check(game.yourSeat !== null && game.seats.length === 3, 'nächste Runde: Zoe sitzt am Tisch (3 Plätze)');

[anna, ben, zoe].forEach((c) => c.close());
console.log(failures === 0 ? '\nAlles in Ordnung.' : `\n${failures} Prüfung(en) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
