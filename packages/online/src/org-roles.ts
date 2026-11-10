import type { Capability } from './capabilities';

/**
 * Rollen einer Organisation (Verein, Schule, Klasse; #217, Konzept `docs/spiele/rechte-und-rollen.md`).
 * Rollen sind feste Bündel aus Rechten; eine Person kann mehrere haben, ihre Rechte sind die Vereinigung.
 * Reine Logik ohne Server: Der Server prüft damit jede Nachricht, die Oberfläche zeigt nur Erlaubtes.
 */
export const ORG_ROLES = ['operator', 'lead', 'referee', 'tableHelper', 'registration', 'minutes', 'screen'] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const isOrgRole = (value: unknown): value is OrgRole => typeof value === 'string' && (ORG_ROLES as readonly string[]).includes(value);

/** Alle Rechte, die der Betreiber hat (Raum-Rechte gehören ihm als Moderator ebenfalls). */
const ALL: readonly Capability[] = ['kick', 'rename', 'unseat', 'lockNames', 'restart', 'enterResult', 'entrants', 'checkin', 'tools', 'print', 'deleteTournament', 'manageRoles', 'manageMembers', 'createTournament'];

/** Das Bündel je Rolle. `screen` ist nur Ansicht und hat keine Rechte. */
export const ROLE_CAPABILITIES: Readonly<Record<OrgRole, readonly Capability[]>> = {
  operator: ALL,
  lead: ['entrants', 'tools', 'enterResult', 'checkin', 'print', 'createTournament'],
  referee: ['enterResult', 'checkin'],
  tableHelper: ['enterResult', 'checkin', 'print'],
  registration: ['entrants', 'checkin'],
  minutes: ['print'],
  screen: [],
};

/** Rollen, die die Leitung vergeben darf (alles unterhalb von Leitung und Betreiber). */
export const LEAD_GRANTABLE: readonly OrgRole[] = ['referee', 'tableHelper', 'registration', 'minutes', 'screen'];

/** Die Rechte aus allen Rollen zusammen, in der Reihenfolge von `ALL` (ohne Doppelte). */
export function orgCapabilities(roles: readonly OrgRole[]): Capability[] {
  const have = new Set<Capability>();
  for (const role of roles) for (const cap of ROLE_CAPABILITIES[role] ?? []) have.add(cap);
  return ALL.filter((cap) => have.has(cap));
}

/**
 * Darf, wer `granter` ist, die Rolle `role` vergeben (oder entziehen)? Der Betreiber alle, die Leitung nur die
 * Rollen aus `LEAD_GRANTABLE` und nur, wenn die Organisation es erlaubt (`leaderMayGrant`, Standard ja).
 */
export function canGrantRole(granter: readonly OrgRole[], role: OrgRole, leaderMayGrant = true): boolean {
  if (granter.includes('operator')) return true;
  return leaderMayGrant && granter.includes('lead') && LEAD_GRANTABLE.includes(role);
}

/** Rolle eines Gerätes im Turnier vor der Organisation: Hauptleitung, Mitleitung, Helfer. */
export type LegacyTournamentRole = 'leader' | 'coleader' | 'helper';

/** Abbildung der bisherigen Rollen auf Organisationsrollen (Migration, Konzept Abschnitt 3). */
export function orgRoleOfLegacy(role: LegacyTournamentRole): OrgRole {
  return role === 'leader' ? 'operator' : role === 'coleader' ? 'lead' : 'tableHelper';
}

/**
 * Ein Tischhelfer soll später nur an den ihm zugewiesenen Tischen eintragen. Solange Tische nicht an Personen
 * gebunden sind (`assignFields` kennt nur Felder), gilt die Einschränkung nur als Hinweis für die Oberfläche.
 */
export function ownFieldsOnly(roles: readonly OrgRole[]): boolean {
  if (!roles.includes('tableHelper')) return false;
  return !roles.some((role) => role === 'operator' || role === 'lead' || role === 'referee');
}
