import { Rng, type BotDefinition, type SeatId } from '@brett-und-blatt/engine';
import {
  STAND_CAPACITY,
  buildDeck,
  legalMoves,
  placeCard,
  scores,
  standOptions,
  type MarketStallsMove,
  type MarketStallsState,
} from './rules';

/** Vermutete Karten der anderen je Handkarte beim schweren Bot. */
const SAMPLES = 6;

/** Eigene Punkte gegen den Schnitt der anderen. */
function worth(pantries: number[][], seat: SeatId): number {
  const all = scores(pantries);
  const others = all.reduce((sum, score) => sum + score, 0) - all[seat]!;
  return all[seat]! - others / Math.max(1, all.length - 1);
}

function withTaken(pantries: number[][], seat: SeatId, taken: number[]): number[][] {
  return taken.length === 0 ? pantries : pantries.map((pantry, s) => (s === seat ? [...pantry, ...taken] : pantry));
}

/** Der beste Stand für diese Karte, wenn man nur auf die Punkte danach schaut. */
export function bestStand(stands: number[][], pantries: number[][], seat: SeatId, card: number): number {
  let best = -1;
  let bestScore = -Infinity;
  for (const stand of standOptions(stands, card)) {
    const placed = placeCard(stands, stand, card);
    let score = worth(withTaken(pantries, seat, placed.taken), seat);
    // Kleiner Abstand lässt die anderen Stände offen; eine vierte Karte ist ein Geschenk an den Nächsten.
    const top = stands[stand]![stands[stand]!.length - 1];
    if (top !== undefined) score -= Math.abs(card - top) * 0.005;
    if (placed.stands[stand]!.length === STAND_CAPACITY - 1) score -= 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = stand;
    }
  }
  return best;
}

/** Spielt eine Runde mit vermuteten Karten durch und bewertet das Ergebnis. */
function tryCard(view: MarketStallsState, seat: SeatId, card: number, unseen: number[], rng: Rng): number {
  const pool = rng.shuffle(unseen);
  const plays = [{ seat, card }];
  for (let other = 0; other < view.seats; other++) if (other !== seat) plays.push({ seat: other, card: pool.pop()! });
  plays.sort((a, b) => a.card - b.card);
  let { stands, pantries } = view;
  for (const play of plays) {
    const placed = placeCard(stands, bestStand(stands, pantries, play.seat, play.card), play.card);
    stands = placed.stands;
    pantries = withTaken(pantries, play.seat, placed.taken);
  }
  return worth(pantries, seat);
}

/**
 * Bot „Marktschreier“:
 * - leicht wählt Karte und Stand zufällig,
 * - mittel wählt die Karte, die jetzt, ohne die anderen, die meisten Punkte bringt, und rechnet den Stand durch,
 * - schwer schätzt zusätzlich die Karten der anderen und spielt die Runde mehrmals durch.
 */
export const marketStallsBot: BotDefinition<MarketStallsState, MarketStallsMove> = {
  id: 'market-stalls',
  name: 'Marktschreier',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, level, rng }) {
    const moves = legalMoves(view, seat);
    if (level === 'easy') return rng.pick(moves);
    if (view.phase === 'place') return { type: 'place', stand: bestStand(view.stands, view.pantries, seat, view.queue[0]!.card) };

    const hand = view.hands[seat]!;
    const seen = new Set([...view.seen, ...hand]);
    const unseen = buildDeck().filter((card) => !seen.has(card));
    let best = hand[0]!;
    let bestScore = -Infinity;
    for (const card of hand) {
      let score = 0;
      if (level === 'hard') {
        for (let sample = 0; sample < SAMPLES; sample++) score += tryCard(view, seat, card, unseen, rng);
      } else {
        const placed = placeCard(view.stands, bestStand(view.stands, view.pantries, seat, card), card);
        score = worth(withTaken(view.pantries, seat, placed.taken), seat);
      }
      if (score > bestScore) {
        bestScore = score;
        best = card;
      }
    }
    return { type: 'choose', card: best };
  },
};
