/*
 * Reine Helfer für Fenster (`aria-modal`) und Controller (#619–#622): welcher Knopf schließt ein Fenster,
 * welches Ziel bekommt beim Öffnen den Fokus.
 */

/** Beschriftung eines Knopfs, der ein Fenster schließt oder abbricht. */
export function isCloseLabel(label: string): boolean {
  const text = label.trim();
  if (text === '✕' || text === '×' || text === 'x') return true;
  return /^(schließen|abbrechen|zurück|fertig|ohne|später|nein)\b/i.test(text) || /\b(schließen|abbrechen)$/i.test(text);
}

/** Index des Ziels für den Anfangsfokus: ein ausdrücklich markiertes, sonst das erste, das kein Hintergrund-Knopf ist. */
export function pickModalEntry(items: readonly { autofocus: boolean; backdrop: boolean }[]): number {
  const marked = items.findIndex((item) => item.autofocus);
  if (marked !== -1) return marked;
  return items.findIndex((item) => !item.backdrop);
}
