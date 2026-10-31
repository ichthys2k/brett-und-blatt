import type { BotDefinition, BotLevel } from '@brett-und-blatt/engine';
import { COUNTDOWN_MS, solveMathProblem, type DuckRallyMove, type DuckRallyState } from './rules';

/** Bedenkzeit pro Aufgabe in Millisekunden: [Basis, Zufallsspanne]. */
const THINK_MS: Record<BotLevel, [number, number]> = {
  easy: [4_400, 2_800],
  medium: [2_600, 1_900],
  hard: [1_400, 1_100],
};

/** Wahrscheinlichkeit eines Tipp-/Rechenfehlers beim ersten Versuch einer Stufe. */
const MISTAKE_CHANCE: Record<BotLevel, number> = {
  easy: 0.15,
  medium: 0.05,
  hard: 0,
};

export const duckRallyBot: BotDefinition<DuckRallyState, DuckRallyMove> = {
  id: 'renn-ente',
  name: 'Renn-Ente',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, level, rng }) {
    const racer = view.racers[seat];
    const problem = racer?.currentProblem;
    if (!racer || !problem) {
      return { type: 'answer', value: 0 };
    }

    const exact = solveMathProblem(problem);

    // Auf leicht und mittel passiert gelegentlich ein Rechenfehler (höchstens einmal je Stufe)
    if (racer.stepMistakes === 0 && rng.chance(MISTAKE_CHANCE[level])) {
      if (problem.kind === 'prime' && problem.options) {
        const wrongOptions = problem.options.filter((opt) => opt !== exact);
        if (wrongOptions.length > 0) {
          return { type: 'answer', value: rng.pick(wrongOptions) };
        }
      } else {
        const offset = rng.pick([-2, -1, 1, 2, 10] as const);
        return { type: 'answer', value: Math.max(0, exact + offset) };
      }
    }

    return { type: 'answer', value: exact };
  },
  delayMs({ view, seat, level, rng }) {
    const racer = view.racers[seat];
    const problem = racer?.currentProblem;
    const [base, spread] = THINK_MS[level];
    // Gleichungen und Prozentaufgaben dauern auch für Menschen einen kleinen Moment länger
    const extra = problem?.kind === 'algebra' || problem?.kind === 'percent' ? 600 : 0;
    // Zu Beginn zählt die Oberfläche „3, 2, 1, los!“ herunter – so lange wartet auch der Bot.
    const fresh = view.ticks === 0 && view.racers.every((r) => r.solvedCount === 0 && r.mistakes === 0);
    return base + Math.floor(rng.next() * spread) + extra + (fresh ? COUNTDOWN_MS : 0);
  },
};
