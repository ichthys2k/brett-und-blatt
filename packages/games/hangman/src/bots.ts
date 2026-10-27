import type { BotDefinition, BotLevel } from '@brett-und-blatt/engine';
import { legalMoves, type HangmanMove, type HangmanState } from './rules';
import { GERMAN_LETTER_FREQUENCY, WORD_LISTS, isGuessableChar, normalizeWord } from './words';

/** Bedenkpause im gleichzeitigen Wettrennen (`race`) in Millisekunden. */
const RACE_DELAY_MS: Record<BotLevel, [number, number]> = {
  easy: [2_800, 1_800],
  medium: [1_900, 1_200],
  hard: [1_100, 800],
};

/**
 * Filtert aus der Wortliste der aktuellen Kategorie alle Wörter heraus, die exakt zum
 * bisher sichtbaren Muster (`maskedWord`) und den bereits geratenen Buchstaben passen.
 */
export function findMatchingWords(
  maskedWord: string,
  guessedLetters: readonly string[],
  category: HangmanState['category'],
): string[] {
  const guessedSet = new Set(guessedLetters);
  const pool = WORD_LISTS[category] ?? WORD_LISTS.alltag;

  return pool.map((w) => normalizeWord(w)).filter((norm) => {
    if (norm.length !== maskedWord.length) return false;
    for (let i = 0; i < norm.length; i++) {
      const mCh = maskedWord[i]!;
      const wCh = norm[i]!;
      if (mCh === '_') {
        // Ein verdecktes Zeichen darf keiner der bereits geratenen Buchstaben sein
        if (isGuessableChar(wCh) && guessedSet.has(wCh)) return false;
      } else if (mCh !== wCh) {
        return false;
      }
    }
    return true;
  });
}

export const hangmanBot: BotDefinition<HangmanState, HangmanMove> = {
  id: 'buchstabenfuchs',
  name: 'Buchstabenfuchs',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, level, rng }) {
    const moves = legalMoves(view, seat);
    if (moves.length === 0) return { type: 'guess', letter: 'E' };

    const board = view.mode === 'coop' ? view.boards[0] : view.boards[seat];
    if (!board) return moves[0]!;

    const availableSet = new Set(moves.map((m) => m.letter));

    // Auf Schwer und Mittel (zu 65 %) Muster-Abgleich mit der Wortliste nutzen
    if (level === 'hard' || (level === 'medium' && rng.chance(0.65))) {
      const candidates = findMatchingWords(board.maskedWord, board.guessedLetters, view.category);
      if (candidates.length > 0) {
        const counts = new Map<string, number>();
        for (const word of candidates) {
          const uniqueInWord = new Set([...word].filter((ch) => availableSet.has(ch)));
          for (const ch of uniqueInWord) {
            counts.set(ch, (counts.get(ch) ?? 0) + 1);
          }
        }
        if (counts.size > 0) {
          const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
          if (level === 'hard') {
            return { type: 'guess', letter: sorted[0]![0] };
          }
          const topSlice = sorted.slice(0, Math.min(3, sorted.length));
          return { type: 'guess', letter: rng.pick(topSlice)[0] };
        }
      }
    }

    // Allgemeine deutsche Buchstabenhäufigkeit
    const freqFiltered = GERMAN_LETTER_FREQUENCY.filter((ch) => availableSet.has(ch));
    if (freqFiltered.length > 0) {
      const windowSize = level === 'easy' ? 7 : level === 'medium' ? 4 : 2;
      const top = freqFiltered.slice(0, Math.min(windowSize, freqFiltered.length));
      return { type: 'guess', letter: rng.pick(top) };
    }

    return rng.pick(moves);
  },
  delayMs({ view, level, rng }) {
    if (view.mode !== 'race') return 0;
    const [base, spread] = RACE_DELAY_MS[level];
    return base + Math.floor(rng.next() * spread);
  },
};
