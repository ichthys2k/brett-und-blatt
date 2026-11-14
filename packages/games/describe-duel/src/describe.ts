/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { DuelMove, DuelState } from './rules';

export function describeMove(_view: DuelState, move: DuelMove): string {
  switch (move.type) {
    case 'block':
      return `Sperren: ${move.words.join(', ')}`;
    case 'clue':
      return `Hinweis: ${move.text}`;
    case 'guess':
      return `Raten: ${move.text}`;
    case 'pass':
      return 'Passen';
    case 'skip':
      return 'Begriff überspringen';
    case 'correct':
      return 'Erraten!';
    case 'buzz':
      return 'Sperrwort gefallen!';
  }
}
