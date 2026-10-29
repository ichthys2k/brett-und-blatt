import { deckStyleOption, generalBots, sameValue, type Actor, type GameModule } from '@brett-und-blatt/engine';
import { schafkopfBot } from './bots.js';
import { meta } from './meta.js';
import {
  applyMove,
  currentPlayers,
  legalMoves,
  playerView,
  result,
  sampleHidden,
  setup,
  type SchafkopfContract,
  type SchafkopfGameType,
  type SchafkopfMove,
  type SchafkopfPhase,
  type SchafkopfState,
} from './rules.js';

export type {
  SchafkopfContract,
  SchafkopfGameType,
  SchafkopfMove,
  SchafkopfPhase,
  SchafkopfState,
};
export {
  CONTRACT_RANKS,
  SCHAFKOPF_RANKS_LONG,
  SCHAFKOPF_RANKS_SHORT,
  createSchafkopfDeck,
} from './rules.js';

export const gameModule: GameModule<SchafkopfState, SchafkopfMove> = {
  info: meta,
  options: [
    {
      id: 'sheet',
      label: 'Blatt',
      choices: [
        { value: 'long', label: 'Langes Blatt (32 Karten, je 8)' },
        { value: 'short', label: 'Kurzes Blatt (24 Karten, ohne 7 und 8)' },
      ],
      default: 'long',
    },
    {
      id: 'rounds',
      label: 'Spiele pro Serie',
      choices: [
        { value: '4', label: '4 Spiele' },
        { value: '8', label: '8 Spiele' },
        { value: '12', label: '12 Spiele' },
        { value: '24', label: '24 Spiele' },
      ],
      default: '12',
    },
    deckStyleOption(),
    {
      id: 'extras',
      label: 'Zusatzspiele',
      choices: [
        { value: 'standard', label: 'Standard (Sauspiel, Wenz, Solo)' },
        { value: 'all', label: 'Alle (+ Geier, Farbwenz, Bettel)' },
      ],
      default: 'standard',
    },
    {
      id: 'doubling',
      label: 'Stoßen & Retour',
      choices: [
        { value: 'true', label: 'An (Verdopplungen erlaubt)' },
        { value: 'false', label: 'Aus' },
      ],
      default: 'true',
    },
    {
      id: 'ifAllPass',
      label: 'Wenn alle weiter sagen',
      choices: [
        { value: 'redeal', label: 'Neu geben' },
        { value: 'ramsch', label: 'Ramsch spielen' },
      ],
      default: 'redeal',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 20_000 },
    fast: { kind: 'perMove', moveMs: 10_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal(state: SchafkopfState, actor: Actor, move: SchafkopfMove): boolean {
    return legalMoves(state, actor).some((m) => sameValue(m, move));
  },
  applyMove,
  playerView,
  result,
  sampleHidden,
  bots: [schafkopfBot, ...generalBots<SchafkopfState, SchafkopfMove, SchafkopfState>()],
};
