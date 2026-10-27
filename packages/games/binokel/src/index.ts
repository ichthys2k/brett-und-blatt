import { generalBots, sameValue, type Actor, type GameModule } from '@brett-und-blatt/engine';
import { binokelBot } from './bot/index.js';
import { meta } from './meta.js';
import {
  applyMove,
  currentPlayers,
  legalMoves,
  playerView,
  result,
  sampleHidden,
  setup,
  type BinokelMove,
  type BinokelPhase,
  type BinokelState,
} from './rules.js';

export type { BinokelMove, BinokelPhase, BinokelState } from './rules.js';
export * from './types.js';
export * from './cards.js';
export * from './melds.js';

export const gameModule: GameModule<BinokelState, BinokelMove> = {
  info: meta,
  options: [
    {
      id: 'tableSize',
      label: 'Tischformat',
      choices: [
        { value: '3', label: '3 Spieler' },
        { value: '4', label: '4 Spieler (Geber setzt aus)' },
      ],
      default: '3',
    },
    {
      id: 'deckSize',
      label: 'Kartendeck',
      choices: [
        { value: '40', label: '40 Karten (ohne 7er)' },
        { value: '48', label: '48 Karten (mit 7er / Dissle)' },
      ],
      default: '40',
    },
    {
      id: 'minBid',
      label: 'Mindestgebot',
      choices: [
        { value: '150', label: '150' },
        { value: '200', label: '200' },
        { value: '250', label: '250' },
        { value: '300', label: '300' },
      ],
      default: '150',
    },
    {
      id: 'targetScore',
      label: 'Zielpunktzahl',
      choices: [
        { value: '1000', label: '1000 Punkte' },
        { value: '1500', label: '1500 Punkte' },
      ],
      default: '1500',
    },
    {
      id: 'allowDurch',
      label: 'Durch-Ansage',
      choices: [
        { value: 'true', label: 'An' },
        { value: 'false', label: 'Aus' },
      ],
      default: 'true',
    },
    {
      id: 'foldCompensation',
      label: 'Gutschrift bei Abgehen',
      choices: [
        { value: 'fifty', label: '50 Punkte für Gegner' },
        { value: 'half', label: 'Halbes Gebot für Gegner' },
        { value: 'none', label: '0 Punkte' },
      ],
      default: 'fifty',
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
  isLegal(state: BinokelState, actor: Actor, move: BinokelMove): boolean {
    if (actor === 'system') return false;
    return legalMoves(state, actor).some((m) => sameValue(m, move));
  },
  applyMove,
  playerView,
  result,
  sampleHidden,
  bots: [binokelBot, ...generalBots<BinokelState, BinokelMove, BinokelState>()],
};

export { binokelBot } from './bot/index.js';
export { gameModule as default };
