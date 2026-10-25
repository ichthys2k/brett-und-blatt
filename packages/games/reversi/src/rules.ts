import type { Actor, GameEvent, MoveResult, Options, Result, SeatId } from '@brett-und-blatt/engine';

export interface ReversiState {
  size: number;
  /** Felder zeilenweise von oben links: Platz 0 (Schwarz), Platz 1 (Weiß) oder leer. */
  cells: (SeatId | null)[];
  turn: SeatId;
  /** Freie Eröffnung: Die ersten vier Steine werden ohne Umdrehen in die Mitte gesetzt. */
  freeOpening: boolean;
  over: boolean;
  lastMove: number | null;
  /** Beim letzten Zug umgedrehte Steine, in der Reihenfolge des Umdrehens (für die Animation). */
  flipped: number[];
}

export interface ReversiMove {
  type: 'place';
  cell: number;
}

const DIRECTIONS: readonly [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function setup(_seats: number, options: Options): ReversiState {
  const size = Number(options.size ?? 8);
  const cells: (SeatId | null)[] = Array(size * size).fill(null);
  const freeOpening = options.opening === 'free';
  if (!freeOpening) {
    const m = size / 2;
    cells[(m - 1) * size + (m - 1)] = 1;
    cells[(m - 1) * size + m] = 0;
    cells[m * size + (m - 1)] = 0;
    cells[m * size + m] = 1;
  }
  return { size, cells, turn: 0, freeOpening, over: false, lastMove: null, flipped: [] };
}

function centerCells(size: number): number[] {
  const m = size / 2;
  return [(m - 1) * size + (m - 1), (m - 1) * size + m, m * size + (m - 1), m * size + m];
}

function inOpening(state: ReversiState): boolean {
  return state.freeOpening && state.cells.filter((c) => c !== null).length < 4;
}

/** Steine, die ein Stein auf `cell` für `seat` umdrehen würde – in allen acht Richtungen. */
export function flipsFor(state: Pick<ReversiState, 'size' | 'cells'>, cell: number, seat: SeatId): number[] {
  if (state.cells[cell] !== null) return [];
  const { size } = state;
  const row = Math.floor(cell / size);
  const col = cell % size;
  const flips: number[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line: number[] = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < size && c >= 0 && c < size && state.cells[r * size + c] === 1 - seat) {
      line.push(r * size + c);
      r += dr;
      c += dc;
    }
    if (line.length > 0 && r >= 0 && r < size && c >= 0 && c < size && state.cells[r * size + c] === seat) flips.push(...line);
  }
  return flips;
}

function placements(state: ReversiState, seat: SeatId): number[] {
  if (inOpening(state)) return centerCells(state.size).filter((cell) => state.cells[cell] === null);
  const cells: number[] = [];
  for (let cell = 0; cell < state.cells.length; cell++) {
    if (state.cells[cell] === null && flipsFor(state, cell, seat).length > 0) cells.push(cell);
  }
  return cells;
}

export function currentPlayers(state: ReversiState): Actor[] {
  return state.over ? [] : [state.turn];
}

export function legalMoves(state: ReversiState, actor: Actor): ReversiMove[] {
  if (actor !== state.turn || state.over) return [];
  return placements(state, actor).map((cell) => ({ type: 'place', cell }));
}

/**
 * Setzt einen Stein. Kann der Gegner danach nicht ziehen, muss er passen – das
 * erledigt die Regel gleich mit (Pflichtzug). Kann niemand mehr ziehen, ist Schluss.
 */
export function applyMove(state: ReversiState, actor: Actor, move: ReversiMove): MoveResult<ReversiState> {
  if (actor !== state.turn || state.over) throw new Error('Du bist nicht am Zug.');
  const opening = inOpening(state);
  const flips = opening ? [] : flipsFor(state, move.cell, actor);
  if (state.cells[move.cell] !== null || (!opening && flips.length === 0) || (opening && !centerCells(state.size).includes(move.cell))) {
    throw new Error('Hier darfst du nicht setzen.');
  }

  const cells = [...state.cells];
  cells[move.cell] = actor;
  for (const cell of flips) cells[cell] = actor;
  const events: GameEvent[] = [{ type: 'placed', cell: move.cell, seat: actor, flipped: flips }];

  const opponent = 1 - actor;
  const next: ReversiState = { ...state, cells, turn: opponent, lastMove: move.cell, flipped: flips };
  if (placements(next, opponent).length === 0) {
    if (placements({ ...next, turn: actor }, actor).length > 0) {
      next.turn = actor;
      events.push({ type: 'passed', seat: opponent });
    } else {
      next.over = true;
      events.push({ type: 'over' });
    }
  }
  return { state: next, events };
}

export function countStones(state: ReversiState): [number, number] {
  let black = 0;
  let white = 0;
  for (const cell of state.cells) {
    if (cell === 0) black++;
    else if (cell === 1) white++;
  }
  return [black, white];
}

export function result(state: ReversiState): Result | null {
  if (!state.over) return null;
  const [black, white] = countStones(state);
  if (black === white) return { kind: 'draw' };
  return { kind: 'win', winners: [black > white ? 0 : 1] };
}

/**
 * Stellungsbewertung: Ecken sind Gold wert, die Felder daneben gefährlich,
 * Beweglichkeit zählt, die Steinzahl erst gegen Ende.
 */
export function evaluate(state: ReversiState, seat: SeatId): number {
  const { size } = state;
  const last = size - 1;
  let score = 0;
  const empty = state.cells.filter((c) => c === null).length;
  for (let cell = 0; cell < state.cells.length; cell++) {
    const owner = state.cells[cell];
    if (owner === null || owner === undefined) continue;
    const r = Math.floor(cell / size);
    const c = cell % size;
    const edgeR = r === 0 || r === last;
    const edgeC = c === 0 || c === last;
    let weight = 1;
    if (edgeR && edgeC) weight = 100;
    else if ((r <= 1 || r >= last - 1) && (c <= 1 || c >= last - 1)) {
      // X- und C-Felder neben einer Ecke: gefährlich, solange die Ecke frei ist.
      const cornerR = r <= 1 ? 0 : last;
      const cornerC = c <= 1 ? 0 : last;
      weight = state.cells[cornerR * size + cornerC] === null ? (edgeR || edgeC ? -20 : -50) : 5;
    } else if (edgeR || edgeC) weight = 8;
    score += owner === seat ? weight : -weight;
  }
  const mobility = placements(state, seat).length - placements({ ...state, turn: 1 - seat }, 1 - seat).length;
  score += mobility * 5;
  if (empty < 14) {
    const [black, white] = countStones(state);
    score += (seat === 0 ? black - white : white - black) * (14 - empty);
  }
  return score;
}
