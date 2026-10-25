import { Chess, type Move } from 'chess.js';

/**
 * Suchbot für Schach: Negamax mit Alpha-Beta-Schnitt, iterativer Vertiefung und
 * Ruhesuche (am Suchende werden Schlagabtausche noch zu Ende gerechnet, damit der
 * Bot nicht mitten in einem Abtausch falsch bewertet). Bewertet werden Material
 * und Figurenstellung mit bewährten Feldtabellen („Simplified Evaluation Function“).
 */

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100_000;

// Feldtabellen aus Sicht von Weiß, Index 0 = a8 … 63 = h1 (wie chess.board()).
const PST: Record<string, number[]> = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  kEnd: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
};

class TimeUp extends Error {}

export interface SearchOptions {
  maxDepth: number;
  timeBudgetMs: number;
  now?: () => number;
  /** Zufallszahl 0–1 für gleich gute Züge und für Ungenauigkeit auf leichten Stufen. */
  random?: () => number;
  /** Zufällige Abweichung der Bewertung in Centipawns (1/100 Bauer) – macht schwächere Stufen menschlicher. */
  noise?: number;
}

export class ChessSearch {
  private readonly chess: Chess;
  private deadline = Infinity;
  private now: () => number = () => Date.now();
  nodes = 0;

  constructor(fen: string) {
    this.chess = new Chess(fen);
  }

  /** Bewertung aus Sicht der Seite, die am Zug ist. */
  evaluate(): number {
    const board = this.chess.board();
    let score = 0;
    let material = 0;
    for (const row of board) for (const square of row) if (square && square.type !== 'p' && square.type !== 'k') material += VALUE[square.type] ?? 0;
    const endgame = material <= 2600;
    board.forEach((row, r) =>
      row.forEach((square, c) => {
        if (!square) return;
        const table = square.type === 'k' && endgame ? PST.kEnd : PST[square.type];
        const index = square.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;
        const value = (VALUE[square.type] ?? 0) + (table?.[index] ?? 0);
        score += square.color === 'w' ? value : -value;
      }),
    );
    return this.chess.turn() === 'w' ? score : -score;
  }

  /** Bester Zug für die Seite am Zug. */
  bestMove(options: SearchOptions): Move {
    this.now = options.now ?? (() => Date.now());
    this.deadline = this.now() + options.timeBudgetMs;
    this.nodes = 0;
    const random = options.random ?? Math.random;
    let rootMoves = this.ordered(this.chess.moves({ verbose: true }));
    if (rootMoves.length === 0) throw new Error('Keine erlaubten Züge.');
    // Schnelle Vorbewertung ohne Vorausrechnen: findet auch unter Zeitdruck Matt in eins und hängende Figuren.
    let best = this.quickBest(rootMoves);
    rootMoves = [best, ...rootMoves.filter((m) => m !== best)];

    for (let depth = 1; depth <= options.maxDepth; depth++) {
      try {
        let bestScore = -Infinity;
        const scored: { move: Move; score: number }[] = [];
        for (const move of rootMoves) {
          this.chess.move(move);
          // Mit Rauschen braucht jeder Zug einen genauen Wert, sonst könnte eine bloße Schranke den besten Zug überholen.
          const beta = options.noise ? Infinity : 1 - bestScore;
          const score = -this.negamax(depth - 1, -Infinity, beta, 1) + (options.noise ? (random() - 0.5) * 2 * options.noise : 0);
          this.chess.undo();
          scored.push({ move, score });
          if (score > bestScore) bestScore = score;
        }
        const top = scored.filter((s) => s.score >= bestScore - (options.noise ? 0 : 0.5));
        best = (top[Math.floor(random() * top.length)] ?? scored[0])!.move;
        rootMoves = [best, ...rootMoves.filter((m) => m !== best)];
        if (Math.abs(bestScore) > MATE - 1000) break;
      } catch (error) {
        if (error instanceof TimeUp) break;
        throw error;
      }
    }
    return best;
  }

  private quickBest(moves: Move[]): Move {
    let best = moves[0] as Move;
    let bestScore = -Infinity;
    for (const move of moves) {
      this.chess.move(move);
      const score = this.chess.inCheck() && this.chess.moves().length === 0 ? MATE : -this.evaluate();
      this.chess.undo();
      if (score > bestScore) [best, bestScore] = [move, score];
    }
    return best;
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number): number {
    if ((++this.nodes & 255) === 0 && this.now() > this.deadline) throw new TimeUp();
    const inCheck = this.chess.inCheck();
    if (depth <= 0 && !inCheck) return this.quiesce(alpha, beta, 0);
    const moves = this.chess.moves({ verbose: true });
    if (moves.length === 0) return inCheck ? -MATE + ply : 0;
    if (depth <= 0) return this.quiesce(alpha, beta, 0);
    if (this.chess.isInsufficientMaterial() || this.chess.isDrawByFiftyMoves()) return 0;
    let best = -Infinity;
    for (const move of this.ordered(moves)) {
      this.chess.move(move);
      const score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      this.chess.undo();
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  /** Ruhesuche: nur Schlagzüge, bis die Stellung „ruhig“ ist. */
  private quiesce(alpha: number, beta: number, depth: number): number {
    if ((++this.nodes & 255) === 0 && this.now() > this.deadline) throw new TimeUp();
    const standPat = this.evaluate();
    if (standPat >= beta || depth >= 4) return standPat;
    if (standPat > alpha) alpha = standPat;
    const captures = this.ordered(this.chess.moves({ verbose: true }).filter((m) => m.captured || m.promotion));
    for (const move of captures) {
      this.chess.move(move);
      const score = -this.quiesce(-beta, -alpha, depth + 1);
      this.chess.undo();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  /** Gute Züge zuerst: Umwandlungen, wertvolle Figur mit billiger schlagen, Schach. */
  private ordered(moves: Move[]): Move[] {
    const rank = (m: Move) => (m.promotion ? 1000 : 0) + (m.captured ? 10 * (VALUE[m.captured] ?? 0) - (VALUE[m.piece] ?? 0) : 0) + (m.san.includes('+') ? 50 : 0);
    return [...moves].sort((a, b) => rank(b) - rank(a));
  }
}
