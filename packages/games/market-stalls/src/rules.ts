import { Rng, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

/**
 * Marktstände – Kartenspiel für 2 bis 10 Spieler (W-039), eigene Fassung statt 6 nimmt!.
 *
 * Alle wählen gleichzeitig eine Karte, gelegt wird von der kleinsten Zahl an, und jeder wählt selbst
 * den Stand. Die fünfte Karte räumt ab. Gewertet wird nach drei Markttagen; jeder Markttag bringt alle
 * 60 Karten neu, die Vorratskammern bleiben. Die Zahlen stammen aus der Bot-Probe, siehe
 * docs/spiele/marktstaende-probe.md.
 */

export const WARES = ['bread', 'cheese', 'apples', 'fish'] as const;
export type Ware = (typeof WARES)[number];
export const CARD_COUNT = 60;
export const STAND_COUNT = 4;
export const STAND_CAPACITY = 5;
/** Karte eines anderen, die dieser Platz nicht sehen darf. */
export const HIDDEN = 0;

/** Sterne je Ware, über deren 15 Karten verteilt. */
const STAR_PATTERN = [0, 1, 2, 0, 2, 1, 0, 1, 2, 0, 2, 1, 0, 1, 2];

/** Je Viererblock jede Ware einmal, damit keine Ware nur hohe Zahlen hat. Fest, nicht je Partie. */
const CARD_TABLE: { ware: number; stars: number }[] = (() => {
  const rng = Rng.fromSeed('marktstaende');
  const seen = [0, 0, 0, 0];
  const table: { ware: number; stars: number }[] = [];
  for (let block = 0; block < CARD_COUNT / 4; block++) {
    for (const ware of rng.shuffle([0, 1, 2, 3])) table.push({ ware, stars: STAR_PATTERN[seen[ware]!++]! });
  }
  return table;
})();

export const wareOf = (card: number): number => CARD_TABLE[card - 1]!.ware;
export const starsOf = (card: number): number => CARD_TABLE[card - 1]!.stars;

export function buildDeck(): number[] {
  return Array.from({ length: CARD_COUNT }, (_, i) => i + 1);
}

export interface QueuedPlay {
  seat: SeatId;
  card: number;
}

export interface MarketStallsState {
  seats: number;
  days: number;
  /** Der laufende Markttag, ab 1. */
  day: number;
  phase: 'choose' | 'place' | 'over';
  /** Handkarten; fremde sind in der Sicht `HIDDEN`. */
  hands: number[][];
  /** Nicht ausgeteilte Karten des Markttags. */
  stock: number[];
  stands: number[][];
  pantries: number[][];
  /** Gewählte Karte je Platz, null = noch nicht gewählt; fremde sind in der Sicht `HIDDEN`. */
  chosen: (number | null)[];
  /** Aufgedeckte Karten, die noch gelegt werden müssen, die kleinste zuerst. */
  queue: QueuedPlay[];
  /** Alle am laufenden Markttag offen gesehenen Karten. */
  seen: number[];
  rng: RngState;
}

export type MarketStallsMove = { type: 'choose'; card: number } | { type: 'place'; stand: number };

/** Handkarten je Markttag: bis zu 10, aber nie mehr, als die 56 Karten ohne die Stände hergeben. */
export function handSize(seats: number): number {
  return Math.min(10, Math.floor((CARD_COUNT - STAND_COUNT) / seats));
}

function dealDay(seats: number, rng: Rng) {
  const deck = rng.shuffle(buildDeck());
  const stands = deck.splice(0, STAND_COUNT).map((card) => [card]);
  const size = handSize(seats);
  const hands: number[][] = [];
  for (let seat = 0; seat < seats; seat++) hands.push(deck.splice(0, size).sort((a, b) => a - b));
  return { stands, hands, stock: deck, seen: stands.flat(), chosen: Array<number | null>(seats).fill(null) };
}

export function setup(seats: number, options: Options, seed: string): MarketStallsState {
  const count = Math.max(2, Math.min(10, Number(seats) || 2));
  const rng = Rng.fromSeed(seed);
  return {
    seats: count,
    days: options.days === '1' ? 1 : 3,
    day: 1,
    phase: 'choose',
    pantries: Array.from({ length: count }, () => []),
    queue: [],
    ...dealDay(count, rng),
    rng: rng.state,
  };
}

export function fits(stand: number[], card: number): boolean {
  const top = stand[stand.length - 1];
  return top === undefined || top < card || wareOf(top) === wareOf(card);
}

/** Stände, an die die Karte darf; passt sie nirgends, sind es alle, denn dann wird einer genommen. */
export function standOptions(stands: number[][], card: number): number[] {
  const legal = stands.flatMap((stand, index) => (fits(stand, card) ? [index] : []));
  return legal.length > 0 ? legal : stands.map((_, index) => index);
}

/** Legt eine Karte an; liefert die neuen Stände und die Karten, die der Spieler nimmt. */
export function placeCard(stands: number[][], stand: number, card: number): { stands: number[][]; taken: number[]; forced: boolean } {
  const pile = stands[stand]!;
  const replace = (next: number[]) => stands.map((s, index) => (index === stand ? next : s));
  if (!fits(pile, card)) return { stands: replace([card]), taken: pile, forced: true };
  if (pile.length === STAND_CAPACITY - 1) return { stands: replace([]), taken: [...pile, card], forced: false };
  return { stands: replace([...pile, card]), taken: [], forced: false };
}

export interface WareTally {
  count: number;
  stars: number;
  /** Hat dieser Platz hier die meisten Karten (Gleichstand zählt für alle)? */
  leads: boolean;
  /** Ist das die stärkste Ware dieses Platzes? */
  best: boolean;
  /** Punkte aus dieser Ware. */
  points: number;
}

/** Die Wertung aller Plätze je Ware. */
export function tally(pantries: number[][]): WareTally[][] {
  const raw = pantries.map((pantry) => {
    const count = [0, 0, 0, 0];
    const stars = [0, 0, 0, 0];
    for (const card of pantry) {
      count[wareOf(card)]!++;
      stars[wareOf(card)]! += starsOf(card);
    }
    return { count, stars };
  });
  const top = WARES.map((_, ware) => Math.max(...raw.map(({ count }) => count[ware]!)));
  return raw.map(({ count, stars }) => {
    const best = [0, 1, 2, 3].reduce((a, b) => (count[b]! > count[a]! || (count[b] === count[a] && stars[b]! > stars[a]!) ? b : a));
    return WARES.map((_, ware) => {
      const leads = count[ware]! > 0 && count[ware] === top[ware];
      const isBest = ware === best && count[ware]! > 0;
      return { count: count[ware]!, stars: stars[ware]!, leads, best: isBest, points: leads && isBest ? stars[ware]! : -stars[ware]! };
    });
  });
}

export function scores(pantries: number[][]): number[] {
  return tally(pantries).map((wares) => wares.reduce((sum, ware) => sum + ware.points, 0));
}

/** Sterne der stärksten Ware: Entscheidung bei gleichen Punkten. */
export function bestWareStars(pantries: number[][]): number[] {
  return tally(pantries).map((wares) => wares.find((ware) => ware.best)?.stars ?? 0);
}

export function currentPlayers(state: MarketStallsState): SeatId[] {
  if (state.phase === 'choose') return state.chosen.flatMap((card, seat) => (card === null ? [seat] : []));
  return state.phase === 'place' ? [state.queue[0]!.seat] : [];
}

export function legalMoves(state: MarketStallsState, seat: SeatId): MarketStallsMove[] {
  if (state.phase === 'choose') {
    if (state.chosen[seat] !== null) return [];
    return (state.hands[seat] ?? []).map((card) => ({ type: 'choose', card }));
  }
  if (state.phase === 'place' && state.queue[0]!.seat === seat) {
    return standOptions(state.stands, state.queue[0]!.card).map((stand) => ({ type: 'place', stand }));
  }
  return [];
}

function putDown(state: MarketStallsState, stand: number, events: GameEvent[]): MarketStallsState {
  const { seat, card } = state.queue[0]!;
  const placed = placeCard(state.stands, stand, card);
  events.push({ type: 'cardPlayed', seat, card, stand });
  if (placed.taken.length > 0) events.push({ type: 'standTaken', seat, stand, count: placed.taken.length, forced: placed.forced });
  return {
    ...state,
    stands: placed.stands,
    pantries: state.pantries.map((pantry, s) => (s === seat ? [...pantry, ...placed.taken] : pantry)),
    queue: state.queue.slice(1),
  };
}

/** Legt, was keine Wahl lässt, von selbst und schließt Runde und Markttag ab. */
function advance(state: MarketStallsState, events: GameEvent[]): MarketStallsState {
  let next = state;
  while (next.queue.length > 0) {
    const options = standOptions(next.stands, next.queue[0]!.card);
    if (options.length > 1) return next;
    next = putDown(next, options[0]!, events);
  }
  if (next.hands.some((hand) => hand.length > 0)) return { ...next, phase: 'choose' };
  if (next.day < next.days) {
    const rng = new Rng(next.rng);
    const day = next.day + 1;
    events.push({ type: 'newDeal', day });
    return { ...next, phase: 'choose', day, ...dealDay(next.seats, rng), rng: rng.state };
  }
  const finished = { ...next, phase: 'over' as const };
  for (const winner of winners(finished)) events.push({ type: 'win', seat: winner });
  return finished;
}

export function applyMove(state: MarketStallsState, seat: SeatId, move: MarketStallsMove): MoveResult<MarketStallsState> {
  const legal = legalMoves(state, seat).some((m) =>
    m.type === 'choose' ? move.type === 'choose' && m.card === move.card : move.type === 'place' && m.stand === move.stand,
  );
  if (!legal) throw new Error('Unzulässiger Zug');
  const events: GameEvent[] = [];

  if (move.type === 'place') return { state: advance(putDown(state, move.stand, events), events), events };

  const hands = state.hands.map((hand, s) => (s === seat ? hand.filter((card) => card !== move.card) : hand));
  const chosen = state.chosen.map((card, s) => (s === seat ? move.card : card));
  events.push({ type: 'cardChosen', seat });
  const next: MarketStallsState = { ...state, hands, chosen };
  if (chosen.some((card) => card === null)) return { state: next, events };

  // Alle haben gewählt: aufdecken, die kleinste Zahl legt zuerst.
  const queue = chosen.flatMap((card, s) => [{ seat: s, card: card! }]).sort((a, b) => a.card - b.card);
  events.push({ type: 'revealed', plays: queue });
  const revealed: MarketStallsState = {
    ...next,
    phase: 'place',
    queue,
    chosen: chosen.map(() => null),
    seen: [...state.seen, ...queue.map((play) => play.card)],
  };
  return { state: advance(revealed, events), events };
}

export function timeoutMove(state: MarketStallsState, seat: SeatId): MarketStallsMove {
  return legalMoves(state, seat)[0]!;
}

export function playerView(state: MarketStallsState, seat: SeatId | 'spectator'): MarketStallsState {
  return {
    ...state,
    rng: [0, 0, 0, 0],
    hands: state.hands.map((hand, s) => (s === seat ? hand : hand.map(() => HIDDEN))),
    stock: state.stock.map(() => HIDDEN),
    chosen: state.chosen.map((card, s) => (s === seat || card === null ? card : HIDDEN)),
  };
}

/** Füllt fremde Hände, fremde Wahl und den Stapel mit den Karten auf, die dieser Platz nicht kennt. */
export function sampleHidden(view: MarketStallsState, seat: SeatId, rng: Rng): MarketStallsState {
  const known = new Set(view.seen);
  for (const card of view.hands[seat] ?? []) known.add(card);
  const own = view.chosen[seat];
  if (own) known.add(own);
  const pool = rng.shuffle(buildDeck().filter((card) => !known.has(card)));
  return {
    ...view,
    hands: view.hands.map((hand, s) => (s === seat ? hand : hand.map(() => pool.pop()!).sort((a, b) => a - b))),
    chosen: view.chosen.map((card, s) => (s === seat || card === null ? card : pool.pop()!)),
    stock: view.stock.map(() => pool.pop()!),
    rng: rng.state,
  };
}

/** Die meisten Punkte gewinnen, bei Gleichstand die meisten Sterne der stärksten Ware. */
function winners(state: MarketStallsState): SeatId[] {
  const points = scores(state.pantries);
  const stars = bestWareStars(state.pantries);
  const topPoints = Math.max(...points);
  const leaders = points.flatMap((score, seat) => (score === topPoints ? [seat] : []));
  const topStars = Math.max(...leaders.map((seat) => stars[seat]!));
  return leaders.filter((seat) => stars[seat] === topStars);
}

export function result(state: MarketStallsState): Result | null {
  return state.phase === 'over' ? { kind: 'win', winners: winners(state) } : null;
}
