import type { OrgKind, OrgRole } from '@brett-und-blatt/online';

/** Bezeichnungen für Organisationen in der Oberfläche („Verein oder Schule“, #217). */
export const ROLE_LABEL: Record<OrgRole, string> = {
  operator: 'Betreiber',
  lead: 'Leitung',
  referee: 'Schiedsrichter',
  tableHelper: 'Tischhelfer',
  registration: 'Anmeldung',
  minutes: 'Protokoll',
  screen: 'Bildschirm',
};

export const ROLE_HELP: Record<OrgRole, string> = {
  operator: 'Darf alles, auch Rollen vergeben und Turniere löschen.',
  lead: 'Legt Turniere an und leitet sie, kann Schiedsrichter, Tischhelfer und weitere Hilfsrollen vergeben.',
  referee: 'Trägt Ergebnisse ein und setzt Check-in.',
  tableHelper: 'Trägt Ergebnisse an den Tischen ein, setzt Check-in, druckt.',
  registration: 'Trägt Teilnehmer ein und gibt Anmeldungen frei.',
  minutes: 'Sieht, druckt und exportiert, ändert nichts.',
  screen: 'Nur Ansicht (Beamer, Turniertafel).',
};

export const KIND_LABEL: Record<OrgKind, string> = { verein: 'Verein', schule: 'Schule', klasse: 'Klasse' };
export const roleList = (roles: readonly OrgRole[]): string => (roles.length === 0 ? 'Mitglied' : roles.map((r) => ROLE_LABEL[r]).join(', '));
