import { describe, expect, it } from 'vitest';
import * as engine from '../src/legacy/engine';
import { chooseBotMove } from '../src/legacy/bot';
import { evaluate, searchMove, SEARCH_WIDTH } from '../src/search';

const lcg = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('Vorausschau des Vierer-Schach-Bots', () => {
  it('liefert nur erlaubte Züge und rechnet schnell', () => {
    const s = engine.newGame('ffa');
    const r = lcg(3);
    for (let i = 0; i < 30; i++) engine.applyAction(s, chooseBotMove(s, s.turn, r)!);
    const t = performance.now();
    const m = searchMove(s, SEARCH_WIDTH.hard, r, 0.1)!;
    expect(performance.now() - t).toBeLessThan(1500);
    expect(engine.legalMoves(s, s.turn).some((x) => x.from === m.from && x.to === m.to)).toBe(true);
  });

  it('bewertet eine verlorene Dame schlechter', () => {
    const s = engine.newGame('ffa');
    const q = s.board.findIndex((p) => p?.c === 'r' && p.t === 'Q');
    const without = { ...s, board: s.board.map((p, i) => (i === q ? null : p)) };
    expect(evaluate(without, 'r')).toBeLessThan(evaluate(s, 'r') - 5);
  });

  it('gewinnt im Teammodus gegen den Faustregel-Bot', () => {
    const r = lcg(11);
    const s = engine.newGame('teams');
    for (let i = 0; i < 1200 && !s.result; i++) {
      if (engine.TEAM_OF[s.turn] === 0) {
        const m = searchMove(s, SEARCH_WIDTH.hard, r, 0.1)!;
        engine.applyAction(s, { t: 'm', p: s.turn, f: m.from, to: m.to });
      } else engine.applyAction(s, chooseBotMove(s, s.turn, () => r() * 0.3)!);
    }
    expect(s.result?.winners).toEqual(expect.arrayContaining(['r', 'y']));
  }, 30_000);
});
