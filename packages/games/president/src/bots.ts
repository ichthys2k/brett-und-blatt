import { Rng, cardRank, createDeck, type BotDefinition, type BotLevel, type CardId, type SeatId } from '@brett-und-blatt/engine';
import { applyMove, beats, cardValue, groupsOf, legalMoves, sampleHidden, topPlay, type PresidentMove, type PresidentState, type PresidentView } from './rules';

/** Was der Bot zum Entscheiden braucht – aus der Sicht oder (in der Vorausschau) aus dem ganzen Spielstand. */
type Table = Pick<PresidentState, 'options' | 'reversed' | 'deckSize' | 'trick' | 'played' | 'swaps'> & { hands: CardId[][] };

interface Group {
  value: number;
  cards: CardId[];
}

/** Alle Karten, die der Bot weder auf der Hand hat noch schon gelegt sieht. */
function unseen(table: Table, seat: SeatId): CardId[] {
  const known = new Set([...table.hands[seat]!, ...table.played]);
  const all = createDeck().filter((c) => table.deckSize === 52 || cardRank(c) === 1 || cardRank(c) >= 7);
  return all.filter((c) => !known.has(c));
}

/** Kann niemand diese Gruppe (in dieser Anzahl) noch überbieten? */
function isBoss(table: Table, seat: SeatId, value: number, size: number): boolean {
  const twoHigh = table.options.twoHigh && table.deckSize === 52;
  const counts = new Map<number, number>();
  for (const c of unseen(table, seat)) {
    const v = cardValue(c, twoHigh);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  for (const [v, n] of counts) if (n >= size && beats(table, v, value)) return false;
  return true;
}

/** Wie stark ein Wert ist, von 0 (schwächste Karte) bis 1 (stärkste). */
function strength(table: Table, value: number): number {
  const lo = table.deckSize === 32 ? 7 : table.options.twoHigh ? 3 : 2;
  const hi = table.options.twoHigh && table.deckSize === 52 ? 15 : 14;
  const s = (value - lo) / (hi - lo);
  return table.reversed ? 1 - s : s;
}

function play(cards: CardId[]): PresidentMove {
  return { type: 'play', cards };
}

/** Eröffnen: die schwächste Gruppe ganz – außer der Bot kann den Rest sicher durchziehen. */
function lead(table: Table, seat: SeatId, level: BotLevel, rng: Rng): PresidentMove {
  const groups = groupsOf(table, table.hands[seat]!);
  if (groups.length === 1) return play(groups[0]!.cards);
  if (level === 'easy') return play(rng.chance(0.3) ? groups[0]!.cards.slice(0, 1) : groups[0]!.cards);
  const bosses = groups.filter((g) => isBoss(table, seat, g.value, g.cards.length) || (table.options.eightClears && cardRank(g.cards[0]!) === 8));
  // Höchstens eine unsichere Gruppe übrig: erst die sicheren Stiche, die letzte zum Schluss.
  if (bosses.length > 0 && groups.length - bosses.length <= 1) return play(bosses[0]!.cards);
  if (groups.length > 2) {
    // Schwache Einzelkarten zuerst – Paare schwächerer Werte bleiben für später zusammen.
    const weakSingle = groups.find((g) => g.cards.length === 1 && strength(table, g.value) < 0.5);
    if (weakSingle) return play(weakSingle.cards);
  }
  return play(groups[0]!.cards);
}

/** Bedienen: die günstigste passende Gruppe, oder passen, wenn es zu teuer wäre. */
function follow(table: Table, seat: SeatId, level: BotLevel, rng: Rng): PresidentMove {
  const hand = table.hands[seat]!;
  const top = topPlay(table)!;
  const need = top.cards.length;
  const topValue = cardValue(top.cards[0]!, table.options.twoHigh && table.deckSize === 52);
  const groups = groupsOf(table, hand);
  const options = groups.filter((g) => g.cards.length >= need && (beats(table, g.value, topValue) || (table.options.sameSkips && g.value === topValue)));
  if (options.length === 0) return { type: 'pass' };
  const finishing = need === hand.length ? options[0] : undefined;
  if (finishing) return play(finishing.cards);
  if (level === 'easy') return rng.chance(0.15) ? { type: 'pass' } : play(options[0]!.cards.slice(0, need));

  // Kosten: hohe Karten, aufgebrochene Gruppen und frühe Spitzenkarten sind teuer.
  const cost = (g: Group) => {
    let c = strength(table, g.value) * 10;
    if (g.cards.length > need) c += 4;
    if (strength(table, g.value) >= 0.99 && hand.length > 5) c += 4;
    return c;
  };
  const best = [...options].sort((a, b) => cost(a) - cost(b))[0]!;
  {
    // Holt die Legung den Stich und bleibt danach höchstens eine unsichere Gruppe, lohnt sie sich.
    const rest = groups.filter((g) => g !== best || g.cards.length > need);
    const restAfter = rest.map((g) => (g === best ? { ...g, cards: g.cards.slice(need) } : g));
    const unsafe = restAfter.filter((g) => !isBoss(table, seat, g.value, g.cards.length));
    if (isBoss(table, seat, best.value, need) && unsafe.length <= 1) return play(best.cards.slice(0, need));
  }
  if (cost(best) > 13 && hand.length > 4) return { type: 'pass' };
  return play(best.cards.slice(0, need));
}

/** Tausch: die schwächsten Karten abgeben, Einzelkarten vor Paaren. */
function give(table: Table, seat: SeatId, count: number): PresidentMove {
  const groups = groupsOf(table, table.hands[seat]!);
  const weakSingles = groups.filter((g) => g.cards.length === 1 && strength(table, g.value) < 0.6).flatMap((g) => g.cards);
  const cards = [...new Set([...weakSingles, ...groups.flatMap((g) => g.cards)])].slice(0, count);
  return { type: 'give', cards };
}

function policy(table: Table, seat: SeatId, level: BotLevel, rng: Rng): PresidentMove {
  return table.trick.length === 0 ? lead(table, seat, level, rng) : follow(table, seat, level, rng);
}

/** Spielt eine ausgedachte Verteilung mit der Faustregel zu Ende; Ergebnis: eigener Platz (0 = Präsident). */
function playout(state: PresidentState, seat: SeatId, rng: Rng): number {
  let s = state;
  for (let guard = 0; guard < 400 && s.phase === 'play'; guard++) {
    const actor = s.turn;
    if (s.finished.includes(seat)) break;
    s = applyMove(s, actor, policy(s, actor, 'medium', rng)).state;
  }
  const place = s.finished.indexOf(seat);
  return place >= 0 ? place : s.hands.length - 1;
}

/**
 * Schwer im Endspiel: Für jede Möglichkeit werden die unbekannten Karten mehrmals zufällig
 * verteilt und die Runde mit Faustregeln zu Ende gespielt; die Möglichkeit mit dem besten
 * Durchschnittsplatz gewinnt.
 */
function search(view: PresidentView, seat: SeatId, rng: Rng, deadline: () => boolean): PresidentMove | null {
  const candidates = legalMoves(sampleHidden(view, seat, rng), seat);
  if (candidates.length <= 1) return null;
  const totals = candidates.map(() => 0);
  let samples = 0;
  for (; samples < 40 && !deadline(); samples++) {
    const world = sampleHidden(view, seat, rng);
    candidates.forEach((move, i) => {
      totals[i]! += playout(applyMove(world, seat, move).state, seat, new Rng(rng.state));
    });
    rng.int(2);
  }
  if (samples === 0) return null;
  let best = 0;
  for (let i = 1; i < candidates.length; i++) if (totals[i]! < totals[best]!) best = i;
  return candidates[best]!;
}

export const presidentBot: BotDefinition<PresidentState, PresidentMove, PresidentView> = {
  id: 'kartenkanzler',
  name: 'Kartenkanzler',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, level, rng, timeBudgetMs, now }) {
    if (view.phase === 'roundEnd') return { type: 'ready' };
    if (view.phase === 'exchange') {
      const swap = view.swaps.find((s) => !s.done && s.high === seat);
      return give(view, seat, swap?.count ?? 1);
    }
    const hand = view.hands[seat]!;
    if (level === 'hard' && hand.length <= 6) {
      const start = now();
      const found = search(view, seat, rng, () => now() - start > Math.min(timeBudgetMs, 600));
      if (found) return found;
    }
    return policy(view, seat, level, rng);
  },
};
