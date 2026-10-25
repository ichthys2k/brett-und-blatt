import { Rng, type SeatId } from '@brett-und-blatt/engine';
import type { FourInARowState } from './rules';

/** Wert eines Sieges; schnellere Siege zählen etwas mehr. */
const WIN = 1_000_000;
/** Gewichte für Fenster mit 1, 2 oder 3 eigenen Steinen und sonst nur leeren Feldern. */
const WINDOW_WEIGHTS = [0, 1, 5, 25];
const CENTER_BONUS = 3;

class TimeUp extends Error {}

interface TableEntry {
  check: number;
  depth: number;
  score: number;
  flag: 0 | 1 | 2;
  best: number;
}

const EXACT = 0;
const LOWER = 1;
const UPPER = 2;

/**
 * Suchbot für Vier in einer Reihe: Negamax mit Alpha-Beta-Schnitt, iterativer
 * Vertiefung und einer Merktabelle (Transpositionstabelle). Statt des
 * unveränderlichen Spielstands rechnet er auf einem Feld aus Zahlen, auf dem
 * Züge gesetzt und wieder zurückgenommen werden – das ist um ein Vielfaches schneller.
 */
export class FourInARowSearch {
  private readonly cols: number;
  private readonly rows: number;
  /** 0 = leer, 1 = Platz 0, 2 = Platz 1. */
  private readonly board: Int8Array;
  private readonly heights: Int8Array;
  private readonly windows: Int16Array;
  private readonly cellWindows: number[][];
  private readonly order: number[];
  private readonly zobristLo: Uint32Array;
  private readonly zobristHi: Uint32Array;
  private readonly table = new Map<number, TableEntry>();
  private hashLo = 0;
  private hashHi = 0;
  private filled = 0;
  private ply = 0;
  private nodes = 0;
  private deadline = Infinity;
  private now: () => number = () => Date.now();

  constructor(state: FourInARowState) {
    this.cols = state.cols;
    this.rows = state.rows;
    this.board = new Int8Array(state.cols * state.rows);
    this.heights = new Int8Array(state.cols);

    const zobrist = Rng.fromSeed('vier-in-einer-reihe', 'zobrist');
    const size = state.cols * state.rows * 3;
    this.zobristLo = Uint32Array.from({ length: size }, () => Math.floor(zobrist.next() * 2 ** 32));
    this.zobristHi = Uint32Array.from({ length: size }, () => Math.floor(zobrist.next() * 2 ** 21));

    state.cells.forEach((cell, index) => {
      if (cell === null) return;
      this.board[index] = cell + 1;
      this.hashLo ^= this.zobristLo[index * 3 + cell + 1] ?? 0;
      this.hashHi ^= this.zobristHi[index * 3 + cell + 1] ?? 0;
      this.filled++;
    });
    for (let col = 0; col < state.cols; col++) {
      let height = 0;
      while (height < state.rows && this.board[col * state.rows + height] !== 0) height++;
      this.heights[col] = height;
    }

    // Mittlere Spalten zuerst untersuchen: Sie sind meist die besten.
    const center = (state.cols - 1) / 2;
    this.order = Array.from({ length: state.cols }, (_, c) => c).sort((a, b) => Math.abs(a - center) - Math.abs(b - center));

    const windows: number[] = [];
    this.cellWindows = Array.from({ length: state.cols * state.rows }, () => []);
    for (let col = 0; col < state.cols; col++) {
      for (let row = 0; row < state.rows; row++) {
        for (const [dc, dr] of [
          [1, 0],
          [0, 1],
          [1, 1],
          [1, -1],
        ] as const) {
          const endCol = col + 3 * dc;
          const endRow = row + 3 * dr;
          if (endCol < 0 || endCol >= state.cols || endRow < 0 || endRow >= state.rows) continue;
          const id = windows.length / 4;
          for (let i = 0; i < 4; i++) {
            const index = (col + i * dc) * state.rows + (row + i * dr);
            windows.push(index);
            this.cellWindows[index]?.push(id);
          }
        }
      }
    }
    this.windows = Int16Array.from(windows);
  }

  /**
   * Bester Zug für `seat`. Bei gleich guten Zügen entscheidet der Zufall,
   * damit sich Partien nicht immer gleich anfühlen.
   */
  bestColumn(seat: SeatId, options: { maxDepth: number; timeBudgetMs: number; now?: () => number; rng?: Rng }): number {
    this.now = options.now ?? (() => Date.now());
    this.deadline = this.now() + options.timeBudgetMs;
    this.nodes = 0;
    const player = seat + 1;
    const playable = this.order.filter((col) => (this.heights[col] ?? 0) < this.rows);
    if (playable.length === 0) throw new Error('Keine Spalte frei.');

    // Sofortiger Sieg geht immer vor.
    for (const col of playable) if (this.winsWith(col, player)) return col;

    let best = playable[0] as number;
    let rootOrder = playable;
    const maxDepth = Math.min(options.maxDepth, this.cols * this.rows - this.filled);
    for (let depth = 1; depth <= maxDepth; depth++) {
      try {
        const scores = new Map<number, number>();
        let bestScore = -Infinity;
        for (const col of rootOrder) {
          this.make(col, player);
          // Fenster knapp unter dem bisher Besten: Gleich gute Züge werden exakt bewertet.
          const score = -this.negamax(depth - 1, -Infinity, -(bestScore - 1), 3 - player);
          this.unmake(col, player);
          scores.set(col, score);
          if (score > bestScore) bestScore = score;
        }
        const tied = rootOrder.filter((col) => scores.get(col) === bestScore);
        best = options.rng ? options.rng.pick(tied) : (tied[0] as number);
        rootOrder = [best, ...rootOrder.filter((c) => c !== best)];
        if (Math.abs(bestScore) >= WIN - 1000) break;
      } catch (error) {
        if (error instanceof TimeUp) break;
        throw error;
      }
    }
    return best;
  }

  private negamax(depth: number, alpha: number, beta: number, player: number): number {
    if ((++this.nodes & 4095) === 0 && this.now() > this.deadline) throw new TimeUp();
    if (this.filled === this.cols * this.rows) return 0;

    for (const col of this.order) {
      if ((this.heights[col] ?? 0) < this.rows && this.winsWith(col, player)) return WIN - this.ply - 1;
    }
    if (depth === 0) return this.evaluate(player);

    const key = this.hashLo * 2 ** 21 + this.hashHi;
    const entry = this.table.get(key);
    const alphaStart = alpha;
    if (entry && entry.check === this.filled && entry.depth >= depth) {
      if (entry.flag === EXACT) return entry.score;
      if (entry.flag === LOWER) alpha = Math.max(alpha, entry.score);
      else beta = Math.min(beta, entry.score);
      if (alpha >= beta) return entry.score;
    }

    let best = -Infinity;
    let bestCol = -1;
    const first = entry?.best ?? -1;
    const moves = first >= 0 ? [first, ...this.order.filter((c) => c !== first)] : this.order;
    for (const col of moves) {
      if ((this.heights[col] ?? 0) >= this.rows) continue;
      this.make(col, player);
      const score = -this.negamax(depth - 1, -beta, -alpha, 3 - player);
      this.unmake(col, player);
      if (score > best) {
        best = score;
        bestCol = col;
      }
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }

    // Siegwerte hängen von der Tiefe ab und werden deshalb nicht gemerkt.
    if (Math.abs(best) < WIN - 1000) {
      if (this.table.size > 400_000) this.table.clear();
      const flag = best <= alphaStart ? UPPER : best >= beta ? LOWER : EXACT;
      this.table.set(key, { check: this.filled, depth, score: best, flag, best: bestCol });
    }
    return best;
  }

  /** Würde ein Stein in dieser Spalte für `player` einen Vierer ergeben? */
  private winsWith(col: number, player: number): boolean {
    const index = col * this.rows + (this.heights[col] ?? 0);
    this.board[index] = player;
    let win = false;
    for (const id of this.cellWindows[index] ?? []) {
      const w = id * 4;
      if (this.board[this.windows[w]!] === player && this.board[this.windows[w + 1]!] === player && this.board[this.windows[w + 2]!] === player && this.board[this.windows[w + 3]!] === player) {
        win = true;
        break;
      }
    }
    this.board[index] = 0;
    return win;
  }

  /** Bewertung aus Sicht von `player`: offene Fenster mit eigenen Steinen, Steine in der Mitte. */
  private evaluate(player: number): number {
    const other = 3 - player;
    let score = 0;
    for (let w = 0; w < this.windows.length; w += 4) {
      let own = 0;
      let theirs = 0;
      for (let i = 0; i < 4; i++) {
        const value = this.board[this.windows[w + i]!];
        if (value === player) own++;
        else if (value === other) theirs++;
      }
      if (theirs === 0) score += WINDOW_WEIGHTS[own] ?? 0;
      else if (own === 0) score -= WINDOW_WEIGHTS[theirs] ?? 0;
    }
    if (this.cols % 2 === 1) {
      const center = (this.cols - 1) / 2;
      for (let row = 0; row < this.rows; row++) {
        const value = this.board[center * this.rows + row];
        if (value === player) score += CENTER_BONUS;
        else if (value === other) score -= CENTER_BONUS;
      }
    }
    return score;
  }

  private make(col: number, player: number): void {
    const index = col * this.rows + (this.heights[col] ?? 0);
    this.board[index] = player;
    this.heights[col] = (this.heights[col] ?? 0) + 1;
    this.hashLo = (this.hashLo ^ (this.zobristLo[index * 3 + player] ?? 0)) >>> 0;
    this.hashHi ^= this.zobristHi[index * 3 + player] ?? 0;
    this.filled++;
    this.ply++;
  }

  private unmake(col: number, player: number): void {
    this.heights[col] = (this.heights[col] ?? 0) - 1;
    const index = col * this.rows + (this.heights[col] ?? 0);
    this.board[index] = 0;
    this.hashLo = (this.hashLo ^ (this.zobristLo[index * 3 + player] ?? 0)) >>> 0;
    this.hashHi ^= this.zobristHi[index * 3 + player] ?? 0;
    this.filled--;
    this.ply--;
  }
}
