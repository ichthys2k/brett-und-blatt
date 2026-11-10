/**
 * Rauchtest gegen den laufenden Spieleserver: Organisationen (#217, #227).
 * Der Server braucht das Secret OPERATOR_KEY (lokal in apps/server/.dev.vars); der Test bekommt es als Umgebungsvariable.
 * Aufruf: OPERATOR_KEY=… node apps/server/scripts/org.mjs [Adresse]
 */
const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const key = process.env.OPERATOR_KEY;
if (!key) {
  console.error('OPERATOR_KEY fehlt.');
  process.exit(2);
}
const H = { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' };
const A = 'kennung-betreiber-0001';
const B = 'kennung-leitung-000002';
const C = 'kennung-gast-0000003';
let failed = 0;
const check = (what, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${what}${ok ? '' : ` ${extra}`}`);
  if (!ok) failed++;
};
const post = async (path, body, auth) => {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { ...H, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json().catch(() => null) };
};

const denied = await post('/org', { name: 'SV Beispiel', kind: 'verein', founder: { token: A, name: 'Bea', avatar: '🦊' } });
check('Anlegen ohne Schlüssel abgelehnt', denied.status === 401, JSON.stringify(denied));
const created = await post('/org', { name: 'SV Beispiel', kind: 'verein', founder: { token: A, name: 'Bea', avatar: '🦊' } }, key);
check('Anlegen mit Schlüssel', created.status === 201 && created.body?.code, JSON.stringify(created));
const code = encodeURIComponent(created.body.code);
const act = (token, body) => post(`/org/${code}`, { token, ...body });

const first = await act(A, { action: 'view' });
check('Gründer ist Betreiber', first.body?.view?.me?.roles?.[0] === 'operator');
check('Fremder sieht keine Mitglieder', (await act(C, { action: 'view' })).body?.view?.members?.length === 0);

const invite = await act(A, { action: 'invite', roles: ['lead'] });
check('Einladung für die Leitung', /^[2-9A-HJ-NP-Z]{8}$/.test(invite.body?.invite?.code ?? ''));
const bad = await act(B, { action: 'redeem', name: 'Lea', invite: 'AAAAAAAA' });
check('falscher Code abgelehnt', bad.status === 409);
const redeem = await act(B, { action: 'redeem', name: 'Lea', avatar: '🐻', invite: invite.body.invite.code });
check('Leitung eingelöst', redeem.body?.view?.me?.roles?.[0] === 'lead');
check('Code nur einmal gültig', (await act(C, { action: 'redeem', name: 'Cem', invite: invite.body.invite.code })).status === 409);

const notAllowed = await act(B, { action: 'invite', roles: ['operator'] });
check('Leitung darf keinen Betreiber ernennen', notAllowed.status === 409);
const ref = await act(B, { action: 'invite', roles: ['referee'] });
check('Leitung lädt Schiedsrichter ein', ref.body?.invite?.code);
await act(C, { action: 'redeem', name: 'Cem', invite: ref.body.invite.code });
const view = (await act(A, { action: 'view' })).body.view;
const cem = view.members.find((m) => m.name === 'Cem');
check('Mitglieder und Protokoll sichtbar', view.members.length === 3 && view.log.length >= 3);
check('Sicht ohne Kennungen', !JSON.stringify(view).includes('kennung-'));

const offer = await act(A, { action: 'offer', id: cem.id, roles: ['registration'] });
check('Angebot noch ohne Wirkung', offer.status === 200 && (await act(C, { action: 'view' })).body.view.me.roles.join() === 'referee');
const accepted = await act(C, { action: 'accept' });
check('Angebot angenommen', accepted.body?.view?.me?.roles?.includes('registration'));
check('Entzug', (await act(A, { action: 'revoke', id: cem.id, roles: ['registration'] })).body?.view?.members?.find((m) => m.id === cem.id)?.roles?.join() === 'referee');
check('Leitung darf nicht entfernen', (await act(B, { action: 'remove', id: cem.id })).status === 409);
check('Betreiber entfernt', (await act(A, { action: 'remove', id: cem.id })).body?.view?.members?.length === 2);
check('einziger Betreiber kann nicht gehen', (await act(A, { action: 'leave' })).status === 409);

const gone = await fetch(`${base}/betreiber/org/${code}`, { method: 'DELETE', headers: { ...H, Authorization: `Bearer ${key}` } });
check('Betreiber löscht die Organisation', gone.status === 200);
check('danach nicht mehr da', (await act(A, { action: 'view' })).status === 404);


// Antrag und Freigabe (#228)
const D = 'kennung-antrag-000004';
const operatorCall = async (method, path, body) => {
  const response = await fetch(`${base}${path}`, { method, headers: { ...H, Authorization: `Bearer ${key}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json().catch(() => null) };
};
const apply = (extra = {}) => post('/org-antrag', { action: 'submit', token: D, name: 'Dora', avatar: '🐻', orgName: 'Schachclub', kind: 'verein', purpose: 'Unser Vereinsturnier am Freitag', ...extra });
const first2 = await apply();
check('Antrag gestellt', first2.status === 201 && first2.body?.id, JSON.stringify(first2));
check('zweiter offener Antrag abgelehnt', (await apply()).status === 409);
check('Antragsteller sieht seinen Antrag', (await post('/org-antrag', { action: 'status', token: D })).body?.requests?.at(-1)?.status === 'open');
check('Liste ohne Schlüssel abgelehnt', (await fetch(`${base}/betreiber/antraege`, { headers: H })).status === 401);
const list = await operatorCall('GET', '/betreiber/antraege');
const mine = list.body?.antraege?.find((r) => r.orgName === 'Schachclub');
check('Betreiber sieht den Antrag ohne Kennung', mine && !JSON.stringify(list.body).includes('kennung-'));
check('Ablehnung', (await operatorCall('POST', `/betreiber/antrag/${mine.id}`, { approve: false, note: 'Bitte genauer beschreiben' })).status === 200);
const rejected = (await post('/org-antrag', { action: 'status', token: D })).body?.requests?.at(-1);
check('Antragsteller sieht Ablehnung mit Anmerkung', rejected?.status === 'rejected' && rejected?.note === 'Bitte genauer beschreiben');
const second2 = await apply();
const list2 = await operatorCall('GET', '/betreiber/antraege');
const approved = await operatorCall('POST', `/betreiber/antrag/${list2.body.antraege[0].id}`, { approve: true });
check('Freigabe legt die Organisation an', approved.status === 200 && approved.body?.code, JSON.stringify(approved));
const mineNow = (await post('/org-antrag', { action: 'status', token: D })).body?.requests?.filter((r) => r.status === 'approved').at(-1);
check('Antragsteller bekommt den Code', mineNow?.code === approved.body.code);
const orgCode = encodeURIComponent(approved.body.code);
check('Antragsteller ist Betreiber', (await post(`/org/${orgCode}`, { token: D, action: 'view' })).body?.view?.me?.roles?.[0] === 'operator');
check('Sperren', (await operatorCall('POST', `/betreiber/org-sperre/${orgCode}`, { blocked: true })).status === 200);
const blockedView = (await post(`/org/${orgCode}`, { token: D, action: 'view' })).body?.view;
check('gesperrt: keine Rechte', blockedView?.status === 'blocked' && blockedView?.me?.capabilities?.length === 0);
check('gesperrt: keine Einladung', (await post(`/org/${orgCode}`, { token: D, action: 'invite', roles: ['referee'] })).status === 409);
check('Entsperren', (await operatorCall('POST', `/betreiber/org-sperre/${orgCode}`, { blocked: false })).status === 200);
check('Auflösen', (await operatorCall('DELETE', `/betreiber/org/${orgCode}`)).status === 200);
void second2;


// Turniere einer Organisation (#230)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const E = 'kennung-gast-0000005';
const created2 = await post('/org', { name: 'SV Turnier', kind: 'verein', founder: { token: A, name: 'Bea', avatar: '🦊' } }, key);
const org2 = created2.body.code;
const act2 = (token, body) => post(`/org/${encodeURIComponent(org2)}`, { token, ...body });
const refInvite = await act2(A, { action: 'invite', roles: ['referee'] });
await act2(C, { action: 'redeem', name: 'Cem', invite: refInvite.body.invite.code });
const regInvite = await act2(A, { action: 'invite', roles: ['registration'] });
await act2(E, { action: 'redeem', name: 'Emil', invite: regInvite.body.invite.code });
const orgSettings = { name: 'Vereinsabend', mode: 'local', sport: 'Darts', format: 'knockout', result: 'winner', checkin: true, org: org2 };
const denied2 = await post('/turniere', { settings: orgSettings, token: C, name: 'Cem' });
check('Turnier der Gruppe: Schiedsrichter darf nicht anlegen', denied2.status === 403, JSON.stringify(denied2));
const made = await post('/turniere', { settings: orgSettings, token: A, name: 'Bea' });
check('Turnier der Gruppe: Betreiber legt an', made.status === 201, JSON.stringify(made));
check('ungültiger Gruppencode abgelehnt', (await post('/turniere', { settings: { ...orgSettings, org: 'kein Code' }, token: A, name: 'Bea' })).status === 400);
async function connectT(code, token) {
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/turniere/${code}`, { headers: { Origin: 'http://localhost:5173' } });
  const box = { view: null, errors: [], closed: false, send: (m) => ws.send(JSON.stringify(m)), close: () => ws.close() };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === 'tournament') box.view = m.view;
    if (m.type === 'closed') box.closed = true;
    if (m.type === 'error') box.errors.push(m.message);
  };
  await new Promise((r) => (ws.onopen = r));
  box.send({ type: 'hello', protocol: 1, token, name: 'Gerät', avatar: '🦊' });
  await sleep(500);
  return box;
}
const tc = made.body.code;
const asReg = await connectT(tc, E);
check('Anmeldung sieht das Turnier mit seiner Rolle', asReg.view?.orgRoles?.[0] === 'registration', JSON.stringify(asReg.view?.orgRoles));
asReg.send({ type: 'addEntrants', names: ['Anna', 'Ben', 'Cem', 'Dora'] });
await sleep(400);
check('Anmeldung trägt Teilnehmer ein', asReg.view?.players?.length === 4, asReg.errors.join());
const asRef = await connectT(tc, C);
check('Schiedsrichter sieht das Turnier', asRef.view?.orgRoles?.[0] === 'referee');
asRef.send({ type: 'addEntrants', names: ['Zora'] });
await sleep(400);
check('Schiedsrichter darf keine Teilnehmer eintragen', asRef.errors.length === 1);
const asStranger = await connectT(tc, 'kennung-fremder-000099');
check('Fremder sieht das Turnier nicht', asStranger.closed === true && !asStranger.view);
const asOperator = await connectT(tc, A);
check('Hauptleitung leitet', asOperator.view?.isLeader === true);
// Serien einer Organisation (#231)
const getSeries = async (code, token) => {
  const response = await fetch(`${base}/serien/${code}`, { headers: { ...H, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  return { status: response.status, body: await response.json().catch(() => null) };
};
const seriesDenied = await post('/serien', { name: 'Kickerliga', scheme: 'linear', token: C, org: org2 });
check('Serie der Gruppe: Schiedsrichter darf nicht anlegen', seriesDenied.status === 403, JSON.stringify(seriesDenied));
check('Serie mit ungültigem Gruppencode abgelehnt', (await post('/serien', { name: 'Kickerliga', scheme: 'linear', token: A, org: 'kein Code' })).status === 400);
const seriesMade = await post('/serien', { name: 'Kickerliga', scheme: 'linear', token: A, org: org2 });
check('Serie der Gruppe: Betreiber legt an', seriesMade.status === 201, JSON.stringify(seriesMade));
const leadInvite = await act2(A, { action: 'invite', roles: ['lead'] });
const LEAD2 = 'kennung-leitung-org-0001';
await act2(LEAD2, { action: 'redeem', name: 'Lea', invite: leadInvite.body.invite.code });
const leadView = await getSeries(seriesMade.body.code, LEAD2);
check('Leitung der Gruppe leitet die Serie mit', leadView.body?.isLeader === true && leadView.body?.org === org2 && typeof leadView.body?.link === 'string', JSON.stringify(leadView.body));
check('Schiedsrichter leitet die Serie nicht', (await getSeries(seriesMade.body.code, C)).body?.isLeader === false);
const renamed = await fetch(`${base}/serien/${seriesMade.body.code}`, { method: 'POST', headers: { ...H, Authorization: `Bearer ${LEAD2}` }, body: JSON.stringify({ action: 'rename', name: 'Kickerliga 2' }) });
check('Leitung der Gruppe benennt die Serie um', renamed.status === 200);
const transfer = await fetch(`${base}/serien/${seriesMade.body.code}`, { method: 'POST', headers: { ...H, Authorization: `Bearer ${A}` }, body: JSON.stringify({ action: 'transfer' }) });
check('Übergabe gibt es bei einer Serie der Gruppe nicht', transfer.status === 400);
await operatorCall('DELETE', `/betreiber/serie/${seriesMade.body.code}`);
for (const box of [asReg, asRef, asStranger, asOperator]) box.close();

// Klassen als Gruppen (#232)
const T1 = 'kennung-lehrkraft-0001';
const T2 = 'kennung-lehrkraft-0002';
const K1 = 'kennung-schueler-00003';
const classMade = await post('/klassen', { token: T1, name: 'Frau Alt', avatar: '🦊', className: 'Klasse 5a' });
check('Klasse angelegt', classMade.status === 201 && classMade.body?.code, JSON.stringify(classMade));
const classCode = classMade.body.code;
const classAct2 = (token, body) => post(`/klassen/${encodeURIComponent(classCode)}`, { token, ...body });
await classAct2(T2, { action: 'join', name: 'Herr Neu', avatar: '🐻' });
await classAct2(K1, { action: 'join', name: 'Kind', avatar: '🐸' });
const classView1 = (await classAct2(T1, { action: 'view' })).body.view;
await classAct2(T1, { action: 'lead', id: classView1.members.find((m) => m.name === 'Herr Neu').id, lead: true });
const classSettings = { name: 'Klassenturnier', mode: 'local', sport: 'Darts', format: 'knockout', result: 'winner', org: classCode };
check('Klassenturnier: Schüler darf nicht anlegen', (await post('/turniere', { settings: classSettings, token: K1, name: 'Kind' })).status === 403);
const classTournament = await post('/turniere', { settings: classSettings, token: T1, name: 'Frau Alt' });
check('Klassenturnier: Klassenleitung legt an', classTournament.status === 201, JSON.stringify(classTournament));
const asTeacher2 = await connectT(classTournament.body.code, T2);
check('zweite Lehrkraft leitet das Klassenturnier', asTeacher2.view?.isLeader === true && asTeacher2.view?.orgRoles?.[0] === 'lead', JSON.stringify(asTeacher2.view?.orgRoles));
const asFirst = await connectT(classTournament.body.code, T1);
check('dienstälteste Lehrkraft ist Betreiber der Klasse', asFirst.view?.mayDelete === true && asFirst.view?.orgRoles?.[0] === 'operator');
const asKid = await connectT(classTournament.body.code, K1);
check('Schüler sieht das Klassenturnier nicht', asKid.closed === true && !asKid.view);
for (const box of [asTeacher2, asFirst, asKid]) box.close();
await operatorCall('DELETE', `/betreiber/turnier/${classTournament.body.code}`);
await operatorCall('DELETE', `/betreiber/klasse/${encodeURIComponent(classCode)}`);

await operatorCall('DELETE', `/betreiber/turnier/${tc}`);
await operatorCall('DELETE', `/betreiber/org/${encodeURIComponent(org2)}`);

console.log(failed === 0 ? 'Alles in Ordnung.' : `${failed} Fehler.`);
process.exit(failed === 0 ? 0 : 1);
