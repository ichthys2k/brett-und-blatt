import { generalBots, type GameModule, type OptionSpec } from '@brett-und-blatt/engine';
import { elevensBot } from './bots';
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
  type ElevensMove,
  type ElevensState,
} from './rules';

export * from './rules';
export * from './bots';
export { meta } from './meta';

const options: OptionSpec[] = [
  {
    id: 'draw',
    label: 'Ziehen',
    description: 'Wie viele Karten ziehen muss, wer nichts anlegen kann.',
    choices: [
      { value: '3', label: 'Bis zu 3 Karten (Standard)' },
      { value: '1', label: '1 Karte' },
      { value: 'match', label: 'Bis eine passt' },
    ],
    default: '3',
  },
  {
    id: 'start',
    label: 'Eröffnung',
    description: 'Wer beginnt und womit.',
    choices: [
      { value: 'red', label: 'Rote Elf beginnt (Standard)' },
      { value: 'free', label: 'Erster Platz beginnt, jede Elf' },
    ],
    default: 'red',
  },
];

export const gameModule: GameModule<ElevensState, ElevensMove> = {
  info: meta,
  options,
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 20_000 },
    fast: { kind: 'perMove', moveMs: 10_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  sampleHidden,
  result,
  timeoutMove,
  bots: [elevensBot, ...generalBots<ElevensState, ElevensMove, ElevensState>()],
};
