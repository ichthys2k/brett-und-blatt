import { alphaBetaSearch, generalBots, stateFor, type BotDefinition, type BotLevel, type GameModule } from '@brett-und-blatt/engine';
import { meta } from './meta';
import { applyMove, currentPlayers, evaluate, legalMoves, result, setup, type MillMove, type MillState } from './rules';

export type { MillMove, MillState, Phase } from './rules';
export { isInMill, phaseOf, removable, stonesOnBoard } from './rules';
export { LINES, POINTS, pointName } from './board';

const DEPTH: Record<BotLevel, number> = { easy: 2, medium: 4, hard: 30 };

/** Züge mit Wegnehmen zuerst – sie sind meist die stärksten. */
function orderMoves(_state: MillState, moves: MillMove[]): MillMove[] {
  return [...moves].sort((a, b) => b.remove.length - a.remove.length);
}

/**
 * Standard-Bot: Alpha-Beta mit Bewertung von Steinen, Mühlen, offenen Zweiern
 * und Beweglichkeit.
 */
const millBot: BotDefinition<MillState, MillMove> = {
  id: 'mill',
  name: 'Vorausrechner',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const state = stateFor(ctx);
    if (ctx.level === 'easy' && ctx.rng.chance(0.25)) return ctx.rng.pick(ctx.module.legalMoves(state, ctx.seat));
    return alphaBetaSearch(ctx.module, state, ctx.seat, {
      maxDepth: DEPTH[ctx.level],
      timeBudgetMs: ctx.level === 'hard' ? ctx.timeBudgetMs : Math.min(ctx.timeBudgetMs, 800),
      now: ctx.now,
      evaluate,
      orderMoves,
    }).move;
  },
};

export const gameModule: GameModule<MillState, MillMove> = {
  info: meta,
  options: [
    {
      id: 'flying',
      label: 'Springen',
      description: 'Mit nur noch drei Steinen darf man auf jeden freien Punkt springen.',
      choices: [
        { value: 'on', label: 'An' },
        { value: 'off', label: 'Aus' },
      ],
      default: 'on',
    },
    {
      id: 'removeFromMills',
      label: 'Steine aus Mühlen nehmen',
      choices: [
        { value: 'fallback', label: 'Nur wenn nötig' },
        { value: 'always', label: 'Immer erlaubt' },
      ],
      default: 'fallback',
    },
    {
      id: 'doubleMill',
      label: 'Doppelmühle',
      description: 'Wer mit einem Zug zwei Mühlen schließt …',
      choices: [
        { value: 'one', label: 'nimmt einen Stein' },
        { value: 'two', label: 'nimmt zwei Steine' },
      ],
      default: 'one',
    },
    {
      id: 'drawRule',
      label: 'Unentschieden nach',
      choices: [
        { value: '50', label: '50 Zügen ohne Mühle' },
        { value: '30', label: '30 Zügen ohne Mühle' },
        { value: 'off', label: 'Aus' },
      ],
      default: '50',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'perMove', moveMs: 20_000 },
    fast: { kind: 'chessClock', baseMs: 180_000, incrementMs: 2_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView: (state) => state,
  result,
  evaluate,
  bots: [millBot, ...generalBots<MillState, MillMove, MillState>()],
};
