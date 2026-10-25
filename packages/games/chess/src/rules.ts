/**
 * Schachregeln über die Bibliothek chess.js (BSD-2-Clause). Der Spielstand
 * speichert die Stellung als FEN-Text (die übliche Kurzschreibweise einer
 * Schachstellung), damit er reines JSON bleibt.
 */
import type { Actor, GameEvent, MoveResult, Result, SeatId } from '@brett-und-blatt/engine';
import { Chess } from 'chess.js';

export type Promotion = 'q' | 'r' | 'b' | 'n';

export interface ChessMove {
  type: 'move';
  from: string;
  to: string;
  promotion?: Promotion;
}

export type ChessEnd = 'checkmate' | 'stalemate' | 'repetition' | 'fiftyMoves' | 'material';

export interface ChessState {
  fen: string;
  /** Wie oft jede Stellung schon vorkam (Wiederholungsregel). */
  positions: Record<string, number>;
  /** Partieverlauf in algebraischer Schreibweise, z. B. „e4“, „Sf3“, „O-O“. */
  history: string[];
  lastMove: { from: string; to: string } | null;
  inCheck: boolean;
  end: ChessEnd | null;
  winner: SeatId | null;
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Die Stellung ohne Zugzähler – für das Erkennen von Wiederholungen. */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/** Platz 0 spielt Weiß, Platz 1 Schwarz. */
export function turnSeat(fen: string): SeatId {
  return fen.split(' ')[1] === 'w' ? 0 : 1;
}

export function setup(): ChessState {
  return { fen: START_FEN, positions: { [positionKey(START_FEN)]: 1 }, history: [], lastMove: null, inCheck: false, end: null, winner: null };
}

export function currentPlayers(state: ChessState): Actor[] {
  return state.end ? [] : [turnSeat(state.fen)];
}

export function legalMoves(state: ChessState, actor: Actor): ChessMove[] {
  if (state.end || actor !== turnSeat(state.fen)) return [];
  return new Chess(state.fen).moves({ verbose: true }).map((m) => (m.promotion ? { type: 'move', from: m.from, to: m.to, promotion: m.promotion as Promotion } : { type: 'move', from: m.from, to: m.to }));
}

export function applyMove(state: ChessState, actor: Actor, move: ChessMove): MoveResult<ChessState> {
  if (state.end || actor !== turnSeat(state.fen)) throw new Error('Du bist nicht am Zug.');
  const chess = new Chess(state.fen);
  let done;
  try {
    done = chess.move({ from: move.from, to: move.to, promotion: move.promotion });
  } catch {
    throw new Error('Dieser Zug ist nicht erlaubt.');
  }
  const fen = chess.fen();
  const key = positionKey(fen);
  const positions = { ...state.positions, [key]: (state.positions[key] ?? 0) + 1 };
  let end: ChessEnd | null = null;
  if (chess.isCheckmate()) end = 'checkmate';
  else if (chess.isStalemate()) end = 'stalemate';
  else if ((positions[key] ?? 0) >= 3) end = 'repetition';
  else if (chess.isDrawByFiftyMoves()) end = 'fiftyMoves';
  else if (chess.isInsufficientMaterial()) end = 'material';

  const events: GameEvent[] = [{ type: 'moved', from: done.from, to: done.to, san: done.san, captured: done.captured ?? null, check: chess.inCheck() }];
  if (end) events.push({ type: 'over', end });
  return {
    state: {
      fen,
      positions,
      history: [...state.history, done.san],
      lastMove: { from: done.from, to: done.to },
      inCheck: chess.inCheck(),
      end,
      winner: end === 'checkmate' ? (actor as SeatId) : null,
    },
    events,
  };
}

export function result(state: ChessState): Result | null {
  if (!state.end) return null;
  if (state.winner !== null) return { kind: 'win', winners: [state.winner], reason: state.end };
  return { kind: 'draw', reason: state.end };
}
