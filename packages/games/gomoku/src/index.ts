import { generalBots, type GameModule } from '@brett-und-blatt/engine';
import { gomokuBotEasy, gomokuBotHard, gomokuBotMedium } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, evaluate, legalMoves, result, setup } from './rules';
import type { GomokuMove, GomokuState } from './types';

export type { GomokuMove, GomokuState } from './types';

export const gameModule: GameModule<GomokuState, GomokuMove> = {
  info: meta,
  options: [],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 30_000 },
    fast: { kind: 'perMove', moveMs: 15_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView: (state) => state,
  result,
  evaluate,
  bots: [gomokuBotMedium, gomokuBotEasy, gomokuBotHard, ...generalBots<GomokuState, GomokuMove, GomokuState>()],
};
