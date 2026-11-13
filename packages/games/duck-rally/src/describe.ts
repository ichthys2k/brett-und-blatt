/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { DuckRallyMove, DuckRallyState } from './rules';

export function describeMove(_view: DuckRallyState, move: DuckRallyMove): string {
  return move.type === 'answer' ? `Antwort ${move.value}` : 'Strömung';
}
