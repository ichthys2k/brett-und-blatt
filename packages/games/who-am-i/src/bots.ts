import type { BotDefinition, BotLevel } from '@brett-und-blatt/engine';
import { termOf, truthOf } from './catalog';
import { MAYBE, NO, YES, candidates, openQuestions, packOf, type WhoMove, type WhoState } from './rules';

/** Ab so wenigen Kandidaten rät der Bot (je Stufe). */
const GUESS_AT: Record<BotLevel, number> = { easy: 4, medium: 2, hard: 1 };

/**
 * „Spürnase“: streicht Begriffe, die nicht zu den Antworten passen oder bei anderen liegen,
 * und stellt die Frage, die die übrigen Kandidaten am gleichmäßigsten teilt. Leicht fragt
 * eher wild und rät früh. Als Antwortgeber sagt der Bot die Wahrheit aus dem Katalog; laut
 * gestellte Fragen kann er nicht hören und enthält sich.
 */
export const whoBot: BotDefinition<WhoState, WhoMove> = {
  id: 'spuernase',
  name: 'Spürnase',
  levels: ['easy', 'medium', 'hard'],
  delayMs({ rng }) {
    return 900 + rng.int(1_400);
  },
  chooseMove({ view, seat, level, rng }) {
    const pack = packOf(view);
    if (view.phase === 'answer' && view.pending) {
      const question = view.pending.question;
      const term = termOf(pack, view.terms[view.turn] ?? null);
      if (question === null || !term) return { type: 'answer', value: null };
      if (level === 'easy' && rng.int(6) === 0) return { type: 'answer', value: MAYBE };
      return { type: 'answer', value: truthOf(term, question) ? YES : NO };
    }

    const left = candidates(view, seat);
    const open = openQuestions(view, seat);
    const guess = (pool = left): WhoMove => {
      const term = rng.pick(pool.length > 0 ? pool : pack.terms);
      return view.mode === 'free' ? { type: 'guessText', text: term.name } : { type: 'guess', term: term.id };
    };
    if (left.length <= GUESS_AT[level] || open.length === 0) return guess();

    // Frage mit der gleichmäßigsten Teilung der Kandidaten.
    const scored = open
      .map((question) => {
        const yes = left.filter((t) => truthOf(t, question)).length;
        return { question, split: Math.min(yes, left.length - yes) };
      })
      .filter((q) => q.split > 0)
      .sort((a, b) => b.split - a.split);
    if (scored.length === 0) return guess();
    if (level === 'easy') return { type: 'ask', question: rng.pick(scored).question };
    if (level === 'medium') return { type: 'ask', question: rng.pick(scored.slice(0, 3)).question };
    return { type: 'ask', question: scored[0]!.question };
  },
};
