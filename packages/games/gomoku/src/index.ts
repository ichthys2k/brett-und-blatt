import { generalBots, type GameModule } from '@brett-und-blatt/engine';
import { gomokuBotEasy, gomokuBotHard, gomokuBotMedium } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, evaluate, legalMoves, result, setup } from './rules';
import type { GomokuMove, GomokuState } from './types';
import { describeMove } from './describe';

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
  // Kurzer Text je Zug für fremde Clients und den Bildschirmleser (#335).
  describeMove,
  bots: [gomokuBotMedium, gomokuBotEasy, gomokuBotHard, ...generalBots<GomokuState, GomokuMove, GomokuState>()],
};
