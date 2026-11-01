import { generalBots, type GameModule, type OptionSpec } from '@brett-und-blatt/engine';
import { marketStallsBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  legalMoves,
  playerView,
  result,
  sampleHidden,
  setup,
  timeoutMove,
  type MarketStallsMove,
  type MarketStallsState,
} from './rules';

export * from './rules';
export * from './bots';
export { meta } from './meta';

const options: OptionSpec[] = [
  {
    id: 'days',
    label: 'Dauer',
    description: 'Jeder Markttag bringt alle Karten neu, die Vorratskammern bleiben.',
    choices: [
      { value: '3', label: '3 Markttage (Standard)' },
      { value: '1', label: '1 Markttag (kurz, öfter knapp)' },
    ],
    default: '3',
  },
];

export const gameModule: GameModule<MarketStallsState, MarketStallsMove> = {
  info: meta,
  options,
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 30_000 },
    fast: { kind: 'perMove', moveMs: 15_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  sampleHidden,
  result,
  timeoutMove,
  bots: [marketStallsBot, ...generalBots<MarketStallsState, MarketStallsMove, MarketStallsState>()],
};
