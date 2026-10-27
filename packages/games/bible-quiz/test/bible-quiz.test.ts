import { resolveOptions, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { QUESTIONS, gameModule, quizBot } from '../src';

const start = (options: Options = {}, seats = 2, seed = 'test-seed') =>
  gameModule.setup(seats, resolveOptions(gameModule, options), seed);

describe('Bibel-Quiz – Regeln', () => {
  it('enthält alle 168 kuratierten Fragen mit gültigen Optionen und Emojis', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(160);
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(4);
      expect(q.emojis.length).toBeGreaterThan(0);
      expect(q.info.length).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(q.difficulty);
    }
  });

  it('erzeugt ein Quiz mit deterministisch gemischten Antwortoptionen', () => {
    const s1 = start({ rounds: '5' }, 1, 'seed-a');
    const s2 = start({ rounds: '5' }, 1, 'seed-a');
    expect(s1.currentQuestion.questionId).toBe(s2.currentQuestion.questionId);
    expect(s1.currentQuestion.shuffledOptions).toEqual(s2.currentQuestion.shuffledOptions);
    expect(s1.currentQuestion.correctOptionIndex).toBe(s2.currentQuestion.correctOptionIndex);
  });

  it('vergibt 10, 20 bzw. 30 Punkte je nach Schwierigkeitsgrad und Serie-Bonus', () => {
    const s = start({ rounds: '5' }, 1, 'points-test');
    const correctIdx = s.currentQuestion.correctOptionIndex;
    const res = gameModule.applyMove(s, 0, { type: 'answer', optionIndex: correctIdx });

    const expectedBase =
      s.currentQuestion.difficulty === 3 ? 30 : s.currentQuestion.difficulty === 2 ? 20 : 10;
    expect(res.state.answers[0]?.correct).toBe(true);
    expect(res.state.answers[0]?.pointsEarned).toBe(expectedBase);
    expect(res.state.scores[0]).toBe(expectedBase);
    expect(res.state.streaks[0]).toBe(1);
  });

  it('wartet im Mehrspieler auf alle Antworten und verbirgt fremde Antworten vorher', () => {
    const s = start({ rounds: '5' }, 2, 'multi-test');
    expect(gameModule.currentPlayers(s)).toEqual([0, 1]);

    // Spieler 0 antwortet
    const move0 = gameModule.legalMoves(s, 0)[0]!;
    const after0 = gameModule.applyMove(s, 0, move0).state;
    expect(after0.phase).toBe('question');
    expect(gameModule.currentPlayers(after0)).toEqual([1]);

    // Spieler 1 darf in seiner Sicht nicht sehen, was Spieler 0 gewählt hat
    const view1 = gameModule.playerView(after0, 1);
    expect(view1.answers[0]?.submitted).toBe(true);
    expect(view1.answers[0]?.chosenIndex).toBeNull();
    expect(view1.answers[0]?.correct).toBeNull();

    // Spieler 1 antwortet -> jetzt erst Phase 'reveal'
    const move1 = gameModule.legalMoves(after0, 1)[0]!;
    const after1 = gameModule.applyMove(after0, 1, move1).state;
    expect(after1.phase).toBe('reveal');
    expect(gameModule.currentPlayers(after1)).toEqual([0]);

    // Nach dem Reveal sind beide Antworten vollständig sichtbar
    const viewReveal = gameModule.playerView(after1, 1);
    expect(viewReveal.answers[0]?.chosenIndex).not.toBeNull();
    expect(viewReveal.answers[1]?.chosenIndex).not.toBeNull();
  });

  it('schaltet nach der Auflösung zur nächsten Frage weiter', () => {
    const s = start({ rounds: '3' }, 1, 'progression');
    const correct0 = s.currentQuestion.correctOptionIndex;
    const afterAns = gameModule.applyMove(s, 0, { type: 'answer', optionIndex: correct0 }).state;
    expect(afterAns.phase).toBe('reveal');

    // Nächste Frage
    const afterNext = gameModule.applyMove(afterAns, 0, { type: 'next' }).state;
    expect(afterNext.phase).toBe('question');
    expect(afterNext.currentRound).toBe(2);
    expect(afterNext.answers[0]).toBeNull();
  });

  it('beendet das Quiz nach der letzten Runde mit korrektem Gewinner', () => {
    let s = start({ rounds: '5' }, 1, 'finish-game');
    for (let r = 1; r <= 5; r++) {
      expect(s.currentRound).toBe(r);
      const move = gameModule.legalMoves(s, 0)[0]!;
      s = gameModule.applyMove(s, 0, move).state;
      const nextMove = gameModule.legalMoves(s, 0)[0]!;
      s = gameModule.applyMove(s, 0, nextMove).state;
    }
    expect(s.phase).toBe('done');
    const res = gameModule.result(s);
    expect(res).not.toBeNull();
    expect(res?.kind).toBe('win');
    if (res?.kind === 'win') {
      expect(res.winners).toEqual([0]);
    }
  });

  it('filtert nach Kategorien (z. B. nur Gleichnisse oder nur Altes Testament)', () => {
    const sParables = start({ category: 'parables', rounds: '10' }, 1, 'parables-seed');
    expect(sParables.currentQuestion.category).toBe('Gleichnisse');

    const sAT = start({ category: 'at', rounds: '10' }, 1, 'at-seed');
    expect(sAT.currentQuestion.category).toBe('Altes Testament');
  });

  it('lässt den Bot Bibelkenner sinnvolle Züge in allen Phasen wählen', () => {
    const s = start({ rounds: '3' }, 2, 'bot-test');
    const botMoveQ = quizBot.chooseMove({
      module: gameModule,
      view: gameModule.playerView(s, 1),
      seat: 1,
      level: 'hard',
      rng: { chance: () => true, pick: <T>(arr: readonly T[]) => arr[0]!, int: () => 0 } as any,
      timeBudgetMs: 1000,
      now: () => Date.now(),
    });
    expect(botMoveQ.type).toBe('answer');

    // Bot im Reveal
    const afterBoth = gameModule.applyMove(
      gameModule.applyMove(s, 0, { type: 'answer', optionIndex: 0 }).state,
      1,
      botMoveQ,
    ).state;
    expect(afterBoth.phase).toBe('reveal');

    const botMoveR = quizBot.chooseMove({
      module: gameModule,
      view: gameModule.playerView(afterBoth, 0),
      seat: 0,
      level: 'medium',
      rng: { chance: () => false, pick: <T>(arr: readonly T[]) => arr[0]!, int: () => 0 } as any,
      timeBudgetMs: 1000,
      now: () => Date.now(),
    });
    expect(botMoveR).toEqual({ type: 'next' });
  });
});

describe('Bibel-Quiz – Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [1, 2, 4], randomGames: 16 })) {
    test(check.name, check.run, 60_000);
  }
});
