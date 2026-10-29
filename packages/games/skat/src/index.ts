import { deckStyleOption, generalBots, sameValue, type Actor, type GameModule } from '@brett-und-blatt/engine';
import { skatBot } from './bots.js';
import { meta } from './meta.js';
import {
  applyMove,
  currentPlayers,
  legalMoves,
  playerView,
  result,
  sampleHidden,
  setup,
  type SkatDeclaration,
  type SkatGameType,
  type SkatMove,
  type SkatPhase,
  type SkatState,
} from './rules.js';

export type { SkatDeclaration, SkatGameType, SkatMove, SkatPhase, SkatState };
export {
  ALL_BID_VALUES,
  SKAT_BASE_VALUES,
  SKAT_RANKS,
  calculateGameValue,
  countSpitzen,
  createSkatDeck,
  nextPossibleBid,
} from './rules.js';

export const gameModule: GameModule<SkatState, SkatMove> = {
  info: meta,
  options: [
    {
      id: 'table',
      label: 'Tischgröße',
      choices: [
        { value: '3', label: '3 Spieler' },
        { value: '4', label: '4 Spieler (Geber setzt aus)' },
      ],
      default: '3',
    },
    {
      id: 'rounds',
      label: 'Spiele pro Serie',
      choices: [
        { value: '3', label: '3 Spiele' },
        { value: '6', label: '6 Spiele' },
        { value: '12', label: '12 Spiele' },
        { value: '24', label: '24 Spiele' },
        { value: '36', label: '36 Spiele (Turnier)' },
      ],
      default: '12',
    },
    deckStyleOption(),
    {
      id: 'countEyes',
      label: 'Lernhilfe: Augen mitzählen',
      choices: [
        { value: 'false', label: 'Aus (selbst mitzählen wie am Tisch)' },
        { value: 'true', label: 'An (Augenstände live einblenden)' },
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
  isLegal(state: SkatState, actor: Actor, move: SkatMove): boolean {
    if (actor === 'system') return false;
    const player = Number(actor);
    if (move.type === 'discard') {
      if (state.phase !== 'discard' || player !== state.declarerSeat) return false;
      const hand = state.hands[player] || [];
      if (hand.length !== 12) return false;
      const [c1, c2] = move.cards;
      if (c1 === c2) return false;
      return hand.includes(c1) && hand.includes(c2);
    }
    return legalMoves(state, actor).some((m) => sameValue(m, move));
  },
  applyMove,
  playerView,
  result,
  sampleHidden,
  bots: [skatBot, ...generalBots<SkatState, SkatMove, SkatState>()],
};
