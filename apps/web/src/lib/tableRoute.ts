/** Routen, in denen eine Partie läuft und ein Neuladen stören würde (#175). */
export function isTableRoute(hash: string): boolean {
  return /^#\/?(partie|raum|tisch|turnier)(\/|\?|$)/.test(hash);
}
