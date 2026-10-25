import { generalBots, mctsSearch, stateFor, type BotDefinition, type BotLevel, type GameModule } from '@brett-und-blatt/engine';
import { meta } from './meta';
import { applyMove, currentPlayers, legalMoves, result, setup, type UltimateMove, type UltimateState } from './rules';

export type { UltimateMove, UltimateState } from './rules';
export { playableBoards } from './rules';

const ITERATIONS: Record<BotLevel, number> = { easy: 150, medium: 3_000, hard: 200_000 };

/**
 * Monte-Carlo-Baumsuche: Für Ultimate Tic-Tac-Toe ist eine gute Stellungsbewertung
 * schwierig, zufällige Testpartien schätzen den Wert eines Zuges dagegen gut.
 */
const ultimateBot: BotDefinition<UltimateState, UltimateMove> = {
  id: 'ultimate',
  name: 'Monte-Carlo',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    return mctsSearch(ctx.module, stateFor(ctx), ctx.seat, ctx.rng, {
      iterations: ITERATIONS[ctx.level],
      timeBudgetMs: ctx.timeBudgetMs,
      now: ctx.now,
      winCheck: ctx.level !== 'easy',
    });
  },
};

export const gameModule: GameModule<UltimateState, UltimateMove> = {
  info: meta,
  options: [
    {
      id: 'decided',
      label: 'Entschiedene Felder',
      description: 'Darf man in einem schon gewonnenen kleinen Feld weiterspielen?',
      choices: [
        { value: 'locked', label: 'Gesperrt' },
        { value: 'playable', label: 'Weiter bespielbar' },
      ],
      default: 'locked',
    },
    {
      id: 'drawBoard',
      label: 'Unentschiedenes kleines Feld',
      choices: [
        { value: 'none', label: 'Zählt für niemanden' },
        { value: 'both', label: 'Zählt für beide' },
      ],
      default: 'none',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 15_000 },
    fast: { kind: 'perMove', moveMs: 7_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView: (state) => state,
  result,
  bots: [ultimateBot, ...generalBots<UltimateState, UltimateMove, UltimateState>()],
};
