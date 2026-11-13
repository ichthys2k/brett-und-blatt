/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { germanCardName, type Suit } from '@brett-und-blatt/engine';
import type { SchafkopfContract, SchafkopfGameType, SchafkopfMove, SchafkopfState } from './rules';

const SUITS: Record<Suit, string> = { C: 'Eichel', S: 'Gras', H: 'Herz', D: 'Schellen' };
const GAMES: Record<SchafkopfGameType, string> = { sauspiel: 'Sauspiel', wenz: 'Wenz', solo: 'Solo', geier: 'Geier', farbwenz: 'Farbwenz', bettel: 'Bettel', ramsch: 'Ramsch' };

export function contractText(contract: SchafkopfContract): string {
  let text = GAMES[contract.gameType];
  if (contract.gameType === 'sauspiel' && contract.calledSuit) text = `Sauspiel auf die ${SUITS[contract.calledSuit]}-Sau`;
  else if (contract.trumpSuit) text = `${SUITS[contract.trumpSuit]}-${text}`;
  return contract.tout ? `${text} Tout` : text;
}

export function describeMove(_view: SchafkopfState, move: SchafkopfMove): string {
  switch (move.type) {
    case 'pass':
      return 'Weiter';
    case 'wantToPlay':
      return `Ich spiele: ${GAMES[move.contractType]}`;
    case 'declare':
      return `${contractText(move.contract)} ansagen`;
    case 'double':
      return 'Stoßen';
    case 'skipDoubling':
      return 'Nicht stoßen';
    case 'play':
      return `${germanCardName(move.card, SUITS)} spielen`;
    case 'nextGame':
      return 'Nächstes Spiel';
  }
}
