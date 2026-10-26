/**
 * Anbindung der bestehenden Vierer-Schach-Regeln (src/legacy/engine.ts) an die
 * Spielmodul-Schnittstelle. Die alte Engine verändert ihren Spielstand direkt –
 * deshalb arbeitet sie hier immer auf einer Kopie.
 */
import type { Actor, GameEvent, MoveResult, Options, Result, SeatId } from '@brett-und-blatt/engine';
import * as engine from './legacy/engine';

export type Color = 'r' | 'b' | 'y' | 'g';

/** Platz 0–3 in Zugreihenfolge: Rot, Blau, Gelb, Grün. */
export const COLORS: Color[] = ['r', 'b', 'y', 'g'];

export interface Piece {
  c: Color;
  t: 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
  /** Tot: Figur eines ausgeschiedenen Spielers, bleibt als Hindernis stehen. */
  d?: boolean;
  /** Umgewandelt (zählt beim Schlagen nur 1 Punkt). */
  pr?: boolean;
}

export interface FourChessState {
  mode: 'ffa' | 'teams';
  board: (Piece | null)[];
  turn: Color;
  active: Record<Color, boolean>;
  out: Partial<Record<Color, string>>;
  scores: Record<Color, number>;
  lastMove: { from: number; to: number; color: Color } | null;
  log: { type: string; color: Color | null; text: string; points?: number }[];
  result: { reason: string; winners: Color[] } | null;
  [key: string]: unknown;
}

export type FourChessMove =
  | { t: 'm'; p: Color; f: number; to: number; pr?: 'Q' | 'R' | 'B' | 'N' }
  /** Sieg beanspruchen: bei zwei übrigen Spielern mit 21 Punkten Vorsprung. */
  | { t: 'claim'; p: Color }
  /** Aufgeben: jederzeit, auch ohne am Zug zu sein. Steht nicht in `legalMoves`. */
  | { t: 'resign'; p: Color; time?: true };

export const seatOf = (color: Color): SeatId => COLORS.indexOf(color);

export function setup(_seats: number, options: Options): FourChessState {
  return engine.newGame(options.mode === 'teams' ? 'teams' : 'ffa') as FourChessState;
}

export function currentPlayers(state: FourChessState): Actor[] {
  return state.result ? [] : [seatOf(state.turn)];
}

export function legalMoves(state: FourChessState, actor: Actor): FourChessMove[] {
  if (state.result || actor !== seatOf(state.turn)) return [];
  const color = state.turn;
  const moves: FourChessMove[] = [];
  for (const m of engine.legalMoves(state, color) as { from: number; to: number; promote?: boolean }[]) {
    // Im Teammodus darf man die Umwandlungsfigur wählen, sonst wird es immer eine Dame.
    if (m.promote && state.mode === 'teams') {
      for (const pr of ['Q', 'R', 'B', 'N'] as const) moves.push({ t: 'm', p: color, f: m.from, to: m.to, pr });
    } else {
      moves.push({ t: 'm', p: color, f: m.from, to: m.to });
    }
  }
  if (engine.canClaim(state, color)) moves.push({ t: 'claim', p: color });
  return moves;
}

/**
 * Aufgeben lässt nur die eigene Farbe ausscheiden (Figuren werden grau), die anderen
 * spielen weiter. Im Teammodus verliert damit das ganze Team.
 */
export function resignMove(state: FourChessState, seat: SeatId, reason: 'resign' | 'time' = 'resign'): FourChessMove | null {
  const color = COLORS[seat];
  if (!color || state.result || !state.active[color]) return null;
  // Abgelaufene Schachuhr: wie Aufgeben, nur mit anderem Grund.
  return reason === 'time' ? { t: 'resign', p: color, time: true } : { t: 'resign', p: color };
}

export function applyMove(state: FourChessState, actor: Actor, move: FourChessMove): MoveResult<FourChessState> {
  if (move.t === 'resign') {
    if (actor !== seatOf(move.p) || !resignMove(state, actor)) throw new Error('Aufgeben ist nicht möglich.');
    const next = structuredClone(state);
    if (!engine.applyAction(next, move)) throw new Error('Aufgeben ist nicht möglich.');
    const events: GameEvent[] = [{ type: move.time ? 'timedOut' : 'resigned', color: move.p }];
    if (next.result) events.push({ type: 'over', winners: next.result.winners });
    return { state: next, events };
  }
  if (actor !== seatOf(state.turn) || move.p !== state.turn) throw new Error('Du bist nicht am Zug.');
  const next = structuredClone(state);
  const victim = move.t === 'm' ? state.board[move.to] : null;
  if (!engine.applyAction(next, move)) throw new Error('Dieser Zug ist nicht erlaubt.');
  const events: GameEvent[] =
    move.t === 'm'
      ? [{ type: 'moved', from: move.f, to: move.to, color: move.p, captured: victim && !victim.d ? victim.t : null }]
      : [{ type: 'claimed', color: move.p }];
  if (next.result) events.push({ type: 'over', winners: next.result.winners });
  return { state: next, events };
}

export function result(state: FourChessState): Result | null {
  if (!state.result) return null;
  const winners = state.result.winners.map(seatOf);
  if (winners.length === 0) return { kind: 'draw', reason: state.result.reason };
  return { kind: 'win', winners, reason: state.result.reason };
}
