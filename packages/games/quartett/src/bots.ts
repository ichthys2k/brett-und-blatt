import type { BotDefinition, BotLevel, Rng, SeatId } from '@brett-und-blatt/engine';
import { askTargets, askableCards, collectKnowledge, setOf, type QuartettMove, type QuartettState } from './rules';
import { compareValues, groupOf, valueOf, type CardId, type CardProperty } from './sets';

/** Anteil der Karten, die `value` schlägt; Gleichstand zählt halb. */
function beatShare(setId: string, property: CardProperty, value: number, others: CardId[]): number {
  if (others.length === 0) return 1;
  let score = 0;
  for (const card of others) {
    const diff = compareValues(property, value, valueOf(setId, card, property.id));
    score += diff > 0 ? 1 : diff === 0 ? 0.5 : 0;
  }
  return score / others.length;
}

function pickBest<T>(items: T[], score: (item: T) => number, rng: Rng): T {
  let best = items[0] as T;
  let bestScore = -Infinity;
  for (const item of items) {
    // Winziges Rauschen entscheidet Gleichstände zufällig.
    const s = score(item) + rng.next() * 1e-6;
    if (s > bestScore) {
      best = item;
      bestScore = s;
    }
  }
  return best;
}

/**
 * Trumpf:
 * - leicht: zufällige Eigenschaft
 * - mittel: Rangplatz des eigenen Werts gegen alle anderen Karten des Sets
 * - schwer: Kartenzählen – bekannte oberste Karten der Gegner exakt, sonst nur Karten, deren Platz unbekannt ist
 */
function chooseProperty(view: QuartettState, seat: SeatId, level: BotLevel, rng: Rng): QuartettMove {
  const set = setOf(view);
  const own = view.stacks[seat]?.[0]?.card;
  if (level === 'easy' || !own) return { type: 'chooseProperty', property: rng.pick(set.properties).id };
  const others = set.cards.map((c) => c.id).filter((card) => card !== own);

  if (level === 'medium') {
    const property = pickBest(set.properties, (p) => beatShare(set.id, p, valueOf(set.id, own, p.id), others), rng);
    return { type: 'chooseProperty', property: property.id };
  }

  const seen = new Set<CardId>([...view.middle, ...view.stacks.flatMap((stack) => stack.flatMap((e) => (e.card ? [e.card] : [])))]);
  const unknown = others.filter((card) => !seen.has(card));
  const opponents = view.stacks.flatMap((stack, s) => (s !== seat && stack.length > 0 ? [stack[0]!.card] : []));
  const property = pickBest(
    set.properties,
    (p) => {
      const mine = valueOf(set.id, own, p.id);
      // Wahrscheinlichkeit, alle Gegner zu schlagen (Gleichstand zählt halb).
      return opponents.reduce((chance, top) => {
        if (top) {
          const diff = compareValues(p, mine, valueOf(set.id, top, p.id));
          return chance * (diff > 0 ? 1 : diff === 0 ? 0.5 : 0);
        }
        return chance * beatShare(set.id, p, mine, unknown);
      }, 1);
    },
    rng,
  );
  return { type: 'chooseProperty', property: property.id };
}

/** Wie viele der letzten Fragen sich ein Bot merkt. */
const MEMORY: Record<BotLevel, number> = { easy: 3, medium: 12, hard: Infinity };

/**
 * Sammeln: Der Bot schätzt für jede mögliche Frage, wie wahrscheinlich der Gefragte die Karte hat –
 * aus Übergaben (sicher), „Nein“-Antworten (sicher nicht) und der Handgröße. Der schwere Bot merkt
 * sich zusätzlich, wer nach welcher Gruppe gefragt hat (der hat dann eine Karte davon).
 */
function chooseAsk(view: QuartettState, seat: SeatId, level: BotLevel, rng: Rng): QuartettMove {
  const cards = askableCards(view, seat);
  const targets = askTargets(view, seat);
  const moves = cards.flatMap((card) => targets.map((target) => ({ type: 'ask' as const, target, card })));
  if (level === 'easy' && rng.chance(0.3)) return rng.pick(moves);

  const memory = MEMORY[level];
  const { holder, notAt } = collectKnowledge(view, seat, memory);
  const knownAt = view.hands.map((_, s) => [...holder.values()].filter((h) => h === s).length);
  const slots = (s: SeatId) => Math.max(0.5, (view.hands[s]?.length ?? 0) - knownAt[s]!);
  const own = (view.hands[seat] ?? []).filter((c): c is CardId => c !== null);
  const recent = Number.isFinite(memory) ? view.asks.slice(-memory) : view.asks;
  // Wer zuletzt nach einer Gruppe gefragt hat, besitzt (noch) eine Karte davon.
  const groupHint = (target: SeatId, group: string) =>
    level === 'hard' && recent.some((a) => a.asker === target && groupOf(a.card) === group) ? 1.6 : 1;

  const chance = (target: SeatId, card: CardId) => {
    const known = holder.get(card);
    if (known !== undefined) return known === target ? 1 : 0;
    const possible = targets.filter((s) => !notAt.get(card)?.has(s));
    if (!possible.includes(target)) return 0;
    const weight = (s: SeatId) => slots(s) * groupHint(s, groupOf(card));
    // Auch der Stapel kann die Karte haben.
    return weight(target) / (possible.reduce((sum, s) => sum + weight(s), 0) + view.talon.length);
  };
  const progress = (card: CardId) => own.filter((c) => groupOf(c) === groupOf(card)).length;
  return pickBest(moves, (m) => chance(m.target, m.card) + 0.03 * progress(m.card), rng);
}

export const quartettBot: BotDefinition<QuartettState, QuartettMove> = {
  id: 'quartett',
  name: 'Kartenkenner',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, level, rng }) {
    return view.mode === 'trump' ? chooseProperty(view, seat, level, rng) : chooseAsk(view, seat, level, rng);
  },
};
