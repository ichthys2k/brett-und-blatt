import type { Actor, GameEvent, MoveResult, Options, Result, SeatId } from '@brett-und-blatt/engine';
import { Rng } from '@brett-und-blatt/engine';
import { BOARD_SIZE, isEmptyBoard, squareTypeAt, type BoardCell } from './board';
import { isValidWord } from './dict';
import { createBag, LETTER_VALUES, RACK_SIZE, type Letter, type Tile } from './letters';

export type { BoardCell } from './board';
export type { Letter, Tile } from './letters';

export interface ScrabbleState {
  board: (BoardCell | null)[];
  racks: Tile[][];
  bag: Tile[];
  scores: number[];
  consecutivePasses: number;
  turn: SeatId;
  phase: 'play' | 'challenge';
  lastMove?: {
    actor: SeatId;
    move: ScrabbleMove;
    words: Array<{ word: string; score: number }>;
    score: number;
  };
  options: ScrabbleOptions;
  moveCount: number;
}

export interface ScrabbleOptions {
  dictionary: 'de' | 'en';
  checkMode: 'immediate' | 'challenge';
  jokerSwap: boolean;
  rackSize: number;
  bingoBonus: number;
}

export type PlacedTile = {
  row: number;
  col: number;
  letter: Letter;
  isBlank?: boolean;
};

export type ScrabbleMove =
  | { type: 'play'; tiles: PlacedTile[] }
  | { type: 'exchange'; letters: Tile[] }
  | { type: 'pass' }
  | { type: 'challenge'; challenge: boolean };

export interface ScrabbleView {
  board: (BoardCell | null)[];
  myRack: Tile[];
  rackSizes: number[];
  scores: number[];
  turn: SeatId;
  phase: 'play' | 'challenge';
  bagCount: number;
  consecutivePasses: number;
  options: ScrabbleOptions;
  lastMove?: ScrabbleState['lastMove'];
}

export const id = 'scrabble';
export const name = 'Scrabble';
export const minSeats = 2;
export const maxSeats = 4;
export const tags = ['wort', 'online'];

function defaultOptions(): ScrabbleOptions {
  return {
    dictionary: 'de',
    checkMode: 'immediate',
    jokerSwap: false,
    rackSize: RACK_SIZE,
    bingoBonus: 50,
  };
}

function shuffleBag(bag: Tile[], rng: any): Tile[] {
  const arr = [...bag];
  for (let i = arr.length - 1; i > 0; i--) {
    const r = typeof rng.next === 'function' ? rng.next() : Math.random();
    const j = Math.floor(r * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawTiles(bag: Tile[], count: number): { drawn: Tile[]; rest: Tile[] } {
  const drawn = bag.slice(0, count);
  const rest = bag.slice(count);
  return { drawn, rest };
}

export function setup(seats: number, options: Options = {}, seed: string = ''): ScrabbleState {
  const rng: any = (Rng as any).fromSeed ? (Rng as any).fromSeed(seed || 'x', 'scrabble-setup') : (new (Rng as any)(seed || 'x'));
  let bag = shuffleBag(createBag(), rng);
  const racks: Tile[][] = [];
  const rackSize = (options as any)?.rackSize ?? RACK_SIZE;
  for (let s = 0; s < seats; s++) {
    const { drawn, rest } = drawTiles(bag, rackSize);
    racks.push(drawn);
    bag = rest;
  }
  const opts = { ...defaultOptions(), ...(options as any) };
  return {
    board: Array(BOARD_SIZE * BOARD_SIZE).fill(null),
    racks,
    bag,
    scores: Array(seats).fill(0),
    consecutivePasses: 0,
    turn: 0 as SeatId,
    phase: 'play',
    options: opts,
    moveCount: 0,
  };
}

export function currentPlayers(state: ScrabbleState): Actor[] {
  if (result(state)) return [];
  return [state.turn];
}

function getWordsForMove(board: (BoardCell | null)[], tiles: PlacedTile[]): Array<{ word: string; positions: { r: number; c: number }[] }> {
  if (tiles.length === 0) return [];
  const rows = new Set(tiles.map((t) => t.row));
  const cols = new Set(tiles.map((t) => t.col));
  const isHorizontal = rows.size === 1;
  const results: Array<{ word: string; positions: { r: number; c: number }[] }> = [];

  const isEmpty = isEmptyBoard(board);
  if (isEmpty && !tiles.some((t) => t.row === 4 && t.col === 4)) {
    return [];
  }

  if (tiles.length === 1) {
    const t = tiles[0];
    let c = t.col;
    while (c > 0 && board[t.row * BOARD_SIZE + (c - 1)]) c--;
    const positions: { r: number; c: number }[] = [];
    while (c < BOARD_SIZE && (board[t.row * BOARD_SIZE + c] || tiles.some((tt) => tt.row === t.row && tt.col === c))) {
      positions.push({ r: t.row, c });
      c++;
    }
    if (positions.length >= 1) {
      let word = '';
      for (const p of positions) {
        const placed = tiles.find((tt) => tt.row === p.r && tt.col === p.c);
        if (placed) word += placed.isBlank ? placed.letter.toLowerCase() : placed.letter;
        else {
          const cell = board[p.r * BOARD_SIZE + p.c];
          if (cell) word += cell.letter;
        }
      }
      if (word.length > 1) results.push({ word, positions });
    }
    let r2 = t.row;
    while (r2 > 0 && board[(r2 - 1) * BOARD_SIZE + t.col]) r2--;
    const positions2: { r: number; c: number }[] = [];
    while (r2 < BOARD_SIZE && (board[r2 * BOARD_SIZE + t.col] || tiles.some((tt) => tt.row === r2 && tt.col === t.col))) {
      positions2.push({ r: r2, c: t.col });
      r2++;
    }
    if (positions2.length >= 1) {
      let word = '';
      for (const p of positions2) {
        const placed = tiles.find((tt) => tt.row === p.r && tt.col === p.c);
        if (placed) word += placed.isBlank ? placed.letter.toLowerCase() : placed.letter;
        else {
          const cell = board[p.r * BOARD_SIZE + p.c];
          if (cell) word += cell.letter;
        }
      }
      if (word.length > 1 && !results.some((r) => r.positions.length === word.length && r.positions[0].r === positions2[0].r)) {
        results.push({ word, positions: positions2 });
      }
    }
    return results;
  }

  if (isHorizontal) {
    const row = tiles[0].row;
    let startCol = Math.min(...tiles.map((t) => t.col));
    while (startCol > 0 && board[row * BOARD_SIZE + (startCol - 1)]) startCol--;
    let endCol = Math.max(...tiles.map((t) => t.col));
    while (endCol < BOARD_SIZE - 1 && board[row * BOARD_SIZE + (endCol + 1)]) endCol++;
    const positions: { r: number; c: number }[] = [];
    for (let c = startCol; c <= endCol; c++) positions.push({ r: row, c });
    let word = '';
    for (const p of positions) {
      const placed = tiles.find((tt) => tt.row === p.r && tt.col === p.c);
      if (placed) word += placed.isBlank ? placed.letter.toLowerCase() : placed.letter;
      else {
        const cell = board[p.r * BOARD_SIZE + p.c];
        if (cell) word += cell.letter;
      }
    }
    if (word.length >= 1) results.push({ word, positions });
  } else {
    const col = tiles[0].col;
    let startRow = Math.min(...tiles.map((t) => t.row));
    while (startRow > 0 && board[(startRow - 1) * BOARD_SIZE + col]) startRow--;
    let endRow = Math.max(...tiles.map((t) => t.row));
    while (endRow < BOARD_SIZE - 1 && board[(endRow + 1) * BOARD_SIZE + col]) endRow++;
    const positions: { r: number; c: number }[] = [];
    for (let r = startRow; r <= endRow; r++) positions.push({ r, c: col });
    let word = '';
    for (const p of positions) {
      const placed = tiles.find((tt) => tt.row === p.r && tt.col === p.c);
      if (placed) word += placed.isBlank ? placed.letter.toLowerCase() : placed.letter;
      else {
        const cell = board[p.r * BOARD_SIZE + p.c];
        if (cell) word += cell.letter;
      }
    }
    if (word.length >= 1) results.push({ word, positions });
  }

  for (const placed of tiles) {
    if (isHorizontal) {
      let r = placed.row;
      while (r > 0 && board[(r - 1) * BOARD_SIZE + placed.col]) r--;
      const positions: { r: number; c: number }[] = [];
      while (r < BOARD_SIZE && (board[r * BOARD_SIZE + placed.col] || (r === placed.row && tiles.some((tt) => tt.row === r && tt.col === placed.col)))) {
        positions.push({ r, c: placed.col });
        r++;
      }
      if (positions.length > 1) {
        let word = '';
        for (const p of positions) {
          const pplaced = tiles.find((tt) => tt.row === p.r && tt.col === p.c);
          if (pplaced) word += pplaced.isBlank ? pplaced.letter.toLowerCase() : pplaced.letter;
          else {
            const cell = board[p.r * BOARD_SIZE + p.c];
            if (cell) word += cell.letter;
          }
        }
        if (!results.some((res) => res.word === word)) {
          results.push({ word, positions });
        }
      }
    } else {
      let c = placed.col;
      while (c > 0 && board[placed.row * BOARD_SIZE + (c - 1)]) c--;
      const positions: { r: number; c: number }[] = [];
      while (c < BOARD_SIZE && (board[placed.row * BOARD_SIZE + c] || (c === placed.col && tiles.some((tt) => tt.row === placed.row && tt.col === c)))) {
        positions.push({ r: placed.row, c });
        c++;
      }
      if (positions.length > 1) {
        let word = '';
        for (const p of positions) {
          const pplaced = tiles.find((tt) => tt.row === p.r && tt.col === p.c);
          if (pplaced) word += pplaced.isBlank ? pplaced.letter.toLowerCase() : pplaced.letter;
          else {
            const cell = board[p.r * BOARD_SIZE + p.c];
            if (cell) word += cell.letter;
          }
        }
        if (!results.some((res) => res.word === word)) {
          results.push({ word, positions });
        }
      }
    }
  }
  return results;
}

function scoreWord(word: string, positions: { r: number; c: number }[], board: (BoardCell | null)[], placedTiles: PlacedTile[]): number {
  let wordScore = 0;
  let wordMultiplier = 1;
  for (const p of positions) {
    const placed = placedTiles.find((tt) => tt.row === p.r && tt.col === p.c);
    if (placed) {
      let letterScore = 0;
      if (!placed.isBlank) letterScore = LETTER_VALUES[placed.letter as Letter] || 0;
      const st = squareTypeAt(p.r, p.c);
      if (st === 'dl') letterScore *= 2;
      else if (st === 'tl') letterScore *= 3;
      else if (st === 'dw') wordMultiplier *= 2;
      else if (st === 'tw') wordMultiplier *= 3;
      wordScore += letterScore;
    } else {
      const cell = board[p.r * BOARD_SIZE + p.c];
      if (cell) wordScore += LETTER_VALUES[cell.letter as Letter] || 0;
    }
  }
  return wordScore * wordMultiplier;
}

export function legalMoves(state: ScrabbleState, actor?: Actor): ScrabbleMove[] {
  if (actor !== undefined && actor !== state.turn) return [];
  if (result(state)) return [];
  const moves: ScrabbleMove[] = [{ type: 'pass' }];
  const rack = state.racks[state.turn];
  if (state.bag.length >= 1 && rack.length > 0) {
    for (let i = 0; i < Math.min(rack.length, 3); i++) {
      moves.push({ type: 'exchange', letters: [rack[i]] });
    }
  }
  return moves;
}

export function isLegal(state: ScrabbleState, actor: Actor, move: ScrabbleMove): boolean {
  if (move.type === 'pass') return actor === state.turn && !result(state);
  if (move.type === 'exchange') return actor === state.turn && !result(state) && move.letters.length > 0;
  if (move.type === 'challenge') return actor === state.turn && !result(state);
  if (move.type === 'play') {
    if (actor !== state.turn || result(state)) return false;
    return tilesValid(state, actor, move.tiles);
  }
  return false;
}

function tilesValid(state: ScrabbleState, actor: Actor, tiles: PlacedTile[]): boolean {
  if (!tiles || tiles.length === 0) return false;
  const isEmpty = isEmptyBoard(state.board);
  if (isEmpty && !tiles.some((t) => t.row === 4 && t.col === 4)) return false;
  const rows = new Set(tiles.map((t) => t.row));
  const cols = new Set(tiles.map((t) => t.col));
  if (rows.size > 1 && cols.size > 1) return false;
  for (const t of tiles) {
    if (t.row < 0 || t.row >= BOARD_SIZE || t.col < 0 || t.col >= BOARD_SIZE) return false;
    if (state.board[t.row * BOARD_SIZE + t.col]) return false;
  }
  if (!isEmpty) {
    let connected = false;
    for (const t of tiles) {
      const adj = [
        [t.row - 1, t.col],
        [t.row + 1, t.col],
        [t.row, t.col - 1],
        [t.row, t.col + 1],
      ];
      for (const [ar, ac] of adj) {
        if (ar >= 0 && ar < BOARD_SIZE && ac >= 0 && ac < BOARD_SIZE) {
          if (state.board[ar * BOARD_SIZE + ac]) {
            connected = true;
            break;
          }
        }
      }
      if (connected) break;
    }
    if (!connected) return false;
  }
  const rack = [...(state.racks[actor as number] || [])];
  for (const t of tiles) {
    const idx = rack.findIndex((rt) => {
      if (typeof rt === 'string') {
        if (t.isBlank && rt === '?') return true;
        if (!t.isBlank && rt === t.letter) return true;
        return false;
      }
      return false;
    });
    if (idx < 0) return false;
    rack.splice(idx, 1);
  }
  const words = getWordsForMove(state.board, tiles);
  if (words.length === 0) return false;
  for (const w of words) {
    if (w.word.length < 2) return false;
    if (!isValidWord(w.word)) return false;
  }
  return true;
}

export function applyMove(state: ScrabbleState, actor: Actor, move: ScrabbleMove): MoveResult<ScrabbleState> {
  if (actor !== state.turn) throw new Error('Du bist nicht am Zug.');
  if (result(state)) throw new Error('Spiel ist vorbei.');
  const events: GameEvent[] = [];

  if (move.type === 'pass') {
    const ns = { ...state, consecutivePasses: state.consecutivePasses + 1, turn: ((state.turn + 1) % state.racks.length) as SeatId, moveCount: state.moveCount + 1 };
    events.push({ type: 'pass', seat: actor });
    return { state: ns, events };
  }

  if (move.type === 'exchange') {
    const rack = [...(state.racks[actor as number] || [])];
    const toExchange = move.letters;
    for (const ex of toExchange) {
      const idx = rack.findIndex((t) => {
        if (typeof t === 'string') {
          if (typeof ex === 'string') return t === ex;
          return false;
        }
        return false;
      });
      if (idx >= 0) rack.splice(idx, 1);
    }
    let bagArr = shuffleBag(state.bag, {});
    const { drawn, rest } = drawTiles(bagArr, toExchange.length);
    bagArr = rest;
    for (const d of drawn) rack.push(d);
    const racks = state.racks.map((r, i) => (i === actor ? rack : r));
    const ns = { ...state, racks, bag: bagArr, consecutivePasses: 0, turn: ((state.turn + 1) % state.racks.length) as SeatId, moveCount: state.moveCount + 1 };
    events.push({ type: 'exchange', seat: actor, count: toExchange.length });
    return { state: ns, events };
  }

  if (move.type === 'play') {
    if (!tilesValid(state, actor, move.tiles)) throw new Error('Ungültiger Zug.');
    const tiles = move.tiles;
    const words = getWordsForMove(state.board, tiles);
    let totalScore = 0;
    for (const w of words) {
      totalScore += scoreWord(w.word, w.positions, state.board, tiles);
    }
    if (tiles.length === 7) totalScore += (state.options.bingoBonus as number) || 50;
    const board = [...state.board];
    for (const t of tiles) {
      board[t.row * BOARD_SIZE + t.col] = { letter: t.letter, isBlank: !!t.isBlank, placedBy: actor as number, turn: state.moveCount } as any;
    }
    let bagDraw = state.bag;
    const { drawn, rest } = drawTiles(bagDraw, tiles.length);
    bagDraw = rest;
    const rack = [...(state.racks[actor as number] || [])];
    for (const t of tiles) {
      const idx = rack.findIndex((rt) => {
        if (typeof rt === 'string') {
          if (t.isBlank && rt === '?') return true;
          if (!t.isBlank && rt === t.letter) return true;
          return false;
        }
        return false;
      });
      if (idx >= 0) rack.splice(idx, 1);
    }
    const newRack = [...rack, ...drawn];
    const racksArr = state.racks.map((r, i) => (i === actor ? newRack : r));
    const scores = state.scores.map((s, i) => (i === actor ? s + totalScore : s));
    const ns: ScrabbleState = {
      ...state,
      board,
      racks: racksArr,
      bag: bagDraw,
      scores,
      consecutivePasses: 0,
      turn: ((state.turn + 1) % state.racks.length) as SeatId,
      phase: 'play',
      lastMove: { actor, move, words: words.map((w) => ({ word: w.word, score: scoreWord(w.word, w.positions, board, tiles) })), score: totalScore },
      moveCount: state.moveCount + 1,
    };
    events.push({ type: 'play', seat: actor, words: words.map((w) => w.word), score: totalScore });
    return { state: ns, events };
  }

  if (move.type === 'challenge') {
    const ns = { ...state, turn: ((state.turn + 1) % state.racks.length) as SeatId, moveCount: state.moveCount + 1 };
    events.push({ type: 'challenge', seat: actor });
    return { state: ns, events };
  }

  throw new Error('Unbekannter Zug.');
}

export function playerView(state: ScrabbleState, seat: SeatId | 'spectator'): ScrabbleView {
  if (seat === 'spectator') {
    return {
      board: state.board,
      myRack: [],
      rackSizes: state.racks.map((r) => r.length),
      scores: state.scores,
      turn: state.turn,
      phase: state.phase,
      bagCount: state.bag.length,
      consecutivePasses: state.consecutivePasses,
      options: state.options,
      lastMove: state.lastMove,
    };
  }
  return {
    board: state.board,
    myRack: state.racks[seat] || [],
    rackSizes: state.racks.map((r) => r.length),
    scores: state.scores,
    turn: state.turn,
    phase: state.phase,
    bagCount: state.bag.length,
    consecutivePasses: state.consecutivePasses,
    options: state.options,
    lastMove: state.lastMove,
  };
}

export function view(state: ScrabbleState, seat: SeatId): ScrabbleView {
  return playerView(state, seat);
}

export function result(state: ScrabbleState): Result | null {
  if (state.consecutivePasses >= state.racks.length * 2) {
    const finalScores = [...state.scores];
    let totalRemaining = 0;
    for (let i = 0; i < state.racks.length; i++) {
      for (const t of state.racks[i]) {
        if (typeof t === 'string' && t !== '?') totalRemaining += LETTER_VALUES[t as Letter] || 0;
      }
    }
    for (let i = 0; i < state.racks.length; i++) {
      if (state.racks[i].length === 0) {
        finalScores[i] += totalRemaining;
      } else {
        let sub = 0;
        for (const t of state.racks[i]) {
          if (typeof t === 'string' && t !== '?') sub += LETTER_VALUES[t as Letter] || 0;
        }
        finalScores[i] -= sub;
      }
    }
    const maxScore = Math.max(...finalScores);
    const winners = finalScores.map((s, i) => (s === maxScore ? i : -1)).filter((i) => i >= 0) as SeatId[];
    if (winners.length === 1) return { kind: 'win', winners };
    return { kind: 'draw' };
  }
  if (state.bag.length === 0) {
    for (let i = 0; i < state.racks.length; i++) {
      if (state.racks[i].length === 0) {
        const finalScores = [...state.scores];
        let totalRemaining = 0;
        for (let j = 0; j < state.racks.length; j++) {
          if (j !== i) {
            for (const t of state.racks[j]) {
              if (typeof t === 'string' && t !== '?') totalRemaining += LETTER_VALUES[t as Letter] || 0;
            }
          }
        }
        finalScores[i] += totalRemaining;
        const maxScore = Math.max(...finalScores);
        const winners = finalScores.map((s, j) => (s === maxScore ? j : -1)).filter((j) => j >= 0) as SeatId[];
        if (winners.length === 1) return { kind: 'win', winners };
        return { kind: 'draw' };
      }
    }
  }
  return null;
}

export function evaluate(state: ScrabbleState, seat: SeatId): number {
  return state.scores[seat] - state.scores.reduce((a, b, i) => (i === seat ? a : a + b), 0) / Math.max(1, state.racks.length - 1);
}

export function sampleHidden(view: ScrabbleView, _seat: SeatId, rng: Rng): ScrabbleState {
  const state = view as any;
  return state;
}
