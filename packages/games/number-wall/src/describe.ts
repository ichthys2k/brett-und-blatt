/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { NumberWallMove, NumberWallState } from './rules';

export function describeMove(_view: NumberWallState, move: NumberWallMove): string {
  return `Mauer abgeben: ${move.values.join(', ')}`;
}
