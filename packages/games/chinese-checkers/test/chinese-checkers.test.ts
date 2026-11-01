import { computeBotMove, type BotLevel } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import {
  CELLS,
  TIPS,
  armCells,
  armOfCell,
  cellIndex,
  destinations,
  gameModule,
  hasFinished,
  targetCells,
  type ChineseCheckersMove,
  type ChineseCheckersState,
} from '../src';

const at = (q: number, r: number) => cellIndex(q, r)!;

function emptyBoard(seats = 2): ChineseCheckersState {
  const state = gameModule.setup(seats, {}, 'test');
  return { ...state, board: state.board.map(() => null) };
}

/** Spielt eine Partie zwischen Bots; gibt Sieger und Zugzahl zurück. */
export function botGame(levels: BotLevel[], seed: string, botIds?: string[], options = {}) {
  let state = gameModule.setup(levels.length, options, seed);
  let step = 0;
  for (; !gameModule.result(state); step++) {
    const seat = state.turn;
    const move = computeBotMove(gameModule, {
      gameId: 'chinese-checkers',
      botId: botIds?.[seat] ?? 'chinese-checkers',
      level: levels[seat]!,
      seat,
      view: state,
      seed: `${seed}/${step}`,
      timeBudgetMs: 50,
    }) as ChineseCheckersMove;
    state = gameModule.applyMove(state, seat, move).state;
  }
  return { result: gameModule.result(state), moves: step, state };
}

describe('Brett', () => {
  it('hat 121 Löcher und sechs Zacken mit je 10 Löchern', () => {
    expect(CELLS).toHaveLength(121);
    for (let arm = 0; arm < 6; arm++) {
      expect(armCells(arm, 10)).toHaveLength(10);
      expect(armCells(arm, 6)).toHaveLength(6);
      expect(armOfCell(TIPS[arm]!)).toBe(arm);
    }
    expect(CELLS.filter((_, i) => armOfCell(i) === null)).toHaveLength(61);
  });

  it('stellt die Steine in ihre Zacken; Ziel ist die gegenüberliegende', () => {
    for (const seats of [2, 3, 4, 5, 6]) {
      const state = gameModule.setup(seats, {}, 'x');
      for (let seat = 0; seat < seats; seat++) {
        expect(state.board.filter((s) => s === seat)).toHaveLength(10);
        expect(targetCells(state, seat).every((c) => armOfCell(c) === (state.homes[seat]! + 3) % 6)).toBe(true);
      }
    }
    expect(gameModule.setup(3, { pieces: '6' }, 'x').board.filter((s) => s === 0)).toHaveLength(6);
  });
});

describe('Züge', () => {
  it('Schritt auf freie Nachbarn, Sprungketten über beliebige Steine', () => {
    const state = emptyBoard();
    const board = [...state.board];
    board[at(0, 0)] = 0;
    board[at(1, 0)] = 1; // rechts daneben, Sprung nach (2,0)
    board[at(3, 0)] = 0; // dann weiter nach (4,0)
    const dests = destinations({ ...state, board }, 0, at(0, 0));
    expect(dests.get(at(0, 1))).toEqual([at(0, 0), at(0, 1)]);
    expect(dests.get(at(2, 0))).toEqual([at(0, 0), at(2, 0)]);
    expect(dests.get(at(4, 0))).toEqual([at(0, 0), at(2, 0), at(4, 0)]);
    expect(dests.has(at(1, 0))).toBe(false);
    // Nicht über zwei Steine oder eine Lücke hinweg.
    expect(dests.has(at(3, 0))).toBe(false);
  });

  it('ein Stein im Ziel verlässt es nicht mehr', () => {
    const state = emptyBoard();
    const target = targetCells(state, 0);
    const inside = target.find((c) => c !== TIPS[0])!;
    const board = [...state.board];
    board[inside] = 0;
    const dests = destinations({ ...state, board }, 0, inside);
    expect([...dests.keys()].every((c) => target.includes(c))).toBe(true);
  });

  it('wer nichts ziehen kann, passt', () => {
    const state = emptyBoard();
    const board = [...state.board];
    // Platz 0 hat einen Stein auf der Spitze unten, umgeben von Steinen, Sprünge blockiert.
    const tip = TIPS[3]!;
    board[tip] = 0;
    for (const c of [at(-4, 7), at(-3, 7), at(-4, 6), at(-3, 6), at(-2, 6)]) board[c] = 1;
    expect(gameModule.legalMoves({ ...state, board }, 0)).toEqual([{ type: 'pass' }]);
  });

  it('gewinnt mit vollem Ziel, auch wenn dort fremde Steine stehen', () => {
    const state = emptyBoard();
    const board = [...state.board];
    const [first, ...rest] = targetCells(state, 0);
    for (const c of rest) board[c] = 1;
    expect(hasFinished({ ...state, board }, 0)).toBe(false);
    board[first!] = 0;
    expect(hasFinished({ ...state, board }, 0)).toBe(true);
    for (const c of targetCells(state, 0)) board[c] = 1;
    expect(hasFinished({ ...state, board }, 0)).toBe(false);
  });

  it('Aufgeben lässt nur diesen Platz ausscheiden', () => {
    const state = gameModule.setup(3, {}, 'x');
    const after = gameModule.applyMove(state, 0, { type: 'resign', seat: 0 }).state;
    expect(after.out).toEqual([true, false, false]);
    expect(after.turn).toBe(1);
    expect(gameModule.result(after)).toBeNull();
    const end = gameModule.applyMove(after, 2, { type: 'resign', seat: 2 }).state;
    expect(gameModule.result(end)).toEqual({ kind: 'win', winners: [1], reason: undefined });
  });
});

describe('Bot', () => {
  it('der schwere Bot gewinnt zu zweit gegen Zufall und gegen „mittel“', () => {
    let vsRandom = 0;
    let vsMedium = 0;
    for (let g = 0; g < 6; g++) {
      const first = g % 2 === 0;
      const a = botGame(first ? ['hard', 'easy'] : ['easy', 'hard'], `zufall${g}`, first ? ['chinese-checkers', 'random'] : ['random', 'chinese-checkers']);
      if (a.result?.kind === 'win' && a.result.winners.includes(first ? 0 : 1)) vsRandom++;
      const b = botGame(first ? ['hard', 'medium'] : ['medium', 'hard'], `mittel${g}`);
      if (b.result?.kind === 'win' && b.result.winners.includes(first ? 0 : 1)) vsMedium++;
    }
    expect(vsRandom).toBe(6);
    expect(vsMedium).toBeGreaterThanOrEqual(4);
  });

  it('Bots spielen zu sechst eine Partie zu Ende', () => {
    const { result } = botGame(['hard', 'medium', 'easy', 'hard', 'medium', 'easy'], 'sechs');
    expect(result?.kind).toBe('win');
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [2, 3, 6], randomGames: 8, maxMoves: 1_000, botMoveLimit: 80 })) test(check.name, check.run);
});
