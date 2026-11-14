/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { questionOf, termOf } from './catalog';
import { packOf, type WhoMove, type WhoState } from './rules';

export function describeMove(view: WhoState, move: WhoMove): string {
  switch (move.type) {
    case 'ask':
      return `Fragen: ${questionOf(packOf(view), move.question)?.text ?? move.question}`;
    case 'askAloud':
      return 'Laut fragen';
    case 'guess':
      return `Raten: ${termOf(packOf(view), move.term)?.name ?? move.term}`;
    case 'guessText':
      return `Raten: ${move.text}`;
    case 'pass':
      return 'Passen';
    case 'answer':
      return move.value === null ? 'Weiß nicht' : (['Ja', 'Nein', 'Vielleicht'][move.value] ?? 'Antworten');
  }
}
