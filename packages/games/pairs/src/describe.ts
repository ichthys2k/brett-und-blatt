/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { PairsMove, PairsState } from './rules';

export function describeMove(view: PairsState, move: PairsMove): string {
  return `Karte in Reihe ${Math.floor(move.card / view.cols) + 1}, Spalte ${(move.card % view.cols) + 1} aufdecken`;
}
