/**
 * Schachregeln über die Bibliothek chess.js (BSD-2-Clause). Der Spielstand
 * speichert die Stellung als FEN-Text (die übliche Kurzschreibweise einer
 * Schachstellung), damit er reines JSON bleibt.
 */
import {
  applyDrawMove,
  drawResponder,
  drawResponses,
  isDrawMove,
  isDrawMoveLegal,
  type Actor,
  type DrawMove,
  type DrawOffer,
  type GameEvent,
  type MoveResult,
  type Options,
  type Result,
  type SeatId,
} from '@brett-und-blatt/engine';
import { Chess } from 'chess.js';

export type Promotion = 'q' | 'r' | 'b' | 'n';

export interface BoardMove {
  type: 'move';
  from: string;
  to: string;
  promotion?: Promotion;
}

/** Ein Zug auf dem Brett oder Remis anbieten, annehmen, ablehnen. */
export type ChessMove = BoardMove | DrawMove;

export type ChessEnd = 'checkmate' | 'stalemate' | 'repetition' | 'fiftyMoves' | 'material' | 'agreement';

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
  /** Darstellung: Brett zum Spieler am Zug drehen (fehlt in älteren Spielständen = ja). */
  rotate?: boolean;
  /** Offenes Remis-Angebot (fehlt in älteren Spielständen = keins). */
  drawOffer?: DrawOffer;
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

export function setup(_seats = 2, options: Options = {}): ChessState {
  // Eingefügte PGN-Partie (verborgene Option, siehe `SetupExtra` der Oberfläche) fortsetzen.
  if (options.pgn) {
    try {
      return loadFromPgn(options.pgn, { ...options, pgn: '' });
    } catch {
      // Ungültig: normal beginnen. Die Oberfläche prüft die Partie schon beim Einfügen.
    }
  }
  return { fen: START_FEN, positions: { [positionKey(START_FEN)]: 1 }, history: [], lastMove: null, inCheck: false, end: null, winner: null, rotate: options.board !== 'fixed' };
}

export function currentPlayers(state: ChessState): Actor[] {
  if (state.end) return [];
  return [drawResponder(state.drawOffer) ?? turnSeat(state.fen)];
}

export function legalMoves(state: ChessState, actor: Actor): ChessMove[] {
  if (state.end) return [];
  if (drawResponder(state.drawOffer) !== null) return drawResponses(state.drawOffer, actor);
  if (actor !== turnSeat(state.fen)) return [];
  return new Chess(state.fen).moves({ verbose: true }).map((m) => (m.promotion ? { type: 'move', from: m.from, to: m.to, promotion: m.promotion as Promotion } : { type: 'move', from: m.from, to: m.to }));
}

/** Wie `legalMoves`, lässt aber zusätzlich „Remis anbieten“ zu (siehe `draw-offer.ts` in der Engine). */
export function isLegal(state: ChessState, actor: Actor, move: ChessMove): boolean {
  if (state.end) return false;
  if (isDrawMove(move)) return isDrawMoveLegal(state.drawOffer, actor, move, turnSeat(state.fen), state.history.length);
  return legalMoves(state, actor).some((m) => m.type === 'move' && m.from === move.from && m.to === move.to && m.promotion === move.promotion);
}

export function applyMove(state: ChessState, actor: Actor, move: ChessMove): MoveResult<ChessState> {
  if (state.end || !isLegal(state, actor, move)) throw new Error('Du bist nicht am Zug.');
  if (isDrawMove(move)) {
    const draw = applyDrawMove(state.drawOffer, actor as SeatId, move, state.history.length);
    const events: GameEvent[] = [draw.event];
    if (draw.agreed) events.push({ type: 'over', end: 'agreement' });
    return { state: { ...state, drawOffer: draw.offer, ...(draw.agreed ? { end: 'agreement' as const, winner: null } : {}) }, events };
  }
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
      ...(state.rotate === undefined ? {} : { rotate: state.rotate }),
      ...(state.drawOffer === undefined ? {} : { drawOffer: state.drawOffer }),
    },
    events,
  };
}

export function result(state: ChessState): Result | null {
  if (!state.end) return null;
  if (state.winner !== null) return { kind: 'win', winners: [state.winner], reason: state.end };
  return { kind: 'draw', reason: state.end };
}

// ---------------------------------------------------------------------------
// PGN – das übliche Textformat für Schachpartien
// ---------------------------------------------------------------------------

/**
 * Liest eine PGN-Partie ein und spielt sie Zug für Zug mit diesen Regeln nach – so stimmen
 * Wiederholungszähler, letzter Zug und Partieende genau wie bei einer hier gespielten Partie.
 * Nur Partien ab der Grundstellung; endet die Partie nach unseren Regeln schon früher
 * (z. B. dreifache Wiederholung), gibt es einen Fehler statt einer still gekürzten Partie.
 */
export function loadFromPgn(pgn: string, options: Options = {}): ChessState {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch (e) {
    throw new Error(`Die PGN-Partie lässt sich nicht lesen: ${e instanceof Error ? e.message : String(e)}`);
  }
  const fen = chess.getHeaders().FEN;
  if (fen && positionKey(fen) !== positionKey(START_FEN)) throw new Error('Nur Partien ab der Grundstellung lassen sich laden.');
  let state = setup(2, options);
  for (const [i, m] of chess.history({ verbose: true }).entries()) {
    if (state.end) throw new Error(`Die Partie endet nach unseren Regeln schon vor Zug ${Math.floor(i / 2) + 1} (${state.end}).`);
    const move: BoardMove = m.promotion ? { type: 'move', from: m.from, to: m.to, promotion: m.promotion as Promotion } : { type: 'move', from: m.from, to: m.to };
    state = applyMove(state, turnSeat(state.fen), move).state;
  }
  return state;
}

const PGN_RESULT: Record<string, string> = { white: '1-0', black: '0-1', draw: '1/2-1/2', open: '*' };

/** Die Partie als PGN-Text mit Kopfzeilen (Namen, Datum, Ergebnis). */
export function toPgn(state: ChessState, names: [string, string] = ['Weiß', 'Schwarz'], date = new Date()): string {
  const chess = new Chess();
  for (const san of state.history) chess.move(san);
  const result = !state.end ? 'open' : state.winner === 0 ? 'white' : state.winner === 1 ? 'black' : 'draw';
  chess.setHeader('Event', 'Brett & Blatt');
  chess.setHeader('Site', 'spiele.lipponer.de');
  chess.setHeader('Date', `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`);
  chess.setHeader('White', names[0]);
  chess.setHeader('Black', names[1]);
  chess.setHeader('Result', PGN_RESULT[result]!);
  return `${chess.pgn({ maxWidth: 80 })}\n`;
}
