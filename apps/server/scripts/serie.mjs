/**
 * Rauchtest gegen den laufenden Spieleserver: Serien (#205) und Übergabe der Leitung (#203).
 * Legt eine Serie an, ordnet ein Turnier vor Ort zu (falscher Code wird abgelehnt), spielt es durch und prüft,
 * dass die Rangliste von selbst erscheint; übergibt dann die Leitung von Turnier und Serie an ein zweites Gerät.
 * Aufruf: node apps/server/scripts/serie.mjs [Adresse]
 */
const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const origin = 'http://localhost:5173';
const H = { 'Content-Type': 'application/json', Origin: origin };
const A = 'kennung-geraet-a-000001';
const B = 'kennung-geraet-b-000002';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (what, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${what}${ok ? '' : ` ${extra}`}`);
  if (!ok) failed++;
};
const call = async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { ...H, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json().catch(() => null) };
};

async function connect(code, token) {
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/turniere/${code}`, { headers: { Origin: origin } });
  const box = { view: null, errors: [], send: (m) => ws.send(JSON.stringify(m)), close: () => ws.close() };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === 'tournament') {
      box.view = m.view;
      box.closed = false;
    }
    if (m.type === 'closed') box.closed = true;
    if (m.type === 'error') box.errors.push(m.message);
    if (m.type === 'leaderCode') box.leaderCode = m;
  };
  await new Promise((r) => (ws.onopen = r));
  box.send({ type: 'hello', protocol: 1, token, name: 'Gerät', avatar: '🦊' });
  await sleep(300);
  return box;
}

// Serie anlegen
const created = await call('/serien', { method: 'POST', body: { name: 'Kickerliga', scheme: 'linear', token: A } });
check('Serie angelegt', created.status === 201 && created.body?.code);
const series = created.body.code;
const lead = await call(`/serien/${series}`, { token: A });
check('Leitung sieht den Zuordnungscode', lead.body?.isLeader === true && /^[A-Z0-9]{8}-[A-Z0-9]{8}$/.test(lead.body?.link ?? ''));
check('öffentlich ohne Code', (await call(`/serien/${series}`)).body?.link === undefined);

// Turnier vor Ort, zuordnen, durchspielen
const tournament = await call('/turniere', { method: 'POST', body: { settings: { name: 'Abend', mode: 'local', sport: 'Darts', format: 'knockout', result: 'winner' }, token: A, name: 'Leitung' } });
const a = await connect(tournament.body.code, A);
a.send({ type: 'attachSeries', link: 'AAAAAAAA-BBBBBBBB' });
await sleep(300);
check('falscher Zuordnungscode abgelehnt', a.errors.length === 1);
a.send({ type: 'attachSeries', link: lead.body.link });
await sleep(300);
check('Turnier der Serie zugeordnet', a.view?.series === series);
check('Schlüssel nicht in der Sicht', !JSON.stringify(a.view).includes(lead.body.link.slice(9)));
a.send({ type: 'addEntrants', names: ['Anna', 'Ben', 'Cem', 'Dina'] });
await sleep(200);
a.send({ type: 'start' });
await sleep(300);
for (let round = 0; round < 6 && a.view.phase !== 'finished'; round++) {
  for (const m of a.view.matches.filter((x) => !x.outcome && x.slots.every((s) => s.player))) {
    a.send({ type: 'enterResult', match: m.id, winner: 0 });
    await sleep(200);
  }
}
check('Turnier beendet', a.view.phase === 'finished');
await sleep(800);
const after = await call(`/serien/${series}`);
check('Rangliste erschien von selbst', after.body?.tournaments?.length === 1 && after.body?.standings?.length === 4);

// Leitung des Turniers übergeben
a.send({ type: 'leaderCode' });
await sleep(300);
const b = await connect(tournament.body.code, B);
check('Gerät B hat vorher keinen Zugang', b.closed === true && !b.view);
b.send({ type: 'takeLeader', code: 'FALSCH22' });
await sleep(300);
check('falscher Übergabecode abgelehnt', b.errors.length === 1);
b.send({ type: 'takeLeader', code: a.leaderCode?.code ?? '' });
await sleep(400);
check('Gerät B ist jetzt Hauptleitung', b.view?.mayDelete === true);
a.send({ type: 'hello', protocol: 1, token: A, name: 'Gerät', avatar: '🦊' });
await sleep(300);
check('Gerät A hat danach keinen Zugang mehr', a.closed === true);
a.close();
b.close();

// Leitung der Serie übergeben
const issued = await call(`/serien/${series}`, { method: 'POST', token: A, body: { action: 'transfer' } });
check('Übergabecode der Serie', issued.status === 200 && issued.body?.code);
check('Fremder ohne Code abgelehnt', (await call(`/serien/${series}`, { method: 'POST', token: B, body: { action: 'take', code: 'FALSCH22' } })).status === 400);
check('Gerät B übernimmt die Serie', (await call(`/serien/${series}`, { method: 'POST', token: B, body: { action: 'take', code: issued.body.code } })).status === 200);
check('Gerät A darf nicht mehr verwalten', (await call(`/serien/${series}`, { method: 'POST', token: A, body: { action: 'rename', name: 'Hack' } })).status === 400);
check('ohne Origin gesperrt', (await fetch(`${base}/serien/${series}`)).status === 403);
check('Serie gelöscht', (await call(`/serien/${series}`, { method: 'DELETE', token: B })).status === 200 && (await call(`/serien/${series}`)).status === 404);

console.log(failed === 0 ? 'Alles in Ordnung.' : `${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
