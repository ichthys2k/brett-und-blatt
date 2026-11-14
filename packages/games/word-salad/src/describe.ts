/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { WordSaladMove, WordSaladState } from './rules';

export function describeMove(_view: WordSaladState, move: WordSaladMove): string {
  return move.type === 'submit' ? `${move.word} einreichen` : 'Runde beenden';
}
