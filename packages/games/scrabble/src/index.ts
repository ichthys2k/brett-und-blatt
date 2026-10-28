import type { GameModule } from '@brett-und-blatt/engine';
import { scrabbleBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  evaluate,
  isLegal,
  legalMoves,
  playerView,
  result,
  sampleHidden,
  setup,
  type ScrabbleMove,
  type ScrabbleState,
} from './rules';

export type { BoardCell, LastMove, PlacedTile, ScrabbleMove, ScrabbleState } from './rules';
export { checkPlay, EXCHANGE_MIN_BAG } from './rules';
export { scrabbleBot } from './bots';
export { isValidWord } from './dict';

export const gameModule: GameModule<ScrabbleState, ScrabbleMove> = {
  info: meta,
  options: [
    {
      id: 'rackSize',
      label: 'Bänkchen',
      choices: [
        { value: '7', label: '7 Steine' },
        { value: '8', label: '8 Steine (leichter)' },
      ],
      default: '7',
    },
    {
      id: 'bingoBonus',
      label: 'Prämie für 7 Steine',
      choices: [
        { value: '50', label: '50 Punkte' },
        { value: '0', label: 'Aus' },
      ],
      default: '50',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'chessClock', baseMs: 15 * 60_000, incrementMs: 10_000 },
    fast: { kind: 'perMove', moveMs: 90_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  result,
  evaluate,
  sampleHidden,
  timeoutMove: () => ({ type: 'pass' }),
  bots: [scrabbleBot],
};
