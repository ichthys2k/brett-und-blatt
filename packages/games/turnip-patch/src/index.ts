import { generalBots, type GameModule, type OptionSpec } from '@brett-und-blatt/engine';
import { turnipBot } from './bots';
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
  type TurnipMove,
  type TurnipState,
} from './rules';

export * from './rules';
export * from './bots';
export { meta } from './meta';

const options: OptionSpec[] = [
  {
    id: 'hares',
    label: 'Hasen je Spieler',
    choices: [
      { value: '3', label: '3 Hasen (Standard)' },
      { value: '2', label: '2 Hasen' },
      { value: '1', label: '1 Hase (ganz kurz)' },
    ],
    default: '3',
  },
  {
    id: 'fall',
    label: 'Wer ins Loch fällt …',
    choices: [
      { value: 'fence', label: '… muss zurück zum letzten Zaunpfahl' },
      { value: 'start', label: '… muss zurück auf die Wiese (streng)' },
    ],
    default: 'fence',
  },
  {
    id: 'goal',
    label: 'Gewonnen hat …',
    choices: [
      { value: 'first', label: 'wer zuerst einen Hasen an der Rübe hat' },
      { value: 'all', label: 'wer zuerst alle Hasen an der Rübe hat' },
    ],
    default: 'first',
  },
];

export const gameModule: GameModule<TurnipState, TurnipMove> = {
  info: meta,
  options,
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 30_000 },
    fast: { kind: 'perMove', moveMs: 12_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  result,
  timeoutMove,
  sampleHidden,
  bots: [turnipBot, ...generalBots<TurnipState, TurnipMove, TurnipState>()],
};
