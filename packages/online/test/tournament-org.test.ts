import { describe, expect, it } from 'vitest';
import { ORG_ROLES, Tournament, parseTournamentSettings, type TournamentSettings } from '../src';

/** Turniere einer Organisation (#230): Rollen aus der Organisation wirken zusätzlich zur Gerätekennung der Leitung. */

const LEADER = 'kennung-der-leitung-01';
const REF = 'kennung-schiedsrichter-1';
const REG = 'kennung-anmeldung-00001';
const LEAD = 'kennung-leitung-org-0001';
const OP = 'kennung-betreiber-org-001';
const STRANGER = 'kennung-fremder-0000001';
const ORG = '🦊🦊🦊🦊🦊🦊';
const deps = { now: () => 1_000_000, randomClaim: () => 'NEUCODE1' };

function local(org: string | undefined) {
  const settings: TournamentSettings = { name: 'Abend', gameId: '', format: 'knockout', time: 'normal', days: 1, thirdPlace: false, mode: 'local', sport: 'Darts', result: 'winner', checkin: true, ...(org ? { org } : {}) };
  const t = Tournament.create('ABCD2345', 'seed', settings, { token: LEADER, name: 'L' }, deps);
  t.setOrgRoles(REF, ['referee']);
  t.setOrgRoles(REG, ['registration']);
  t.setOrgRoles(LEAD, ['lead']);
  t.setOrgRoles(OP, ['operator']);
  return t;
}

describe('Organisationsrollen im Turnier', () => {
  it('ohne Organisation am Turnier bleiben die Rollen wirkungslos', () => {
    const t = local(undefined);
    expect(t.isLeader(LEAD)).toBe(false);
    expect(t.mayDelete(OP)).toBe(false);
    expect(t.addEntrants(REG, ['Anna'])).toMatch(/Leitung/);
    expect(t.view(OP).orgRoles).toEqual(['operator']);
    expect(t.view(OP).isLeader).toBe(false);
  });

  it('Leitung der Organisation leitet, Betreiber darf auch löschen, die Hauptleitung bleibt', () => {
    const t = local(ORG);
    expect(t.isLeader(LEAD)).toBe(true);
    expect(t.mayDelete(LEAD)).toBe(false);
    expect(t.mayDelete(OP)).toBe(true);
    expect(t.isLeader(LEADER)).toBe(true);
    expect(t.isLeader(STRANGER)).toBe(false);
    expect(t.view(LEAD).isLeader).toBe(true);
    expect(t.view(OP).mayDelete).toBe(true);
    expect(t.view(REF).orgRoles).toEqual(['referee']);
  });

  it('Anmeldung trägt Teilnehmer ein und setzt Check-in, Schiedsrichter nicht', () => {
    const t = local(ORG);
    expect(t.addEntrants(REF, ['Anna'])).toMatch(/Leitung/);
    expect(t.addEntrants(REG, ['Anna', 'Ben', 'Cem', 'Dora'])).toBeNull();
    const [first] = t.view(REG).players;
    expect(t.setPresent(REG, first!.id, true)).toBeNull();
    expect(t.setPresent(REF, first!.id, false)).toBeNull();
    expect(t.setPresent(STRANGER, first!.id, false)).toMatch(/Leitung/);
    expect(t.removeEntrant(REG, first!.id)).toBeNull();
  });

  it('Schiedsrichter tragen Ergebnisse ein, Anmeldung nicht', () => {
    const t = local(ORG);
    t.addEntrants(LEADER, ['Anna', 'Ben', 'Cem', 'Dora']);
    for (const p of t.view(LEADER).players) t.setPresent(LEADER, p.id, true);
    expect(t.start(LEADER)).toBeNull();
    const match = t.view(LEADER).matches.find((m) => !m.outcome && m.slots.every((s) => s.player));
    expect(match).toBeTruthy();
    expect(t.enterResult(REG, match!.id, { winner: 0 })).toMatch(/Leitung/);
    expect(t.enterResult(REF, match!.id, { winner: 0 })).toBeNull();
  });

  it('Einblick: wer eine Rolle hat, sieht das Turnier; Fremde nicht', () => {
    const t = local(ORG);
    for (const token of [REF, REG, LEAD, OP]) expect(t.maySee(token)).toBe(true);
    expect(t.maySee(STRANGER)).toBe(false);
  });

  it('ein Rollenwechsel wirkt sofort, ein Entzug auch', () => {
    const t = local(ORG);
    t.setOrgRoles(REF, []);
    expect(t.view(REF).orgRoles).toEqual([]);
    expect(t.maySee(REF)).toBe(false);
  });

  it('der Code der Organisation wird beim Anlegen geprüft', () => {
    const body = { name: 'Abend', mode: 'local', sport: 'Darts', format: 'knockout' };
    expect(parseTournamentSettings({ ...body, org: ORG }, () => undefined)?.org).toBe(ORG);
    expect(parseTournamentSettings({ ...body, org: 'kein Code' }, () => undefined)).toBeNull();
    expect(parseTournamentSettings({ ...body, org: '' }, () => undefined)?.org).toBeUndefined();
    expect(parseTournamentSettings(body, () => undefined)?.org).toBeUndefined();
    expect(ORG_ROLES.length).toBeGreaterThan(0);
  });
});
