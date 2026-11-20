import { alphaBetaSearch, stateFor, type BotDefinition, type BotLevel } from '@brett-und-blatt/engine';
import { BOARD_COLORS, SIZE, evaluate, goalRow, threatens, towerSquare, type DragonTowersMove, type DragonTowersState } from './rules';

/** Rechentiefe und Zeitdeckel je Stufe. */
const LEVELS: Record<BotLevel, { depth: number; maxMs: number; randomChance: number }> = {
  easy: { depth: 1, maxMs: 200, randomChance: 0.35 },
  medium: { depth: 3, maxMs: 600, randomChance: 0 },
  hard: { depth: 7, maxMs: 1_200, randomChance: 0 },
};

/**
 * Gute Züge zuerst: Ziel erreichen, dann Züge, nach denen der Gegner keinen
 * bedrohenden Turm ziehen muss, dann weite Züge.
 */
export function orderMoves(state: DragonTowersState, moves: DragonTowersMove[]): DragonTowersMove[] {
  const score = (move: DragonTowersMove): number => {
    if (move.type === 'pass') return 0;
    const seat = state.turn;
    if (Math.floor(move.to / SIZE) === goalRow(seat)) return 10_000;
    const forced = towerSquare(state, 1 - seat, BOARD_COLORS[move.to]!);
    // Grobe Vorschau: Steht der erzwungene Gegnerturm schon mit freier Bahn da, ist der Zug schlecht.
    const danger = forced >= 0 && forced !== move.from && threatens(state, forced) ? -5_000 : 0;
    return danger + Math.abs(Math.floor(move.from / SIZE) - Math.floor(move.to / SIZE));
  };
  return [...moves].sort((a, b) => score(b) - score(a));
}

/**
 * Standard-Bot „Vorausrechner“: rechnet mit Alpha-Beta voraus.
 * - leicht: ein Zug tief, oft ein zufälliger Zug
 * - mittel: drei Züge tief
 * - schwer: bis zu sieben Züge tief mit Zeitdeckel
 */
export const dragonTowersBot: BotDefinition<DragonTowersState, DragonTowersMove> = {
  id: 'dragon-towers',
  name: 'Vorausrechner',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const state = stateFor(ctx);
    const moves = ctx.module.legalMoves(state, ctx.seat);
    const level = LEVELS[ctx.level];
    if (moves.length === 1) return moves[0]!;
    // Ein sofortiger Sieg wird nie verschenkt, auch nicht auf „leicht“.
    const winning = moves.find((m) => m.type === 'move' && Math.floor(m.to / SIZE) === goalRow(ctx.seat));
    if (winning) return winning;
    if (level.randomChance > 0 && ctx.rng.chance(level.randomChance)) return ctx.rng.pick(moves);
    return alphaBetaSearch(ctx.module, state, ctx.seat, {
      maxDepth: level.depth,
      evaluate,
      orderMoves,
      timeBudgetMs: Math.min(level.maxMs, ctx.timeBudgetMs),
      now: ctx.now,
    }).move;
  },
};
