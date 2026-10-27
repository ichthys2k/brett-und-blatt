import type { GameModule } from '@brett-und-blatt/engine';
import { numberWallBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  formatStoneValue,
  isLegal,
  legalMoves,
  playerView,
  result,
  sampleHidden,
  scoreWallSubmission,
  setup,
  solveWallFromGivens,
  stoneIndex,
  totalStones,
  type NumberWallMove,
  type NumberWallState,
  type WallNumberMode,
  type WallRoundSummary,
  type WallSubmission,
} from './rules';

export type { NumberWallMove, NumberWallState, WallNumberMode, WallRoundSummary, WallSubmission };
export { formatStoneValue, scoreWallSubmission, solveWallFromGivens, stoneIndex, totalStones };

export const gameModule: GameModule<NumberWallState, NumberWallMove> = {
  info: meta,
  options: [
    {
      id: 'numbers',
      label: 'Zahlenbereich',
      description: 'Natürliche Zahlen, ganze Zahlen (mit Minus), Dezimalzahlen oder Einmaleins-Mauer (Produkt).',
      choices: [
        { value: 'natural', label: 'Natürliche Zahlen (Kl. 5)' },
        { value: 'integers', label: 'Ganze Zahlen mit Minus (Kl. 5/6)' },
        { value: 'decimals', label: 'Dezimalzahlen (Kl. 6)' },
        { value: 'products', label: 'Einmaleins-Mauer (Produkt)' },
      ],
      default: 'natural',
    },
    {
      id: 'height',
      label: 'Mauerhöhe',
      choices: [
        { value: '3', label: '3 Stufen (6 Steine)' },
        { value: '4', label: '4 Stufen (10 Steine)' },
      ],
      default: '4',
    },
    {
      id: 'rounds',
      label: 'Runden',
      choices: [
        { value: '3', label: '3 Mauern' },
        { value: '5', label: '5 Mauern' },
        { value: '8', label: '8 Mauern' },
      ],
      default: '5',
    },
  ],
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
  bots: [numberWallBot],
};
