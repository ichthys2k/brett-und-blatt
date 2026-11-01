import { Rng } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { buildQuestion, gameModule, scoreTimeline, splitItem } from '../src';

describe('timeline: allgemeine Prüfungen', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 8 })) test(check.name, check.run, 120_000);
});

describe('timeline: Regeln', () => {
  it('trennt die Jahreszahl vom Namen, damit die Anzeige nichts verrät', () => {
    expect(splitItem('Telefon (1876)')).toEqual({ name: 'Telefon', year: '1876' });
    expect(splitItem('Pfingsten')).toEqual({ name: 'Pfingsten', year: '' });
    const q = buildQuestion({ id: 'x', title: 'T', items: ['A (1)', 'B (2)', 'C (3)'] }, Rng.fromSeed('s'));
    expect(q.items.join('')).not.toMatch(/\d/);
    expect(q.order!.map((i) => q.items[i])).toEqual(['A', 'B', 'C']);
    expect(q.order!.map((i) => q.years![i])).toEqual(['1', '2', '3']);
  });

  it('zeigt nie die fertige Reihenfolge', () => {
    for (let i = 0; i < 50; i++) {
      const q = buildQuestion({ id: 'x', title: 'T', items: ['A', 'B', 'C'] }, Rng.fromSeed(`s${i}`));
      expect(q.items).not.toEqual(['A', 'B', 'C']);
    }
  });

  it('wertet Plätze und die ganz richtige Reihenfolge', () => {
    expect(scoreTimeline([2, 0, 1], [[2, 0, 1], [2, 1, 0], [0, 1, 2], null])).toEqual([10, 2, 0, 0]);
  });

  it('verbirgt die Lösung und prüft die Antwort', () => {
    const s = gameModule.setup(2, {}, 's');
    const v = gameModule.playerView(s, 0).questions[0]!;
    expect(v.order).toBeNull();
    expect(v.years).toBeNull();
    const n = v.items.length;
    expect(gameModule.isLegal!(s, 0, { type: 'answer', answer: new Array(n).fill(0) })).toBe(false);
    expect(gameModule.isLegal!(s, 0, { type: 'answer', answer: v.items.map((_, i) => i) })).toBe(true);
  });

  it('der schwere Bot kennt die Reihenfolge', () => {
    const s = gameModule.setup(1, {}, 's');
    const q = s.questions[0]!;
    const move = gameModule.bots[0]!.chooseMove({ module: gameModule, view: gameModule.playerView(s, 0), seat: 0, level: 'hard', rng: Rng.fromSeed('b'), timeBudgetMs: 10, now: () => 0 });
    expect(move).toEqual({ type: 'answer', answer: q.order });
  });
});
