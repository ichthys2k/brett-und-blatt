import type { GameModule } from '@brett-und-blatt/engine';
import { factorGridBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  freeChainNeighbors,
  freeProperDivisors,
  isLegal,
  legalMoves,
  playerView,
  result,
  setup,
  validNumbers,
  type FactorGridMove,
  type FactorGridState,
  type FactorVariant,
  type LastAction,
} from './rules';

export type { FactorGridMove, FactorGridState, FactorVariant, LastAction };
export { freeChainNeighbors, freeProperDivisors, validNumbers };

export const gameModule: GameModule<FactorGridState, FactorGridMove> = {
  info: meta,
  options: [
    {
      id: 'variant',
      label: 'Variante',
      description: 'Steuereintreiber (Punktejagd mit echten Teilern) oder Teiler & Vielfache (Ketten-Duell).',
      choices: [
        { value: 'taxman', label: 'Steuereintreiber (Taxman)' },
        { value: 'chain', label: 'Teiler & Vielfache (Kette)' },
      ],
      default: 'taxman',
    },
    {
      id: 'gridSize',
      label: 'Zahlenraum',
      choices: [
        { value: '20', label: '1 bis 20 (Einstieg)' },
        { value: '30', label: '1 bis 30 (Standard)' },
        { value: '50', label: '1 bis 50 (Großes Brett)' },
      ],
      default: '30',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 30_000 },
    fast: { kind: 'perMove', moveMs: 15_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  result,
  bots: [factorGridBot],
};
