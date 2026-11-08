/*
 * Vergleich zweier Builds für die Aktualisierung der App (#175). Ein Service Worker, der „bereitsteht“, muss nicht
 * jünger sein als die laufende App: Der Zwischenspeicher von GitHub Pages kann nach einer Veröffentlichung kurz
 * noch die vorige Version ausliefern, dann sähe die App eine ältere Datei als „neu“. Darum fragt sie bei
 * `version.json` nach und zeigt den Hinweis nur, wenn dort ein jüngerer Build steht.
 */
export interface BuildInfo {
  id: string;
  time: number;
}

/** Liest `version.json`; alles Ungültige ist `null`. */
export function parseBuildInfo(value: unknown): BuildInfo | null {
  if (!value || typeof value !== 'object') return null;
  const { id, time } = value as Record<string, unknown>;
  return typeof id === 'string' && id !== '' && typeof time === 'number' && Number.isFinite(time) ? { id, time } : null;
}

/** Steht beim Server ein jüngerer Build als der laufende? Zeitgleiche oder ältere zählen nicht. */
export function isNewerBuild(remote: BuildInfo, own: BuildInfo): boolean {
  return remote.id !== own.id && remote.time > own.time;
}
