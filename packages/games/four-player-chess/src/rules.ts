/**
 * Anbindung der bestehenden Vierer-Schach-Regeln (src/legacy/engine.ts) an die
 * Spielmodul-Schnittstelle. Die alte Engine verändert ihren Spielstand direkt –
 * deshalb arbeitet sie hier immer auf einer Kopie.
 */
import type { Actor, GameEvent, MoveResult, Options, Result, SeatId } from '@brett-und-blatt/engine';
import * as engine from './legacy/engine';

export type { Color, FourChessState, Piece } from './legacy/engine';
export { COLORS } from './legacy/engine';

export type FourChessMove =
  | { t: 'm'; p: engine.Color; f: number; to: number; pr?: 'Q' | 'R' | 'B' | 'N' }
  /** Sieg beanspruchen: bei zwei übrigen Spielern mit 21 Punkten Vorsprung. */
  | { t: 'claim'; p: engine.Color }
  /** Aufgeben: jederzeit, auch ohne am Zug zu sein. Steht nicht in `legalMoves`. */
  | { t: 'resign'; p: engine.Color; time?: true };

export const seatOf = (color: engine.Color): SeatId => engine.COLORS.indexOf(color);

export function setup(_seats: number, options: Options): engine.FourChessState {
  return engine.newGame(options.mode === 'teams' ? 'teams' : 'ffa', options.promotion === 'queen' ? 'queen' : 'any');
}

export function currentPlayers(state: engine.FourChessState): Actor[] {
  return state.result ? [] : [seatOf(state.turn)];
}

export function legalMoves(state: engine.FourChessState, actor: Actor): FourChessMove[] {
  if (state.result || actor !== seatOf(state.turn)) return [];
  const color = state.turn;
  const moves: FourChessMove[] = [];
  for (const m of engine.legalMoves(state, color)) {
    // Mit freier Wahl gibt es je Umwandlungsfigur einen Zug, sonst wird es immer eine Dame.
    if (m.promote && engine.promotionChoice(state)) {
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
export function resignMove(state: engine.FourChessState, seat: SeatId, reason: 'resign' | 'time' = 'resign'): FourChessMove | null {
  const color = engine.COLORS[seat];
  if (!color || state.result || !state.active[color]) return null;
  // Abgelaufene Schachuhr: wie Aufgeben, nur mit anderem Grund.
  return reason === 'time' ? { t: 'resign', p: color, time: true } : { t: 'resign', p: color };
}

export function applyMove(state: engine.FourChessState, actor: Actor, move: FourChessMove): MoveResult<engine.FourChessState> {
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
  let victim = move.t === 'm' ? state.board[move.to] : null;
  if (move.t === 'm' && !victim) {
    const engineMove = engine.legalMoves(state, move.p).find((m) => m.from === move.f && m.to === move.to);
    if (engineMove && engineMove.ep !== undefined) {
      victim = state.board[engineMove.ep] ?? null;
    }
  }
  if (!engine.applyAction(next, move)) throw new Error('Dieser Zug ist nicht erlaubt.');
  const events: GameEvent[] =
    move.t === 'm'
      ? [{ type: 'moved', from: move.f, to: move.to, color: move.p, captured: victim && !victim.d ? victim.t : null }]
      : [{ type: 'claimed', color: move.p }];
  if (next.result) events.push({ type: 'over', winners: next.result.winners });
  return { state: next, events };
}

export function result(state: engine.FourChessState): Result | null {
  if (!state.result) return null;
  const winners = state.result.winners.map(seatOf);
  if (winners.length === 0) return { kind: 'draw', reason: state.result.reason };
  return { kind: 'win', winners, reason: state.result.reason };
}
