import type { BotContext, BotDefinition } from '@brett-und-blatt/engine';
import type { Tile } from './letters';
import { checkPlay, EXCHANGE_MIN_BAG, legalMoves, type ScrabbleMove, type ScrabbleState } from './rules';

/**
 * Bot „Wortmeister“.
 *
 * - „leicht“ legt ein mittelmäßiges Wort aus allen möglichen.
 * - „mittel“ legt das Wort mit den meisten Punkten.
 * - „schwer“ bewertet zusätzlich, was auf dem Bänkchen bleibt (Joker und S behalten,
 *   keine Dubletten, ausgewogene Selbstlaute), und tauscht schlechte Bänkchen.
 */
export const scrabbleBot: BotDefinition<ScrabbleState, ScrabbleMove> = {
  id: 'scrabble',
  name: 'Wortmeister',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx: BotContext<ScrabbleState, ScrabbleMove, ScrabbleState>): ScrabbleMove {
    const { view, level, rng } = ctx;
    const moves = legalMoves(view, ctx.seat);
    if (moves.length === 0) throw new Error('Kein Zug');
    const rack = view.racks[ctx.seat]!.filter((t): t is Tile => t !== null);
    const plays = moves
      .filter((m): m is Extract<ScrabbleMove, { type: 'play' }> => m.type === 'play')
      .map((move) => {
        const check = checkPlay(view.board, move.tiles, view.bingoBonus);
        const score = check.ok ? check.score : 0;
        const used = move.tiles.map((t) => (t.blank ? '?' : t.letter));
        return { move, score, leave: leaveAfter(rack, used) };
      });

    if (plays.length === 0) {
      if (level !== 'easy' && view.bag.length >= EXCHANGE_MIN_BAG) return { type: 'exchange', tiles: worstTiles(rack) };
      return { type: 'pass' };
    }

    if (level === 'easy') {
      const sorted = [...plays].sort((a, b) => a.score - b.score);
      const from = Math.floor(sorted.length * 0.3);
      const to = Math.max(from + 1, Math.floor(sorted.length * 0.7));
      return sorted[from + rng.int(to - from)]!.move;
    }

    if (level === 'medium') {
      return plays.reduce((best, p) => (p.score > best.score ? p : best)).move;
    }

    const endgame = view.bag.length === 0;
    const value = (p: (typeof plays)[number]) => p.score + (endgame ? 0 : leaveValue(p.leave));
    const best = plays.reduce((a, b) => (value(b) > value(a) ? b : a));
    // Lohnt sich Tauschen mehr als ein schwacher Zug?
    if (!endgame && view.bag.length >= EXCHANGE_MIN_BAG && best.score < 10) {
      const swap = worstTiles(rack);
      const keep = leaveAfter(rack, swap);
      if (leaveValue(keep) + 8 > value(best)) return { type: 'exchange', tiles: swap };
    }
    return best.move;
  },
};

function leaveAfter(rack: readonly Tile[], used: readonly Tile[]): Tile[] {
  const rest = [...rack];
  for (const t of used) {
    const i = rest.indexOf(t);
    if (i >= 0) rest.splice(i, 1);
  }
  return rest;
}

const GOOD: Partial<Record<Tile, number>> = { '?': 20, S: 4, E: 3, N: 2, R: 2, T: 1, I: 1, A: 1, D: 1, L: 0.5 };
const BAD: Partial<Record<Tile, number>> = { Q: -8, Y: -6, X: -4, Ö: -4, Ä: -3, Ü: -3, J: -3, V: -3, C: -2, P: -1 };
const VOWELS = new Set<Tile>(['A', 'E', 'I', 'O', 'U', 'Ä', 'Ö', 'Ü']);

/** Wie gut ist dieser Rest für den nächsten Zug? */
export function leaveValue(leave: readonly Tile[]): number {
  let value = 0;
  const seen = new Map<Tile, number>();
  for (const t of leave) {
    value += GOOD[t] ?? BAD[t] ?? 0;
    const n = (seen.get(t) ?? 0) + 1;
    seen.set(t, n);
    if (n > 1 && t !== '?') value -= 3 * (n - 1);
  }
  if (leave.includes('Q') && !leave.includes('U')) value -= 6;
  if (leave.includes('C') && !leave.includes('H') && !leave.includes('K')) value -= 2;
  const vowels = leave.filter((t) => VOWELS.has(t)).length;
  const consonants = leave.filter((t) => t !== '?' && !VOWELS.has(t)).length;
  value -= Math.abs(vowels - consonants * 0.7) * 2;
  return value;
}

/** Steine, die beim Tauschen gehen sollen: alles außer den besten Resten. */
function worstTiles(rack: readonly Tile[]): Tile[] {
  const keep: Tile[] = [];
  for (const t of ['?', 'S', 'E', 'N', 'R'] as Tile[]) {
    if (rack.includes(t) && !keep.includes(t)) keep.push(t);
  }
  const swap = leaveAfter(rack, keep.slice(0, 3));
  return swap.length > 0 ? swap : [...rack];
}
