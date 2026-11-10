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
check('Antragsteller sieht seinen Antrag', (await post('/org-antrag', { action: 'status', token: D })).body?.requests?.[0]?.status === 'open');
check('Liste ohne Schlüssel abgelehnt', (await fetch(`${base}/betreiber/antraege`, { headers: H })).status === 401);
const list = await operatorCall('GET', '/betreiber/antraege');
const mine = list.body?.antraege?.find((r) => r.orgName === 'Schachclub');
check('Betreiber sieht den Antrag ohne Kennung', mine && !JSON.stringify(list.body).includes('kennung-'));
check('Ablehnung', (await operatorCall('POST', `/betreiber/antrag/${mine.id}`, { approve: false, note: 'Bitte genauer beschreiben' })).status === 200);
const rejected = (await post('/org-antrag', { action: 'status', token: D })).body?.requests?.[0];
check('Antragsteller sieht Ablehnung mit Anmerkung', rejected?.status === 'rejected' && rejected?.note === 'Bitte genauer beschreiben');
const second2 = await apply();
const list2 = await operatorCall('GET', '/betreiber/antraege');
const approved = await operatorCall('POST', `/betreiber/antrag/${list2.body.antraege[0].id}`, { approve: true });
check('Freigabe legt die Organisation an', approved.status === 200 && approved.body?.code, JSON.stringify(approved));
const mineNow = (await post('/org-antrag', { action: 'status', token: D })).body?.requests?.find((r) => r.status === 'approved');
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

console.log(failed === 0 ? 'Alles in Ordnung.' : `${failed} Fehler.`);
process.exit(failed === 0 ? 0 : 1);
