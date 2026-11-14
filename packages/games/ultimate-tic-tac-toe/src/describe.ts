/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { UltimateMove, UltimateState } from './rules';

const PLACES = ['oben links', 'oben Mitte', 'oben rechts', 'Mitte links', 'Mitte', 'Mitte rechts', 'unten links', 'unten Mitte', 'unten rechts'];

export function describeMove(_view: UltimateState, move: UltimateMove): string {
  return `Feld ${PLACES[move.board]}, ${PLACES[move.cell]}`;
}
