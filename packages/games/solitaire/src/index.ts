import { randomBot, type BotDefinition, type GameModule } from '@brett-und-blatt/engine';
import { solitaireBot } from './bot';
import { meta } from './meta';
import { applyMove, currentPlayers, legalMoves, playerView, result, sampleHidden, setup } from './rules';
import type { SolitaireMove, SolitaireState } from './types';

export type { FreeCellState, KlondikeState, Loc, Pile, PyramidLoc, PyramidState, SolitaireMove, SolitaireState, SpiderState } from './types';
export { sameLoc } from './types';
export { isFree, rowOf, rowStart, cardAt } from './pyramid';
export { MOVE_LIMIT } from './rules';

export const gameModule: GameModule<SolitaireState, SolitaireMove> = {
  info: meta,
  options: [
    {
      id: 'variant',
      label: 'Variante',
      choices: [
        { value: 'klondike', label: 'Klondike' },
        { value: 'freecell', label: 'FreeCell' },
        { value: 'spider', label: 'Spider' },
        { value: 'pyramid', label: 'Pyramide' },
      ],
      default: 'klondike',
    },
    {
      id: 'draw',
      label: 'Klondike: Karten ziehen',
      choices: [
        { value: '1', label: 'Eine' },
        { value: '3', label: 'Drei' },
      ],
      default: '1',
    },
    {
      id: 'spiderSuits',
      label: 'Spider: Farben',
      choices: [
        { value: '1', label: 'Eine' },
        { value: '2', label: 'Zwei' },
        { value: '4', label: 'Vier' },
      ],
      default: '1',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'chessClock', baseMs: 600_000, incrementMs: 0 },
    fast: { kind: 'chessClock', baseMs: 300_000, incrementMs: 0 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  result,
  sampleHidden,
  // Die allgemeine Monte-Carlo-Suche hilft bei Patiencen wenig; der Zufallsbot bleibt zum Testen.
  bots: [solitaireBot, randomBot as unknown as BotDefinition<SolitaireState, SolitaireMove>],
};
