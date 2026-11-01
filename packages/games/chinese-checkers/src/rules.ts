import type { GameEvent, MoveResult, Options, Result, SeatId } from '@brett-und-blatt/engine';

/**
 * Sternhalma auf dem Sternbrett mit 121 Löchern.
 *
 * Das Brett besteht aus einem Sechseck (61 Löcher) und sechs Zacken mit je 10 Löchern. Jeder
 * Spieler beginnt in einer Zacke und muss alle Steine in die gegenüberliegende bringen. Ein Zug
 * ist ein Schritt auf ein freies Nachbarloch oder eine Kette von Sprüngen über je einen
 * Nachbarstein (gleich welcher Farbe) auf das freie Loch dahinter.
 *
 * Koordinaten: axial (q, r) mit s = −q − r, Spitzen oben (Zeile r wächst nach unten).
 */

export interface Cell {
  q: number;
  r: number;
}

/** Sechs Richtungen zu den Nachbarn. */
export const DIRECTIONS: readonly Cell[] = [
  { q: 1, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 1 },
];

function inStar(q: number, r: number): boolean {
  const s = -q - r;
  const upward = q >= -4 && r >= -4 && s >= -4;
  const downward = q <= 4 && r <= 4 && s <= 4;
  return upward || downward;
}

/** Alle 121 Löcher, zeilenweise von oben nach unten. */
export const CELLS: readonly Cell[] = (() => {
  const cells: Cell[] = [];
  for (let r = -8; r <= 8; r++) for (let q = -8; q <= 8; q++) if (inStar(q, r)) cells.push({ q, r });
  return cells;
})();

const INDEX = new Map<string, number>(CELLS.map((c, i) => [`${c.q},${c.r}`, i]));

export function cellIndex(q: number, r: number): number | undefined {
  return INDEX.get(`${q},${r}`);
}

/** Nachbarn je Loch und Richtung (undefined am Rand). */
export const NEIGHBORS: readonly (readonly (number | undefined)[])[] = CELLS.map((c) =>
  DIRECTIONS.map((d) => cellIndex(c.q + d.q, c.r + d.r)),
);

/**
 * Zacke eines Lochs (0 oben, dann im Uhrzeigersinn: 1 rechts oben, 2 rechts unten, 3 unten,
 * 4 links unten, 5 links oben) oder null in der Mitte.
 */
export function armOfCell(index: number): number | null {
  const { q, r } = CELLS[index]!;
  const s = -q - r;
  if (r <= -5) return 0;
  if (q >= 5) return 1;
  if (s <= -5) return 2;
  if (r >= 5) return 3;
  if (q <= -5) return 4;
  if (s >= 5) return 5;
  return null;
}

/** Wie weit ein Zackenloch von der Mitte entfernt ist: 0 an der Basis, 3 an der Spitze. */
export function depthOfCell(index: number): number {
  const { q, r } = CELLS[index]!;
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) - 5;
}

/** Spitze jeder Zacke. */
export const TIPS: readonly number[] = [
  cellIndex(4, -8)!,
  cellIndex(8, -4)!,
  cellIndex(4, 4)!,
  cellIndex(-4, 8)!,
  cellIndex(-8, 4)!,
  cellIndex(-4, -4)!,
];

export function hexDistance(a: number, b: number): number {
  const ca = CELLS[a]!;
  const cb = CELLS[b]!;
  const dq = ca.q - cb.q;
  const dr = ca.r - cb.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Zacken der Plätze in Zugreihenfolge (im Uhrzeigersinn); Platz 1 sitzt unten. */
export function homeArms(seats: number): number[] {
  switch (seats) {
    case 2:
      return [3, 0];
    case 3:
      return [3, 5, 1];
    case 4:
      return [3, 4, 0, 1];
    case 5:
      return [3, 4, 5, 0, 1];
    default:
      return [3, 4, 5, 0, 1, 2];
  }
}

export const opposite = (arm: number) => (arm + 3) % 6;

/** Steine je Spieler: 10 (ganze Zacke) oder 6 (die drei Reihen an der Spitze). */
export type PieceCount = 10 | 6;

/** Löcher einer Zacke, die bei dieser Steinzahl belegt bzw. gefüllt werden. */
export function armCells(arm: number, pieces: PieceCount): number[] {
  const minDepth = pieces === 6 ? 1 : 0;
  const cells: number[] = [];
  for (let i = 0; i < CELLS.length; i++) if (armOfCell(i) === arm && depthOfCell(i) >= minDepth) cells.push(i);
  return cells;
}

/** Nach so vielen Runden endet die Partie; es gewinnt, wer dem Ziel am nächsten ist. */
export const ROUND_LIMIT = 150;

export interface ChineseCheckersState {
  seats: number;
  pieces: PieceCount;
  /** Belegung je Loch: Platz oder null. */
  board: (SeatId | null)[];
  /** Startzacke je Platz; das Ziel ist die gegenüberliegende. */
  homes: number[];
  turn: SeatId;
  /** Gezogene Züge insgesamt (für die Rundengrenze). */
  moves: number;
  /** Aufgegebene Plätze; ihre Steine bleiben stehen. */
  out: boolean[];
  lastMove: { seat: SeatId; path: number[] } | null;
  winners: SeatId[] | null;
  /** Grund für das Ende: Ziel erreicht, Rundengrenze oder alle anderen haben aufgegeben. */
  endReason: 'goal' | 'limit' | 'resign' | null;
}

export type ChineseCheckersMove =
  | { type: 'move'; from: number; to: number }
  | { type: 'pass' }
  | { type: 'resign'; seat: SeatId };

export function parsePieces(value: unknown): PieceCount {
  return value === '6' ? 6 : 10;
}

export function setup(seats: number, options: Options): ChineseCheckersState {
  const count = Math.max(2, Math.min(6, Number(seats) || 2));
  const pieces = parsePieces(options.pieces);
  const homes = homeArms(count);
  const board: (SeatId | null)[] = CELLS.map(() => null);
  homes.forEach((arm, seat) => {
    for (const cell of armCells(arm, pieces)) board[cell] = seat;
  });
  return {
    seats: count,
    pieces,
    board,
    homes,
    turn: 0,
    moves: 0,
    out: Array.from({ length: count }, () => false),
    lastMove: null,
    winners: null,
    endReason: null,
  };
}

export function targetArm(state: ChineseCheckersState, seat: SeatId): number {
  return opposite(state.homes[seat]!);
}

/** Ziellöcher eines Platzes (je nach Steinzahl die ganze Zacke oder nur die Spitze). */
export function targetCells(state: ChineseCheckersState, seat: SeatId): number[] {
  return armCells(targetArm(state, seat), state.pieces);
}

/** Abstand eines Lochs zur Spitze der Zielzacke dieses Platzes. */
export function distanceToGoal(state: ChineseCheckersState, seat: SeatId, cell: number): number {
  return hexDistance(cell, TIPS[targetArm(state, seat)]!);
}

/**
 * Alle Ziele, die ein Stein mit Sprüngen erreicht, mit dem kürzesten Sprungweg dorthin.
 * Der Stein selbst ist während der Sprünge nicht mehr auf seinem Startloch.
 */
export function jumpPaths(board: readonly (SeatId | null)[], from: number): Map<number, number[]> {
  const paths = new Map<number, number[]>([[from, [from]]]);
  const queue = [from];
  while (queue.length > 0) {
    const cell = queue.shift()!;
    for (let d = 0; d < DIRECTIONS.length; d++) {
      const over = NEIGHBORS[cell]![d];
      if (over === undefined || over === from || board[over] === null) continue;
      const land = NEIGHBORS[over]![d];
      if (land === undefined || paths.has(land) || (board[land] !== null && land !== from)) continue;
      paths.set(land, [...paths.get(cell)!, land]);
      queue.push(land);
    }
  }
  paths.delete(from);
  return paths;
}

/** Ziele eines Steins mit dem Weg dorthin (Schritt oder Sprungkette). */
export function destinations(state: ChineseCheckersState, seat: SeatId, from: number): Map<number, number[]> {
  const result = jumpPaths(state.board, from);
  for (const to of NEIGHBORS[from]!) {
    if (to !== undefined && state.board[to] === null && !result.has(to)) result.set(to, [from, to]);
  }
  // Ein Stein im Ziel darf es nicht mehr verlassen.
  const target = new Set(targetCells(state, seat));
  if (target.has(from)) for (const to of [...result.keys()]) if (!target.has(to)) result.delete(to);
  return result;
}

export function currentPlayers(state: ChineseCheckersState): SeatId[] {
  return state.winners === null ? [state.turn] : [];
}

export function legalMoves(state: ChineseCheckersState, seat: SeatId): ChineseCheckersMove[] {
  if (state.winners !== null || seat !== state.turn) return [];
  const moves: ChineseCheckersMove[] = [];
  state.board.forEach((owner, from) => {
    if (owner !== seat) return;
    for (const to of destinations(state, seat, from).keys()) moves.push({ type: 'move', from, to });
  });
  return moves.length > 0 ? moves : [{ type: 'pass' }];
}

/**
 * Gewonnen hat, wessen Ziellöcher alle besetzt sind, mindestens eines mit einem eigenen Stein.
 * So kann niemand das Ziel durch stehen gelassene Steine blockieren.
 */
export function hasFinished(state: ChineseCheckersState, seat: SeatId): boolean {
  const cells = targetCells(state, seat);
  return cells.every((c) => state.board[c] !== null) && cells.some((c) => state.board[c] === seat);
}

/** Wie weit ein Platz noch vom Ziel entfernt ist: Summe der Abstände seiner Steine zur Zielspitze. */
export function remaining(state: ChineseCheckersState, seat: SeatId): number {
  let sum = 0;
  state.board.forEach((owner, cell) => {
    if (owner === seat) sum += distanceToGoal(state, seat, cell);
  });
  return sum;
}

function nextActive(state: ChineseCheckersState, from: SeatId): SeatId {
  for (let i = 1; i <= state.seats; i++) {
    const seat = (from + i) % state.seats;
    if (!state.out[seat]) return seat;
  }
  return from;
}

/** Nach der Rundengrenze: Es gewinnt, wer dem Ziel am nächsten ist. */
function limitWinners(state: ChineseCheckersState): SeatId[] {
  const active = state.out.flatMap((out, seat) => (out ? [] : [seat]));
  const best = Math.min(...active.map((seat) => remaining(state, seat)));
  return active.filter((seat) => remaining(state, seat) === best);
}

export function applyMove(state: ChineseCheckersState, seat: SeatId, move: ChineseCheckersMove): MoveResult<ChineseCheckersState> {
  if (state.winners !== null) throw new Error('Die Partie ist vorbei');
  const events: GameEvent[] = [];

  if (move.type === 'resign') {
    if (move.seat !== seat || state.out[seat]) throw new Error('Unzulässiger Zug');
    const out = state.out.map((o, s) => o || s === seat);
    let next: ChineseCheckersState = { ...state, out };
    events.push({ type: 'resigned', seat });
    const active = out.flatMap((o, s) => (o ? [] : [s]));
    if (active.length === 1) {
      next = { ...next, winners: active, endReason: 'resign' };
      events.push({ type: 'win', seat: active[0] });
    } else if (state.turn === seat) {
      next = { ...next, turn: nextActive(next, seat) };
    }
    return { state: next, events };
  }

  if (seat !== state.turn) throw new Error('Nicht am Zug');
  let next: ChineseCheckersState;
  if (move.type === 'pass') {
    if (legalMoves(state, seat).some((m) => m.type !== 'pass')) throw new Error('Passen geht nur ohne Zug');
    next = { ...state, lastMove: null };
    events.push({ type: 'passed', seat });
  } else {
    if (state.board[move.from] !== seat) throw new Error('Kein eigener Stein');
    const path = destinations(state, seat, move.from).get(move.to);
    if (!path) throw new Error('Unzulässiger Zug');
    const board = [...state.board];
    board[move.from] = null;
    board[move.to] = seat;
    next = { ...state, board, lastMove: { seat, path } };
    const jump = path.length > 2 || hexDistance(move.from, move.to) > 1;
    events.push({ type: jump ? 'jumped' : 'stepped', seat, from: move.from, to: move.to, path });
    const target = new Set(targetCells(state, seat));
    if (target.has(move.to) && !target.has(move.from)) events.push({ type: 'arrived', seat, cell: move.to });
  }

  next = { ...next, moves: state.moves + 1 };
  if (hasFinished(next, seat)) {
    events.push({ type: 'win', seat });
    return { state: { ...next, winners: [seat], endReason: 'goal' }, events };
  }
  if (next.moves >= ROUND_LIMIT * state.seats) {
    const winners = limitWinners(next);
    events.push({ type: 'limit' });
    return { state: { ...next, winners, endReason: 'limit' }, events };
  }
  return { state: { ...next, turn: nextActive(next, seat) }, events };
}

export function resignMove(state: ChineseCheckersState, seat: SeatId): ChineseCheckersMove | null {
  return state.winners === null && !state.out[seat] ? { type: 'resign', seat } : null;
}

/** Bei Zeitablauf: der Zug, der dem Ziel am meisten näher bringt. */
export function timeoutMove(state: ChineseCheckersState, seat: SeatId): ChineseCheckersMove {
  const moves = legalMoves(state, seat);
  let best = moves[0]!;
  let bestGain = -Infinity;
  for (const move of moves) {
    if (move.type !== 'move') continue;
    const gain = distanceToGoal(state, seat, move.from) - distanceToGoal(state, seat, move.to);
    if (gain > bestGain) {
      bestGain = gain;
      best = move;
    }
  }
  return best;
}

export function result(state: ChineseCheckersState): Result | null {
  if (state.winners === null) return null;
  if (state.winners.length === state.out.filter((o) => !o).length && state.winners.length > 1) {
    return { kind: 'draw', reason: 'Rundengrenze erreicht, alle gleich weit' };
  }
  return {
    kind: 'win',
    winners: state.winners,
    reason: state.endReason === 'limit' ? `Nach ${ROUND_LIMIT} Runden am nächsten am Ziel` : undefined,
  };
}

/** Für Suchbots: wie viel näher dieser Platz dem Ziel ist als der beste Gegner. */
export function evaluate(state: ChineseCheckersState, seat: SeatId): number {
  const mine = remaining(state, seat);
  let best = Infinity;
  for (let s = 0; s < state.seats; s++) if (s !== seat && !state.out[s]) best = Math.min(best, remaining(state, s));
  return best === Infinity ? 0 : best - mine;
}
