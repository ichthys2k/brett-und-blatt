import { describe, expect, it } from 'vitest';
import { can, tournamentCapabilities } from '../src/capabilities';
import { LEAD_GRANTABLE, ORG_ROLES, canGrantRole, isOrgRole, orgCapabilities, orgRoleOfLegacy, ownFieldsOnly } from '../src/org-roles';

describe('Rollen einer Organisation (#226)', () => {
  it('jede Rolle kennt ihr Bündel, Bildschirm hat keine Rechte', () => {
    for (const role of ORG_ROLES) expect(Array.isArray(orgCapabilities([role]))).toBe(true);
    expect(orgCapabilities(['screen'])).toEqual([]);
    expect(orgCapabilities(['minutes'])).toEqual(['print']);
  });

  it('der Betreiber hat alles, die Leitung verwaltet aber löscht nicht und vergibt über canGrantRole', () => {
    const op = orgCapabilities(['operator']);
    for (const cap of ['manageRoles', 'manageMembers', 'createTournament', 'deleteTournament', 'enterResult', 'tools'] as const) expect(can(op, cap)).toBe(true);
    const lead = orgCapabilities(['lead']);
    expect(can(lead, 'tools')).toBe(true);
    expect(can(lead, 'createTournament')).toBe(true);
    expect(can(lead, 'deleteTournament')).toBe(false);
    expect(can(lead, 'manageRoles')).toBe(false);
  });

  it('mehrere Rollen ergeben die Vereinigung, ohne Doppelte', () => {
    const caps = orgCapabilities(['referee', 'registration']);
    expect(caps).toEqual(['enterResult', 'entrants', 'checkin']);
    expect(new Set(caps).size).toBe(caps.length);
  });

  it('Vergabe: Betreiber alle, Leitung nur darunter und nur wenn erlaubt, sonst niemand', () => {
    for (const role of ORG_ROLES) expect(canGrantRole(['operator'], role)).toBe(true);
    for (const role of LEAD_GRANTABLE) expect(canGrantRole(['lead'], role)).toBe(true);
    expect(canGrantRole(['lead'], 'lead')).toBe(false);
    expect(canGrantRole(['lead'], 'operator')).toBe(false);
    expect(canGrantRole(['lead'], 'referee', false)).toBe(false);
    expect(canGrantRole(['operator'], 'lead', false)).toBe(true);
    expect(canGrantRole(['referee', 'registration', 'minutes'], 'screen')).toBe(false);
    expect(canGrantRole([], 'screen')).toBe(false);
  });

  it('alte Rollen werden abgebildet und verlieren nichts', () => {
    expect(orgRoleOfLegacy('leader')).toBe('operator');
    expect(orgRoleOfLegacy('coleader')).toBe('lead');
    expect(orgRoleOfLegacy('helper')).toBe('tableHelper');
    const base = { isLeader: false, helperRole: null, mayDelete: false, local: true } as const;
    const legacyCo = tournamentCapabilities({ ...base, isLeader: true, helperRole: 'coleader' });
    const legacyHelper = tournamentCapabilities({ ...base, helperRole: 'helper' });
    for (const cap of legacyCo) expect(can(orgCapabilities([orgRoleOfLegacy('coleader')]), cap)).toBe(true);
    for (const cap of legacyHelper) expect(can(orgCapabilities([orgRoleOfLegacy('helper')]), cap)).toBe(true);
  });

  it('Turnier ohne Organisation bleibt unverändert, Organisationsrollen kommen hinzu', () => {
    const base = { isLeader: false, helperRole: null, mayDelete: false, local: false } as const;
    expect(tournamentCapabilities(base)).toEqual([]);
    expect(tournamentCapabilities({ ...base, orgRoles: [] })).toEqual([]);
    expect(tournamentCapabilities({ ...base, orgRoles: ['referee'] })).toEqual(['enterResult', 'checkin']);
    const both = tournamentCapabilities({ ...base, isLeader: true, mayDelete: true, orgRoles: ['lead'] });
    expect(both).toEqual(['entrants', 'tools', 'enterResult', 'checkin', 'print', 'deleteTournament', 'createTournament']);
  });

  it('Tischhelfer sind auf eigene Tische beschränkt, solange sie nichts Höheres haben', () => {
    expect(ownFieldsOnly(['tableHelper'])).toBe(true);
    expect(ownFieldsOnly(['tableHelper', 'referee'])).toBe(false);
    expect(ownFieldsOnly(['lead'])).toBe(false);
    expect(ownFieldsOnly([])).toBe(false);
  });

  it('isOrgRole erkennt nur bekannte Rollen', () => {
    expect(isOrgRole('lead')).toBe(true);
    expect(isOrgRole('admin')).toBe(false);
    expect(isOrgRole(3)).toBe(false);
  });
});
