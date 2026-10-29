import { randomBot, type BotDefinition, type BotLevel, type GameModule } from '@brett-und-blatt/engine';
import { meta } from './meta';
import { applyMove, currentPlayers, isLegal, legalMoves, result, setup, type ChessMove, type ChessState, type Promotion } from './rules';
import { ChessSearch } from './search';

export type { BoardMove, ChessEnd, ChessMove, ChessState, Promotion } from './rules';
export { loadFromPgn, toPgn, turnSeat } from './rules';

/**
 * Ab welchem Rückstand (in Hundertstel Bauern, aus Sicht des Bots) nimmt er ein Remis an?
 * „Leicht“ nimmt schon bei ausgeglichener Stellung an, „schwer“ erst, wenn er klar schlechter steht.
 */
const ACCEPT_DRAW_AT: Record<BotLevel, number> = { easy: 0, medium: -150, hard: -300 };

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
 * Ein Remis-Angebot nimmt er an, wenn er nach seiner Bewertung schlechter steht (`ACCEPT_DRAW_AT`);
 * selbst bietet er keins an.
 */
const chessBot: BotDefinition<ChessState, ChessMove> = {
  id: 'chess',
  name: 'Vorausrechner',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    if (ctx.view.drawOffer?.by != null) {
      // Die Bewertung gilt für die Seite am Zug – das ist der Anbieter.
      const ownScore = -new ChessSearch(ctx.view.fen).evaluate();
      return { type: ownScore <= ACCEPT_DRAW_AT[ctx.level] ? 'acceptDraw' : 'declineDraw' };
    }
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
  options: [
    {
      id: 'board',
      label: 'Brett drehen',
      description: 'Wichtig, wenn zwei an einem Gerät spielen: Soll sich das Brett nach jedem Zug zur Farbe am Zug drehen?',
      choices: [
        { value: 'turn', label: 'Zum Spieler am Zug' },
        { value: 'fixed', label: 'Fest' },
      ],
      default: 'turn',
    },
    {
      // Eingefügte Partie zum Fortsetzen – füllt `SetupExtra` der Oberfläche (nur am eigenen Gerät).
      id: 'pgn',
      label: 'PGN-Partie',
      hidden: true,
      pattern: '[\\s\\S]*',
      maxLength: 8000,
      choices: [{ value: '', label: 'keine' }],
      default: '',
    },
  ],
  timePresets: {
    relaxed: { kind: 'none' },
    normal: { kind: 'chessClock', baseMs: 600_000, incrementMs: 5_000 },
    fast: { kind: 'chessClock', baseMs: 300_000, incrementMs: 3_000 },
  },
  setup,
  currentPlayers,
  legalMoves,
  isLegal,
  applyMove,
  playerView: (state) => state,
  result,
  // Die allgemeine Monte-Carlo-Suche ist für Schach zu schwach und zu langsam; der Zufallsbot bleibt zum Testen.
  bots: [chessBot, randomBot as unknown as BotDefinition<ChessState, ChessMove>],
};
