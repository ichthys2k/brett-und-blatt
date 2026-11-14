/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { cardNameIn, SUIT_NAMES } from '@brett-und-blatt/engine';
import type { DokoAnnouncement, DokoContract, DokoMove, DokoState } from './rules';

const CALLS: Record<DokoAnnouncement, string> = { re: 'Re ansagen', kontra: 'Kontra ansagen', no90: 'Keine 90 ansagen', no60: 'Keine 60 ansagen', no30: 'Keine 30 ansagen', schwarz: 'Schwarz ansagen' };

export function contractText(contract: DokoContract): string {
  switch (contract.type) {
    case 'normal':
      return 'Normalspiel';
    case 'hochzeit':
      return 'Hochzeit';
    case 'damensolo':
      return 'Damensolo';
    case 'bubensolo':
      return 'Bubensolo';
    case 'fleischlos':
      return 'Fleischloser';
    case 'farbsolo':
      return `${contract.trumpSuit ? SUIT_NAMES[contract.trumpSuit] : 'Farb'}-Solo`;
  }
}

export function describeMove(view: DokoState, move: DokoMove): string {
  switch (move.type) {
    case 'healthy':
      return 'Gesund';
    case 'reservation':
      return 'Vorbehalt';
    case 'chooseContract':
      return `${contractText(move.contract)} spielen`;
    case 'announce':
      return CALLS[move.call];
    case 'play':
      return `${cardNameIn(move.card, Object.values(view.hands ?? {}).find((hand) => hand.includes(move.card)))} spielen`;
    case 'nextGame':
      return 'Nächstes Spiel';
  }
}
