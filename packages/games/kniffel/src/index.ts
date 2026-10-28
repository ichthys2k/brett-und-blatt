import { generalBots, type GameModule } from '@brett-und-blatt/engine';
import { kniffelBot } from './bots';
import { meta } from './meta';
import { applyMove, calculateScore, currentPlayers, evaluate, isLegal, legalMoves, playerView, result, sampleHidden, setup, type KniffelMove, type KniffelState } from './rules';

export type { KniffelMove, KniffelState, Category, UpperCategory, LowerCategory } from './rules';
export { calculateScore };

export const gameModule: GameModule<KniffelState, KniffelMove> = {
  info: meta,
  options: [],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 60_000 },
    fast: { kind: 'perMove', moveMs: 30_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  sampleHidden,
  result,
  evaluate,
  bots: [kniffelBot, ...generalBots<KniffelState, KniffelMove, KniffelState>()],
};
