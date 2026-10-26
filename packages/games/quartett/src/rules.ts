import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type SeatId } from '@brett-und-blatt/engine';
import { cardSet, compareValues, groupOf, valueOf, type CardId, type CardSet } from './sets';

export type QuartettMode = 'trump' | 'collect';

/** Eine Karte im Stapel. `open`: Alle haben gesehen, welche Karte hier liegt (gewonnene Karten). */
export interface StackCard {
  /** In der Sicht null, wenn der Platz die Karte nicht kennt. */
  card: CardId | null;
  open: boolean;
}

export interface Play {
  seat: SeatId;
  card: CardId;
}

/** Eine aufgedeckte Runde im Trumpf. */
export interface Trick {
  chooser: SeatId;
  property: string;
  /** Die aufgedeckten Karten in Sitzreihenfolge. */
  plays: Play[];
  /** null bei Gleichstand: Dann liegen die Karten in der Mitte. */
  winner: SeatId | null;
  /** Wie viele Karten der Gewinner bekommt (mit der Mitte) bzw. jetzt in der Mitte liegen. */
  cards: number;
}

/** Eine Frage beim Sammeln – das Protokoll ist öffentlich. */
export interface Ask {
  asker: SeatId;
  target: SeatId;
  card: CardId;
  got: boolean;
  /** Wer danach vom Stapel gezogen hat: der Fragende bei einer Niete, wer keine Karten mehr hatte. */
  drew: SeatId[];
}

export interface QuartettState {
  mode: QuartettMode;
  set: string;
  turn: SeatId;

  // Trumpf
  /** Stapel je Platz, oberste Karte vorn. */
  stacks: StackCard[][];
  /** Karten aus Gleichständen; die nächste gewonnene Runde nimmt sie mit. Öffentlich. */
  middle: CardId[];
  /** Gespielte Runden (auch Gleichstände). */
  round: number;
  /** Nach so vielen Runden gewinnt, wer die meisten Karten hat; 0 = unbegrenzt. */
  roundLimit: number;
  lastTrick: Trick | null;
  /** Wie lange die Oberfläche eine aufgedeckte Runde stehen lässt. */
  revealMs: number;

  // Sammeln
  /** Hände je Platz, sortiert. In der Sicht sind fremde Karten null. */
  hands: (CardId | null)[][];
  /** Nachziehstapel (nur bei 2–3 Spielern), oberste Karte vorn; in der Sicht null. */
  talon: (CardId | null)[];
  /** Abgelegte Quartette in der Reihenfolge des Ablegens. */
  quartets: { seat: SeatId; group: string }[];
  /** Alle Fragen der Partie. */
  asks: Ask[];
}

export type QuartettMove =
  | { type: 'chooseProperty'; property: string }
  | { type: 'ask'; target: SeatId; card: CardId };

/** Bis zu so vielen Spielern bekommt beim Sammeln jeder nur einige Karten, der Rest bildet einen Stapel. */
export const HAND_WITH_TALON = { maxSeats: 3, cards: 7 };

export function setOf(state: Pick<QuartettState, 'set'>): CardSet {
  return cardSet(state.set);
}

export function setup(seats: number, options: Options, seed: string): QuartettState {
  const set = cardSet(options.set ?? 'tiere');
  const mode: QuartettMode = options.mode === 'collect' ? 'collect' : 'trump';
  const rng = Rng.fromSeed(seed, 'karten');
  const deck = rng.shuffle(set.cards.map((card) => card.id));
  const dealt: CardId[][] = Array.from({ length: seats }, () => []);
  // Sammeln zu zweit oder dritt: je 7 Karten, der Rest ist ein Stapel – sonst ginge zu zweit jede Frage auf.
  const handOut = mode === 'collect' && seats <= HAND_WITH_TALON.maxSeats ? HAND_WITH_TALON.cards * seats : deck.length;
  deck.slice(0, handOut).forEach((card, i) => dealt[i % seats]!.push(card));
  const limit = Number(options.rounds ?? 30);

  const state: QuartettState = {
    mode,
    set: set.id,
    turn: 0,
    stacks: [],
    middle: [],
    round: 0,
    roundLimit: Number.isFinite(limit) && limit > 0 ? limit : 0,
    lastTrick: null,
    revealMs: Math.max(0, Math.min(5_000, Number(options.reveal ?? 2) * 1000 || 0)),
    hands: [],
    talon: [],
    quartets: [],
    asks: [],
  };
  if (mode === 'trump') {
    state.stacks = dealt.map((cards) => cards.map((card) => ({ card, open: false })));
    return state;
  }
  // Sammeln: Wer schon beim Austeilen ein Quartett hat, legt es sofort ab.
  state.hands = dealt.map((cards) => [...cards].sort());
  state.talon = deck.slice(handOut);
  for (let seat = 0; seat < seats; seat++) layDown(state, seat, []);
  state.turn = nextWithCards(state.hands, seats - 1) ?? 0;
  return state;
}

// ————— gemeinsam —————

/** Der nächste Platz nach `from` (im Kreis, ohne `from` selbst zuerst), der noch Karten hat. */
function nextWithCards(piles: unknown[][], from: SeatId): SeatId | null {
  const n = piles.length;
  for (let k = 1; k <= n; k++) {
    const seat = (from + k) % n;
    if ((piles[seat]?.length ?? 0) > 0) return seat;
  }
  return null;
}

export function currentPlayers(state: QuartettState): Actor[] {
  return result(state) ? [] : [state.turn];
}

export function legalMoves(state: QuartettState, actor: Actor): QuartettMove[] {
  if (actor !== state.turn || result(state)) return [];
  if (state.mode === 'trump') return setOf(state).properties.map((p) => ({ type: 'chooseProperty', property: p.id }));
  return askableCards(state, actor).flatMap((card) => askTargets(state, actor).map((target): QuartettMove => ({ type: 'ask', target, card })));
}

export function applyMove(state: QuartettState, actor: Actor, move: QuartettMove): MoveResult<QuartettState> {
  if (actor !== state.turn || result(state)) throw new Error('Du bist nicht am Zug.');
  if (move.type === 'chooseProperty') {
    if (state.mode !== 'trump') throw new Error('Beim Sammeln wird gefragt, nicht verglichen.');
    return playTrick(state, actor, move.property);
  }
  if (state.mode !== 'collect') throw new Error('Im Trumpf wird verglichen, nicht gefragt.');
  return ask(state, actor, move.target, move.card);
}

export function result(state: QuartettState): Result | null {
  if (state.mode === 'trump') {
    const counts = state.stacks.map((stack) => stack.length);
    const alive = counts.filter((n) => n > 0).length;
    if (alive === 0) return { kind: 'draw', reason: 'cards' };
    if (alive === 1) return { kind: 'win', winners: [counts.findIndex((n) => n > 0)], reason: 'allCards' };
    if (state.roundLimit > 0 && state.round >= state.roundLimit) return mostOf(counts, 'rounds');
    return null;
  }
  if (state.quartets.length < setOf(state).groups.length) return null;
  const counts = state.hands.map((_, seat) => state.quartets.filter((q) => q.seat === seat).length);
  return mostOf(counts, 'quartets');
}

function mostOf(counts: number[], reason: string): Result {
  const best = Math.max(...counts);
  const winners = counts.flatMap((n, seat) => (n === best ? [seat] : []));
  return winners.length === counts.length ? { kind: 'draw', reason } : { kind: 'win', winners, reason };
}

// ————— Trumpf —————

function playTrick(state: QuartettState, chooser: SeatId, propertyId: string): MoveResult<QuartettState> {
  const set = setOf(state);
  const property = set.properties.find((p) => p.id === propertyId);
  if (!property) throw new Error('Diese Eigenschaft gibt es nicht.');
  const plays: Play[] = [];
  const stacks = state.stacks.map((stack, seat) => {
    const top = stack[0];
    if (!top?.card) return stack;
    plays.push({ seat, card: top.card });
    return stack.slice(1);
  });
  const value = (play: Play) => valueOf(set.id, play.card, property.id);
  const best = plays.reduce((a, b) => (compareValues(property, value(b), value(a)) > 0 ? b : a));
  const leaders = plays.filter((play) => compareValues(property, value(play), value(best)) === 0);
  const events: GameEvent[] = [];
  let middle = state.middle;
  let turn = chooser;
  let trick: Trick;

  if (leaders.length === 1) {
    const winner = best.seat;
    // Unter den Stapel: die eigene Karte, dann die der anderen reihum, dann die Mitte.
    const order = [...plays.filter((p) => p.seat >= winner), ...plays.filter((p) => p.seat < winner)].map((p) => p.card);
    const won = [...order, ...middle];
    stacks[winner] = [...stacks[winner]!, ...won.map((card) => ({ card, open: true }))];
    trick = { chooser, property: property.id, plays, winner, cards: won.length };
    middle = [];
    turn = winner;
  } else {
    middle = [...middle, ...plays.map((p) => p.card)];
    trick = { chooser, property: property.id, plays, winner: null, cards: middle.length };
    // Bei Gleichstand wählt derselbe Platz erneut – wenn er noch Karten hat.
    if (stacks[chooser]!.length === 0) turn = nextWithCards(stacks, chooser) ?? chooser;
  }
  events.push({ type: 'trick', ...trick });
  for (const play of plays) if (stacks[play.seat]!.length === 0) events.push({ type: 'out', seat: play.seat });
  return { state: { ...state, stacks, middle, turn, round: state.round + 1, lastTrick: trick }, events };
}

// ————— Sammeln —————

/** Karten, nach denen `seat` fragen darf: fehlende Karten der Gruppen, von denen er etwas hat. */
export function askableCards(state: QuartettState, seat: SeatId): CardId[] {
  const hand = (state.hands[seat] ?? []).filter((c): c is CardId => c !== null);
  const groups = new Set(hand.map(groupOf));
  return setOf(state)
    .cards.map((card) => card.id)
    .filter((card) => groups.has(groupOf(card)) && !hand.includes(card));
}

/** Wen `seat` fragen darf: alle anderen mit Karten. */
export function askTargets(state: QuartettState, seat: SeatId): SeatId[] {
  return state.hands.flatMap((hand, target) => (target !== seat && hand.length > 0 ? [target] : []));
}

/** Legt vollständige Gruppen eines Platzes ab (verändert den übergebenen, frisch kopierten Zustand). */
function layDown(state: QuartettState, seat: SeatId, events: GameEvent[]): void {
  const hand = state.hands[seat]!;
  const counts = new Map<string, number>();
  for (const card of hand) if (card) counts.set(groupOf(card), (counts.get(groupOf(card)) ?? 0) + 1);
  for (const [group, count] of counts) {
    if (count < 4) continue;
    state.hands[seat] = state.hands[seat]!.filter((card) => card === null || groupOf(card) !== group);
    state.quartets = [...state.quartets, { seat, group }];
    events.push({ type: 'quartet', seat, group });
  }
}

/** Wer keine Karten mehr hat, zieht eine vom Stapel, solange dort etwas liegt. */
function refill(state: QuartettState, seat: SeatId, drew: SeatId[], events: GameEvent[]): void {
  if (state.hands[seat]!.length > 0 || state.talon.length === 0) return;
  draw(state, seat, drew, events);
}

function draw(state: QuartettState, seat: SeatId, drew: SeatId[], events: GameEvent[]): void {
  const [card, ...rest] = state.talon;
  if (!card) return;
  state.talon = rest;
  state.hands[seat] = [...state.hands[seat]!, card].sort();
  drew.push(seat);
  events.push({ type: 'drew', seat });
  layDown(state, seat, events);
  refill(state, seat, drew, events);
}

function ask(state: QuartettState, asker: SeatId, target: SeatId, card: CardId): MoveResult<QuartettState> {
  if (!askTargets(state, asker).includes(target)) throw new Error('Diesen Mitspieler kannst du nicht fragen.');
  if (!askableCards(state, asker).includes(card)) throw new Error('Fragen darfst du nur nach fehlenden Karten einer Gruppe, von der du selbst eine hast.');
  const got = state.hands[target]!.includes(card);
  const drew: SeatId[] = [];
  const entry: Ask = { asker, target, card, got, drew };
  const events: GameEvent[] = [{ type: 'asked', asker, target, card, got }];
  const next: QuartettState = { ...state, hands: state.hands.map((hand) => [...hand]) };
  if (!got) {
    // Niete: Der Fragende zieht vom Stapel (falls es einen gibt), der Gefragte ist dran.
    draw(next, asker, drew, events);
    next.turn = target;
  } else {
    next.hands[target] = next.hands[target]!.filter((c) => c !== card);
    next.hands[asker] = [...next.hands[asker]!, card].sort();
    layDown(next, asker, events);
    refill(next, target, drew, events);
    refill(next, asker, drew, events);
    // Wer etwas bekommt, darf weiterfragen – solange er noch Karten hat.
    next.turn = next.hands[asker]!.length > 0 ? asker : (nextWithCards(next.hands, asker) ?? asker);
  }
  next.asks = [...state.asks, entry];
  return { state: next, events };
}

// ————— Sicht und Bots —————

/** Trumpf: Jeder sieht nur die eigene oberste Karte und alles, was offen gewonnen wurde. Sammeln: nur die eigene Hand. */
export function playerView(state: QuartettState, seat: SeatId | 'spectator'): QuartettState {
  if (state.mode === 'trump') {
    return {
      ...state,
      stacks: state.stacks.map((stack, s) => stack.map((entry, i) => (entry.open || (s === seat && i === 0) ? entry : { card: null, open: false }))),
    };
  }
  return { ...state, hands: state.hands.map((hand, s) => (s === seat ? hand : hand.map(() => null))), talon: state.talon.map(() => null) };
}

/** Was öffentlich über die Hände bekannt ist: sichere Besitzer und Plätze, die eine Karte sicher nicht haben. */
export interface CollectKnowledge {
  holder: Map<CardId, SeatId>;
  notAt: Map<CardId, Set<SeatId>>;
}

/** Wertet das Frageprotokoll aus – auf Wunsch nur die letzten `memory` Fragen (vergessliche Bots). */
export function collectKnowledge(view: QuartettState, seat: SeatId, memory = Infinity): CollectKnowledge {
  const holder = new Map<CardId, SeatId>();
  const notAt = new Map<CardId, Set<SeatId>>();
  const asks = Number.isFinite(memory) ? view.asks.slice(-memory) : view.asks;
  for (const entry of asks) {
    if (entry.got) {
      holder.set(entry.card, entry.asker);
      notAt.delete(entry.card);
    } else {
      // Weder der Gefragte noch der Fragende (man fragt nie nach eigenen Karten) hat sie.
      const set = notAt.get(entry.card) ?? new Set<SeatId>();
      set.add(entry.target).add(entry.asker);
      notAt.set(entry.card, set);
    }
    // Wer vom Stapel zieht, kann danach jede unbekannte Karte haben.
    for (const seat of entry.drew) for (const set of notAt.values()) set.delete(seat);
  }
  for (const card of view.hands[seat] ?? []) if (card) holder.set(card, seat);
  return { holder, notAt };
}

/** Karten, die noch auf der Hand von irgendwem sind (nicht abgelegt). */
export function cardsInPlay(state: QuartettState): CardId[] {
  const laid = new Set(state.quartets.map((q) => q.group));
  return setOf(state)
    .cards.map((c) => c.id)
    .filter((card) => !laid.has(groupOf(card)));
}

/** Für Bots: Unbekanntes passend zur Sicht ausfüllen. */
export function sampleHidden(view: QuartettState, seat: SeatId, rng: Rng): QuartettState {
  if (view.mode === 'trump') {
    const seen = new Set<CardId>([...view.middle, ...view.stacks.flatMap((stack) => stack.flatMap((e) => (e.card ? [e.card] : [])))]);
    const pool = rng.shuffle(setOf(view).cards.map((c) => c.id).filter((card) => !seen.has(card)));
    return { ...view, stacks: view.stacks.map((stack) => stack.map((e) => (e.card ? e : { card: pool.pop()!, open: false }))) };
  }
  const { holder, notAt } = collectKnowledge(view, seat);
  for (let attempt = 0; attempt < 30; attempt++) {
    const dealt = dealHidden(view, seat, rng, holder, attempt < 25 ? notAt : new Map());
    if (dealt) return { ...view, ...dealt };
  }
  // Notlösung: ganz ohne Wissen verteilen.
  return { ...view, ...dealHidden(view, seat, rng, new Map(), new Map())! };
}

/** Verteilt die unbekannten Karten auf fremde Hände und den Stapel (der Stapel ist der Platz `n`). */
function dealHidden(view: QuartettState, seat: SeatId, rng: Rng, holder: Map<CardId, SeatId>, notAt: Map<CardId, Set<SeatId>>): { hands: CardId[][]; talon: CardId[] } | null {
  const own = (view.hands[seat] ?? []).filter((c): c is CardId => c !== null);
  const n = view.hands.length;
  const piles: CardId[][] = [...view.hands.map((_, s) => (s === seat ? [...own] : [])), []];
  const room = [...view.hands.map((hand, s) => (s === seat ? 0 : hand.length)), view.talon.length];
  const unknown: CardId[] = [];
  for (const card of cardsInPlay(view)) {
    if (own.includes(card)) continue;
    const owner = holder.get(card);
    if (owner !== undefined && owner !== seat && room[owner]! > 0) {
      piles[owner]!.push(card);
      room[owner]!--;
    } else unknown.push(card);
  }
  // Am stärksten eingeschränkte Karten zuerst verteilen.
  const options = (card: CardId) => room.flatMap((free, s) => (free > 0 && !notAt.get(card)?.has(s) ? [s] : []));
  for (const card of rng.shuffle(unknown).sort((a, b) => (notAt.get(b)?.size ?? 0) - (notAt.get(a)?.size ?? 0))) {
    const seats = options(card);
    if (seats.length === 0) return null;
    // Gewichtet nach freiem Platz, damit große Hände öfter etwas bekommen.
    let pick = rng.next() * seats.reduce((sum, s) => sum + room[s]!, 0);
    const target = seats.find((s) => (pick -= room[s]!) < 0) ?? seats[seats.length - 1]!;
    piles[target]!.push(card);
    room[target]!--;
  }
  return { hands: piles.slice(0, n).map((hand) => hand.sort()), talon: rng.shuffle(piles[n]!) };
}
