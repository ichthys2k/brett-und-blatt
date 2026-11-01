import { initialLetter, type BotDefinition, type BotLevel } from '@brett-und-blatt/engine';
import { currentLetter, wordsFor, type SprintMove, type SprintState } from './rules';

/** Wie viele Felder der Bot je Runde füllt (Anteil) und wie lange er je Wort braucht. */
const SKILL: Record<BotLevel, { share: number; delay: [number, number] }> = {
  easy: { share: 0.5, delay: [9_000, 6_000] },
  medium: { share: 0.75, delay: [6_500, 4_000] },
  hard: { share: 1, delay: [4_000, 3_000] },
};

/**
 * „Wortflitzer“: schreibt Wörter aus den Listen, nimmt sich je Stufe nur einen Teil der
 * Felder vor und stimmt großzügig ab (Antworten mit dem richtigen Buchstaben gelten).
 */
export const sprintBot: BotDefinition<SprintState, SprintMove> = {
  id: 'wortflitzer',
  name: 'Wortflitzer',
  levels: ['easy', 'medium', 'hard'],
  delayMs({ view, level, move, rng }) {
    if (view.phase !== 'write' || move.type !== 'answer') return 1_200 + rng.int(1_500);
    const [base, jitter] = SKILL[level].delay;
    return base + rng.int(jitter);
  },
  chooseMove({ view, seat, level, rng }) {
    if (view.phase === 'review' && view.vote) {
      const letter = currentLetter(view);
      return {
        type: 'review',
        verdicts: view.disputed.map((entry) => {
          if (entry.seat === seat) return null;
          const text = view.answers[entry.seat]?.[entry.category] ?? '';
          return text.length >= 3 && initialLetter(text) === letter ? 1 : 0;
        }),
      };
    }
    const sheet = view.answers[seat] ?? [];
    const letter = currentLetter(view);
    const target = Math.round(view.categoryIds.length * SKILL[level].share);
    const open = view.categoryIds.flatMap((id, category) => (sheet[category] === '' && wordsFor(id, letter).length > 0 ? [category] : []));
    if ((view.filled[seat] ?? 0) >= target || open.length === 0) return { type: 'finish' };
    const category = rng.pick(open);
    const words = wordsFor(view.categoryIds[category]!, letter);
    // Leicht nimmt das erstbeste Wort, schwer eher ein seltenes (weniger Doppelte).
    const text = level === 'easy' ? words[0]! : rng.pick(words);
    return { type: 'answer', category, text };
  },
};
