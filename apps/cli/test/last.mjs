// Lastmessung (#339): Wie viele Nachrichten und Zeichen kosten eine Partie für einen Client?
// Spielt mit dem Text-Client ganze Partien gegen Server-Bots und zählt an der WebSocket mit.
//   node apps/cli/test/last.mjs [http://127.0.0.1:8787] [tic-tac-toe,four-in-a-row,chess,mau-mau]
import { newToken } from '../src/connection.mjs';
import { startClient } from '../src/play.mjs';

const server = process.argv[2] ?? 'http://127.0.0.1:8787';
const games = (process.argv[3] ?? 'tic-tac-toe,four-in-a-row,chess,mau-mau').split(',');

// Zähler um die eingebaute WebSocket legen: empfangene und gesendete Nachrichten samt Zeichen.
const counts = { in: 0, inChars: 0, out: 0, outChars: 0 };
const Native = globalThis.WebSocket;
globalThis.WebSocket = class extends Native {
  constructor(...args) {
    super(...args);
    this.addEventListener('message', (e) => {
      counts.in++;
      counts.inChars += String(e.data).length;
    });
  }
  send(data) {
    counts.out++;
    counts.outChars += String(data).length;
    super.send(data);
  }
};

const rows = [];
for (const game of games) {
  Object.assign(counts, { in: 0, inChars: 0, out: 0, outChars: 0 });
  const started = Date.now();
  const client = await startClient({ server, code: null, token: newToken(), name: 'Messung', game, bot: 'easy', start: true, auto: true, autoDelayMs: 130 }, { print: () => {} });
  const result = await Promise.race([client.done, new Promise((r) => setTimeout(() => r('timeout'), 240_000))]);
  if (result === 'timeout') client.connection.close();
  rows.push({ game, result: result === 'timeout' ? 'abgebrochen' : result?.kind, seconds: Math.round((Date.now() - started) / 1000), ...counts, avgIn: Math.round(counts.inChars / Math.max(counts.in, 1)) });
}
console.table(rows);
console.log(JSON.stringify(rows));
process.exit(0);
