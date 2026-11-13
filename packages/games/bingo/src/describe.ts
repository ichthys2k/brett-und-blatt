/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { BingoMove, BingoState } from './rules';

export function describeMove(view: BingoState, move: BingoMove): string {
  if (move.type === 'draw') return 'Nächste Zahl ziehen';
  if (move.type === 'bingo') return 'Bingo rufen!';
  return `Feld Reihe ${Math.floor(move.cell / view.size) + 1}, Spalte ${(move.cell % view.size) + 1} markieren`;
}
