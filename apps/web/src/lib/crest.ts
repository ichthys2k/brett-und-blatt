/*
 * Wappen der Spielkacheln (gemalte Bilder, siehe THIRD_PARTY.md). Gibt es für ein Spiel
 * noch keines, bleibt das Emoji aus dem Steckbrief.
 */
const files = import.meta.glob<string>('../wappen/*.webp', { eager: true, query: '?url', import: 'default' });

export function crestUrl(gameId: string): string | undefined {
  return files[`../wappen/${gameId}.webp`];
}
