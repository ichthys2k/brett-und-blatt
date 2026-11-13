/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { FactorGridMove, FactorGridState } from './rules';

export function describeMove(_view: FactorGridState, move: FactorGridMove): string {
  return `${move.number} nehmen`;
}
