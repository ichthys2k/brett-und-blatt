import { computeBotMove, isLegalMove } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it } from 'vitest';
import { gameModule } from '../src';
import { CENTER } from '../src/board';
import { generatePlays } from '../src/movegen';
import { checkPlay, type BoardCell, type PlacedTile, type ScrabbleMove, type ScrabbleState } from '../src/rules';
import type { Letter, Tile } from '../src/letters';

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule)) it(check.name, check.run);
});

const word = (text: string, row: number, col: number, horizontal = true): PlacedTile[] =>
  [...text].map((letter, i) => ({ row: horizontal ? row : row + i, col: horizontal ? col + i : col, letter: letter as Letter }));

function withRack(state: ScrabbleState, rack: Tile[], seat = state.turn): ScrabbleState {
  return { ...state, racks: state.racks.map((r, s) => (s === seat ? rack : r)) };
}

function boardWith(tiles: PlacedTile[]): (BoardCell | null)[] {
  const board: (BoardCell | null)[] = Array(225).fill(null);
  for (const t of tiles) board[t.row * 15 + t.col] = { letter: t.letter, blank: !!t.blank, by: 0 };
  return board;
}

describe('Wortgitter – Regeln', () => {
  it('erster Zug muss über das Mittelfeld H8 gehen und zählt doppelt', () => {
    const empty = boardWith([]);
    expect(checkPlay(empty, word('HAUS', 0, 0)).ok).toBe(false);
    const ok = checkPlay(empty, word('HAUS', CENTER, CENTER - 1));
    expect(ok.ok).toBe(true);
    // H2 A1 U1 S1 = 5, doppelt = 10
    if (ok.ok) expect(ok.score).toBe(10);
  });

  it('Folgezüge müssen anliegen, lückenlos sein und nur gültige Wörter bilden', () => {
    const board = boardWith(word('HAUS', CENTER, 6));
    expect(checkPlay(board, word('MAUS', 0, 0)).ok).toBe(false);
    // HAUS + E = HAUSE
    expect(checkPlay(board, [{ row: CENTER, col: 10, letter: 'E' }]).ok).toBe(true);
    // R vor HAUS: „RHAUS“ gibt es nicht
    const wrong = checkPlay(board, [{ row: CENTER, col: 5, letter: 'R' }]);
    expect(wrong.ok).toBe(false);
    // Lücke
    expect(checkPlay(board, [{ row: CENTER + 1, col: 6, letter: 'A' }, { row: CENTER + 3, col: 6, letter: 'D' }]).ok).toBe(false);
  });

  it('Prämien gelten nur für neue Steine, Joker zählen 0', () => {
    const board = boardWith(word('HAUS', CENTER, 6));
    const plain = checkPlay(board, [{ row: CENTER, col: 10, letter: 'E' }]);
    const blank = checkPlay(board, [{ row: CENTER, col: 10, letter: 'E', blank: true }]);
    expect(plain.ok && blank.ok).toBe(true);
    if (plain.ok && blank.ok) {
      expect(plain.score).toBe(6); // H2 A1 U1 S1 E1, keine Prämie mehr auf H8
      expect(blank.score).toBe(5);
    }
  });

  it('wer alle sieben Steine legt, bekommt 50 Punkte dazu', () => {
    const check = checkPlay(boardWith([]), word('REISEND', CENTER, 4));
    if (check.ok) {
      expect(check.bingo).toBe(true);
      expect(check.score).toBeGreaterThan(50);
    }
  });

  it('Zuggenerator findet nur gültige Legungen, darunter naheliegende', () => {
    const board = boardWith(word('HAUS', CENTER, 6));
    const plays = generatePlays(board, ['E', 'M', 'R', 'T', 'O', 'N', '?']);
    expect(plays.length).toBeGreaterThan(50);
    for (const tiles of plays) expect(checkPlay(board, tiles).ok).toBe(true);
    expect(plays.some((p) => p.length === 1 && p[0]!.row === CENTER && p[0]!.col === 10 && p[0]!.letter === 'E' && !p[0]!.blank)).toBe(true);
  });

  it('Bänkchen der anderen und der Beutel sind verdeckt', () => {
    const state = gameModule.setup(3, {}, 'verdeckt');
    const view = gameModule.playerView(state, 1);
    expect(view.racks[1]).toEqual(state.racks[1]);
    expect(view.racks[0]!.every((t) => t === null)).toBe(true);
    expect(view.bag.every((t) => t === null)).toBe(true);
    expect(view.rng).toEqual([0, 0, 0, 0]);
  });

  it('Tauschen nur bei mindestens sieben Steinen im Beutel', () => {
    let state = gameModule.setup(2, {}, 'tausch');
    const rack = state.racks[0]!.filter((t): t is Tile => t !== null);
    const swap: ScrabbleMove = { type: 'exchange', tiles: rack.slice(0, 3) };
    expect(isLegalMove(gameModule, state, 0, swap)).toBe(true);
    const after = gameModule.applyMove(state, 0, swap).state;
    expect(after.racks[0]).toHaveLength(7);
    expect(after.bag).toHaveLength(state.bag.length);
    state = { ...state, bag: state.bag.slice(0, 6) };
    expect(isLegalMove(gameModule, state, 0, swap)).toBe(false);
  });

  it('Spielende: Reststeine werden verrechnet', () => {
    let state = gameModule.setup(2, {}, 'ende');
    state = { ...withRack(withRack({ ...state, bag: [] }, ['E'], 0), ['Q', 'A'], 1), board: boardWith(word('HAUS', CENTER, 6)) };
    const done = gameModule.applyMove(state, 0, { type: 'play', tiles: [{ row: CENTER, col: 10, letter: 'E' }] }).state;
    // HAUSE = 6 Punkte, dazu die Reste des Gegners (Q 10 + A 1)
    expect(done.final).toEqual([17, -11]);
    expect(gameModule.result(done)).toEqual({ kind: 'win', winners: [0] });
  });

  it('nach sechs Zügen ohne Punkte ist Schluss', () => {
    let state = gameModule.setup(2, {}, 'passen');
    for (let i = 0; i < 6; i++) state = gameModule.applyMove(state, state.turn, { type: 'pass' }).state;
    expect(gameModule.result(state)).not.toBeNull();
    expect(state.final).not.toBeNull();
  });
});

describe('Wortgitter – Bot', () => {
  it('spielt ganze Partien auf allen Stufen, schwer schlägt leicht', () => {
    const totals = { easy: 0, hard: 0 };
    for (let g = 0; g < 3; g++) {
      let state = gameModule.setup(2, {}, `bot-${g}`);
      const levels = g % 2 === 0 ? (['hard', 'easy'] as const) : (['easy', 'hard'] as const);
      for (let i = 0; i < 200 && !gameModule.result(state); i++) {
        const seat = state.turn;
        const move = computeBotMove(gameModule, { gameId: 'scrabble', botId: 'scrabble', level: levels[seat]!, seat, view: gameModule.playerView(state, seat), seed: `${g}/${i}`, timeBudgetMs: 500 }) as ScrabbleMove;
        expect(isLegalMove(gameModule, state, seat, move)).toBe(true);
        state = gameModule.applyMove(state, seat, move).state;
      }
      expect(gameModule.result(state)).not.toBeNull();
      levels.forEach((level, seat) => (totals[level] += state.final![seat]!));
    }
    expect(totals.hard).toBeGreaterThan(totals.easy);
  }, 60_000);
});
