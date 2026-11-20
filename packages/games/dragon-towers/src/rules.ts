/**
 * Die Regeln von Drachentürme (eigene Fassung der Mechanik von „Kamisado“, Einzelrunde).
 *
 * Alle Funktionen sind rein: Sie verändern den alten Spielstand nicht und geben einen
 * neuen zurück. Sie wissen nichts von Bildschirm, Uhr oder Netzwerk.
 *
 * Brett: 8 × 8 Felder in acht Farben, jede Farbe genau einmal je Reihe und Spalte.
 * Platz 0 (Schwarz) steht unten auf Reihe 7 und zieht nach oben, Platz 1 (Gold)
 * steht oben auf Reihe 0 und zieht nach unten.
 */
import type { Actor, GameEvent, MoveResult, Options, Result, SeatId } from '@brett-und-blatt/engine';

export const SIZE = 8;

/** Die acht Farben in fester Reihenfolge; Türme und Felder tragen ihren Index. */
export const COLOR_NAMES = ['Orange', 'Blau', 'Lila', 'Rosa', 'Gelb', 'Rot', 'Grün', 'Braun'] as const;
export type ColorIndex = number;

/**
 * Feldfarben zeilenweise von oben links. Lateinisches Quadrat, um 180° drehsymmetrisch:
 * Beide Spieler sehen ihre Grundreihe von Braun (links) bis Orange (rechts).
 */
export const BOARD_COLORS: readonly ColorIndex[] = [
  0, 1, 2, 3, 4, 5, 6, 7,
  5, 0, 3, 6, 1, 4, 7, 2,
  6, 3, 0, 5, 2, 7, 4, 1,
  3, 2, 1, 0, 7, 6, 5, 4,
  4, 5, 6, 7, 0, 1, 2, 3,
  1, 4, 7, 2, 5, 0, 3, 6,
  2, 7, 4, 1, 6, 3, 0, 5,
  7, 6, 5, 4, 3, 2, 1, 0,
];

export interface Tower {
  seat: SeatId;
  color: ColorIndex;
}

export interface DragonTowersState {
  /** 64 Felder zeilenweise von oben links: ein Turm oder leer. */
  towers: (Tower | null)[];
  turn: SeatId;
  /** Farbe des Turms, den `turn` ziehen muss; `null` nur beim allerersten Zug. */
  required: ColorIndex | null;
  /** Letzter echter Zug (für Hervorhebung und Gleit-Animation). */
  lastMove: { from: number; to: number; seat: SeatId } | null;
  /** Wer den letzten echten Zug gemacht hat – verliert bei einer Blockade. */
  lastMover: SeatId | null;
  /** Aussetz-Lagen seit dem letzten echten Zug („Platz:Farbe“), um Blockaden zu erkennen. */
  passChain: string[];
  /** Anzahl aller Züge einschließlich Aussetzen (Schlüssel für die Animation). */
  plies: number;
  winner: SeatId | null;
  end: 'goal' | 'deadlock' | null;
  /** Brett zum Spieler am Zug drehen (Hot-Seat). */
  rotate: boolean;
}

export type DragonTowersMove = { type: 'move'; from: number; to: number } | { type: 'pass' };

const FILES = 'abcdefgh';

export function squareName(index: number): string {
  return `${FILES[index % SIZE]}${SIZE - Math.floor(index / SIZE)}`;
}

/** Reihe, in die `seat` vorrückt (−1 = nach oben, +1 = nach unten). */
export function forward(seat: SeatId): number {
  return seat === 0 ? -1 : 1;
}

/** Zielreihe von `seat`: die gegnerische Grundreihe. */
export function goalRow(seat: SeatId): number {
  return seat === 0 ? 0 : SIZE - 1;
}

export function setup(_seats = 2, options: Options = {}): DragonTowersState {
  const towers: (Tower | null)[] = Array(SIZE * SIZE).fill(null);
  for (let col = 0; col < SIZE; col++) {
    towers[col] = { seat: 1, color: BOARD_COLORS[col]! };
    const bottom = (SIZE - 1) * SIZE + col;
    towers[bottom] = { seat: 0, color: BOARD_COLORS[bottom]! };
  }
  return {
    towers,
    turn: 0,
    required: null,
    lastMove: null,
    lastMover: null,
    passChain: [],
    plies: 0,
    winner: null,
    end: null,
    rotate: options.board !== 'fixed',
  };
}

export function currentPlayers(state: DragonTowersState): Actor[] {
  return state.end !== null ? [] : [state.turn];
}

/** Feld des Turms `color` von `seat`. */
export function towerSquare(state: DragonTowersState, seat: SeatId, color: ColorIndex): number {
  return state.towers.findIndex((t) => t !== null && t.seat === seat && t.color === color);
}

/** Alle Zielfelder eines Turms: gerade und schräg vorwärts bis zum ersten Hindernis. */
export function towerTargets(state: DragonTowersState, from: number): number[] {
  const tower = state.towers[from];
  if (!tower) return [];
  const dr = forward(tower.seat);
  const row = Math.floor(from / SIZE);
  const col = from % SIZE;
  const targets: number[] = [];
  for (const dc of [-1, 0, 1]) {
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      const index = r * SIZE + c;
      if (state.towers[index] !== null) break;
      targets.push(index);
      r += dr;
      c += dc;
    }
  }
  return targets;
}

/** Felder der Türme, die `seat` jetzt ziehen darf. */
export function movableSquares(state: DragonTowersState, seat: SeatId): number[] {
  if (state.required === null) {
    return state.towers.flatMap((t, i) => (t !== null && t.seat === seat ? [i] : []));
  }
  const square = towerSquare(state, seat, state.required);
  return square < 0 ? [] : [square];
}

export function legalMoves(state: DragonTowersState, actor: Actor): DragonTowersMove[] {
  if (state.end !== null || actor !== state.turn) return [];
  const moves: DragonTowersMove[] = [];
  for (const from of movableSquares(state, actor)) {
    for (const to of towerTargets(state, from)) moves.push({ type: 'move', from, to });
  }
  return moves.length > 0 ? moves : [{ type: 'pass' }];
}

export function isLegal(state: DragonTowersState, actor: Actor, move: DragonTowersMove): boolean {
  return legalMoves(state, actor).some((m) => m.type === move.type && (m.type === 'pass' || (move.type === 'move' && m.from === move.from && m.to === move.to)));
}

export function applyMove(state: DragonTowersState, actor: Actor, move: DragonTowersMove): MoveResult<DragonTowersState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist nicht erlaubt.');
  const seat = actor as SeatId;
  const other: SeatId = 1 - seat;

  if (move.type === 'pass') {
    // Der eingesperrte Turm „zieht“ null Felder; der Gegner zieht die Farbe seines Feldes.
    const square = towerSquare(state, seat, state.required!);
    const nextColor = BOARD_COLORS[square]!;
    const key = `${seat}:${state.required}`;
    const nextKey = `${other}:${nextColor}`;
    const passChain = [...state.passChain, key];
    const events: GameEvent[] = [{ type: 'passed', seat, color: state.required, square }];
    if (passChain.includes(nextKey)) {
      // Blockade: Die Aussetz-Folge wiederholt sich. Wer zuletzt wirklich gezogen hat, verliert.
      const winner: SeatId = 1 - (state.lastMover ?? seat);
      events.push({ type: 'deadlock', winner });
      return { state: { ...state, passChain, plies: state.plies + 1, turn: other, required: nextColor, winner, end: 'deadlock' }, events };
    }
    return { state: { ...state, passChain, plies: state.plies + 1, turn: other, required: nextColor }, events };
  }

  const towers = [...state.towers];
  const tower = towers[move.from]!;
  towers[move.from] = null;
  towers[move.to] = tower;
  const landed = BOARD_COLORS[move.to]!;
  const reached = Math.floor(move.to / SIZE) === goalRow(seat);
  const events: GameEvent[] = [{ type: 'moved', seat, from: move.from, to: move.to, color: tower.color, distance: distance(move.from, move.to) }];
  if (reached) events.push({ type: 'win', seat });
  return {
    state: {
      ...state,
      towers,
      turn: other,
      required: landed,
      lastMove: { from: move.from, to: move.to, seat },
      lastMover: seat,
      passChain: [],
      plies: state.plies + 1,
      winner: reached ? seat : null,
      end: reached ? 'goal' : null,
    },
    events,
  };
}

/** Anzahl der Felder, die ein Zug überstreicht (gerade wie schräg). */
export function distance(from: number, to: number): number {
  return Math.abs(Math.floor(from / SIZE) - Math.floor(to / SIZE));
}

export function result(state: DragonTowersState): Result | null {
  if (state.winner === null) return null;
  return { kind: 'win', winners: [state.winner], reason: state.end === 'deadlock' ? 'Blockade' : 'Ziel erreicht' };
}

/** Kann der Turm auf `from` in einem Zug die Zielreihe erreichen? */
export function threatens(state: DragonTowersState, from: number): boolean {
  const tower = state.towers[from];
  if (!tower) return false;
  const goal = goalRow(tower.seat);
  return towerTargets(state, from).some((to) => Math.floor(to / SIZE) === goal);
}

/**
 * Stellungsbewertung aus Sicht von `seat`: Türme mit freier Bahn zum Ziel zählen viel,
 * Vorrücken wenig. Muss der Gegner gleich einen bedrohenden Turm ziehen, ist das fast verloren.
 */
export function evaluate(state: DragonTowersState, seat: SeatId): number {
  if (state.winner !== null) return state.winner === seat ? 100_000 : -100_000;
  let score = 0;
  state.towers.forEach((tower, index) => {
    if (!tower) return;
    const sign = tower.seat === seat ? 1 : -1;
    const row = Math.floor(index / SIZE);
    const advance = tower.seat === 0 ? SIZE - 1 - row : row;
    score += sign * advance * 2;
    if (threatens(state, index)) score += sign * 40;
  });
  // Wer am Zug ist und mit dem Pflicht-Turm ins Ziel kommt, gewinnt sofort.
  if (state.required !== null) {
    const square = towerSquare(state, state.turn, state.required);
    if (square >= 0 && threatens(state, square)) score += state.turn === seat ? 5_000 : -5_000;
  }
  return score;
}
