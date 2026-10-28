import type { Actor, GameEvent, MoveResult, Options, Result, SeatId } from '@brett-und-blatt/engine';
import { Rng, type RngState } from '@brett-und-blatt/engine';
import { BOARD_SIZE, CENTER, squareTypeAt } from './board';
import { isValidWord } from './dict';
import { createBag, LETTER_VALUES, type Letter, type Tile } from './letters';
import { generatePlays } from './movegen';

export type { Letter, Tile } from './letters';

/** Ein liegender Stein. Joker tragen den gewählten Buchstaben und zählen 0 Punkte. */
export interface BoardCell {
  letter: Letter;
  blank: boolean;
  by: number;
}

export interface PlacedTile {
  row: number;
  col: number;
  letter: Letter;
  blank?: boolean;
}

export interface LastMove {
  seat: number;
  kind: 'play' | 'exchange' | 'pass';
  cells: number[];
  words: { word: string; score: number }[];
  score: number;
  count: number;
}

export interface ScrabbleState {
  seats: number;
  board: (BoardCell | null)[];
  /** Bänkchen; fremde Steine sind in der Sicht `null`. */
  racks: (Tile | null)[][];
  /** Beutel; in der Sicht nur noch als Anzahl (`null`-Einträge). */
  bag: (Tile | null)[];
  rng: RngState;
  scores: number[];
  turn: number;
  /** Züge ohne Punkte in Folge (Passen, Tauschen). */
  scoreless: number;
  moveCount: number;
  rackSize: number;
  bingoBonus: number;
  lastMove: LastMove | null;
  /** Endstand nach Verrechnung der Reststeine, sobald die Partie vorbei ist. */
  final: number[] | null;
}

export type ScrabbleMove =
  | { type: 'play'; tiles: PlacedTile[] }
  | { type: 'exchange'; tiles: Tile[] }
  | { type: 'pass' };

/** Mindestzahl Steine im Beutel, damit getauscht werden darf. */
export const EXCHANGE_MIN_BAG = 7;
export const BINGO_TILES = 7;

const idx = (row: number, col: number) => row * BOARD_SIZE + col;
const inside = (row: number, col: number) => row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

export function setup(seats: number, options: Options, seed: string): ScrabbleState {
  const rng = Rng.fromSeed(seed, 'beutel');
  const bag: Tile[] = rng.shuffle(createBag());
  const rackSize = Number(options.rackSize ?? 7) === 8 ? 8 : 7;
  const racks = Array.from({ length: seats }, () => bag.splice(bag.length - rackSize, rackSize));
  return {
    seats,
    board: Array(BOARD_SIZE * BOARD_SIZE).fill(null),
    racks,
    bag,
    rng: rng.state,
    scores: Array(seats).fill(0),
    turn: 0,
    scoreless: 0,
    moveCount: 0,
    rackSize,
    bingoBonus: String(options.bingoBonus ?? '50') === '0' ? 0 : 50,
    lastMove: null,
    final: null,
  };
}

export function currentPlayers(state: ScrabbleState): Actor[] {
  return state.final ? [] : [state.turn];
}

// ---------------------------------------------------------------------------
// Wörter und Wertung
// ---------------------------------------------------------------------------

export type PlayCheck =
  | { ok: true; words: { word: string; score: number; cells: number[] }[]; score: number; bingo: boolean }
  | { ok: false; reason: string };

/**
 * Prüft eine Legung auf dem Brett (ohne Bänkchen): eine Linie, lückenlos, angelegt bzw. über
 * die Mitte, alle entstandenen Wörter im Wörterbuch. Liefert Wörter und Punkte.
 */
export function checkPlay(board: readonly (BoardCell | null)[], tiles: readonly PlacedTile[], bingoBonus = 50): PlayCheck {
  if (tiles.length === 0) return { ok: false, reason: 'Lege mindestens einen Stein.' };
  const placed = new Map<number, PlacedTile>();
  for (const t of tiles) {
    if (!inside(t.row, t.col)) return { ok: false, reason: 'Außerhalb des Bretts.' };
    if (!(t.letter in LETTER_VALUES)) return { ok: false, reason: 'Unbekannter Buchstabe.' };
    const i = idx(t.row, t.col);
    if (board[i] || placed.has(i)) return { ok: false, reason: 'Das Feld ist schon belegt.' };
    placed.set(i, t);
  }
  const sameRow = tiles.every((t) => t.row === tiles[0]!.row);
  const sameCol = tiles.every((t) => t.col === tiles[0]!.col);
  if (!sameRow && !sameCol) return { ok: false, reason: 'Alle Steine in eine Reihe oder Spalte.' };

  const letterAt = (row: number, col: number): Letter | null => {
    if (!inside(row, col)) return null;
    const i = idx(row, col);
    return placed.get(i)?.letter ?? board[i]?.letter ?? null;
  };

  // Lückenlos zwischen erstem und letztem neuen Stein.
  const horizontal = tiles.length > 1 ? sameRow : true;
  const along = (t: PlacedTile) => (horizontal ? t.col : t.row);
  const lo = Math.min(...tiles.map(along));
  const hi = Math.max(...tiles.map(along));
  const fixed = horizontal ? tiles[0]!.row : tiles[0]!.col;
  for (let p = lo; p <= hi; p++) {
    if (!(horizontal ? letterAt(fixed, p) : letterAt(p, fixed))) return { ok: false, reason: 'Die Steine müssen lückenlos liegen.' };
  }

  const empty = board.every((c) => c === null);
  if (empty) {
    if (!placed.has(idx(CENTER, CENTER))) return { ok: false, reason: 'Das erste Wort muss über das Mittelfeld ★ gehen.' };
    if (tiles.length < 2) return { ok: false, reason: 'Das erste Wort braucht mindestens zwei Buchstaben.' };
  } else {
    const touches = tiles.some((t) =>
      [
        [t.row - 1, t.col],
        [t.row + 1, t.col],
        [t.row, t.col - 1],
        [t.row, t.col + 1],
      ].some(([r, c]) => inside(r!, c!) && board[idx(r!, c!)]),
    );
    if (!touches) return { ok: false, reason: 'Lege an die vorhandenen Steine an.' };
  }

  const wordAt = (row: number, col: number, dr: number, dc: number) => {
    let r = row;
    let c = col;
    while (letterAt(r - dr, c - dc)) {
      r -= dr;
      c -= dc;
    }
    const cells: number[] = [];
    let word = '';
    let sum = 0;
    let mult = 1;
    while (letterAt(r, c)) {
      const i = idx(r, c);
      const fresh = placed.get(i);
      word += letterAt(r, c);
      cells.push(i);
      if (fresh) {
        let value = fresh.blank ? 0 : LETTER_VALUES[fresh.letter];
        const square = squareTypeAt(r, c);
        if (square === 'dl') value *= 2;
        else if (square === 'tl') value *= 3;
        else if (square === 'dw' || square === 'star') mult *= 2;
        else if (square === 'tw') mult *= 3;
        sum += value;
      } else {
        const cell = board[i]!;
        sum += cell.blank ? 0 : LETTER_VALUES[cell.letter];
      }
      r += dr;
      c += dc;
    }
    return { word, score: sum * mult, cells };
  };

  const words: { word: string; score: number; cells: number[] }[] = [];
  const first = tiles[0]!;
  const directions: [number, number][] = tiles.length > 1 ? [horizontal ? [0, 1] : [1, 0]] : [[0, 1], [1, 0]];
  for (const [dr, dc] of directions) {
    const main = wordAt(first.row, first.col, dr, dc);
    if (main.word.length > 1) words.push(main);
  }
  if (tiles.length > 1) {
    const [dr, dc] = horizontal ? [1, 0] : [0, 1];
    for (const t of tiles) {
      const cross = wordAt(t.row, t.col, dr, dc);
      if (cross.word.length > 1) words.push(cross);
    }
  }
  if (words.length === 0) return { ok: false, reason: 'Es entsteht kein Wort.' };
  const wrong = words.find((w) => !isValidWord(w.word));
  if (wrong) return { ok: false, reason: `„${wrong.word}“ steht nicht im Wörterbuch.` };
  const bingo = tiles.length >= BINGO_TILES;
  const score = words.reduce((sum, w) => sum + w.score, 0) + (bingo ? bingoBonus : 0);
  return { ok: true, words, score, bingo };
}

/** Nimmt die Steine vom Bänkchen; null, wenn sie nicht darauf liegen. */
function takeFromRack(rack: readonly (Tile | null)[], tiles: readonly Tile[]): (Tile | null)[] | null {
  const rest = [...rack];
  for (const t of tiles) {
    const i = rest.indexOf(t);
    if (i < 0) return null;
    rest.splice(i, 1);
  }
  return rest;
}

const rackTile = (t: PlacedTile): Tile => (t.blank ? '?' : t.letter);

// ---------------------------------------------------------------------------
// Züge
// ---------------------------------------------------------------------------

/**
 * Alle Legungen, die das Bänkchen erlaubt, dazu Passen und – bei vollem Beutel – Tauschen
 * des ganzen Bänkchens (beliebige Teilmengen prüft `isLegal`).
 */
export function legalMoves(state: ScrabbleState, actor: Actor): ScrabbleMove[] {
  if (state.final || actor !== state.turn) return [];
  const rack = state.racks[state.turn]!.filter((t): t is Tile => t !== null);
  const moves: ScrabbleMove[] = generatePlays(state.board, rack).map((tiles) => ({ type: 'play', tiles }));
  if (state.bag.length >= EXCHANGE_MIN_BAG && rack.length > 0) moves.push({ type: 'exchange', tiles: rack });
  moves.push({ type: 'pass' });
  return moves;
}

export function isLegal(state: ScrabbleState, actor: Actor, move: ScrabbleMove): boolean {
  if (state.final || actor !== state.turn) return false;
  const rack = state.racks[state.turn]!;
  switch (move.type) {
    case 'pass':
      return true;
    case 'exchange':
      return (
        Array.isArray(move.tiles) &&
        move.tiles.length > 0 &&
        state.bag.length >= EXCHANGE_MIN_BAG &&
        takeFromRack(rack, move.tiles) !== null
      );
    case 'play':
      return (
        Array.isArray(move.tiles) &&
        takeFromRack(rack, move.tiles.map(rackTile)) !== null &&
        checkPlay(state.board, move.tiles, state.bingoBonus).ok
      );
    default:
      return false;
  }
}

const rackPoints = (rack: readonly (Tile | null)[]) => rack.reduce((sum, t) => sum + (t && t !== '?' ? LETTER_VALUES[t] : 0), 0);

/** Endabrechnung: Reststeine abziehen; wer ausgespielt hat, bekommt die Reste der anderen. */
function finish(state: ScrabbleState, finisher: number | null): number[] {
  const rests = state.racks.map(rackPoints);
  const total = rests.reduce((a, b) => a + b, 0);
  return state.scores.map((score, seat) => (seat === finisher ? score + total : score - rests[seat]!));
}

export function applyMove(state: ScrabbleState, actor: Actor, move: ScrabbleMove): MoveResult<ScrabbleState> {
  if (!isLegal(state, actor, move)) throw new Error('Unerlaubter Zug.');
  const seat = state.turn;
  const next: ScrabbleState = { ...state, turn: (seat + 1) % state.seats, moveCount: state.moveCount + 1 };
  const events: GameEvent[] = [];

  if (move.type === 'pass') {
    next.scoreless = state.scoreless + 1;
    next.lastMove = { seat, kind: 'pass', cells: [], words: [], score: 0, count: 0 };
    events.push({ type: 'passed', seat });
  } else if (move.type === 'exchange') {
    const rng = new Rng(state.rng);
    const bag = [...state.bag];
    const drawn = bag.splice(bag.length - move.tiles.length, move.tiles.length);
    const rack = [...takeFromRack(state.racks[seat]!, move.tiles)!, ...drawn];
    next.bag = rng.shuffle([...bag, ...move.tiles]);
    next.rng = rng.state;
    next.racks = state.racks.map((r, s) => (s === seat ? rack : r));
    next.scoreless = state.scoreless + 1;
    next.lastMove = { seat, kind: 'exchange', cells: [], words: [], score: 0, count: move.tiles.length };
    events.push({ type: 'exchanged', seat, count: move.tiles.length });
  } else {
    const check = checkPlay(state.board, move.tiles, state.bingoBonus);
    if (!check.ok) throw new Error(check.reason);
    const board = [...state.board];
    for (const t of move.tiles) board[idx(t.row, t.col)] = { letter: t.letter, blank: !!t.blank, by: seat };
    const bag = [...state.bag];
    const left = takeFromRack(state.racks[seat]!, move.tiles.map(rackTile))!;
    const drawn = bag.splice(Math.max(0, bag.length - move.tiles.length), move.tiles.length);
    next.board = board;
    next.bag = bag;
    next.racks = state.racks.map((r, s) => (s === seat ? [...left, ...drawn] : r));
    next.scores = state.scores.map((sc, s) => (s === seat ? sc + check.score : sc));
    next.scoreless = 0;
    next.lastMove = {
      seat,
      kind: 'play',
      cells: move.tiles.map((t) => idx(t.row, t.col)),
      words: check.words.map(({ word, score }) => ({ word, score })),
      score: check.score,
      count: move.tiles.length,
    };
    events.push({ type: 'played', seat, words: check.words.map((w) => w.word), score: check.score, bingo: check.bingo });
  }

  const emptied = next.racks[seat]!.length === 0 && next.bag.length === 0;
  if (emptied) next.final = finish(next, seat);
  else if (next.scoreless >= Math.max(6, state.seats * 2)) next.final = finish(next, null);
  if (next.final) events.push({ type: 'gameOver' });
  return { state: next, events };
}

export function result(state: ScrabbleState): Result | null {
  if (!state.final) return null;
  const best = Math.max(...state.final);
  const winners = state.final.flatMap((score, seat) => (score === best ? [seat] : []));
  return winners.length === 1 ? { kind: 'win', winners } : { kind: 'draw' };
}

export function evaluate(state: ScrabbleState, seat: SeatId): number {
  const scores = state.final ?? state.scores;
  const others = scores.filter((_, s) => s !== seat);
  return (scores[seat]! - Math.max(...others)) / 100;
}

/** Fremde Bänkchen und der Beutel bleiben verdeckt, ebenso der Zufallszustand. */
export function playerView(state: ScrabbleState, seat: SeatId | 'spectator'): ScrabbleState {
  return {
    ...state,
    racks: state.racks.map((rack, s) => (s === seat || state.final ? rack : rack.map(() => null))),
    bag: state.bag.map(() => null),
    rng: [0, 0, 0, 0],
  };
}

/** Für Bots: die unbekannten Steine zufällig auf fremde Bänkchen und den Beutel verteilen. */
export function sampleHidden(view: ScrabbleState, seat: SeatId, rng: Rng): ScrabbleState {
  const unknown: Tile[] = createBag();
  const remove = (t: Tile) => {
    const i = unknown.indexOf(t);
    if (i >= 0) unknown.splice(i, 1);
  };
  for (const cell of view.board) if (cell) remove(cell.blank ? '?' : cell.letter);
  for (const t of view.racks[seat] ?? []) if (t) remove(t);
  const pool = rng.shuffle(unknown);
  const racks = view.racks.map((rack, s) => (s === seat ? rack : rack.map((t) => t ?? pool.pop() ?? null)));
  return { ...view, racks, bag: view.bag.map(() => pool.pop() ?? null), rng: rng.state };
}

/** Wie viele Punkte die Steine auf dem Bänkchen wert sind (für die Anzeige). */
export { rackPoints };
