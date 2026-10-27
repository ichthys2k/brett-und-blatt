import { generalBots, type GameModule } from '@brett-und-blatt/engine';
import { ligrettoBot } from './bots';
import { meta } from './meta';
import { applyMove, currentPlayers, legalMoves, playerView, result, sampleHidden, setup, type LigrettoMove, type LigrettoState } from './rules';

export type { LigrettoMove, LigrettoState } from './rules';

export const gameModule: GameModule<LigrettoState, LigrettoMove> = {
  info: meta,
  options: [],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 2000 },
    fast: { kind: 'perMove', moveMs: 1000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  result,
  sampleHidden,
  bots: [ligrettoBot, ...generalBots<LigrettoState, LigrettoMove, LigrettoState>()],
};
