/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { BibleQuizMove, BibleQuizState } from './rules';

export function describeMove(view: BibleQuizState, move: BibleQuizMove): string {
  if (move.type === 'next') return 'Weiter';
  const text = view.currentQuestion?.shuffledOptions?.[move.optionIndex];
  return `${String.fromCharCode(65 + move.optionIndex)}: ${text ?? `Antwort ${move.optionIndex + 1}`}`;
}
