/*
 * Wahl des Anfangsfokus eines Konsolen-Bildschirms (#607, K3b), rein und testbar:
 * zuerst das zuletzt benutzte Element, dann die Hauptaktion, dann das erste Element.
 */

/**
 * Ziel unter den fokussierbaren Elementen (`ids` in DOM-Reihenfolge); `null`, wenn es keines gibt.
 * Mit `preferAutofocus` geht die Hauptaktion vor (z. B. „Weiterspielen“ bei laufender Partie).
 */
export function pickInitialFocus(ids: readonly string[], remembered: string | null, autofocusId: string | null, preferAutofocus = false): string | null {
  if (preferAutofocus && autofocusId && ids.includes(autofocusId)) return autofocusId;
  if (remembered && ids.includes(remembered)) return remembered;
  if (autofocusId && ids.includes(autofocusId)) return autofocusId;
  return ids[0] ?? null;
}
