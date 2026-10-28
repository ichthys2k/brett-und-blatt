import type { BotDefinition } from '@brett-und-blatt/engine';
import { solutionOf, type BibleQuizMove, type BibleQuizState } from './rules';

export const quizBot: BotDefinition<BibleQuizState, BibleQuizMove> = {
  id: 'bibelkenner',
  name: 'Bibelkenner',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    if (ctx.view.phase === 'reveal') {
      return { type: 'next' };
    }

    // Die Sicht verbirgt die Lösung bis zur Auflösung – der Bibelkenner kennt den Katalog.
    const correctIdx = solutionOf(ctx.view.currentQuestion).correctOptionIndex;
    const threshold = ctx.level === 'hard' ? 0.95 : ctx.level === 'medium' ? 0.75 : 0.5;

    if (ctx.rng.chance(threshold)) {
      return { type: 'answer', optionIndex: correctIdx };
    }

    const wrongIndices = [0, 1, 2, 3].filter((i) => i !== correctIdx);
    const chosenWrong = ctx.rng.pick(wrongIndices);
    return { type: 'answer', optionIndex: chosenWrong };
  },
  delayMs(ctx) {
    if (ctx.view.phase === 'reveal') {
      return 1500;
    }
    return 600 + ctx.rng.int(600);
  },
};
