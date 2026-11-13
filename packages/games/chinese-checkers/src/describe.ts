/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { CELLS, type ChineseCheckersMove, type ChineseCheckersState } from './rules';

/** Reihe von oben (1–17) und Platz in der Reihe von links, z. B. „Reihe 14, Platz 3“. */
export function holeName(index: number): string {
  const cell = CELLS[index]!;
  const place = CELLS.slice(0, index).filter((c) => c.r === cell.r).length + 1;
  return `Reihe ${cell.r + 9}, Platz ${place}`;
}

export function describeMove(_view: ChineseCheckersState, move: ChineseCheckersMove): string {
  if (move.type !== 'move') return 'Aussetzen';
  return `Stein von ${holeName(move.from)} nach ${holeName(move.to)}`;
}
