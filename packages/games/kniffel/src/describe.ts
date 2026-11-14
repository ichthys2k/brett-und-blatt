/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { CATEGORY_LABELS, type KniffelMove, type KniffelState } from './rules';

export function describeMove(_view: KniffelState, move: KniffelMove): string {
  switch (move.type) {
    case 'roll':
      return 'Würfeln';
    case 'hold':
      return `Würfel ${move.index + 1} halten`;
    case 'unhold':
      return `Würfel ${move.index + 1} freigeben`;
    case 'toggleHold':
      return `Würfel ${move.index + 1} halten oder freigeben`;
    case 'score':
      return `${CATEGORY_LABELS[move.category]} eintragen`;
  }
}
