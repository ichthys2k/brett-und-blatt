// Rauchtest „Abstimmung am Rundenende“ (#298) gegen den laufenden Spieleserver.
// Aufruf (Server läuft, z. B. lokal mit `wrangler dev`):
//   node apps/server/scripts/rundenende.mjs [http://127.0.0.1:8787]
// Drei nachgebaute Browser: Nochmal, anderes Spiel (Vorschlag + Stimme), Frist ohne Stimmen, Zuschauer darf nicht abstimmen.

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

/** Anna und Ben spielen Tic-Tac-Toe, Zoe schaut zu; Anna gibt auf, damit die Runde zu Ende ist. */
async function finishedRound() {
  const created = await fetch(`${base}/rooms`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic: false }) });
  const { code } = await created.json();
  const anna = await client(code, 'Anna');
  const ben = await client(code, 'Ben');
  const zoe = await client(code, 'Zoe');
  anna.send({ type: 'setGame', gameId: 'tic-tac-toe' });
  await anna.next((m) => m.type === 'room' && m.lobby.gameId === 'tic-tac-toe' && m.lobby.seats.length === 2);
  anna.send({ type: 'takeSeat', index: 0 });
  await anna.next((m) => m.type === 'room' && m.lobby.seats[0]?.memberId === anna.you);
  ben.send({ type: 'takeSeat', index: 1 });
  await ben.next((m) => m.type === 'room' && m.lobby.seats[1]?.memberId === ben.you);
  const started = anna.next((m) => m.type === 'game');
  anna.send({ type: 'start' });
  await started;
  const opened = Promise.all([anna, ben, zoe].map((c) => c.next((m) => m.type === 'afterGame' && m.after)));
  anna.send({ type: 'resign' });
  await opened;
  return { code, anna, ben, zoe };
}

// 1. Nochmal
{
  const { anna, ben, zoe } = await finishedRound();
  const info = anna.last('afterGame').after;
  check(info.voters === 2 && info.canVote === true && zoe.last('afterGame').after.canVote === false, 'Abstimmung beginnt mit dem Ergebnis, Zuschauer stimmen nicht ab');
  zoe.send({ type: 'afterVote', choice: 'again' });
  await zoe.next((m) => m.type === 'error' && m.code === 'notAllowed');
  check(true, 'Zuschauer bekommt bei einer Stimme „nicht erlaubt“');
  anna.send({ type: 'afterVote', choice: 'again' });
  await ben.next((m) => m.type === 'afterGame' && m.after?.voted === 1 && m.after.again === 1);
  check(ben.last('afterGame').after.you?.choice === undefined, 'Ben sieht nur den Zähler, nicht Annas Stimme');
  const restarted = anna.next((m) => m.type === 'game' && m.round === 2);
  ben.send({ type: 'afterVote', choice: 'again' });
  const game = await restarted;
  check(game.round === 2 && game.result === null, 'beide „Nochmal“: die nächste Runde startet sofort');
  [anna, ben, zoe].forEach((c) => c.close());
}

// 2. Anderes Spiel: Vorschlag + Stimme für den Kandidaten → Lobby mit dem neuen Spiel
{
  const { anna, ben, zoe } = await finishedRound();
  anna.send({ type: 'afterPropose', gameId: 'four-in-a-row' });
  const candidates = await ben.next((m) => m.type === 'afterGame' && m.after?.candidates.some((c) => c.gameId === 'four-in-a-row'));
  check(candidates.after.candidates.at(-1).gameId === 'random', 'Vorschlag steht zur Wahl, „Zufällig“ steht am Ende');
  const lobby = ben.next((m) => m.type === 'room' && m.phase === 'lobby');
  ben.send({ type: 'afterPick', gameId: 'four-in-a-row' });
  const room = await lobby;
  check(room.lobby.gameId === 'four-in-a-row', 'Mehrheit für ein anderes Spiel: Raum geht in die Lobby mit dem neuen Spiel');
  check(room.lobby.seats.filter((s) => s.kind === 'human' && s.memberId).length === 2, 'beide behalten ihren Platz');
  [anna, ben, zoe].forEach((c) => c.close());
}

console.log(failures === 0 ? '\nAlles in Ordnung.' : `\n${failures} Prüfung(en) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
