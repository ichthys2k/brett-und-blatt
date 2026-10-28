import { Rng, type BotContext, type BotDefinition } from '@brett-und-blatt/engine';
import { UPPER_CATEGORIES, calculateScore, type Category, type DieValue, type KniffelMove, type KniffelState, type PlayerSheet } from './rules';

/**
 * Kniffel-Bot.
 *
 * - „leicht“ hält nur nach dem ersten Wurf und trägt meist die meisten Punkte ein, manchmal zufällig.
 * - „mittel“ hält nach Faustregeln (häufigste Augenzahl oder Straßen-Lauf) und trägt die
 *   beste Kategorie nach einer Bewertung ein, die den oberen Bonus und die Chance schont.
 * - „schwer“ probiert alle 32 Möglichkeiten zu halten und schätzt per Stichprobe, welche
 *   nach den restlichen Würfen den höchsten Wert erwarten lässt.
 */
export const kniffelBot: BotDefinition<KniffelState, KniffelMove> = {
  id: 'kniffel',
  name: 'Kniffel-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx: BotContext<KniffelState, KniffelMove, KniffelState>): KniffelMove {
    const { view, rng, level } = ctx;
    const moves = ctx.module.legalMoves(view, ctx.seat);
    if (moves.length === 0) throw new Error('Kein Zug');
    const sheet = view.sheets[view.turn]!;
    const open = openCategories(sheet);
    const rollMove = moves.find((m) => m.type === 'roll');
    const scoreMoves = moves.filter((m): m is Extract<KniffelMove, { type: 'score' }> => m.type === 'score');

    if (!view.dice) return rollMove ?? scoreMoves[0]!;
    const values = view.dice.values;

    if (level === 'easy') {
      // Hält nur nach dem ersten Wurf und trägt oft einfach die meisten Punkte ein.
      if (rollMove && view.rollsLeft === 2) {
        const index = heuristicHold(values, open).findIndex((h, i) => h !== view.dice!.held[i]);
        if (index >= 0) return { type: 'toggleHold', index };
      }
      if (rollMove) return rollMove;
      if (rng.chance(0.3)) return scoreMoves[rng.int(scoreMoves.length)]!;
      return scoreMoves.reduce((a, b) => (calculateScore(b.category, values) > calculateScore(a.category, values) ? b : a));
    }

    if (rollMove && view.rollsLeft > 0) {
      // Volltreffer sofort eintragen.
      const now = bestCategory(values, open, sheet);
      if (now && (now.category === 'kniffel' || now.category === 'largeStraight') && calculateScore(now.category, values) > 0) {
        return { type: 'score', category: now.category };
      }
      // Die Stichprobe hängt nur vom Wurf ab, damit mehrere Halte-Schritte dasselbe Ziel verfolgen.
      const target = level === 'hard' ? bestHoldBySampling(values, open, sheet, view.rollsLeft, sampleRng(values, view.rollsLeft, open)) : heuristicHold(values, open);
      if (target.every((h) => h)) return { type: 'score', category: bestCategory(values, open, sheet)!.category };
      const index = target.findIndex((h, i) => h !== view.dice!.held[i]);
      if (index >= 0) return { type: 'toggleHold', index };
      return rollMove;
    }

    const best = bestCategory(values, open, sheet);
    return best ? { type: 'score', category: best.category } : scoreMoves[0]!;
  },
};

// ---------------------------------------------------------------------------
// Bewertung
// ---------------------------------------------------------------------------

const FACE: Partial<Record<Category, number>> = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };

function openCategories(sheet: PlayerSheet): Category[] {
  return (Object.keys(CATEGORY_ORDER) as Category[]).filter((c) => typeof sheet.scores[c] !== 'number');
}

const CATEGORY_ORDER: Record<Category, true> = {
  ones: true, twos: true, threes: true, fours: true, fives: true, sixes: true,
  threeOfAKind: true, fourOfAKind: true, fullHouse: true, smallStraight: true, largeStraight: true, kniffel: true, chance: true,
};

/** Wert einer Eintragung: Punkte plus Rücksicht auf Bonus und die Chance als Reserve. */
function categoryValue(category: Category, values: readonly DieValue[], sheet: PlayerSheet): number {
  const score = calculateScore(category, values);
  const face = FACE[category];
  if (face !== undefined) {
    // Drei gleiche oben halten den Bonus (63 = je dreimal) in Reichweite.
    const par = face * 3;
    const bonusOpen = sheet.upperBonus === 0;
    return score + (bonusOpen ? (score - par) * 0.9 : 0);
  }
  if (category === 'chance') return score - 12;
  if (score === 0) {
    // Null eintragen kostet die Möglichkeit, die Kategorie noch zu füllen.
    const cost: Partial<Record<Category, number>> = { kniffel: 12, largeStraight: 16, smallStraight: 12, fullHouse: 10, fourOfAKind: 6, threeOfAKind: 8 };
    return -(cost[category] ?? 5);
  }
  return score;
}

function bestCategory(values: readonly DieValue[], open: Category[], sheet: PlayerSheet): { category: Category; value: number } | null {
  let best: { category: Category; value: number } | null = null;
  for (const category of open) {
    const value = categoryValue(category, values, sheet);
    if (!best || value > best.value) best = { category, value };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Halten
// ---------------------------------------------------------------------------

type Hold = [boolean, boolean, boolean, boolean, boolean];

/** Faustregel: auf eine Straße spielen, wenn ein Lauf von vier da ist, sonst die beste Augenzahl sammeln. */
function heuristicHold(values: readonly DieValue[], open: Category[]): Hold {
  const straightOpen = open.includes('smallStraight') || open.includes('largeStraight');
  if (straightOpen) {
    for (const run of [[2, 3, 4, 5], [1, 2, 3, 4], [3, 4, 5, 6]]) {
      if (run.every((v) => values.includes(v as DieValue))) {
        const used = new Set<number>();
        return values.map((v) => {
          if (run.includes(v) && !used.has(v)) {
            used.add(v);
            return true;
          }
          return false;
        }) as Hold;
      }
    }
  }
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const v of values) counts[v]!++;
  let keep = 6;
  for (let face = 6; face >= 1; face--) {
    const upperOpen = open.includes(UPPER_CATEGORIES[face - 1]!);
    const weight = counts[face]! * 10 + face + (upperOpen ? 5 : 0);
    const keepWeight = counts[keep]! * 10 + keep + (open.includes(UPPER_CATEGORIES[keep - 1]!) ? 5 : 0);
    if (weight > keepWeight) keep = face;
  }
  if (counts[keep]! <= 1) return [false, false, false, false, false];
  return values.map((v) => v === keep) as Hold;
}

const SAMPLES = 48;

function sampleRng(values: readonly DieValue[], rollsLeft: number, open: Category[]): Rng {
  let h = 2166136261;
  for (const ch of `${values.join('')}|${rollsLeft}|${open.join(',')}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return new Rng([h, 0x9e3779b9, 0x243f6a88, 0xb7e15162]);
}

/** Alle 32 Halte-Muster durchprobieren und per Stichprobe den erwarteten Endwert schätzen. */
function bestHoldBySampling(values: readonly DieValue[], open: Category[], sheet: PlayerSheet, rollsLeft: number, rng: Rng): Hold {
  let best: { hold: Hold; value: number } = { hold: [false, false, false, false, false], value: -Infinity };
  const seen = new Set<string>();
  for (let mask = 0; mask < 32; mask++) {
    const hold = [0, 1, 2, 3, 4].map((i) => (mask & (1 << i)) !== 0) as Hold;
    // Gleiche gehaltene Augenmenge nur einmal prüfen.
    const key = values.filter((_, i) => hold[i]).sort().join('');
    if (seen.has(key)) continue;
    seen.add(key);
    const value = mask === 31 ? bestCategory(values, open, sheet)!.value : expectedValue(values, hold, open, sheet, rollsLeft, rng);
    if (value > best.value) best = { hold, value };
  }
  return best.hold;
}

function expectedValue(values: readonly DieValue[], hold: Hold, open: Category[], sheet: PlayerSheet, rollsLeft: number, rng: Rng): number {
  let total = 0;
  for (let s = 0; s < SAMPLES; s++) {
    let dice = values.map((v, i) => (hold[i] ? v : ((rng.int(6) + 1) as DieValue)));
    // Für weitere Würfe nach der einfachen Faustregel halten.
    for (let r = 1; r < rollsLeft; r++) {
      const next = heuristicHold(dice, open);
      dice = dice.map((v, i) => (next[i] ? v : ((rng.int(6) + 1) as DieValue)));
    }
    total += bestCategory(dice, open, sheet)!.value;
  }
  return total / SAMPLES;
}

export const _test = { heuristicHold, bestCategory, categoryValue };
