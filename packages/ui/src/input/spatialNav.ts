export interface NavRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface FocusCandidate {
  id: string;
  rect: NavRect;
  disabled?: boolean;
}

export type NavDirection = 'up' | 'down' | 'left' | 'right';

export interface NavOptions {
  /**
   * Gewicht des Mittelpunkt-Versatzes bei senkrechten Schritten zwischen Zielen, die sich waagrecht überlappen
   * (Standard 1 = wie bisher). Die Menüs der Konsole setzen 0,01 (#636): Dort zählt fast nur der Abstand in
   * Laufrichtung, sonst übersprang „runter“ eine Zeile über die volle Breite oder einen rechtsbündigen Regler.
   * In den Partien bleibt es bei 1 – ein kleinerer Wert machte die Buchstabenbank von Scrabble unerreichbar.
   */
  verticalAlignedWeight?: number;
}

function centerOf(r: NavRect): { x: number; y: number } {
  return {
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
  };
}

/**
 * Findet das geometrisch nächste Fokusziel in einer Richtung.
 * Arbeitet rein auf Rechtecken (ohne DOM), damit es exakt testbar bleibt.
 */
export function findNextFocusTarget(
  current: NavRect,
  candidates: readonly FocusCandidate[],
  direction: NavDirection,
  options: NavOptions = {},
): string | null {
  const alignedWeight = options.verticalAlignedWeight ?? 1;
  const cur = centerOf(current);
  let bestId: string | null = null;
  let bestScore = Infinity;

  for (const cand of candidates) {
    if (cand.disabled) continue;
    if (cand.rect.width <= 0 || cand.rect.height <= 0) continue;

    const c = centerOf(cand.rect);
    const dx = c.x - cur.x;
    const dy = c.y - cur.y;

    let primary = 0;
    let secondary = 0;
    let aligns = false;

    switch (direction) {
      case 'up':
        if (dy >= -2) continue;
        primary = -dy;
        aligns = cand.rect.right > current.left && cand.rect.left < current.right;
        secondary = aligns ? Math.abs(dx) * alignedWeight : Math.abs(dx);
        break;
      case 'down':
        if (dy <= 2) continue;
        primary = dy;
        aligns = cand.rect.right > current.left && cand.rect.left < current.right;
        secondary = aligns ? Math.abs(dx) * alignedWeight : Math.abs(dx);
        break;
      case 'left':
        if (dx >= -2) continue;
        primary = -dx;
        secondary = Math.abs(dy);
        aligns = cand.rect.bottom > current.top && cand.rect.top < current.bottom;
        break;
      case 'right':
        if (dx <= 2) continue;
        primary = dx;
        secondary = Math.abs(dy);
        aligns = cand.rect.bottom > current.top && cand.rect.top < current.bottom;
        break;
    }

    // Elemente, die auf der Querachse überlappen (gleiche Spalte/Zeile), werden stark bevorzugt
    const penalty = aligns ? 0 : 1000;
    const score = penalty + primary + secondary * 2.2;

    if (score < bestScore) {
      bestScore = score;
      bestId = cand.id;
    }
  }

  return bestId;
}

/** Wählt das Einstiegselement beim Betreten einer Zone (zuletzt fokussiert oder erstes sichtbares). */
export function pickZoneEntryTarget(
  candidates: readonly FocusCandidate[],
  lastFocusedId?: string | null,
): string | null {
  const valid = candidates.filter((c) => !c.disabled && c.rect.width > 0 && c.rect.height > 0);
  if (valid.length === 0) return null;
  if (lastFocusedId && valid.some((c) => c.id === lastFocusedId)) {
    return lastFocusedId;
  }
  return valid[0].id;
}
