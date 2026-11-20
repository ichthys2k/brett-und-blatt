import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

/**
 * Maulwurfsgänge – Schiebe-Labyrinth für 2–4 Spieler (eigene Fassung).
 *
 * Auf einem Raster aus Gangteilen (Gerade, Kurve, Abzweig) liegen offene Rüben. Ein Zug hat zwei
 * Schritte desselben Spielers: erst das Freiteil an einer Schiebestelle ins Brett schieben (die
 * ganze Reihe rutscht mit allem, was darauf liegt), dann mit dem Hasen durch die verbundenen
 * Gänge laufen und am Ziel eine Rübe ernten. Geerntete Rüben wachsen nach, ein Maulwurf-Marker
 * sperrt ein Teil. Wer zuerst die Zielzahl geerntet hat, gewinnt. Alles ist offen.
 */

export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Kind = 'I' | 'L' | 'T';
export type Rot = 0 | 1 | 2 | 3;
export type Pos = [row: number, col: number];

export interface Tile {
  /** Stabile Nummer: ein Teil behält sie ein Leben lang (die Oberfläche animiert danach). */
  id: number;
  kind: Kind;
  /** Vierteldrehungen im Uhrzeigersinn; bei Geraden nur 0 oder 1. */
  rot: Rot;
  turnip: boolean;
  mole: boolean;
}

export type Phase = 'push' | 'walk';

export interface MoleOptions {
  goal: number;
  turnips: number;
  mole: boolean;
}

export interface MoleState {
  size: 5 | 7;
  /** Zeile für Zeile, size × size. Feste Teile erkennt man an der Lage (`isFixed`). */
  cells: Tile[];
  /** Das Freiteil neben dem Brett. */
  spare: Tile;
  /** Der letzte Schub; sein Gegenstück ist verboten. */
  lastPush: { side: Side; index: number } | null;
  /** Je Platz: Zeile und Spalte des Hasen. */
  hares: Pos[];
  /** Geerntete Rüben je Platz. */
  harvested: number[];
  phase: Phase;
  turn: SeatId;
  /** Vollständige Züge (Schieben und Laufen) seit Beginn, für das Zuglimit. */
  moves: number;
  options: MoleOptions;
  rng: RngState;
}

export type MoleMove =
  | { type: 'push'; side: Side; index: number; /** zusätzliche Vierteldrehungen im Uhrzeigersinn */ rot: Rot }
  | { type: 'walk'; to: Pos };

/** Zuglimit: so viele vollständige Züge je Spieler, dann endet die Partie nach Punkten. */
export const MOVES_PER_SEAT = 40;

export const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

// ---------------------------------------------------------------- Öffnungen

/** Öffnungen als Bitmaske. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

const BASE_MASK: Record<Kind, number> = { I: N | S, L: N | E, T: N | E | W };

/** Eine Vierteldrehung im Uhrzeigersinn. */
export function turnMask(mask: number): number {
  return ((mask << 1) | (mask >> 3)) & 15;
}

export function maskOf(kind: Kind, rot: number): number {
  let mask = BASE_MASK[kind];
  for (let i = 0; i < rot % 4; i++) mask = turnMask(mask);
  return mask;
}

export function tileMask(tile: Tile): number {
  return maskOf(tile.kind, tile.rot);
}

/** Wie viele verschiedene Drehungen ein Teil hat. */
export function rotations(kind: Kind): number {
  return kind === 'I' ? 2 : 4;
}

/** Dreht ein Teil um `turns` Vierteldrehungen weiter (Gerade bleiben bei 0 oder 1). */
export function rotated(tile: Tile, turns: number): Tile {
  return { ...tile, rot: ((tile.rot + turns) % rotations(tile.kind)) as Rot };
}

// -------------------------------------------------------------------- Brett

export function parseSize(value: unknown): 5 | 7 {
  return value === '5' ? 5 : 7;
}

export function isFixed(row: number, col: number): boolean {
  return row % 2 === 0 && col % 2 === 0;
}

/** Schiebestellen: ungerade Zeilen/Spalten. */
export function pushIndices(size: number): number[] {
  const list: number[] = [];
  for (let i = 1; i < size - 1; i += 2) list.push(i);
  return list;
}

export function isCorner(size: number, row: number, col: number): boolean {
  return (row === 0 || row === size - 1) && (col === 0 || col === size - 1);
}

/** Startecke je Platz: 0 oben links, 1 unten rechts, 2 oben rechts, 3 unten links. */
export function startCorner(size: number, seat: SeatId): Pos {
  const last = size - 1;
  const corners: Pos[] = [
    [0, 0],
    [last, last],
    [0, last],
    [last, 0],
  ];
  return corners[seat]!;
}

export function oppositeSide(side: Side): Side {
  return side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left';
}

const DIRS: [mask: number, opposite: number, dr: number, dc: number][] = [
  [N, S, -1, 0],
  [E, W, 0, 1],
  [S, N, 1, 0],
  [W, E, 0, -1],
];

export function tileAt(state: Pick<MoleState, 'size' | 'cells'>, row: number, col: number): Tile {
  return state.cells[row * state.size + col]!;
}

export function parseOptions(options: Options): MoleOptions & { size: 5 | 7 } {
  const size = parseSize(options.size);
  const goal = options.goal === '3' ? 3 : options.goal === '8' ? 8 : 5;
  let turnips = options.turnips === '4' ? 4 : options.turnips === '8' ? 8 : 6;
  if (size === 5) turnips = Math.min(turnips, 6);
  return { size, goal, turnips, mole: options.mole !== 'off' };
}

export function setup(seats: number, options: Options, seed: string): MoleState {
  const count = Math.max(2, Math.min(4, Number(seats) || 2));
  const { size, ...opts } = parseOptions(options);
  const rng = Rng.fromSeed(seed);
  const last = size - 1;

  // Feste Teile: Ecken sind nach innen offene Kurven, Randabzweige zeigen nach innen.
  const cells: (Tile | null)[] = Array<Tile | null>(size * size).fill(null);
  let nextId = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!isFixed(row, col)) continue;
      let kind: Kind = 'T';
      let rot: Rot = rng.int(4) as Rot; // nur innen ausgewürfelt
      if (isCorner(size, row, col)) {
        kind = 'L';
        rot = row === 0 ? (col === 0 ? 1 : 2) : col === 0 ? 0 : 3;
      } else if (row === 0) rot = 2;
      else if (row === last) rot = 0;
      else if (col === 0) rot = 1;
      else if (col === last) rot = 3;
      cells[row * size + col] = { id: nextId++, kind, rot, turnip: false, mole: false };
    }
  }

  // Bewegliche Teile (einschließlich Freiteil): 13 I / 15 L / 6 T bzw. 7 / 7 / 3.
  const counts: Record<Kind, number> = size === 7 ? { I: 13, L: 15, T: 6 } : { I: 7, L: 7, T: 3 };
  const kinds: Kind[] = [];
  for (const kind of ['I', 'L', 'T'] as const) for (let i = 0; i < counts[kind]; i++) kinds.push(kind);
  const movable = rng.shuffle(kinds).map((kind): Tile => ({ id: 0, kind, rot: rng.int(rotations(kind)) as Rot, turnip: false, mole: false }));
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) cells[i] = { ...movable.pop()!, id: nextId++ };
  }
  const spare: Tile = { ...movable.pop()!, id: nextId++ };
  const board = cells as Tile[];

  // Rüben: auf Teilen des Bretts, nie in einer Startecke. Maulwurf: auf einem beweglichen Feld ohne Rübe.
  const spots: number[] = [];
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) if (!isCorner(size, row, col)) spots.push(row * size + col);
  const shuffled = rng.shuffle(spots);
  for (let i = 0; i < opts.turnips; i++) board[shuffled[i]!] = { ...board[shuffled[i]!]!, turnip: true };
  if (opts.mole) {
    const at = shuffled.slice(opts.turnips).find((index) => !isFixed(Math.floor(index / size), index % size));
    if (at !== undefined) board[at] = { ...board[at]!, mole: true };
  }

  return {
    size,
    cells: board,
    spare,
    lastPush: null,
    hares: Array.from({ length: count }, (_, seat) => startCorner(size, seat)),
    harvested: Array<number>(count).fill(0),
    phase: 'push',
    turn: 0,
    moves: 0,
    options: opts,
    rng: rng.state,
  };
}

// --------------------------------------------------------------- Schieben

/** Einschubfeld, Feld des herausfallenden Teils und Richtung, in die die Reihe rutscht. */
/** Ein- und Ausgang einer Schiebestelle und die Schubrichtung (für Oberfläche und Animation). */
export function pushGeometry(size: number, side: Side, index: number): { entry: Pos; exit: Pos; dr: number; dc: number } {
  const last = size - 1;
  switch (side) {
    case 'top':
      return { entry: [0, index], exit: [last, index], dr: 1, dc: 0 };
    case 'bottom':
      return { entry: [last, index], exit: [0, index], dr: -1, dc: 0 };
    case 'left':
      return { entry: [index, 0], exit: [index, last], dr: 0, dc: 1 };
    case 'right':
      return { entry: [index, last], exit: [index, 0], dr: 0, dc: -1 };
  }
}

export function isPushForbidden(state: Pick<MoleState, 'lastPush'>, side: Side, index: number): boolean {
  const last = state.lastPush;
  return last !== null && last.index === index && last.side === oppositeSide(side);
}

/**
 * Schiebt das Freiteil (um `rot` Vierteldrehungen weitergedreht) ein. Gibt das neue Brett, das neue
 * Freiteil, die Hasenpositionen sowie das hinausgefallene und das eingeschobene Teil zurück.
 * Ein Hase auf dem herausfallenden Teil setzt sich auf das eingeschobene.
 */
export function pushTile(state: MoleState, side: Side, index: number, rot: number): { cells: Tile[]; spare: Tile; hares: Pos[]; out: Tile; entered: Tile } {
  const { size } = state;
  const { entry, exit, dr, dc } = pushGeometry(size, side, index);
  const cells = [...state.cells];
  const out = cells[exit[0] * size + exit[1]]!;
  // Vom Ausgang her: jedes Teil rückt ein Feld in Schubrichtung.
  for (let row = exit[0], col = exit[1]; row !== entry[0] || col !== entry[1]; row -= dr, col -= dc) {
    cells[row * size + col] = cells[(row - dr) * size + (col - dc)]!;
  }
  const entered = rotated(state.spare, rot);
  cells[entry[0] * size + entry[1]] = entered;
  const hares = state.hares.map(([row, col]): Pos => {
    const inLine = side === 'top' || side === 'bottom' ? col === index : row === index;
    if (!inLine) return [row, col];
    if (row === exit[0] && col === exit[1]) return [entry[0], entry[1]];
    return [row + dr, col + dc];
  });
  return { cells, spare: out, hares, out, entered };
}

// ----------------------------------------------------------------- Laufen

/** Alle Felder, die der Hase von `from` aus erreicht (einschließlich des eigenen), Zeile für Zeile sortiert. */
export function reachable(state: Pick<MoleState, 'size' | 'cells'>, from: Pos): Pos[] {
  const { size } = state;
  const seen = new Set<number>([from[0] * size + from[1]]);
  const queue: Pos[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const [row, col] = queue[head]!;
    const mask = tileMask(tileAt(state, row, col));
    for (const [bit, opposite, dr, dc] of DIRS) {
      if (!(mask & bit)) continue;
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= size || c >= size || seen.has(r * size + c)) continue;
      const next = tileAt(state, r, c);
      if (next.mole || !(tileMask(next) & opposite)) continue;
      seen.add(r * size + c);
      queue.push([r, c]);
    }
  }
  return [...seen].sort((a, b) => a - b).map((index): Pos => [Math.floor(index / size), index % size]);
}

/** Kürzester Weg (Felder von `from` bis `to`) für die Hüpf-Animation; null, wenn nicht erreichbar. */
export function pathTo(state: Pick<MoleState, 'size' | 'cells'>, from: Pos, to: Pos): Pos[] | null {
  const { size } = state;
  const key = (p: Pos) => p[0] * size + p[1];
  const parent = new Map<number, number>([[key(from), -1]]);
  const queue: Pos[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    if (key(cur) === key(to)) break;
    const mask = tileMask(tileAt(state, cur[0], cur[1]));
    for (const [bit, opposite, dr, dc] of DIRS) {
      if (!(mask & bit)) continue;
      const r = cur[0] + dr;
      const c = cur[1] + dc;
      if (r < 0 || c < 0 || r >= size || c >= size || parent.has(r * size + c)) continue;
      const next = tileAt(state, r, c);
      if (next.mole || !(tileMask(next) & opposite)) continue;
      parent.set(r * size + c, key(cur));
      queue.push([r, c]);
    }
  }
  if (!parent.has(key(to))) return null;
  const path: Pos[] = [];
  for (let k = key(to); k !== -1; k = parent.get(k)!) path.unshift([Math.floor(k / size), k % size]);
  return path;
}

// ---------------------------------------------------------------- Schnittstelle

export function currentPlayers(state: MoleState): Actor[] {
  return result(state) ? [] : [state.turn];
}

export function legalMoves(state: MoleState, actor: Actor): MoleMove[] {
  if (actor !== state.turn || result(state)) return [];
  if (state.phase === 'walk') {
    return reachable(state, state.hares[state.turn]!).map((to): MoleMove => ({ type: 'walk', to }));
  }
  const moves: MoleMove[] = [];
  for (const side of SIDES) {
    for (const index of pushIndices(state.size)) {
      if (isPushForbidden(state, side, index)) continue;
      for (let rot = 0; rot < rotations(state.spare.kind); rot++) moves.push({ type: 'push', side, index, rot: rot as Rot });
    }
  }
  return moves;
}

function validatePush(state: MoleState, move: Extract<MoleMove, { type: 'push' }>): void {
  if (!SIDES.includes(move.side) || !pushIndices(state.size).includes(move.index)) throw new Error('Hier kann nicht eingeschoben werden.');
  if (!Number.isInteger(move.rot) || move.rot < 0 || move.rot >= rotations(state.spare.kind)) throw new Error('Ungültige Drehung.');
  if (isPushForbidden(state, move.side, move.index)) throw new Error('Den Schub des Vorgängers darfst du nicht sofort zurückschieben.');
}

export function applyMove(state: MoleState, actor: Actor, move: MoleMove): MoveResult<MoleState> {
  if (actor !== state.turn || result(state)) throw new Error('Du bist nicht am Zug.');
  const seat = state.turn;
  const events: GameEvent[] = [];

  if (move.type === 'push') {
    if (state.phase !== 'push') throw new Error('Du musst jetzt laufen.');
    validatePush(state, move);
    const pushed = pushTile(state, move.side, move.index, move.rot);
    events.push({ type: 'push', seat, side: move.side, index: move.index, rot: move.rot, entered: pushed.entered.id, out: pushed.out.id });
    return {
      state: { ...state, cells: pushed.cells, spare: pushed.spare, hares: pushed.hares, lastPush: { side: move.side, index: move.index }, phase: 'walk' },
      events,
    };
  }

  if (move.type !== 'walk') throw new Error('Unbekannter Zug.');
  if (state.phase !== 'walk') throw new Error('Du musst zuerst ein Teil einschieben.');
  const from = state.hares[seat]!;
  const to = move.to;
  if (!Array.isArray(to) || !reachable(state, from).some(([row, col]) => row === to[0] && col === to[1])) throw new Error('Dieses Feld ist nicht erreichbar.');
  events.push({ type: 'walk', seat, from: [...from], to: [...to], path: pathTo(state, from, to) });

  const hares = state.hares.map((pos, i): Pos => (i === seat ? [to[0], to[1]] : pos));
  let cells = state.cells;
  const harvested = [...state.harvested];
  let rngState = state.rng;
  const target = tileAt(state, to[0], to[1]);
  if (target.turnip && !target.mole) {
    harvested[seat] = harvested[seat]! + 1;
    cells = cells.map((tile) => (tile.id === target.id ? { ...tile, turnip: false } : tile));
    events.push({ type: 'harvest', seat, tile: target.id, at: [...to], count: harvested[seat] });
    // Nachwachsen: zufälliges Teil auf dem Brett ohne Rübe, ohne Maulwurf, nicht in einer Ecke.
    const rng = new Rng(state.rng);
    const spots: number[] = [];
    cells.forEach((tile, index) => {
      if (!tile.turnip && !tile.mole && !isCorner(state.size, Math.floor(index / state.size), index % state.size)) spots.push(index);
    });
    if (spots.length > 0) {
      const at = rng.pick(spots);
      const sprouted = cells[at]!;
      cells = cells.map((tile, index) => (index === at ? { ...tile, turnip: true } : tile));
      events.push({ type: 'sprout', tile: sprouted.id, at: [Math.floor(at / state.size), at % state.size] });
    }
    rngState = rng.state;
  }

  const next: MoleState = { ...state, cells, hares, harvested, rng: rngState, phase: 'push', moves: state.moves + 1, turn: (seat + 1) % state.hares.length };
  const res = result(next);
  if (res) events.push({ type: 'end', kind: res.kind });
  return { state: next, events };
}

export function result(state: MoleState): Result | null {
  const { goal } = state.options;
  const best = Math.max(...state.harvested);
  const seats = state.harvested.length;
  if (best >= goal) return { kind: 'win', winners: [state.harvested.indexOf(best)] };
  if (state.moves >= MOVES_PER_SEAT * seats) {
    const winners = state.harvested.flatMap((count, seat) => (count === best ? [seat] : []));
    return winners.length === seats ? { kind: 'draw', reason: 'limit' } : { kind: 'win', winners, reason: 'limit' };
  }
  return null;
}

/** Alles ist offen; nur der Zufallszustand bleibt verborgen. */
export function playerView(state: MoleState): MoleState {
  return { ...state, rng: [0, 0, 0, 0] };
}

/** Bei Zeitablauf: erster erlaubter Schub ohne Drehung, beim Laufen stehen bleiben. */
export function timeoutMove(state: MoleState, seat: SeatId): MoleMove {
  if (state.phase === 'walk') return { type: 'walk', to: [...state.hares[seat]!] as Pos };
  const first = legalMoves(state, seat).find((move) => move.type === 'push' && move.rot === 0);
  if (!first) throw new Error('Kein Schub möglich.');
  return first;
}
