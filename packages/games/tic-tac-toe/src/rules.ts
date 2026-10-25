/**
 * Die Regeln von Tic-Tac-Toe.
 *
 * Diese Datei ist das Lehrbeispiel für neue Spiele. Jede Funktion ist „rein“:
 * Sie bekommt einen Spielstand und gibt einen neuen zurück, ohne den alten zu
 * verändern. Sie weiß nichts von Bildschirm, Uhr oder Netzwerk – darum läuft
 * derselbe Code im Browser, im Bot-Worker, in den Tests und später auf dem Server.
 */
import type { Actor, GameEvent, MoveResult, Result, SeatId } from '@brett-und-blatt/engine';

/**
 * Der Spielstand. Er muss reines JSON sein (keine Klassen, keine Funktionen,
 * keine Map/Set), damit er gespeichert und verschickt werden kann.
 */
export interface TicTacToeState {
  /** Neun Felder, zeilenweise von oben links: Platz 0 (Kreuz), Platz 1 (Kreis) oder leer. */
  board: (SeatId | null)[];
  /** Wer am Zug ist. */
  turn: SeatId;
  winner: SeatId | null;
  /** Die drei Felder der Gewinnreihe – für die Hervorhebung in der Oberfläche. */
  winLine: number[] | null;
}

/** Ein Zug: ein Zeichen in ein Feld setzen. Züge sind ebenfalls reines JSON. */
export interface TicTacToeMove {
  type: 'place';
  cell: number;
}

/** Alle acht möglichen Reihen: drei waagerecht, drei senkrecht, zwei diagonal. */
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function setup(): TicTacToeState {
  return { board: Array(9).fill(null), turn: 0, winner: null, winLine: null };
}

/** Wer darf jetzt handeln? Nach Spielende niemand. */
export function currentPlayers(state: TicTacToeState): Actor[] {
  return result(state) ? [] : [state.turn];
}

/** Alle erlaubten Züge. Die Plattform prüft jeden Zug gegen diese Liste. */
export function legalMoves(state: TicTacToeState, actor: Actor): TicTacToeMove[] {
  if (actor !== state.turn || result(state)) return [];
  const moves: TicTacToeMove[] = [];
  state.board.forEach((cell, index) => {
    if (cell === null) moves.push({ type: 'place', cell: index });
  });
  return moves;
}

/**
 * Führt einen Zug aus. Unerlaubte Züge werfen einen Fehler.
 * Die `events` sagen der Oberfläche, was sie animieren soll.
 */
export function applyMove(state: TicTacToeState, actor: Actor, move: TicTacToeMove): MoveResult<TicTacToeState> {
  if (actor !== state.turn || result(state)) throw new Error('Du bist nicht am Zug.');
  if (move.type !== 'place' || state.board[move.cell] !== null || move.cell < 0 || move.cell > 8) {
    throw new Error('Dieses Feld ist nicht frei.');
  }

  // Neue Kopie statt Veränderung des alten Spielstands.
  const board = [...state.board];
  board[move.cell] = actor;
  const events: GameEvent[] = [{ type: 'placed', cell: move.cell, seat: actor }];

  const winLine = LINES.find((line) => line.every((cell) => board[cell] === actor)) ?? null;
  if (winLine) events.push({ type: 'win', seat: actor, line: [...winLine] });

  return {
    state: { board, turn: 1 - actor, winner: winLine ? actor : null, winLine: winLine ? [...winLine] : null },
    events,
  };
}

export function result(state: TicTacToeState): Result | null {
  if (state.winner !== null) return { kind: 'win', winners: [state.winner] };
  if (state.board.every((cell) => cell !== null)) return { kind: 'draw' };
  return null;
}

/** Stellungsbewertung für Suchbots: offene Zweier zählen. Aus Sicht von `seat`. */
export function evaluate(state: TicTacToeState, seat: SeatId): number {
  let score = 0;
  for (const line of LINES) {
    const own = line.filter((c) => state.board[c] === seat).length;
    const other = line.filter((c) => state.board[c] === 1 - seat).length;
    if (other === 0) score += own * own;
    if (own === 0) score -= other * other;
  }
  return score;
}
