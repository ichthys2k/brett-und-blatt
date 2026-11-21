/*
 * Reine Entscheidungen der Konsolen-Bausteine (#636, U1). Ohne DOM, damit sie getestet werden können.
 */

/** Bis zu so vielen Möglichkeiten zeigt `KnsChoiceRow` eine Knopfleiste in der Zeile, sonst ein Fenster. */
export const CHOICE_INLINE_MAX = 4;

/** Breite, ab der `KnsSplit` die Kategorien links neben den Inhalt stellt (nur im Querformat). */
export const SPLIT_SIDE_MIN_WIDTH = 900;

/** Knopfleiste in der Zeile oder Liste im Fenster. */
export function choiceRowMode(count: number): 'inline' | 'dialog' {
  return count <= CHOICE_INLINE_MAX ? 'inline' : 'dialog';
}

/** Kategorien links (`side`) oder als Chip-Zeile darüber (`top`). */
export function splitMode(width: number, height: number): 'side' | 'top' {
  return width >= height && width >= SPLIT_SIDE_MIN_WIDTH ? 'side' : 'top';
}

/** Nächster Wert eines Zählers; bleibt in den Grenzen. */
export function stepperValue(value: number, min: number, max: number, delta: number): number {
  return Math.min(max, Math.max(min, value + delta));
}
