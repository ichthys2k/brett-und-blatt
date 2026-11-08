// Rauchtest für das Schloss der Ausweise (#138) gegen den laufenden Spieleserver.
// Aufruf: node apps/server/scripts/schloss.mjs [http://127.0.0.1:8787]
// Der Server braucht `PASS_PEPPER` (lokal in apps/server/.dev.vars, im Betrieb `wrangler secret put PASS_PEPPER`).
// Spricht das Protokoll direkt: Beweis (`auth`) und Notfallwert (`recovery`) sind hier Zufallswerte, die PBKDF2-Rechnung
// des Browsers ist in packages/ui/test/lock.test.ts geprüft.

const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const origin = 'http://localhost:5173';
let failures = 0;
const check = (ok, text) => {
  console.log(`${ok ? '✓' : '✗'} ${text}`);
  if (!ok) failures++;
};

const b64u = (n) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString('base64url');
const id = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');
const auth = b64u(32);
const wrong = b64u(32);
const recovery = b64u(32);
const newAuth = b64u(32);

async function post(action, body) {
  const res = await fetch(`${base}/schloss/${id}/${action}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function exists() {
  const res = await fetch(`${base}/schloss/${id}`, { headers: { Origin: origin } });
  return (await res.json()).exists;
}

check((await fetch(`${base}/schloss/${id}`)).status === 403, 'ohne erlaubte Herkunft: 403');
check((await exists()) === false, 'neues Schloss: gibt es noch nicht');

const made = await post('anlegen', { auth, recovery });
if (made.status === 503) {
  console.log('✗ Server hat keinen Pfeffer (PASS_PEPPER fehlt)');
  process.exit(1);
}
check(made.status === 200 && typeof made.body.share === 'string', 'anlegen liefert den Serveranteil');
check((await post('anlegen', { auth, recovery })).status === 409, 'zweites Anlegen: 409');
check((await post('speichern', { auth, data: 'QUJD', rev: 0 })).status === 200, 'speichern mit richtigem Beweis');
check((await exists()) === true, 'Schloss ist da');

const opened = await post('oeffnen', { auth });
check(opened.status === 200 && opened.body.share === made.body.share && opened.body.data === 'QUJD' && opened.body.rev === 1, 'öffnen gibt Serveranteil, Inhalt und Nummer');

const miss = await post('oeffnen', { auth: wrong });
check(miss.status === 401 && miss.body.left === 9, 'falscher Beweis: 401, noch 9 Versuche');
for (let i = 0; i < 4; i++) await post('oeffnen', { auth: wrong });
const waiting = await post('oeffnen', { auth });
check(waiting.status === 423 && waiting.body.locked === false, 'nach fünf Fehlern wartet das Schloss, auch für den richtigen Beweis');

const reset = await post('zuruecksetzen', { recovery, newAuth, data: 'REVG' });
check(reset.status === 200 && reset.body.share === made.body.share, 'Notfallkarte setzt zurück');
check((await post('oeffnen', { auth })).status === 401, 'alter Beweis gilt nicht mehr');
const again = await post('oeffnen', { auth: newAuth });
check(again.status === 200 && again.body.data === 'REVG', 'neuer Beweis öffnet, Zähler ist zurückgesetzt');
check((await post('loeschen', { auth: newAuth })).status === 200, 'löschen mit Beweis');
check((await exists()) === false, 'Schloss ist weg');

console.log(failures === 0 ? '\nAlles in Ordnung.' : `\n${failures} Prüfung(en) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
