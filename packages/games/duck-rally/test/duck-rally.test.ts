import { Rng, resolveOptions, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import {
  gameModule,
  generateMathProblem,
  isPrimeNumber,
  rankRacers,
  solveMathProblem,
  type RallyDifficulty,
  type RallyTopic,
} from '../src';

const start = (options: Options = {}, seats = 2, seed = 'test-rally') =>
  gameModule.setup(seats, resolveOptions(gameModule, options), seed);

describe('Enten-Rallye – Regeln & Aufgaben-Generator', () => {
  it('löst alle generierten Aufgabentypen auch ohne gespeichertes answer-Feld exakt', () => {
    const topics: RallyTopic[] = ['basic', 'addSub', 'mulDiv', 'algebra', 'percentPrime', 'mix'];
    const diffs: RallyDifficulty[] = ['easy', 'medium', 'hard'];
    const rng = Rng.fromSeed('solver-check', 'math');

    for (const topic of topics) {
      for (const diff of diffs) {
        for (let i = 0; i < 20; i++) {
          const prob = generateMathProblem(rng, topic, diff, `${topic}-${diff}-${i}`);
          expect(prob.answer).not.toBeNull();
          const masked = { ...prob, answer: null };
          expect(solveMathProblem(masked)).toBe(prob.answer);
          if (prob.kind === 'prime') {
            expect(prob.options).toHaveLength(6);
            const primes = prob.options!.filter((n) => isPrimeNumber(n));
            expect(primes).toEqual([prob.answer]);
          }
        }
      }
    }
  });

  it('teilt allen Plätzen denselben Aufgabenpool in 3er-Blöcken zu und verbirgt Geheimes in playerView', () => {
    const s = start({ target: '15', topic: 'mix' }, 4, 'klassen-seed');
    expect(s.baseProblems).toHaveLength(15);

    for (let seat = 0; seat < 4; seat++) {
      const sortedIndices = [...s.racers[seat]!.order].sort((a, b) => a - b);
      expect(sortedIndices).toEqual(Array.from({ length: 15 }, (_, i) => i));
    }

    const view = gameModule.playerView(s, 0);
    expect(view.baseProblems).toEqual([]);
    expect(view.seedKey).toBe('');
    expect(view.racers[0]!.currentProblem?.answer).toBeNull();
  });

  it('wertet richtige Antworten als Schwimm-Schub und ersetzt die Aufgabe nach einem Fehler', () => {
    let s = start({ target: '10', topic: 'basic' }, 2, 'race-1');
    const firstProblem = s.racers[0]!.currentProblem!;
    const exact = solveMathProblem(firstProblem);

    // Fehlversuch von Platz 0: Zähler bleibt bei 0, Fehler steigt auf 1, Ersatz-Aufgabe erscheint
    const wrongVal = exact + 5;
    const afterWrong = gameModule.applyMove(s, 0, { type: 'answer', value: wrongVal });
    s = afterWrong.state;
    expect(afterWrong.events[0]?.type).toBe('mistake');
    expect(s.racers[0]!.solvedCount).toBe(0);
    expect(s.racers[0]!.mistakes).toBe(1);
    expect(s.racers[0]!.currentProblem?.id).not.toBe(firstProblem.id);

    // Jetzt löst Platz 0 alle 10 Aufgaben richtig und gewinnt das Rennen
    for (let step = 0; step < 10; step++) {
      const prob = s.racers[0]!.currentProblem!;
      const ans = solveMathProblem(prob);
      const res = gameModule.applyMove(s, 0, { type: 'answer', value: ans });
      s = res.state;
    }

    expect(s.racers[0]!.solvedCount).toBe(10);
    expect(s.racers[0]!.bestStreak).toBe(10);
    expect(gameModule.result(s)).toEqual({ kind: 'win', winners: [0] });
    expect(rankRacers(s)[0]?.seat).toBe(0);
  });
});

describe('Enten-Rallye – Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [1, 4], randomGames: 16 })) {
    test(check.name, check.run, 60_000);
  }
});
