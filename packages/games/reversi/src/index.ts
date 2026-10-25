import { alphaBetaSearch, generalBots, stateFor, type BotDefinition, type BotLevel, type GameModule } from '@brett-und-blatt/engine';
import { meta } from './meta';
import { applyMove, currentPlayers, evaluate, legalMoves, result, setup, type ReversiMove, type ReversiState } from './rules';

export type { ReversiMove, ReversiState } from './rules';
export { countStones, flipsFor } from './rules';

const DEPTH: Record<BotLevel, number> = { easy: 1, medium: 4, hard: 60 };

/** Ecken zuerst untersuchen, dann Ränder – so schneidet Alpha-Beta mehr ab. */
function orderMoves(state: ReversiState, moves: ReversiMove[]): ReversiMove[] {
  const last = state.size - 1;
  const rank = (cell: number) => {
    const r = Math.floor(cell / state.size);
    const c = cell % state.size;
    if ((r === 0 || r === last) && (c === 0 || c === last)) return 0;
    if (r === 0 || r === last || c === 0 || c === last) return 1;
    return 2;
  };
  return [...moves].sort((a, b) => rank(a.cell) - rank(b.cell));
}

/**
 * Standard-Bot: Alpha-Beta mit Stellungsbewertung.
 * - leicht: gierig – nimmt den Zug, der sofort am meisten bringt
 * - mittel: 4 Halbzüge voraus
 * - schwer: so tief, wie die Zeit erlaubt; im Endspiel oft bis zum Schluss
 */
const reversiBot: BotDefinition<ReversiState, ReversiMove> = {
  id: 'reversi',
  name: 'Vorausrechner',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const state = stateFor(ctx);
    if (ctx.level === 'easy' && ctx.rng.chance(0.3)) return ctx.rng.pick(ctx.module.legalMoves(state, ctx.seat));
    return alphaBetaSearch(ctx.module, state, ctx.seat, {
      maxDepth: DEPTH[ctx.level],
      timeBudgetMs: ctx.level === 'hard' ? ctx.timeBudgetMs : Math.min(ctx.timeBudgetMs, 700),
      now: ctx.now,
      evaluate,
      orderMoves,
    }).move;
  },
};

export const gameModule: GameModule<ReversiState, ReversiMove> = {
  info: meta,
  options: [
    {
      id: 'size',
      label: 'Brettgröße',
      choices: [
        { value: '6', label: '6 × 6' },
        { value: '8', label: '8 × 8' },
        { value: '10', label: '10 × 10' },
      ],
      default: '8',
    },
    {
      id: 'opening',
      label: 'Eröffnung',
      description: 'Bei der freien Eröffnung setzen beide die ersten vier Steine selbst in die Mitte.',
      choices: [
        { value: 'cross', label: 'Kreuzstellung' },
        { value: 'free', label: 'Frei' },
      ],
      default: 'cross',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 15_000 },
    fast: { kind: 'chessClock', baseMs: 180_000, incrementMs: 2_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView: (state) => state,
  result,
  evaluate,
  bots: [reversiBot, ...generalBots<ReversiState, ReversiMove, ReversiState>()],
};
