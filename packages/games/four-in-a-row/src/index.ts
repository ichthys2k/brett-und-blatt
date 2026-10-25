import { generalBots, type GameModule } from '@brett-und-blatt/engine';
import { fourInARowBot } from './bot';
import { meta } from './meta';
import { applyMove, currentPlayers, legalMoves, result, setup, type FourInARowMove, type FourInARowState } from './rules';

export type { FourInARowMove, FourInARowState } from './rules';
export { cellIndex, columnHeight } from './rules';

export const gameModule: GameModule<FourInARowState, FourInARowMove> = {
  info: meta,
  options: [
    {
      id: 'size',
      label: 'Brettgröße',
      choices: [
        { value: '6x5', label: '6 × 5' },
        { value: '7x6', label: '7 × 6' },
        { value: '8x7', label: '8 × 7' },
        { value: '9x7', label: '9 × 7' },
      ],
      default: '7x6',
    },
    {
      id: 'popOut',
      label: 'PopOut',
      description: 'Statt einen Stein einzuwerfen, darfst du einen eigenen Stein unten herausziehen.',
      choices: [
        { value: 'off', label: 'Aus' },
        { value: 'on', label: 'An' },
      ],
      default: 'off',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 10_000 },
    fast: { kind: 'perMove', moveMs: 5_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView: (state) => state,
  result,
  bots: [fourInARowBot, ...generalBots<FourInARowState, FourInARowMove, FourInARowState>()],
};
