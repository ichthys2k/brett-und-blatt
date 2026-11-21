/*
 * Hoch- oder Querformat der Konsole (#637, U2). Rein, damit es ohne DOM getestet werden kann; den Zustand
 * im Browser setzt `useKnsLayout` (apps/web) als `data-kns-layout` an <html>.
 */

export type KnsLayout = 'portrait' | 'landscape';

/** Unter dieser Breite gilt immer das Hochformat (Handy quer bleibt bei 844 × 390 Querformat). */
export const KNS_PORTRAIT_MAX_WIDTH = 700;

/** Hochformat, wenn das Fenster höher als breit oder schmaler als 700 px ist. */
export function knsLayout(width: number, height: number): KnsLayout {
  return height > width || width < KNS_PORTRAIT_MAX_WIDTH ? 'portrait' : 'landscape';
}

/** Maßeinheit `--kns-u` im Querformat: clamp(6px, 0.625vw, 12px). */
export function knsUnit(width: number): number {
  return Math.min(12, Math.max(6, width * 0.00625));
}

/** Spalten des Kachelrasters: Hochformat 2 (ab 600 px Breite 3); Querformat so viele Kacheln von 28 u passen. */
export function knsColumns(width: number, height: number): number {
  if (knsLayout(width, height) === 'portrait') return width >= 600 ? 3 : 2;
  const u = knsUnit(width);
  const inner = width - 2 * 5 * u - 2 * 1.5 * u;
  return Math.max(1, Math.floor((inner + 2 * u) / (28 * u + 2 * u)));
}
