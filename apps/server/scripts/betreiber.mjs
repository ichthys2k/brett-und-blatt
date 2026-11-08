// Betreiber-Werkzeug: löscht ein Turnier oder löst eine Klasse auf (Spieleserver, Secret OPERATOR_KEY).
// Aufruf:  OPERATOR_KEY=… node apps/server/scripts/betreiber.mjs <Server-Adresse> turnier <Code>
//          OPERATOR_KEY=… node apps/server/scripts/betreiber.mjs <Server-Adresse> klasse <Code mit sechs Emoji>
// Der Schlüssel steht nur in der Umgebungsvariable, nie in der Befehlszeile, im Repo oder im Chat.
const [server, kind, target] = process.argv.slice(2);
const key = process.env.OPERATOR_KEY;
if (!server || !['turnier', 'klasse'].includes(kind) || !target || !key) {
  console.error('Aufruf: OPERATOR_KEY=… node apps/server/scripts/betreiber.mjs <Server-Adresse> turnier|klasse <Code>');
  process.exit(2);
}
const response = await fetch(`${server.replace(/\/$/, '')}/betreiber/${kind}/${encodeURIComponent(target)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } });
const text = await response.text();
console.log(response.status, text);
process.exit(response.ok ? 0 : 1);
