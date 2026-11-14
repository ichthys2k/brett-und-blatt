// Prüfstein für fremde Clients (#336): Der Text-Client spielt über den laufenden Spieleserver
// ganze Partien gegen Server-Bots, nur mit dem offenen Protokoll – und steigt nach einem
// Verbindungsabbruch mitten in der Partie wieder auf seinem Platz ein.
// Aufruf (Server läuft, z. B. `corepack pnpm --filter @brett-und-blatt/server dev`):
//   node apps/cli/test/partie.mjs [http://127.0.0.1:8787]
import { newToken } from '../src/connection.mjs';
import { startClient } from '../src/play.mjs';

const server = process.argv[2] ?? 'http://127.0.0.1:8787';
let failures = 0;
function check(ok, text) {
  console.log(`${ok ? '✓' : '✗'} ${text}`);
  if (!ok) failures++;
}

async function play(game, { dropAfterMoves = 0 } = {}) {
  const output = [];
  const client = await startClient(
    { server, code: null, token: newToken(), name: 'Prüfstein', game, bot: 'easy', start: true, auto: true },
    { print: (text) => output.push(text) },
  );
  let welcomes = 0;
  let moves = 0;
  let dropped = false;
  client.connection.on('welcome', () => welcomes++);
  if (dropAfterMoves > 0) {
    // Nach einigen eigenen Zügen das „Netz“ kappen; der Client muss allein zurückfinden.
    const original = client.connection.send.bind(client.connection);
    client.connection.send = (message) => {
      original(message);
      if (message.type === 'move' && ++moves === dropAfterMoves && !dropped) {
        dropped = true;
        setTimeout(() => client.connection.drop(), 0);
      }
    };
  }
  const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), 60_000));
  const result = await Promise.race([client.done, timeout]);
  return { result, output: output.join('\n'), welcomes, dropped, you: client.connection.you, client };
}

const ttt = await play('tic-tac-toe', { dropAfterMoves: 1 });
check(ttt.result && ttt.result !== 'timeout', `Tic-Tac-Toe gegen den Bot zu Ende gespielt: ${JSON.stringify(ttt.result)}`);
check(/Kreuz auf/.test(ttt.output), 'Zugliste zeigt die Zugtexte des Servers');
check(ttt.dropped && ttt.welcomes >= 1 && /Wieder verbunden/.test(ttt.output), 'nach dem Abbruch wieder auf dem eigenen Platz');
if (failures) console.log(ttt.output);

const mau = await play('mau-mau');
check(mau.result && mau.result !== 'timeout', `Mau-Mau (verdeckte Karten) gegen den Bot zu Ende gespielt: ${JSON.stringify(mau.result)}`);
check(/spielen|Karte ziehen/.test(mau.output), 'Kartenzüge kommen als Text');
if (failures) console.log(mau.output.slice(-3000));

console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen.` : '\nAlles in Ordnung.');
process.exit(failures ? 1 : 0);
