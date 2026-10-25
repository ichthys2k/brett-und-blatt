import { randomBot, type BotDefinition, type BotLevel, type GameModule } from '@brett-und-blatt/engine';
import { meta } from './meta';
import { applyMove, currentPlayers, legalMoves, result, setup, type ChessMove, type ChessState, type Promotion } from './rules';
import { ChessSearch } from './search';

export type { ChessEnd, ChessMove, ChessState, Promotion } from './rules';
export { turnSeat } from './rules';

/** Suchtiefe, Zeit und Ungenauigkeit (in Hundertstel Bauern) je Stufe. */
const LEVELS: Record<BotLevel, { depth: number; maxMs: number; noise: number }> = {
  easy: { depth: 1, maxMs: 300, noise: 150 },
  medium: { depth: 2, maxMs: 800, noise: 30 },
  hard: { depth: 8, maxMs: Infinity, noise: 0 },
};

/**
 * Standard-Bot und Tipp-Geber: rechnet mit Alpha-Beta voraus.
 * - leicht: einen Halbzug tief und ungenau – übersieht gern etwas
 * - mittel: zwei Halbzüge plus Schlagabtausche
 * - schwer: so tief, wie die Zeit erlaubt
 */
const chessBot: BotDefinition<ChessState, ChessMove> = {
  id: 'chess',
  name: 'Vorausrechner',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const level = LEVELS[ctx.level];
    const move = new ChessSearch(ctx.view.fen).bestMove({
      maxDepth: level.depth,
      timeBudgetMs: Math.min(level.maxMs, ctx.timeBudgetMs),
      now: ctx.now,
      random: () => ctx.rng.next(),
      noise: level.noise,
    });
    return move.promotion ? { type: 'move', from: move.from, to: move.to, promotion: move.promotion as Promotion } : { type: 'move', from: move.from, to: move.to };
  },
};

export const gameModule: GameModule<ChessState, ChessMove> = {
  info: meta,
  options: [],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'chessClock', baseMs: 600_000, incrementMs: 5_000 },
    fast: { kind: 'chessClock', baseMs: 300_000, incrementMs: 3_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView: (state) => state,
  result,
  // Die allgemeine Monte-Carlo-Suche ist für Schach zu schwach und zu langsam; der Zufallsbot bleibt zum Testen.
  bots: [chessBot, randomBot as unknown as BotDefinition<ChessState, ChessMove>],
};
