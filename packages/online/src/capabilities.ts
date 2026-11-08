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
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Die Raumleitung darf alles; alle anderen nichts. */
export function roomCapabilities(isHost: boolean): Capability[] {
  return isHost ? [...CAPABILITIES] : [];
}

export const can = (capabilities: readonly Capability[], what: Capability): boolean => capabilities.includes(what);
