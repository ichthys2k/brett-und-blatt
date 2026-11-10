/**
 * Was eine Verbindung in der Moderation darf (#100): Die Oberfläche zeigt nur Erlaubtes, statt überall nach
 * Rollen zu fragen. Der Raum füllt die Liste aus der Raumleitung, das Turnier später aus Leitung, Mitleitung
 * und Helfer; so kann dasselbe Spielleiter-Panel in beiden Bereichen wohnen, ohne dass ihre Logik zusammenfällt.
 *
 * Sie ist nur eine Anzeigehilfe: Der Server prüft jede Nachricht weiter selbst.
 */
export const CAPABILITIES = [
  /** Mitglieder aus dem Raum entfernen. */
  'kick',
  /** Namen und Bild anderer Mitglieder festlegen. */
  'rename',
  /** Mitglieder vom Platz nehmen. */
  'unseat',
  /** Selbst-Umbenennen für alle sperren oder erlauben. */
  'lockNames',
  /** Die Partie neu starten oder zurück in die Lobby. */
  'restart',
  /** Turnier: Ergebnisse und Tischergebnisse eintragen (vor Ort auch Helfer). */
  'enterResult',
  /** Turnier: Teilnehmer eintragen oder entfernen, Turnier starten. */
  'entrants',
  /** Turnier: Anwesenheit (Check-in) setzen. */
  'checkin',
  /** Turnier: Werkzeuge der Leitung (Zuschaulink, Helfer, Zeitplan, Serie, Übergabe). */
  'tools',
  /** Turnier: Druckansichten und Export. */
  'print',
  /** Turnier: das ganze Turnier löschen (nur die Hauptleitung). */
  'deleteTournament',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ROOM_CAPABILITIES: readonly Capability[] = ['kick', 'rename', 'unseat', 'lockNames', 'restart'];

/** Die Raumleitung darf alles im Raum; alle anderen nichts. */
export function roomCapabilities(isHost: boolean): Capability[] {
  return isHost ? [...ROOM_CAPABILITIES] : [];
}

/** Die Rolle eines Geräts im Turnier, wie die Sicht sie meldet (`TournamentView`). */
export interface TournamentRole {
  isLeader: boolean;
  helperRole: 'helper' | 'coleader' | null;
  mayDelete: boolean;
  /** Vor Ort (Leitung trägt ein) oder online (Teilnehmer spielen selbst). */
  local: boolean;
}

/**
 * Fähigkeiten im Turnier: Leitung und Mitleitung (`isLeader`) dürfen verwalten, Helfer nur vor Ort Ergebnisse
 * eintragen, Check-in setzen und drucken; die Hauptleitung allein löscht. Gleiche Form wie `roomCapabilities`, damit
 * ein Panel beide Bereiche bedient. Nur Anzeigehilfe, der Server prüft selbst.
 */
export function tournamentCapabilities(role: TournamentRole): Capability[] {
  const caps: Capability[] = [];
  const staff = role.isLeader || role.helperRole !== null;
  if (role.isLeader) caps.push('entrants', 'tools', 'enterResult');
  else if (role.local && role.helperRole === 'helper') caps.push('enterResult');
  if (staff) caps.push('checkin', 'print');
  if (role.mayDelete) caps.push('deleteTournament');
  return caps;
}

export const can = (capabilities: readonly Capability[], what: Capability): boolean => capabilities.includes(what);
