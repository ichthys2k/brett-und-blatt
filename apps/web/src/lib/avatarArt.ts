import map from './avatarMap.json';

/**
 * Gemalte Avatare (#312): Zu jedem Emoji der Auswahlliste gibt es ein Tavernengast-Bild. Das Profil speichert
 * weiter das Emoji; hier wird es dem Bild zugeordnet (Abbildung aus `scripts/grafik/manifeste/avatare.json`).
 */
const FILES = import.meta.glob<string>('../assets/avatare/avatar-*.webp', { eager: true, query: '?url', import: 'default' });

/** Bild zu einem Avatar-Emoji; ohne Bild `undefined` (dann bleibt das Emoji). */
export function avatarUrl(emoji: string): string | undefined {
  const id = (map as Record<string, string>)[emoji.replace(/\uFE0F/g, '')];
  return id ? FILES[`../assets/avatare/avatar-${id}.webp`] : undefined;
}
