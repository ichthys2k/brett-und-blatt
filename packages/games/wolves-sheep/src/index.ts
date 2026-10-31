import type { GameModule } from '@brett-und-blatt/engine';
import { wolvesSheepBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  currentPlayers,
  isLegal,
  legalMoves,
  playerView,
  resignMove,
  result,
  sampleHidden,
  setup,
  systemDelayMs,
  timeoutMove,
  type WolvesSheepMove,
  type WolvesSheepState,
} from './rules';

export type { Departure, Examination, Phase, Role, VoteRecord, WolvesSheepMove, WolvesSheepState } from './rules';
export { buildDeck, livingSeats, nightTargets, speakerOf, wolfCount } from './rules';

export const gameModule: GameModule<WolvesSheepState, WolvesSheepMove> = {
  info: meta,
  options: [
    {
      id: 'debate',
      label: 'Beratung',
      description: '„Bis zum Knopf“: Die erste Person im Kreis eröffnet den Herdenrat, wenn alle so weit sind.',
      choices: [
        { value: '120', label: '2 Minuten' },
        { value: '180', label: '3 Minuten' },
        { value: '300', label: '5 Minuten' },
        { value: '0', label: 'bis zum Knopf' },
      ],
      default: '180',
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
  result,
  resignMove,
  systemDelayMs,
  timeoutMove,
  sampleHidden,
  bots: [wolvesSheepBot],
};
