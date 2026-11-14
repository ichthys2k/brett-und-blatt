// Rauchtest für den Spieleserver: verhält sich wie zwei Browser.
// Aufruf (Server läuft, z. B. lokal mit `wrangler dev`):
//   node apps/server/scripts/smoke.mjs [http://127.0.0.1:8787]
// Prüft: Raum erstellen, Anmelden, Lobby, eine ganze Partie, Wiedereinstieg,
// Herkunftsprüfung, Bot-Antwortzeit, Zeitablauf mit Bot-Zug und Emoji-Reaktion,
// dazu einen fremden Client ohne Webseite (#334): Kennung, Partie gegen einen Bot, Ratenbegrenzung.

const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const origin = 'http://localhost:5173';
let failures = 0;

function check(ok, text) {
  console.log(`${ok ? '✓' : '✗'} ${text}`);
  if (!ok) failures++;
}

/** Ein nachgebauter Browser mit einer WebSocket-Verbindung. */
async function client(code, name, token = `${name}-${crypto.randomUUID()}`, { cli } = {}) {
  // Ein Programm ohne Webseite (#334) schickt keinen Origin, sondern nennt seine Kennung.
  const url = `${base.replace(/^http/, 'ws')}/rooms/${encodeURIComponent(code)}${cli ? `?client=${cli}` : ''}`;
  const ws = new WebSocket(url, cli ? {} : { headers: { Origin: origin } });
  const messages = [];
  const waiting = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    messages.push(message);
    // Eine Fehlermeldung des Servers beendet jedes Warten sofort, statt erst nach der Zeitüberschreitung.
    for (const w of [...waiting]) {
      if (w.test(message)) waiting.splice(waiting.indexOf(w), 1) && w.resolve(message);
      else if (message.type === 'error') waiting.splice(waiting.indexOf(w), 1) && w.reject(new Error(`${name}: Server meldet ${message.code} – ${message.message}`));
    }
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const c = {
    token,
    messages,
    send: (m) => ws.send(JSON.stringify(m)),
    /** Wartet auf die nächste ankommende Nachricht, die passt. */
    next: (test, timeoutMs = 10_000) =>
      new Promise((resolve, reject) => {
        const entry = { test, resolve: (m) => (clearTimeout(timer), resolve(m)), reject: (e) => (clearTimeout(timer), reject(e)) };
        const timer = setTimeout(() => {
          waiting.splice(waiting.indexOf(entry), 1);
          reject(new Error(`${name}: Zeitüberschreitung beim Warten`));
        }, timeoutMs);
        waiting.push(entry);
      }),
    /**
     * Schickt eine Nachricht und wartet, bis der Raum sie bestätigt. Nachrichten verschiedener
     * Browser kommen beim Server in beliebiger Reihenfolge an – nur so bleibt die Abfolge sicher.
     */
    step: (message, test, timeoutMs) => {
      const done = c.next((m) => m.type === 'room' && test(m), timeoutMs);
      c.send(message);
      return done;
    },
    close: () => ws.close(),
  };
  const welcome = c.next((m) => m.type === 'welcome');
  c.send({ type: 'hello', protocol: 1, token, name, avatar: '🦊' });
  c.you = (await welcome).you;
  return c;
}

const preflight = await fetch(`${base}/rooms`, {
  method: 'OPTIONS',
  headers: {
    Origin: origin,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Content-Type',
  },
});
const allowHeaders = preflight.headers.get('Access-Control-Allow-Headers') ?? '';
check(
  preflight.status === 204 && allowHeaders.toLowerCase().includes('content-type'),
  'CORS-Preflight erlaubt Content-Type Header',
);

const created = await fetch(`${base}/rooms`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ isPublic: true }),
});
const { code } = await created.json();
check(created.status === 201 && typeof code === 'string', `Raum erstellt: ${code}`);

const foreign = await fetch(`${base}/rooms`, { method: 'POST', headers: { Origin: 'https://fremde-seite.example' } });
check(foreign.status === 403, 'fremde Seiten dürfen keine Räume anlegen');

const missing = await fetch(`${base}/rooms/${encodeURIComponent('🐶🐶🐶🐶')}`);
check((await missing.json()).exists === false, 'ein unbekannter Code führt ins Leere');

const openInitial = await fetch(`${base}/rooms/open`, { headers: { Origin: origin } });
check(openInitial.status === 200, 'GET /rooms/open antwortet mit 200');

const anna = await client(code, 'Anna');
const ben = await client(code, 'Ben');
check(anna.you === 'm1' && ben.you === 'm2', 'beide angemeldet, Anna leitet den Raum');

// Lobby: Tic-Tac-Toe, beide setzen sich – Ben erst, wenn das Spiel gewählt ist (sonst gibt es Platz 2 noch nicht).
await anna.step({ type: 'setGame', gameId: 'tic-tac-toe' }, (m) => m.lobby.gameId === 'tic-tac-toe' && m.lobby.seats.length === 2);
const openWithGame = await (await fetch(`${base}/rooms/open`, { headers: { Origin: origin } })).json();
check(openWithGame.some((r) => r.code === code && r.gameId === 'tic-tac-toe'), 'öffentlicher Raum mit Spiel erscheint in /rooms/open');

await anna.step({ type: 'setPublic', isPublic: false }, (m) => m.lobby.isPublic === false);
const openPrivate = await (await fetch(`${base}/rooms/open`, { headers: { Origin: origin } })).json();
check(!openPrivate.some((r) => r.code === code), 'privater Raum verschwindet aus /rooms/open');

await anna.step({ type: 'setPublic', isPublic: true }, (m) => m.lobby.isPublic === true);
const openPublicAgain = await (await fetch(`${base}/rooms/open`, { headers: { Origin: origin } })).json();
check(openPublicAgain.some((r) => r.code === code), 'wieder öffentlicher Raum erscheint erneut in /rooms/open');

await anna.step({ type: 'takeSeat', index: 0 }, (m) => m.lobby.seats[0]?.memberId === 'm1');
await ben.step({ type: 'takeSeat', index: 1 }, (m) => m.lobby.seats[1]?.memberId === 'm2');
let annaGame = anna.next((m) => m.type === 'game');
let benGame = ben.next((m) => m.type === 'game');
anna.send({ type: 'start' });
let games = { Anna: await annaGame, Ben: await benGame };
check(games.Anna.yourSeat === 0 && games.Ben.yourSeat === 1, 'Partie gestartet, jeder kennt seinen Platz');
const openStarted = await (await fetch(`${base}/rooms/open`, { headers: { Origin: origin } })).json();
check(!openStarted.some((r) => r.code === code), 'gestarteter Raum verschwindet aus /rooms/open');

// Zurücknehmen mit Zustimmung: Anna zieht, bittet ums Zurücknehmen, Ben erlaubt es.
{
  const mover = games.Anna.current[0] === 0 ? anna : ben;
  const other = mover === anna ? ben : anna;
  const own = mover === anna ? games.Anna : games.Ben;
  const moved = mover.next((m) => m.type === 'game' && m.canTakeBack === true);
  mover.send({ type: 'move', version: own.version, move: own.legalMoves[0] });
  await moved;
  const asked = other.next((m) => m.type === 'game' && m.takeBack?.status === 'pending');
  mover.send({ type: 'takeBack' });
  check((await asked).legalMoves.length === 0, 'Bitte ums Zurücknehmen kommt an, die Partie ruht');
  const doneA = anna.next((m) => m.type === 'game' && m.takeBack?.status === 'accepted');
  const doneB = ben.next((m) => m.type === 'game' && m.takeBack?.status === 'accepted');
  other.send({ type: 'answerTakeBack', accept: true });
  games = { Anna: await doneA, Ben: await doneB };
  check(games.Anna.view.board.every((cell) => cell === null), 'Nach Zustimmung ist der Zug zurückgenommen');
}

// Ganze Partie: Wer dran ist, nimmt den ersten erlaubten Zug.
for (let turn = 0; turn < 9 && !games.Anna.result; turn++) {
  const mover = games.Anna.current[0] === 0 ? anna : ben;
  const own = mover === anna ? games.Anna : games.Ben;
  annaGame = anna.next((m) => m.type === 'game' && m.version > games.Anna.version);
  benGame = ben.next((m) => m.type === 'game' && m.version > games.Ben.version);
  mover.send({ type: 'move', version: own.version, move: own.legalMoves[0] });
  games = { Anna: await annaGame, Ben: await benGame };
}
check(games.Anna.result !== null, `Partie zu Ende: ${JSON.stringify(games.Anna.result)}`);

// Wiedereinstieg: Ben trennt die Verbindung und kommt mit derselben Kennung zurück.
ben.close();
await anna.next((m) => m.type === 'room' && m.members.some((x) => x.id === 'm2' && !x.connected));
const benAgain = await client(code, 'Ben', ben.token);
check(benAgain.you === 'm2', 'Ben kommt mit derselben Kennung zurück auf seinen Platz');

// Revanche gegen einen Bot (schwer) bei Vier in einer Reihe: Wie lange denkt er nach?
await anna.step({ type: 'toLobby' }, (m) => m.phase === 'lobby');
await anna.step({ type: 'setGame', gameId: 'four-in-a-row' }, (m) => m.lobby.gameId === 'four-in-a-row');
await benAgain.step({ type: 'leaveSeat' }, (m) => m.lobby.seats.every((s) => s.memberId !== 'm2'));
await anna.step({ type: 'setSeat', index: 1, seat: { bot: 'hard' } }, (m) => m.lobby.seats[1]?.kind === 'bot');
annaGame = anna.next((m) => m.type === 'game');
anna.send({ type: 'start' });
let game = await annaGame;
const times = [];
for (let turn = 0; turn < 4 && !game.result; turn++) {
  const reply = anna.next((m) => m.type === 'game' && m.current.includes(0) && m.version > game.version + 1, 20_000);
  const started = Date.now();
  anna.send({ type: 'move', version: game.version, move: game.legalMoves[Math.floor(game.legalMoves.length / 2)] });
  game = await reply;
  times.push(Date.now() - started);
}
check(times.length > 0, `Bot „schwer“ antwortet nach ${times.join(', ')} ms`);
if (!game.result) {
  const undone = anna.next((m) => m.type === 'game' && m.takeBack?.status === 'accepted');
  anna.send({ type: 'takeBack' });
  check((await undone).current.includes(0), 'Gegen den Bot: Zurücknehmen ohne Abstimmung');
}

// Zeitablauf über den Wecker des Servers: Tic-Tac-Toe „schnell“ (5 s pro Zug), Anna zieht nicht.
await anna.step({ type: 'toLobby' }, (m) => m.phase === 'lobby');
await anna.step({ type: 'setGame', gameId: 'tic-tac-toe' }, (m) => m.lobby.gameId === 'tic-tac-toe');
await anna.step({ type: 'setTime', time: 'fast' }, (m) => m.lobby.time === 'fast');
await anna.step({ type: 'setSeat', index: 1, seat: 'open' }, (m) => m.lobby.seats[1]?.kind === 'human' && m.lobby.seats[1].memberId === null);
await benAgain.step({ type: 'takeSeat', index: 1 }, (m) => m.lobby.seats[1]?.memberId === 'm2');
annaGame = anna.next((m) => m.type === 'game');
anna.send({ type: 'start' });
game = await annaGame;
const waitStarted = Date.now();
const timedOut = await benAgain.next((m) => m.type === 'game' && m.current.includes(1) && m.legalMoves.length > 0, 10_000);
const waited = Date.now() - waitStarted;
check(timedOut.current.includes(1) && waited >= 5000 && waited < 8000, `Zeitablauf nach ${waited} ms: Für Anna hat der Bot gezogen`);

// Emoji-Reaktion kommt beim anderen an.
const signal = benAgain.next((m) => m.type === 'signal');
anna.send({ type: 'react', emoji: '👏' });
check((await signal).value === '👏', 'Emoji-Reaktion kommt an');

anna.close();
benAgain.close();

// Fremder Client ohne Webseite (#334): ohne Kennung abgewiesen, mit Kennung eine ganze Partie gegen einen Bot.
const noId = await fetch(`${base}/rooms`, { method: 'POST' });
check(noId.status === 403, 'ohne Origin und ohne Kennung kein Raum');
const fakeSite = await fetch(`${base}/rooms?client=smoke-cli`, { method: 'POST', headers: { Origin: 'https://fremde-seite.example' } });
check(fakeSite.status === 403, 'eine fremde Webseite kann sich nicht als Programm ausgeben');
const cliCreated = await fetch(`${base}/rooms?client=smoke-cli`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic: false }) });
const cliCode = (await cliCreated.json()).code;
check(cliCreated.status === 201 && typeof cliCode === 'string', `fremder Client legt Raum an: ${cliCode}`);
const cliOpen = await fetch(`${base}/rooms/open?client=smoke-cli`);
check(cliOpen.status === 200, 'fremder Client sieht die offenen Räume');
const cli = await client(cliCode, 'Kommandozeile', undefined, { cli: 'smoke-cli' });
check(cli.you === 'm1', 'fremder Client ist angemeldet und leitet den Raum');
await cli.step({ type: 'setGame', gameId: 'tic-tac-toe' }, (m) => m.lobby.gameId === 'tic-tac-toe');
await cli.step({ type: 'setSeat', index: 1, seat: { bot: 'easy' } }, (m) => m.lobby.seats[1]?.kind === 'bot');
await cli.step({ type: 'takeSeat', index: 0 }, (m) => m.lobby.seats[0]?.memberId === cli.you);
let cliGame = await (() => {
  const started = cli.next((m) => m.type === 'game');
  cli.send({ type: 'start' });
  return started;
})();
for (let turn = 0; turn < 20 && !cliGame.result; turn++) {
  if (!cliGame.current.includes(0) || cliGame.legalMoves.length === 0) {
    cliGame = await cli.next((m) => m.type === 'game' && m.version > cliGame.version);
    continue;
  }
  if (turn < 2) check(cliGame.moveLabels?.length === cliGame.legalMoves.length && cliGame.moveLabels[0].startsWith('Kreuz auf'), `Zugtexte kommen mit (#335): ${cliGame.moveLabels?.[0]}`);
  const next = cli.next((m) => m.type === 'game' && m.version > cliGame.version);
  cli.send({ type: 'move', version: cliGame.version, move: cliGame.legalMoves[0] });
  cliGame = await next;
}
check(cliGame.result !== null, `fremder Client spielt eine ganze Partie gegen den Bot: ${JSON.stringify(cliGame.result)}`);

// Ratenbegrenzung: Ein Schwall von Nachrichten wird gebremst.
const tooFast = cli.next((m) => m.type === 'error' && m.code === 'tooFast', 5000).catch(() => null);
for (let i = 0; i < 80; i++) cli.send({ type: 'ping' });
check((await tooFast) !== null, 'zu viele Nachrichten eines fremden Clients werden gebremst');
cli.close();

console.log(failures === 0 ? '\nAlles in Ordnung.' : `\n${failures} Prüfung(en) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
