import type { BotDefinition, BotLevel } from '@brett-und-blatt/engine';
import type { WordSaladMove, WordSaladState } from './rules';
import { getValidSubwords } from './words';

const DELAY_RANGE_MS: Record<BotLevel, [number, number]> = {
  easy: [3_800, 2_200],
  medium: [2_800, 1_600],
  hard: [1_800, 1_100],
};

const TARGET_WORDS_PER_ROUND: Record<BotLevel, number> = {
  easy: 5,
  medium: 9,
  hard: 14,
};

export const wordSaladBot: BotDefinition<WordSaladState, WordSaladMove> = {
  id: 'wortakrobat',
  name: 'Wortakrobat',
  levels: ['easy', 'medium', 'hard'],
  delayMs({ level, rng }) {
    const [base, jitter] = DELAY_RANGE_MS[level];
    return base + rng.int(jitter);
  },
  chooseMove({ view, seat, level, rng }) {
    const player = view.players[seat];
    if (!player || player.done) {
      return { type: 'finishRound' };
    }

    const limit = TARGET_WORDS_PER_ROUND[level];
    if (player.foundCount >= limit) {
      return { type: 'finishRound' };
    }

    const valid = getValidSubwords(view.currentStem, view.minLength);
    const foundSet = new Set(player.foundWords);
    const unfound = valid.filter((w) => !foundSet.has(w));

    if (unfound.length === 0) {
      return { type: 'finishRound' };
    }

    // Leicht bevorzugt kurze Wörter (3-4 Buchstaben), Schwer auch lange Wörter
    if (level === 'easy') {
      const shortPool = unfound.filter((w) => w.length <= 4);
      const pool = shortPool.length > 0 ? shortPool : unfound;
      return { type: 'submit', word: rng.pick(pool) };
    }

    if (level === 'medium') {
      const midPool = unfound.filter((w) => w.length <= 6);
      const pool = midPool.length > 0 ? midPool : unfound;
      return { type: 'submit', word: rng.pick(pool) };
    }

    // Schwer: bevorzugt die längeren (punkteträchtigen) Wörter im oberen Drittel
    const topThirdCount = Math.max(1, Math.ceil(unfound.length * 0.4));
    const topPool = unfound.slice(0, topThirdCount);
    return { type: 'submit', word: rng.pick(topPool) };
  },
};

export const bots = [wordSaladBot] as const;
