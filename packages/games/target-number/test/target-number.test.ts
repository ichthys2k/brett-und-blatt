import { resolveOptions, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { findCandidateMoves, gameModule, scoreSubmission, simulateSteps } from '../src';

const start = (options: Options = {}, seats = 2, seed = 'test') =>
  gameModule.setup(seats, resolveOptions(gameModule, options), seed);

describe('Zielzahl – Regeln', () => {
  it('simuliert Rechenschritte und setzt mathematisch korrekte Klammern', () => {
    // Karten: [8, 2, 4, 1] -> (8 - 2) * 4 = 24
    const res1 = simulateSteps(
      [8, 2, 4, 1],
      [
        { a: 0, op: '-', b: 1 }, // [4, 1, 6 (8-2)]
        { a: 2, op: '*', b: 0 }, // [1, 24 ((8-2)*4)]
        { a: 1, op: '*', b: 0 }, // [24 (((8-2)*4)*1)]
      ],
      'all',
    );
    expect(res1).not.toBeNull();
    expect(res1![0]!.value).toBe(24);
    expect(res1![0]!.expr).toBe('(8 − 2) · 4 · 1');
  });

  it('lehnt nicht aufgehende Divisionen und negative Zwischenergebnisse ab', () => {
    expect(simulateSteps([3, 7], [{ a: 0, op: '-', b: 1 }], 'all')).toBeNull();
    expect(simulateSteps([7, 3], [{ a: 0, op: '/', b: 1 }], 'all')).toBeNull();
    expect(simulateSteps([6, 3], [{ a: 0, op: '/', b: 1 }], 'addSubMul')).toBeNull();
  });

  it('findet für Klassik-24-Runden stets eine exakte Lösung mit 12 Punkten', () => {
    for (let i = 0; i < 10; i++) {
      const s = start({ mode: 'classic24' }, 1, `seed-${i}`);
      expect(s.target).toBe(24);
      expect(s.cards).toHaveLength(4);
      const candidates = findCandidateMoves(s.cards, s.target, s.allowedOps, 3);
      expect(candidates[0]!.value).toBe(24);
      expect(candidates[0]!.points).toBe(12);
    }
  });

  it('wertet die Runde erst aus, wenn alle Plätze eingeloggt haben, und verbirgt fremde Terme vorher', () => {
    const s = start({ rounds: '3' }, 2, 'duell');
    const move0 = gameModule.legalMoves(s, 0)[0]!;
    const after0 = gameModule.applyMove(s, 0, move0).state;
    expect(after0.round).toBe(1);
    expect(gameModule.currentPlayers(after0)).toEqual([1]);

    // Spieler 1 sieht noch nicht den Term von Spieler 0
    const view1 = gameModule.playerView(after0, 1);
    expect(view1.submissions[0]?.submitted).toBe(true);
    expect(view1.submissions[0]?.expr).toBeNull();

    // Sobald Spieler 1 abgibt, wechselt die Runde und lastRound wird öffentlich
    const move1 = gameModule.legalMoves(after0, 1)[0]!;
    const after1 = gameModule.applyMove(after0, 1, move1).state;
    expect(after1.round).toBe(2);
    expect(after1.lastRound).not.toBeNull();
    expect(after1.lastRound?.submissions).toHaveLength(2);
  });

  it('vergibt gestaffelte Punkte je nach Abstand zur Zielzahl', () => {
    expect(scoreSubmission(24, 24, true)).toBe(12);
    expect(scoreSubmission(24, 24, false)).toBe(10);
    expect(scoreSubmission(23, 24, false)).toBe(7);
    expect(scoreSubmission(20, 24, false)).toBe(5);
    expect(scoreSubmission(16, 24, false)).toBe(3);
    expect(scoreSubmission(2, 24, false)).toBe(1);
  });
});

describe('Zielzahl – Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [1, 4], randomGames: 16 })) {
    test(check.name, check.run, 60_000);
  }
});
