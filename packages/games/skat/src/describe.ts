/** Zugtexte (#335, #350): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { cardName } from '@brett-und-blatt/engine';
import type { SkatDeclaration, SkatMove, SkatState } from './rules';

const GAME_NAMES: Record<SkatDeclaration['gameType'], string> = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo', grand: 'Grand', null: 'Null' };

/** Etwa „Grand Hand, Schneider angesagt“ oder „Null ouvert“. */
export function declarationText(d: SkatDeclaration): string {
  const parts = [GAME_NAMES[d.gameType]];
  if (d.hand) parts.push('Hand');
  if (d.ouvert) parts.push('ouvert');
  const extras = [d.schneider ? 'Schneider angesagt' : '', d.schwarz ? 'Schwarz angesagt' : ''].filter(Boolean);
  return [parts.join(' '), ...extras].join(', ');
}

export function describeMove(_view: SkatState, move: SkatMove): string {
  switch (move.type) {
    case 'bid':
      return `${move.value} reizen`;
    case 'hold':
      return 'Ja (halten)';
    case 'pass':
      return 'Passen';
    case 'takeSkat':
      return 'Skat aufnehmen';
    case 'playHand':
      return 'Hand spielen';
    case 'discard':
      return `${cardName(move.cards[0])} und ${cardName(move.cards[1])} drücken`;
    case 'declare':
      return `${declarationText(move.declaration)} ansagen`;
    case 'play':
      return `${cardName(move.card)} spielen`;
    case 'concede':
      return 'Spiel verloren geben';
    case 'claimRest':
      return 'Rest beanspruchen';
    case 'nextGame':
      return 'Nächstes Spiel';
  }
}
