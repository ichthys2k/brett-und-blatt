/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { SorterMove, SorterState } from './types';

const list = (cards: number[]) => cards.map((i) => i + 1).join(', ');

export function describeMove(_view: SorterState, move: SorterMove): string {
  switch (move.type) {
    case 'start':
      return 'Los geht’s';
    case 'skip':
      return move.alt ? 'Überspringen (andere Wahl)' : 'Überspringen';
    case 'play':
      return `Karten ${list(move.cards)} spielen`;
    case 'discard':
      return `Karten ${list(move.cards)} abwerfen`;
    case 'use':
      return `Hilfsmittel ${move.index + 1} einsetzen${move.cards.length ? ` auf Karten ${list(move.cards)}` : ''}`;
    case 'sellMod':
      return `Narr ${move.index + 1} verkaufen`;
    case 'sellConsumable':
      return `Hilfsmittel ${move.index + 1} verkaufen`;
    case 'moveMod':
      return `Narr ${move.from + 1} auf Platz ${move.to + 1}`;
    case 'buy':
      return `Angebot ${move.index + 1} kaufen`;
    case 'buyPack':
      return `Päckchen ${move.index + 1} kaufen`;
    case 'buyTool':
      return 'Werkzeug kaufen';
    case 'reroll':
      return 'Neu auslegen';
    case 'pick':
      return `Wahl ${move.index + 1}${move.cards.length ? ` für Karten ${list(move.cards)}` : ''}`;
    case 'skipPack':
      return 'Päckchen auslassen';
    case 'next':
      return 'Weiter';
    case 'sortHand':
      return move.by === 'rank' ? 'Nach Wert sortieren' : 'Nach Farbe sortieren';
    case 'moveCard':
      return `Karte ${move.from + 1} auf Platz ${move.to + 1}`;
    case 'rerollBoss':
      return 'Gegner neu wählen';
  }
}
