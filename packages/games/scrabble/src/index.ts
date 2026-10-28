import type { GameModule } from '@brett-und-blatt/engine';
import { generalBots } from '@brett-und-blatt/engine';
import { scrabbleBot } from './bots';
import { meta } from './meta';
import {
  applyMove,
  sampleHidden,
  currentPlayers,
  evaluate,
  isLegal,
  legalMoves,
  playerView,
  result,
  setup,
  type ScrabbleMove,
  type ScrabbleState,
  type ScrabbleView,
} from './rules';

export type { ScrabbleMove, ScrabbleState, ScrabbleView } from './rules';
export { scrabbleBot } from './bots';
export { isValidWord } from './dict';

export const gameModule: any = {
  info: meta,
  options: [
    {
      id: 'dictionary',
      label: 'Wörterbuch',
      choices: [
        { value: 'de', label: 'Deutsch (Standard)' },
        { value: 'en', label: 'Englisch (SOWPODS)' },
      ],
      default: 'de',
    },
    {
      id: 'checkMode',
      label: 'Prüfmodus',
      choices: [
        { value: 'immediate', label: 'Sofortprüfung' },
        { value: 'challenge', label: 'Challenge (Anfechten)' },
      ],
      default: 'immediate',
    },
    {
      id: 'jokerSwap',
      label: 'Joker-Tausch',
      choices: [
        { value: 'off', label: 'Aus' },
        { value: 'on', label: 'An' },
      ],
      default: 'off',
    },
    {
      id: 'rackSize',
      label: 'Bänkchengröße',
      choices: [
        { value: '7', label: '7 Steine' },
        { value: '8', label: '8 Steine' },
      ],
      default: '7',
    },
    {
      id: 'bingoBonus',
      label: 'Bingo-Prämie',
      choices: [
        { value: '50', label: '50 Punkte' },
        { value: '0', label: 'Aus' },
      ],
      default: '50',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'chessClock', baseMs: 15 * 60 * 1000, incrementMs: 10 * 1000 },
    fast: { kind: 'perMove', moveMs: 60 * 1000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView,
  result,
  evaluate,
  sampleHidden,
  bots: [scrabbleBot, ...generalBots<ScrabbleState, ScrabbleMove, ScrabbleView>()],
} as any;
