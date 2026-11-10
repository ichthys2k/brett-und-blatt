import { describe, expect, it } from 'vitest';
import { ORG_INVITE_ATTEMPTS, ORG_INVITE_BLOCK_MS, ORG_INVITE_TTL_MS, ORG_LOG_MAX, ORG_MAX_MEMBERS, answerOffer, configureOrg, createInvite, createOrg, leaveOrg, offerRoles, orgCapabilitiesOf, orgView, parseOrgCode, randomOrgCode, redeemInvite, removeOrgMember, revokeInvite, revokeRoles, rolesOf, type OrgState } from '../src/org';

const NOW = 1_000_000;
const A = 'kennung-betreiber-0001';
const B = 'kennung-leitung-000002';
const C = 'kennung-gast-0000003';
const D = 'kennung-gast-0000004';

function org(): OrgState {
  const state = createOrg('🦊🦊🦊🦊🦊🦊', { name: 'SV Beispiel', kind: 'verein' }, { token: A, name: 'Bea', avatar: '🦊' }, NOW);
  if (typeof state === 'string') throw new Error(state);
  return state;
}
const err = (r: unknown) => ('error' in (r as object) ? (r as { error: string }).error : null);
const invited = (state: OrgState, token: string, roles: string[], name = 'Gast') => {
  const made = createInvite(state, A, roles, NOW) as { code: string };
  expect(redeemInvite(state, { token, name }, made.code, NOW)).toEqual({ ok: true });
};

describe('Organisation (#227)', () => {
  it('Anlegen: Anleger wird Betreiber, Eingaben werden geprüft, Code lässt sich lesen', () => {
    const state = org();
    expect(rolesOf(state, A)).toEqual(['operator']);
    expect(orgCapabilitiesOf(state, A)).toContain('manageRoles');
    expect(typeof createOrg('x', { name: '', kind: 'verein' }, { token: A, name: 'Bea' }, NOW)).toBe('string');
    expect(typeof createOrg('x', { name: 'Test', kind: 'firma' }, { token: A, name: 'Bea' }, NOW)).toBe('string');
    const code = randomOrgCode((n) => 3 % n);
    expect(parseOrgCode(code)).toBe(code);
    expect(parseOrgCode(`https://x/#/org/${encodeURIComponent(code)}`)).toBe(code);
    expect(parseOrgCode('abc')).toBeNull();
  });

  it('Einmal-Einladung: Rolle kommt an, der Code gilt nur einmal', () => {
    const state = org();
    const made = createInvite(state, A, ['lead'], NOW) as { code: string; id: string };
    expect(made.code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
    expect(redeemInvite(state, { token: B, name: 'Lea' }, made.code.toLowerCase(), NOW + 1)).toEqual({ ok: true });
    expect(rolesOf(state, B)).toEqual(['lead']);
    expect(err(redeemInvite(state, { token: C, name: 'Cem' }, made.code, NOW + 2))).toBeTruthy();
    expect(rolesOf(state, C)).toEqual([]);
  });

  it('Einladung läuft nach 24 Stunden ab, falsche Codes sperren zeitweise', () => {
    const state = org();
    const made = createInvite(state, A, ['referee'], NOW) as { code: string };
    expect(err(redeemInvite(state, { token: C, name: 'Cem' }, made.code, NOW + ORG_INVITE_TTL_MS + 1))).toBeTruthy();
    const other = org();
    const fresh = createInvite(other, A, ['referee'], NOW) as { code: string };
    for (let i = 0; i < ORG_INVITE_ATTEMPTS; i++) redeemInvite(other, { token: D, name: 'Dina' }, 'AAAAAAAA', NOW + 10);
    expect(err(redeemInvite(other, { token: D, name: 'Dina' }, fresh.code, NOW + 20))).toMatch(/Zu viele/);
    expect(redeemInvite(other, { token: D, name: 'Dina' }, fresh.code, NOW + 10 + ORG_INVITE_BLOCK_MS + 1)).toEqual({ ok: true });
  });

  it('Vergabe nach Regeln: Leitung nur darunter, nicht bei abgeschalteter Vergabe', () => {
    const state = org();
    invited(state, B, ['lead'], 'Lea');
    expect(err(createInvite(state, B, ['lead'], NOW))).toBeTruthy();
    expect(err(createInvite(state, B, ['operator'], NOW))).toBeTruthy();
    expect(err(createInvite(state, B, ['referee'], NOW))).toBeNull();
    expect(configureOrg(state, A, { leaderMayGrant: false }, NOW)).toEqual({ ok: true });
    expect(err(createInvite(state, B, ['referee'], NOW))).toBeTruthy();
    expect(err(configureOrg(state, B, { name: 'Neu' }, NOW))).toBeTruthy();
    expect(err(createInvite(state, C, ['screen'], NOW))).toBeTruthy();
  });

  it('Direktes Angebot gilt erst nach Annahme, Ablehnen lässt nichts zurück', () => {
    const state = org();
    invited(state, C, []);
    const id = Object.values(state.members).find((m) => m.name === 'Gast')!.id;
    expect(offerRoles(state, A, id, ['referee', 'registration'], NOW)).toEqual({ ok: true });
    expect(rolesOf(state, C)).toEqual([]);
    expect(answerOffer(state, C, true, NOW)).toEqual({ ok: true });
    expect(rolesOf(state, C)).toEqual(['referee', 'registration']);
    expect(offerRoles(state, A, id, ['minutes'], NOW)).toEqual({ ok: true });
    answerOffer(state, C, false, NOW);
    expect(rolesOf(state, C)).toEqual(['referee', 'registration']);
    expect(err(offerRoles(state, C, id, ['screen'], NOW))).toBeTruthy();
  });

  it('Entzug: einzelne Rolle, letzter Betreiber bleibt, Fremde dürfen nichts', () => {
    const state = org();
    invited(state, C, ['referee', 'minutes']);
    const id = Object.values(state.members).find((m) => m.name === 'Gast')!.id;
    expect(revokeRoles(state, A, id, ['referee'], NOW)).toEqual({ ok: true });
    expect(rolesOf(state, C)).toEqual(['minutes']);
    const mine = state.members[A]!.id;
    expect(err(revokeRoles(state, A, mine, ['operator'], NOW))).toMatch(/mindestens einen Betreiber/);
    expect(err(revokeRoles(state, D, id, ['minutes'], NOW))).toBeTruthy();
  });

  it('Mitglieder entfernen und austreten: nur Betreiber entfernt, der letzte Betreiber geht nicht', () => {
    const state = org();
    invited(state, B, ['lead'], 'Lea');
    invited(state, C, ['referee']);
    const lea = state.members[B]!.id;
    const gast = state.members[C]!.id;
    expect(err(removeOrgMember(state, B, gast, NOW))).toBeTruthy();
    expect(removeOrgMember(state, A, gast, NOW)).toEqual({ ok: true });
    expect(state.members[C]).toBeUndefined();
    expect(err(removeOrgMember(state, A, state.members[A]!.id, NOW))).toBeTruthy();
    expect(err(leaveOrg(state, A, NOW))).toBeTruthy();
    expect(leaveOrg(state, B, NOW)).toEqual({ ok: true });
    expect(state.members[B]).toBeUndefined();
    expect(lea).toBeTruthy();
  });

  it('Sicht: Fremde sehen nichts, Mitglieder die Liste, Leitung Einladungen und Protokoll, nie Codes', () => {
    const state = org();
    invited(state, B, ['lead'], 'Lea');
    invited(state, C, ['referee']);
    const made = createInvite(state, A, ['screen'], NOW) as { code: string };
    const stranger = orgView(state, D, NOW);
    expect(stranger.me).toBeNull();
    expect(stranger.members).toEqual([]);
    const guest = orgView(state, C, NOW);
    expect(guest.members.length).toBe(3);
    expect(guest.invites).toEqual([]);
    expect(guest.log).toEqual([]);
    const lead = orgView(state, B, NOW);
    expect(lead.invites.length).toBe(1);
    expect(lead.log.length).toBeGreaterThan(0);
    expect(JSON.stringify(lead)).not.toContain(made.code);
    expect(JSON.stringify(lead)).not.toContain(A);
    expect(revokeInvite(state, A, lead.invites[0]!.id, NOW)).toEqual({ ok: true });
  });

  it('Obergrenze nach Art, Protokoll bleibt begrenzt, nicht freigegebene Organisation ist stumm', () => {
    expect(ORG_MAX_MEMBERS).toEqual({ verein: 200, schule: 200, klasse: 40 });
    const klasse = createOrg('k', { name: 'Klasse 5a', kind: 'klasse' }, { token: A, name: 'Bea' }, NOW) as OrgState;
    for (let i = 1; i < ORG_MAX_MEMBERS.klasse; i++) klasse.members[`kennung-schueler-${String(i).padStart(4, '0')}`] = { id: `s${i}`, name: 'S', avatar: '🦊', roles: [], offered: [], joinedAt: NOW, via: 'invite' };
    const made = createInvite(klasse, A, [], NOW) as { code: string };
    expect(err(redeemInvite(klasse, { token: C, name: 'Cem' }, made.code, NOW))).toMatch(/voll/);
    const state = org();
    for (let i = 0; i < ORG_LOG_MAX + 20; i++) configureOrg(state, A, { leaderMayGrant: true }, NOW + i);
    expect(state.log.length).toBe(ORG_LOG_MAX);
    const pending = createOrg('p', { name: 'Neu', kind: 'schule' }, { token: A, name: 'Bea' }, NOW, 'pending') as OrgState;
    expect(orgCapabilitiesOf(pending, A)).toEqual([]);
    expect(err(createInvite(pending, A, ['referee'], NOW))).toBeTruthy();
  });
});
