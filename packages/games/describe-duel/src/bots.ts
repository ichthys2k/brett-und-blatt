import { normalizeWord, sameWord, wordStem, type BotDefinition, type BotLevel } from '@brett-und-blatt/engine';
import { MAX_BLOCKED, blockers, clueProblem, guessers, packOf, termOf, type DuelMove, type DuelState } from './rules';
import type { DuelTerm } from './catalog';

/** Wörter eines Textes als grobe Stämme (für den Vergleich von Hinweisen mit Begriffen). */
function stems(text: string): string[] {
  return text
    .split(/[\s\-,.;:!?/()"'„“]+/)
    .map((w) => wordStem(w))
    .filter((w) => w.length >= 3);
}

/** Wie gut passen die Hinweise zu einem Begriff? Zählt gemeinsame Wortstämme mit seinen Merkwörtern und Umschreibungen. */
function fit(term: DuelTerm, clues: string[]): number {
  const known = new Set([...term.hints, ...term.clues].flatMap(stems));
  return clues.flatMap(stems).filter((s) => known.has(s) || [...known].some((k) => k.length >= 4 && (k.includes(s) || s.includes(k)))).length;
}

const DELAY: Record<BotLevel, [number, number]> = { easy: [5_000, 4_000], medium: [3_500, 3_000], hard: [2_500, 2_000] };

/**
 * „Wortakrobat“ erklärt mit seinen eigenen Umschreibungen (und meidet Sperrwörter), schlägt
 * die naheliegendsten Wörter als Sperrwörter vor und rät, welcher Begriff des Pakets am
 * besten zu den Hinweisen passt. Im Sprech-Modus kann er nicht erklären und passt.
 */
export const duelBot: BotDefinition<DuelState, DuelMove> = {
  id: 'wortakrobat-duell',
  name: 'Wortakrobat',
  levels: ['easy', 'medium', 'hard'],
  delayMs({ level, rng }) {
    const [base, jitter] = DELAY[level];
    return base + rng.int(jitter);
  },
  chooseMove({ view, seat, level, rng }) {
    const term = termOf(view, view.term);
    if (view.phase === 'block') {
      const hints = (term?.hints ?? []).filter((h) => !h.includes(' ') && !(term && sameWord(h, term.name)));
      const words = level === 'hard' ? hints.slice(0, MAX_BLOCKED) : rng.shuffle(hints).slice(0, level === 'easy' ? 2 : MAX_BLOCKED);
      const unique = words.filter((w, i) => !words.slice(0, i).some((v) => sameWord(v, w)));
      return { type: 'block', words: unique };
    }
    if (seat === view.explainer) {
      if (view.mode === 'speak' || !term) return { type: 'skip' };
      const own = term.clues.find((c) => clueProblem(view, c) === null);
      if (own) return { type: 'clue', text: own };
      const hint = term.hints.find((h) => clueProblem(view, `Hat mit ${h} zu tun`) === null);
      return hint ? { type: 'clue', text: `Hat mit ${hint} zu tun` } : { type: 'skip' };
    }
    if (!guessers(view).includes(seat) || view.mode === 'speak' || blockers(view).includes(seat)) return { type: 'pass' };
    const tried = new Set(view.guesses.map((g) => normalizeWord(g.text)));
    const played = new Set(view.deck);
    const ranked = packOf(view)
      .terms.map((t, i) => ({ t, i, score: fit(t, view.clues) }))
      .filter((c) => !played.has(c.i) && !tried.has(normalizeWord(c.t.name)))
      .sort((a, b) => b.score - a.score);
    if (ranked.length === 0) return { type: 'pass' };
    // Leicht rät manchmal daneben, schwer nimmt den besten Treffer.
    const pool = level === 'hard' ? ranked.slice(0, 1) : level === 'medium' ? ranked.slice(0, 2) : ranked.slice(0, 4);
    return { type: 'guess', text: rng.pick(pool).t.name };
  },
};
