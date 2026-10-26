/**
 * Schnelles Go-Brett für Regeln, Zufallspartien und Gebietsschätzung.
 *
 * Punkte sind zeilenweise von oben links nummeriert (0 … size² − 1). Belegung:
 * 0 = frei, 1 = Schwarz (Platz 0), 2 = Weiß (Platz 1).
 */
import type { Rng } from '@brett-und-blatt/engine';

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export type Color = typeof BLACK | typeof WHITE;

export const other = (color: Color): Color => (color === BLACK ? WHITE : BLACK);

/** Nachbarn und Diagonalen je Brettgröße, einmal berechnet. */
export interface Geometry {
  size: number;
  points: number;
  neighbors: Int16Array[];
  diagonals: Int16Array[];
}

const geometries = new Map<number, Geometry>();

export function geometry(size: number): Geometry {
  let geo = geometries.get(size);
  if (geo) return geo;
  const neighbors: Int16Array[] = [];
  const diagonals: Int16Array[] = [];
  for (let p = 0; p < size * size; p++) {
    const r = Math.floor(p / size);
    const c = p % size;
    const n: number[] = [];
    if (r > 0) n.push(p - size);
    if (r < size - 1) n.push(p + size);
    if (c > 0) n.push(p - 1);
    if (c < size - 1) n.push(p + 1);
    const d: number[] = [];
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < size && cc >= 0 && cc < size) d.push(rr * size + cc);
    }
    neighbors.push(Int16Array.from(n));
    diagonals.push(Int16Array.from(d));
  }
  geo = { size, points: size * size, neighbors, diagonals };
  geometries.set(size, geo);
  return geo;
}

/** Eine zusammenhängende Gruppe gleicher Farbe mit ihren Freiheiten. */
export interface Group {
  stones: number[];
  liberties: number[];
}

/** Gruppe, zu der der Stein auf `start` gehört. */
export function groupAt(board: ArrayLike<number>, geo: Geometry, start: number): Group {
  const color = board[start];
  const stones: number[] = [start];
  const liberties: number[] = [];
  const seen = new Uint8Array(geo.points);
  seen[start] = 1;
  for (let i = 0; i < stones.length; i++) {
    for (const n of geo.neighbors[stones[i]!]!) {
      if (seen[n]) continue;
      seen[n] = 1;
      if (board[n] === color) stones.push(n);
      else if (board[n] === EMPTY) liberties.push(n);
    }
  }
  return { stones, liberties };
}

/** Gruppennummer je Punkt (−1 frei) und Freiheiten je Gruppe – einmal für alle Punkte berechnet. */
export function labelGroups(board: ArrayLike<number>, geo: Geometry): { label: Int32Array; liberties: number[] } {
  const label = new Int32Array(geo.points).fill(-1);
  const liberties: number[] = [];
  const libSeen = new Int32Array(geo.points).fill(-1);
  for (let p = 0; p < geo.points; p++) {
    if (board[p] === EMPTY || label[p] !== -1) continue;
    const id = liberties.length;
    const color = board[p];
    const stack = [p];
    label[p] = id;
    let libs = 0;
    while (stack.length > 0) {
      const q = stack.pop()!;
      for (const n of geo.neighbors[q]!) {
        if (board[n] === color && label[n] === -1) {
          label[n] = id;
          stack.push(n);
        } else if (board[n] === EMPTY && libSeen[n] !== id) {
          libSeen[n] = id;
          libs++;
        }
      }
    }
    liberties.push(libs);
  }
  return { label, liberties };
}

/** Ergebnis eines Steins: geschlagene Steine oder null, wenn der Zug Selbstmord wäre. */
export function placeStone(board: number[] | Int8Array, geo: Geometry, point: number, color: Color): number[] | null {
  if (board[point] !== EMPTY) return null;
  board[point] = color;
  const enemy = other(color);
  const captured: number[] = [];
  for (const n of geo.neighbors[point]!) {
    if (board[n] !== enemy || captured.includes(n)) continue;
    const group = groupAt(board, geo, n);
    if (group.liberties.length === 0) {
      for (const s of group.stones) {
        board[s] = EMPTY;
        captured.push(s);
      }
    }
  }
  if (captured.length === 0 && groupAt(board, geo, point).liberties.length === 0) {
    board[point] = EMPTY;
    return null;
  }
  return captured;
}

/** Ist `point` ein eigenes Auge von `color`? (Alle Nachbarn eigen, höchstens eine fremde Diagonale, am Rand keine.) */
export function isEye(board: ArrayLike<number>, geo: Geometry, point: number, color: Color): boolean {
  if (board[point] !== EMPTY) return false;
  for (const n of geo.neighbors[point]!) if (board[n] !== color) return false;
  const diagonals = geo.diagonals[point]!;
  let bad = 0;
  for (const d of diagonals) if (board[d] === other(color)) bad++;
  return diagonals.length < 4 ? bad === 0 : bad <= 1;
}

/** Zobrist-Prüfsummen: zwei 32-Bit-Zufallszahlen je Punkt und Farbe, für alle Partien gleich. */
const zobristTables = new Map<number, Uint32Array>();

function zobrist(points: number): Uint32Array {
  let table = zobristTables.get(points);
  if (table) return table;
  table = new Uint32Array(points * 4);
  // Fester Startwert: Die Prüfsummen müssen auf jedem Gerät gleich sein.
  let x = 0x9e3779b9;
  for (let i = 0; i < table.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    table[i] = x >>> 0;
  }
  zobristTables.set(points, table);
  return table;
}

function hashText(hi: number, lo: number): string {
  return (hi >>> 0).toString(36) + '.' + (lo >>> 0).toString(36);
}

/**
 * Prüfsumme nach einem Zug, aus der alten berechnet: neuer Stein dazu, geschlagene weg.
 * Viel schneller als `positionHash` für jeden möglichen Zug.
 */
export function hashAfter(hash: string, points: number, point: number, color: Color, captured: readonly number[]): string {
  const table = zobrist(points);
  const [a, b] = hash.split('.');
  let hi = parseInt(a ?? '0', 36);
  let lo = parseInt(b ?? '0', 36);
  const flip = (p: number, v: number) => {
    const i = (p * 2 + (v - 1)) * 2;
    hi ^= table[i]!;
    lo ^= table[i + 1]!;
  };
  flip(point, color);
  for (const p of captured) flip(p, other(color));
  return hashText(hi, lo);
}

/** Prüfsumme einer Stellung (nur die Belegung, nicht wer am Zug ist: Positional Superko). */
export function positionHash(board: ArrayLike<number>): string {
  const table = zobrist(board.length);
  let hi = 0;
  let lo = 0;
  for (let p = 0; p < board.length; p++) {
    const v = board[p]!;
    if (v === EMPTY) continue;
    const i = (p * 2 + (v - 1)) * 2;
    hi ^= table[i]!;
    lo ^= table[i + 1]!;
  }
  return hashText(hi, lo);
}

/**
 * Flächenwertung: Steine plus umschlossenes Gebiet. Tote Steine zählen als geschlagen,
 * ihr Punkt gehört dem Gegner. Liefert auch, wem jeder Punkt gehört (0 neutral).
 */
export function areaScore(board: ArrayLike<number>, geo: Geometry, dead: Iterable<number> = []): { black: number; white: number; owner: number[] } {
  const cells = Array.from(board);
  for (const p of dead) cells[p] = EMPTY;
  const owner = cells.slice();
  const seen = new Uint8Array(geo.points);
  for (let p = 0; p < geo.points; p++) {
    if (cells[p] !== EMPTY || seen[p]) continue;
    const region: number[] = [p];
    seen[p] = 1;
    let touches = 0;
    for (let i = 0; i < region.length; i++) {
      for (const n of geo.neighbors[region[i]!]!) {
        const v = cells[n]!;
        if (v === EMPTY) {
          if (!seen[n]) {
            seen[n] = 1;
            region.push(n);
          }
        } else touches |= v;
      }
    }
    const who = touches === BLACK || touches === WHITE ? touches : EMPTY;
    for (const q of region) owner[q] = who;
  }
  let black = 0;
  let white = 0;
  for (const v of owner) {
    if (v === BLACK) black++;
    else if (v === WHITE) white++;
  }
  return { black, white, owner };
}

/** Schneller Zufallsgenerator für Zufallspartien (xorshift32), gestartet aus dem Seed-Rng. */
export class FastRandom {
  private x: number;
  constructor(rng: Rng) {
    this.x = (rng.int(0x7fffffff) | 1) >>> 0;
  }
  /** Ganze Zahl von 0 bis max − 1. */
  int(max: number): number {
    let x = this.x;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.x = x >>> 0;
    return this.x % max;
  }
}

/**
 * Zufallspartien auf einem schnellen Brett. Die Züge folgen einer leichten Strategie:
 * eigene Augen nicht füllen, Gruppen in Atari bevorzugt schlagen bzw. retten.
 * Ein Objekt lässt sich mit `reset` für viele Partien wiederverwenden.
 */
export class Playout {
  readonly board: Int8Array;
  readonly geo: Geometry;
  turn: Color = BLACK;
  ko = -1;
  passes = 0;
  /** Atari-Go: Wer zuerst schlägt, gewinnt. */
  firstCapture: Color | 0 = 0;
  private seen: Uint32Array;
  private stamp = 0;
  private stack: Int16Array;
  private libs: Int16Array;
  private libCount = 0;
  /** Freie Punkte als Liste mit Rückverweis, damit Setzen und Schlagen in O(1) nachgeführt werden. */
  private empty: Int16Array;
  private emptyAt: Int16Array;
  private emptyCount = 0;

  constructor(board: ArrayLike<number>, size: number, turn: Color, ko = -1, readonly atari = false) {
    this.geo = geometry(size);
    const n = this.geo.points;
    this.board = new Int8Array(n);
    this.seen = new Uint32Array(n);
    this.stack = new Int16Array(n);
    this.libs = new Int16Array(n);
    this.empty = new Int16Array(n);
    this.emptyAt = new Int16Array(n);
    this.reset(board, turn, ko);
  }

  reset(board: ArrayLike<number>, turn: Color, ko = -1, passes = 0): void {
    const n = this.geo.points;
    this.emptyCount = 0;
    for (let p = 0; p < n; p++) {
      const v = board[p]!;
      this.board[p] = v;
      if (v === EMPTY) this.addEmpty(p);
      else this.emptyAt[p] = -1;
    }
    this.turn = turn;
    this.ko = ko;
    this.passes = passes;
    this.firstCapture = 0;
  }

  private addEmpty(p: number): void {
    this.emptyAt[p] = this.emptyCount;
    this.empty[this.emptyCount++] = p;
  }

  private removeEmpty(p: number): void {
    const i = this.emptyAt[p]!;
    const last = this.empty[--this.emptyCount]!;
    this.empty[i] = last;
    this.emptyAt[last] = i;
    this.emptyAt[p] = -1;
  }

  /** Zählt die Freiheiten der Gruppe auf `start`, bricht bei `limit` ab; die Freiheiten stehen danach in `libs`. */
  private countLiberties(start: number, limit: number): number {
    const { board, seen, stack, libs } = this;
    const nb = this.geo.neighbors;
    const stamp = ++this.stamp;
    const color = board[start];
    let top = 0;
    stack[top++] = start;
    seen[start] = stamp;
    let count = 0;
    while (top > 0) {
      const p = stack[--top]!;
      const ns = nb[p]!;
      for (let k = 0; k < ns.length; k++) {
        const q = ns[k]!;
        if (seen[q] === stamp) continue;
        const v = board[q];
        if (v === color) {
          seen[q] = stamp;
          stack[top++] = q;
        } else if (v === EMPTY) {
          seen[q] = stamp;
          libs[count++] = q;
          if (count >= limit) {
            this.libCount = count;
            return count;
          }
        }
      }
    }
    this.libCount = count;
    return count;
  }

  /** Setzt einen Stein, wenn erlaubt (einfacher Ko, kein Selbstmord). Gibt false zurück, wenn nicht. Passen: −1. */
  play(point: number): boolean {
    const { board, geo } = this;
    if (point < 0) {
      this.passes++;
      this.ko = -1;
      this.turn = other(this.turn);
      return true;
    }
    if (board[point] !== EMPTY || point === this.ko) return false;
    const color = this.turn;
    const enemy = other(color);
    board[point] = color;
    let captured = 0;
    let lastCaptured = -1;
    const ns = geo.neighbors[point]!;
    for (let k = 0; k < ns.length; k++) {
      const n = ns[k]!;
      if (board[n] === enemy && this.countLiberties(n, 1) === 0) {
        captured += this.removeGroup(n);
        lastCaptured = n;
      }
    }
    if (captured === 0 && this.countLiberties(point, 1) === 0) {
      board[point] = EMPTY;
      return false;
    }
    this.removeEmpty(point);
    // Einfacher Ko: genau ein Stein geschlagen und der neue Stein steht allein mit einer Freiheit.
    this.ko = -1;
    if (captured === 1) {
      let alone = true;
      for (let k = 0; k < ns.length; k++) if (board[ns[k]!] === color) alone = false;
      if (alone && this.countLiberties(point, 2) === 1) this.ko = lastCaptured;
    }
    if (captured > 0 && this.atari && !this.firstCapture) this.firstCapture = color;
    this.passes = 0;
    this.turn = enemy;
    return true;
  }

  private removeGroup(start: number): number {
    const { board, geo, stack } = this;
    const color = board[start];
    let top = 0;
    stack[top++] = start;
    board[start] = EMPTY;
    this.addEmpty(start);
    let count = 0;
    while (top > 0) {
      const p = stack[--top]!;
      count++;
      const ns = geo.neighbors[p]!;
      for (let k = 0; k < ns.length; k++) {
        const n = ns[k]!;
        if (board[n] === color) {
          board[n] = EMPTY;
          this.addEmpty(n);
          stack[top++] = n;
        }
      }
    }
    return count;
  }

  /** Freiheiten der Gruppe auf `point`, höchstens `limit`. */
  liberties(point: number, limit: number): number[] {
    const count = this.countLiberties(point, limit);
    return Array.from(this.libs.subarray(0, count));
  }

  /** Wäre der Zug erlaubt? (ohne ihn auszuführen) */
  isLegal(point: number): boolean {
    const { board, geo } = this;
    if (board[point] !== EMPTY || point === this.ko) return false;
    const ns = geo.neighbors[point]!;
    for (let k = 0; k < ns.length; k++) if (board[ns[k]!] === EMPTY) return true;
    const color = this.turn;
    board[point] = color;
    let ok = false;
    for (let k = 0; k < ns.length && !ok; k++) {
      const n = ns[k]!;
      const libs = this.countLiberties(n, 1);
      ok = board[n] === color ? libs > 0 : libs === 0;
    }
    board[point] = EMPTY;
    return ok;
  }

  /**
   * Merkmale eines Zugs für die Vorbewertung im Suchbaum: Wie viele Steine schlägt er,
   * rettet er eine eigene Gruppe aus dem Atari, oder setzt er sich selbst ins Atari?
   */
  features(point: number): { captures: number; saves: boolean; selfAtari: boolean } {
    const { board, geo } = this;
    const color = this.turn;
    const enemy = other(color);
    const ns = geo.neighbors[point]!;
    let captures = 0;
    let inAtari = false;
    for (let k = 0; k < ns.length; k++) {
      const n = ns[k]!;
      if (board[n] === enemy && this.countLiberties(n, 2) === 1) captures++;
      else if (board[n] === color && this.countLiberties(n, 2) === 1) inAtari = true;
    }
    board[point] = color;
    const libs = this.countLiberties(point, 3);
    board[point] = EMPTY;
    return { captures, saves: inAtari && libs >= 2, selfAtari: captures === 0 && libs <= 1 };
  }

  /** Taktischer Zug nach dem letzten gegnerischen Stein: schlagen oder aus dem Atari retten. */
  private tacticalMove(last: number, random: FastRandom): number {
    if (last < 0) return -1;
    const { board, geo } = this;
    const color = this.turn;
    let found = -1;
    let seenCount = 0;
    const consider = (p: number) => {
      if (this.countLiberties(p, 2) !== 1) return;
      const lib = this.libs[0]!;
      if (!this.isLegal(lib)) return;
      // Gleichverteilt unter allen Kandidaten (Reservoir-Auswahl).
      if (random.int(++seenCount) === 0) found = lib;
    };
    if (board[last] === other(color)) consider(last);
    const ns = geo.neighbors[last]!;
    for (let k = 0; k < ns.length; k++) if (board[ns[k]!] === color) consider(ns[k]!);
    return found;
  }

  /** Zufälliger Zug: freie Punkte ab einer zufälligen Stelle durchgehen, Augen und Verbotenes überspringen. */
  private randomMove(random: FastRandom): number {
    const count = this.emptyCount;
    if (count === 0) return -1;
    const color = this.turn;
    const offset = random.int(count);
    for (let i = 0; i < count; i++) {
      const p = this.empty[(offset + i) % count]!;
      if (!isEye(this.board, this.geo, p, color) && this.isLegal(p)) return p;
    }
    return -1;
  }

  /** Spielt zufällig zu Ende. Gibt die Farbe des Siegers zurück. */
  run(random: FastRandom, komi: number, maxMoves: number, record?: (point: number, color: Color) => void): Color {
    let last = -1;
    for (let moves = 0; moves < maxMoves && this.passes < 2; moves++) {
      if (this.atari && this.firstCapture) break;
      const color = this.turn;
      let move = random.int(10) < 9 ? this.tacticalMove(last, random) : -1;
      if (move < 0) move = this.randomMove(random);
      this.play(move);
      if (move >= 0) record?.(move, color);
      last = move;
    }
    if (this.atari && this.firstCapture) return this.firstCapture;
    return this.simpleScore(komi) > 0 ? BLACK : WHITE;
  }

  /** Punkte Schwarz minus Weiß (mit Komi) – Steine plus Punkte, deren Nachbarn alle eine Farbe haben. */
  simpleScore(komi: number): number {
    const { board, geo } = this;
    let score = -komi;
    for (let p = 0; p < geo.points; p++) {
      const v = board[p];
      if (v === BLACK) score++;
      else if (v === WHITE) score--;
      else {
        let touch = 0;
        for (const n of geo.neighbors[p]!) touch |= board[n]!;
        if (touch === BLACK) score++;
        else if (touch === WHITE) score--;
      }
    }
    return score;
  }

  /** Besitz je Punkt am Ende: +1 Schwarz, −1 Weiß, 0 niemand. */
  ownership(out: Float64Array): void {
    const { board, geo } = this;
    for (let p = 0; p < geo.points; p++) {
      const v = board[p];
      if (v === BLACK) out[p]! += 1;
      else if (v === WHITE) out[p]! -= 1;
      else {
        let touch = 0;
        for (const n of geo.neighbors[p]!) touch |= board[n]!;
        if (touch === BLACK) out[p]! += 1;
        else if (touch === WHITE) out[p]! -= 1;
      }
    }
  }
}

/**
 * Schätzt, wem jeder Punkt am Ende gehört: Mittel über viele Zufallspartien,
 * +1 sicher Schwarz, −1 sicher Weiß.
 */
export function estimateOwnership(board: ArrayLike<number>, size: number, turn: Color, komi: number, playouts: number, rng: Rng): Float64Array {
  const sum = new Float64Array(size * size);
  const random = new FastRandom(rng);
  const game = new Playout(board, size, turn);
  for (let i = 0; i < playouts; i++) {
    game.reset(board, turn);
    game.run(random, komi, size * size * 3);
    game.ownership(sum);
  }
  for (let p = 0; p < sum.length; p++) sum[p] = sum[p]! / playouts;
  return sum;
}

/**
 * Vorschlag für tote Steine: Gruppen, deren Punkte in den Zufallspartien meist dem Gegner gehören.
 * Ganze Gruppen werden einheitlich markiert.
 */
export function guessDead(board: ArrayLike<number>, size: number, turn: Color, komi: number, rng: Rng, playouts = size <= 9 ? 300 : size <= 13 ? 200 : 120): number[] {
  const own = estimateOwnership(board, size, turn, komi, playouts, rng);
  const geo = geometry(size);
  const seen = new Uint8Array(geo.points);
  const dead: number[] = [];
  for (let p = 0; p < geo.points; p++) {
    if (board[p] === EMPTY || seen[p]) continue;
    const group = groupAt(board, geo, p);
    const sign = board[p] === BLACK ? 1 : -1;
    let mean = 0;
    for (const s of group.stones) {
      seen[s] = 1;
      mean += own[s]! * sign;
    }
    if (mean / group.stones.length < -0.2) dead.push(...group.stones);
  }
  return dead.sort((a, b) => a - b);
}
