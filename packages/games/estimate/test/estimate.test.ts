import { LocalSession, Rng, inlineBotRunner } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule, scoreEstimate } from '../src';

describe('estimate: allgemeine Prüfungen', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 8 })) test(check.name, check.run, 120_000);
});

describe('estimate: Regeln', () => {
  it('wertet Nähe und genaue Treffer', () => {
    expect(scoreEstimate(100, [100, 95, 80, 10, null])).toEqual([15, 5, 2, 0, 0]);
    expect(scoreEstimate(100, [90, 110, 50])).toEqual([10, 10, 0]);
  });

  it('verbirgt Lösung und fremde Antworten bis zur Auflösung', () => {
    let s = gameModule.setup(3, {}, 's');
    expect(gameModule.playerView(s, 0).questions[0]!.answer).toBeNull();
    expect(gameModule.playerView(s, 0).questions[1]).toBeNull();
    const a = s.questions[0]!.min;
    s = gameModule.applyMove(s, 1, { type: 'answer', answer: a }).state;
    expect(gameModule.playerView(s, 0).answers[1]).toBeNull();
    expect(gameModule.playerView(s, 1).answers[1]).toBe(a);
    expect(gameModule.currentPlayers(s)).toEqual([0, 2, 'system']);
  });

  it('löst auf, sobald alle abgegeben haben, und geht zur nächsten Frage', () => {
    let s = gameModule.setup(2, { count: '5' }, 's');
    const q = s.questions[0]!;
    s = gameModule.applyMove(s, 0, { type: 'answer', answer: q.answer! }).state;
    s = gameModule.applyMove(s, 1, { type: 'answer', answer: q.min }).state;
    expect(s.phase).toBe('reveal');
    expect(s.scores[0]).toBeGreaterThanOrEqual(15);
    expect(gameModule.playerView(s, 1).questions[0]!.answer).toBe(q.answer);
    s = gameModule.applyMove(s, 'system', { type: 'next' }).state;
    expect(s.round).toBe(1);
    expect(s.phase).toBe('answer');
  });

  it('der Zeitablauf löst auch ohne alle Antworten auf', () => {
    let s = gameModule.setup(3, {}, 's');
    expect(gameModule.systemDelayMs!(s)).toBe(30_000);
    s = gameModule.applyMove(s, 'system', { type: 'close' }).state;
    expect(s.phase).toBe('reveal');
    expect(s.scores).toEqual([0, 0, 0]);
  });

  it('Spielleitung: Sind alle früher fertig, läuft die Auflösung mit ihrer eigenen Dauer', () => {
    let now = 0;
    const session = new LocalSession(
      gameModule,
      { gameId: 'estimate', seed: 'takt', options: {}, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }], time: { kind: 'none' } },
      { botRunner: inlineBotRunner([gameModule]), now: () => now },
    );
    expect(session.nextDeadline()).toBe(30_000);
    now = 2000;
    const answer = session.state.questions[0]!.min;
    session.submit(0, { type: 'answer', answer });
    // Eine einzelne Antwort verschiebt die Zeit nicht.
    expect(session.nextDeadline()).toBe(30_000);
    session.submit(1, { type: 'answer', answer });
    expect(session.state.phase).toBe('reveal');
    expect(session.nextDeadline()).toBe(2000 + 9000);
    now = 11_000;
    session.tick();
    expect(session.state.round).toBe(1);
    expect(session.nextDeadline()).toBe(11_000 + 30_000);
    session.dispose?.();
  });

  it('auf Wunsch tippt Platz 1 „Weiter“', () => {
    let s = gameModule.setup(1, { advance: 'lead', seconds: 'none' }, 's');
    expect(gameModule.currentPlayers(s)).toEqual([0]);
    s = gameModule.applyMove(s, 0, { type: 'answer', answer: s.questions[0]!.min }).state;
    expect(gameModule.currentPlayers(s)).toEqual([0]);
    expect(gameModule.legalMoves(s, 'system')).toEqual([]);
    s = gameModule.applyMove(s, 0, { type: 'next' }).state;
    expect(s.round).toBe(1);
  });

  it('lehnt Antworten außerhalb des Bereichs ab und endet mit Siegern', () => {
    let s = gameModule.setup(2, { count: '5' }, 's');
    const q = s.questions[0]!;
    expect(gameModule.isLegal!(s, 0, { type: 'answer', answer: q.max + 1 })).toBe(false);
    expect(gameModule.isLegal!(s, 0, { type: 'answer', answer: 1.5 })).toBe(false);
    for (let i = 0; i < 5; i++) {
      s = gameModule.applyMove(s, 'system', { type: 'close' }).state;
      s = gameModule.applyMove(s, 'system', { type: 'next' }).state;
    }
    expect(gameModule.result(s)).toEqual({ kind: 'win', winners: [0, 1] });
  });

  it('der Bot trifft auf schwer näher als auf leicht', () => {
    const bot = gameModule.bots[0]!;
    const s = gameModule.setup(1, { pack: 'mathe' }, 's');
    const q = s.questions[0]!;
    const off = (level: 'easy' | 'hard') => {
      let sum = 0;
      for (let i = 0; i < 200; i++) {
        const move = bot.chooseMove({ module: gameModule, view: gameModule.playerView(s, 0), seat: 0, level, rng: Rng.fromSeed(`b${i}`), timeBudgetMs: 10, now: () => 0 });
        if (move.type === 'answer') sum += Math.abs(move.answer - q.answer!);
      }
      return sum;
    };
    expect(off('hard')).toBeLessThan(off('easy'));
  });
});
