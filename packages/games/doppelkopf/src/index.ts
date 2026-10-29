import { deckStyleOption, generalBots, sameValue, type Actor, type GameModule } from '@brett-und-blatt/engine';
import { dokoBot } from './bots.js';
import { meta } from './meta.js';
import {
  applyMove,
  currentPlayers,
  legalMoves,
  playerView,
  result,
  sampleHidden,
  setup,
  type DokoAnnouncement,
  type DokoContract,
  type DokoContractType,
  type DokoMove,
  type DokoPhase,
  type DokoState,
} from './rules.js';

export type {
  DokoAnnouncement,
  DokoContract,
  DokoContractType,
  DokoMove,
  DokoPhase,
  DokoState,
};
export { DOKO_RANKS, createDokoDeck } from './rules.js';

export const gameModule: GameModule<DokoState, DokoMove> = {
  info: meta,
  options: [
    {
      id: 'table',
      label: 'Tischgröße',
      choices: [
        { value: '4', label: '4 Spieler' },
        { value: '5', label: '5 Spieler (Geber setzt aus)' },
      ],
      default: '4',
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
      id: 'mandatorySolo',
      label: 'Pflichtsolo',
      choices: [
        { value: 'false', label: 'Aus' },
        { value: 'true', label: 'An (jeder muss pro Serie 1 Solo spielen)' },
      ],
      default: 'false',
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
  isLegal(state: DokoState, actor: Actor, move: DokoMove): boolean {
    return legalMoves(state, actor).some((m) => sameValue(m, move));
  },
  applyMove,
  playerView,
  result,
  sampleHidden,
  bots: [dokoBot, ...generalBots<DokoState, DokoMove, DokoState>()],
};
