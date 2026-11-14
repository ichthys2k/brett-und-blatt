/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { HangmanMove, HangmanState } from './rules';

export function describeMove(_view: HangmanState, move: HangmanMove): string {
  return `Buchstabe ${move.letter}`;
}
