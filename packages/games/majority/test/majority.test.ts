import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule, scoreMajority } from '../src';

describe('majority: allgemeine Prüfungen', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 8 })) test(check.name, check.run, 120_000);
});

describe('majority: Regeln', () => {
  it('gibt Punkte nach dem Anteil gleicher Antworten', () => {
    expect(scoreMajority([0, 0, 0, 0])).toEqual([10, 10, 10, 10]);
    expect(scoreMajority([0, 0, 0, 1])).toEqual([8, 8, 8, 3]);
    expect(scoreMajority([0, 1, null])).toEqual([5, 5, 0]);
  });

  it('nimmt nur vorhandene Antworten an und verbirgt fremde', () => {
    let s = gameModule.setup(3, {}, 's');
    expect(gameModule.isLegal!(s, 0, { type: 'answer', answer: 99 })).toBe(false);
    s = gameModule.applyMove(s, 0, { type: 'answer', answer: 1 }).state;
    expect(gameModule.playerView(s, 1).answers[0]).toBeNull();
    expect(gameModule.isLegal!(s, 0, { type: 'answer', answer: 0 })).toBe(false);
  });

  it('alle Fragen haben zwei bis sechs verschiedene Antworten', () => {
    const s = gameModule.setup(3, { count: '15' }, 'x');
    for (const q of s.questions) {
      expect(q!.options.length).toBeGreaterThanOrEqual(2);
      expect(q!.options.length).toBeLessThanOrEqual(6);
      expect(new Set(q!.options).size).toBe(q!.options.length);
    }
  });
});
