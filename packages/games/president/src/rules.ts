/**
 * Die Regeln von Präsident (bekannt als „Arschloch“).
 *
 * Alle Karten werden verteilt. Wer den Stich beginnt, legt eine Einzelkarte oder mehrere Karten
 * gleichen Rangs. Reihum legt jeder gleich viele Karten eines höheren Rangs oder passt (Farben
 * sind egal). Passen alle anderen, räumt der Stich ab und wer zuletzt gelegt hat, beginnt neu.
 * Wer zuerst alle Karten los ist, wird Präsident, wer übrig bleibt, Bettler. Ab der zweiten Runde
 * gibt der Bettler dem Präsidenten seine zwei besten Karten und bekommt zwei beliebige zurück
 * (Vize-Bettler und Vize je eine); der Bettler beginnt.
 */
import { Rng, parseDeckStyle, type DeckStyle, cardRank, cardSuit, createDeck, type Actor, type CardId, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

export type DeckChoice = 'auto' | '32' | '52';
export type Titles = 'president' | 'court';

export interface PresidentOptions {
  deck: DeckChoice;
  deckStyle: DeckStyle;
  /** Nur mit 52 Karten: Die 2 ist die höchste Karte, die 3 die niedrigste. */
  twoHigh: boolean;
  /** Wer gepasst hat, darf im selben Stich wieder legen (Standard) – sonst ist er draußen. */
  reenter: boolean;
  /** Gleich legen erlaubt; der Nächste setzt dann aus. */
  sameSkips: boolean;
  /** Eine 8 (oder mehrere) beendet den Stich sofort. */
  eightClears: boolean;
  /** Vier Gleiche kehren die Rangfolge bis zum Rundenende um. */
  revolution: boolean;
  titles: Titles;
  rounds: number;
}

export const DEFAULT_OPTIONS: PresidentOptions = {
  deck: 'auto',
  deckStyle: 'four-color',
  twoHigh: false,
  reenter: true,
  sameSkips: false,
  eightClears: false,
  revolution: false,
  titles: 'president',
  rounds: 5,
};

export const ROUND_CHOICES = [3, 5, 10];

export interface TrickPlay {
  seat: SeatId;
  cards: CardId[];
}

/** Ein Kartentausch zwischen zwei Rundenplätzen. */
export interface Swap {
  /** Wer abgeben muss (Bettler bzw. Vize-Bettler) – die besten Karten gehen automatisch. */
  low: SeatId;
  /** Wer zurückgibt (Präsident bzw. Vize) und die Karten selbst wählt. */
  high: SeatId;
  count: number;
  /** Was der Untere abgegeben hat. */
  up: CardId[];
  /** Was der Obere zurückgegeben hat. */
  down: CardId[];
  done: boolean;
}

export interface RoundSummary {
  round: number;
  /** Plätze in der Reihenfolge, in der sie ausgegangen sind (zuerst der Präsident). */
  order: SeatId[];
  points: number[];
}

export interface PresidentState {
  phase: 'exchange' | 'play' | 'roundEnd' | 'gameEnd';
  options: PresidentOptions;
  /** 32 oder 52 Karten in dieser Partie. */
  deckSize: 32 | 52;
  hands: CardId[][];
  /** Der laufende Stich; die letzte Legung liegt oben. */
  trick: TrickPlay[];
  /** Wer im laufenden Stich gepasst hat. */
  passed: boolean[];
  turn: SeatId;
  /** Reihenfolge, in der diese Runde jemand ausgegangen ist. */
  finished: SeatId[];
  /** Platzierung der letzten Runde je Platz (0 = Präsident), null in der ersten Runde. */
  lastPlace: (number | null)[];
  /** Rangfolge umgekehrt (Revolution). */
  reversed: boolean;
  /** Alle in dieser Runde gelegten Karten. */
  played: CardId[];
  swaps: Swap[];
  scores: number[];
  ready: boolean[];
  round: number;
  lastRound: RoundSummary | null;
  rng: RngState;
}

export type PresidentMove =
  | { type: 'play'; cards: CardId[] }
  | { type: 'pass' }
  | { type: 'give'; cards: CardId[] }
  | { type: 'ready' };

// ── Rangfolge ────────────────────────────────────────────────────────────────

/** Stärke einer Karte ohne Revolution: höher ist besser. Ass 14, mit „2 hoch“ die 2 = 15. */
export function cardValue(card: CardId, twoHigh: boolean): number {
  const rank = cardRank(card);
  if (rank === 1) return 14;
  if (rank === 2 && twoHigh) return 15;
  return rank;
}

type Ranking = Pick<PresidentState, 'options' | 'reversed' | 'deckSize'>;

function valueOf(state: Ranking, card: CardId): number {
  return cardValue(card, state.options.twoHigh && state.deckSize === 52);
}

/** Schlägt Wert `a` den Wert `b`? Mit Revolution gilt die umgekehrte Reihenfolge. */
export function beats(state: Ranking, a: number, b: number): boolean {
  return state.reversed ? a < b : a > b;
}

/** Sortiert Karten von schwach nach stark (unter Beachtung der Revolution). */
export function sortCards(state: Ranking, cards: readonly CardId[]): CardId[] {
  const sign = state.reversed ? -1 : 1;
  return [...cards].sort((a, b) => sign * (valueOf(state, a) - valueOf(state, b)) || a.localeCompare(b));
}

/** Gruppen gleichen Rangs aus einer Hand, von schwach nach stark. */
export function groupsOf(state: Ranking, hand: readonly CardId[]): { value: number; cards: CardId[] }[] {
  const groups = new Map<number, CardId[]>();
  for (const card of sortCards(state, hand)) {
    const v = valueOf(state, card);
    groups.set(v, [...(groups.get(v) ?? []), card]);
  }
  return [...groups.entries()].map(([value, cards]) => ({ value, cards }));
}

export function topPlay(state: Pick<PresidentState, 'trick'>): TrickPlay | undefined {
  return state.trick[state.trick.length - 1];
}

// ── Titel und Punkte ─────────────────────────────────────────────────────────

const TITLES: Record<Titles, { top: string; vice: string; middle: string; viceLow: string; low: string }> = {
  president: { top: 'Präsident', vice: 'Vizepräsident', middle: 'Bürger', viceLow: 'Vize-Bettler', low: 'Bettler' },
  court: { top: 'König', vice: 'Prinz', middle: 'Bürger', viceLow: 'Knecht', low: 'Bettler' },
};

export type PlaceKind = 'top' | 'vice' | 'middle' | 'viceLow' | 'low';

/** Welcher Titel zu einer Platzierung gehört (Vize-Titel erst ab vier Spielern). */
export function placeKind(place: number, players: number): PlaceKind {
  if (place === 0) return 'top';
  if (place === players - 1) return 'low';
  if (players >= 4 && place === 1) return 'vice';
  if (players >= 4 && place === players - 2) return 'viceLow';
  return 'middle';
}

export function placeTitle(place: number, players: number, titles: Titles): string {
  return TITLES[titles][placeKind(place, players)];
}

const POINTS: Record<PlaceKind, number> = { top: 2, vice: 1, middle: 0, viceLow: -1, low: -2 };

export function placePoints(place: number, players: number): number {
  return POINTS[placeKind(place, players)];
}

// ── Aufbau ───────────────────────────────────────────────────────────────────

function deckFor(size: 32 | 52): CardId[] {
  const deck = createDeck();
  return size === 52 ? deck : deck.filter((c) => cardRank(c) === 1 || cardRank(c) >= 7);
}

function parseOptions(options: Options): PresidentOptions {
  const rounds = Number(options.rounds);
  return {
    deck: options.deck === '32' || options.deck === '52' ? options.deck : 'auto',
    deckStyle: parseDeckStyle(options.deckStyle),
    twoHigh: options.twoHigh === 'on',
    reenter: options.passing !== 'out',
    sameSkips: options.sameSkips === 'on',
    eightClears: options.eightClears === 'on',
    revolution: options.revolution === 'on',
    titles: options.titles === 'court' ? 'court' : 'president',
    rounds: ROUND_CHOICES.includes(rounds) ? rounds : DEFAULT_OPTIONS.rounds,
  };
}

export function setup(seats: number, options: Options, seed: string): PresidentState {
  const opts = parseOptions(options);
  const deckSize = opts.deck === '32' ? 32 : opts.deck === '52' ? 52 : seats <= 5 ? 32 : 52;
  const state: PresidentState = {
    phase: 'play',
    options: { ...opts, twoHigh: opts.twoHigh && deckSize === 52 },
    deckSize,
    hands: [],
    trick: [],
    passed: Array.from({ length: seats }, () => false),
    turn: 0,
    finished: [],
    lastPlace: Array.from({ length: seats }, () => null),
    reversed: false,
    played: [],
    swaps: [],
    scores: Array.from({ length: seats }, () => 0),
    ready: Array.from({ length: seats }, () => false),
    round: 1,
    lastRound: null,
    rng: Rng.fromSeed(seed, 'president').state,
  };
  deal(state);
  // Erste Runde: Wer die niedrigste Kreuzkarte hat, beginnt.
  const clubs = sortCards(state, deckFor(deckSize).filter((c) => cardSuit(c) === 'C'));
  state.turn = Math.max(0, state.hands.findIndex((h) => h.includes(clubs[0]!)));
  return state;
}

function deal(state: PresidentState): void {
  const rng = new Rng(state.rng);
  const deck = rng.shuffle(deckFor(state.deckSize));
  state.rng = rng.state;
  const seats = state.hands.length || state.scores.length;
  state.hands = Array.from({ length: seats }, () => []);
  // Reihum austeilen, beginnend links vom Startspieler – bei ungerader Zahl hat er eine Karte weniger.
  deck.forEach((card, i) => state.hands[i % seats]!.push(card));
  for (let s = 0; s < seats; s++) state.hands[s] = sortCards(state, state.hands[s]!);
  state.trick = [];
  state.passed = state.passed.map(() => false);
  state.finished = [];
  state.reversed = false;
  state.played = [];
  state.swaps = [];
}

// ── Wer ist dran? ────────────────────────────────────────────────────────────

/** Noch im Spiel: hat Karten und ist nicht ausgegangen. */
function inPlay(state: PresidentState, seat: SeatId): boolean {
  return state.hands[seat]!.length > 0 && !state.finished.includes(seat);
}

function pendingSwap(state: PresidentState): Swap | undefined {
  return state.swaps.find((s) => !s.done);
}

export function currentPlayers(state: PresidentState): Actor[] {
  if (state.phase === 'play') return [state.turn];
  if (state.phase === 'exchange') {
    const swap = pendingSwap(state);
    return swap ? [swap.high] : [];
  }
  if (state.phase === 'roundEnd') return state.ready.flatMap((r, s) => (r ? [] : [s]));
  return [];
}

/** Prüft eine Legung: alles eigene Karten, gleicher Rang, passt auf den Stich. */
function playOk(state: PresidentState, seat: SeatId, cards: readonly CardId[]): boolean {
  const hand = state.hands[seat]!;
  if (cards.length === 0 || new Set(cards).size !== cards.length) return false;
  if (!cards.every((c) => hand.includes(c))) return false;
  const value = valueOf(state, cards[0]!);
  if (!cards.every((c) => valueOf(state, c) === value)) return false;
  const top = topPlay(state);
  if (!top) return true;
  if (cards.length !== top.cards.length) return false;
  const topValue = valueOf(state, top.cards[0]!);
  return beats(state, value, topValue) || (state.options.sameSkips && value === topValue);
}

export function legalMoves(state: PresidentState, actor: Actor): PresidentMove[] {
  if (actor === 'system' || !currentPlayers(state).includes(actor)) return [];
  if (state.phase === 'roundEnd') return [{ type: 'ready' }];
  const hand = state.hands[actor]!;
  if (state.phase === 'exchange') {
    // Je Kombination eine Möglichkeit (bei zwei Karten alle Paare).
    const swap = pendingSwap(state)!;
    if (swap.count === 1) return hand.map((c) => ({ type: 'give', cards: [c] }));
    const moves: PresidentMove[] = [];
    for (let i = 0; i < hand.length; i++) for (let j = i + 1; j < hand.length; j++) moves.push({ type: 'give', cards: [hand[i]!, hand[j]!] });
    return moves;
  }
  // Legen: je Rang und Anzahl eine Legung (welche Farben, ist egal – `isLegal` nimmt jede).
  const moves: PresidentMove[] = [];
  const top = topPlay(state);
  for (const group of groupsOf(state, hand)) {
    for (let n = 1; n <= group.cards.length; n++) {
      if (top && n !== top.cards.length) continue;
      const cards = group.cards.slice(0, n);
      if (playOk(state, actor, cards)) moves.push({ type: 'play', cards });
    }
  }
  if (top) moves.push({ type: 'pass' });
  return moves;
}

export function isLegal(state: PresidentState, actor: Actor, move: PresidentMove): boolean {
  if (actor === 'system' || !currentPlayers(state).includes(actor)) return false;
  switch (move.type) {
    case 'ready':
      return state.phase === 'roundEnd';
    case 'pass':
      return state.phase === 'play' && state.trick.length > 0;
    case 'play':
      return state.phase === 'play' && Array.isArray(move.cards) && playOk(state, actor, move.cards);
    case 'give': {
      if (state.phase !== 'exchange' || !Array.isArray(move.cards)) return false;
      const swap = pendingSwap(state)!;
      const hand = state.hands[actor]!;
      return move.cards.length === swap.count && new Set(move.cards).size === swap.count && move.cards.every((c) => hand.includes(c));
    }
    default:
      return false;
  }
}

// ── Züge ─────────────────────────────────────────────────────────────────────

function clone(state: PresidentState): PresidentState {
  return {
    ...state,
    hands: state.hands.map((h) => [...h]),
    trick: state.trick.map((p) => ({ ...p, cards: [...p.cards] })),
    passed: [...state.passed],
    finished: [...state.finished],
    lastPlace: [...state.lastPlace],
    played: [...state.played],
    swaps: state.swaps.map((s) => ({ ...s, up: [...s.up], down: [...s.down] })),
    scores: [...state.scores],
    ready: [...state.ready],
  };
}

/** Nächster Platz im Uhrzeigersinn, der noch spielt und (im Stich) nicht gepasst hat. */
function nextActive(state: PresidentState, from: SeatId, skipPassed: boolean): SeatId | null {
  const n = state.hands.length;
  for (let step = 1; step <= n; step++) {
    const seat = (from + step) % n;
    if (inPlay(state, seat) && !(skipPassed && state.passed[seat])) return seat;
  }
  return null;
}

export function applyMove(state: PresidentState, actor: Actor, move: PresidentMove): MoveResult<PresidentState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist gerade nicht erlaubt.');
  const seat = actor as SeatId;
  const next = clone(state);
  const events: GameEvent[] = [];

  if (move.type === 'ready') {
    next.ready[seat] = true;
    if (next.ready.every(Boolean)) startRound(next, events);
    return { state: next, events };
  }

  if (move.type === 'give') {
    const swap = pendingSwap(next)!;
    swap.down = [...move.cards];
    swap.done = true;
    next.hands[seat] = sortCards(next, next.hands[seat]!.filter((c) => !move.cards.includes(c)));
    next.hands[swap.low] = sortCards(next, [...next.hands[swap.low]!, ...move.cards]);
    events.push({ type: 'exchanged', from: seat, to: swap.low, count: swap.count });
    if (!pendingSwap(next)) {
      next.phase = 'play';
      next.turn = next.lastPlace.indexOf(next.hands.length - 1);
    }
    return { state: next, events };
  }

  if (move.type === 'pass') {
    next.passed[seat] = true;
    events.push({ type: 'passed', seat });
    advance(next, seat, events, false);
    return { state: next, events };
  }

  // Legen
  const cards = sortCards(next, move.cards);
  const top = topPlay(next);
  const same = !!top && valueOf(next, cards[0]!) === valueOf(next, top.cards[0]!);
  next.hands[seat] = next.hands[seat]!.filter((c) => !cards.includes(c));
  next.trick.push({ seat, cards });
  next.played.push(...cards);
  if (next.options.reenter) next.passed = next.passed.map(() => false);
  events.push({ type: 'played', seat, cards });

  if (next.options.revolution && cards.length === 4) {
    next.reversed = !next.reversed;
    next.hands = next.hands.map((h) => sortCards(next, h));
    events.push({ type: 'revolution', reversed: next.reversed });
  }

  if (next.hands[seat]!.length === 0) {
    next.finished.push(seat);
    events.push({ type: 'out', seat, place: next.finished.length - 1 });
    const left = next.hands.flatMap((h, s) => (inPlay(next, s) ? [s] : []));
    if (left.length <= 1) {
      endRound(next, events);
      return { state: next, events };
    }
  }

  if (next.options.eightClears && cardRank(cards[0]!) === 8) {
    events.push({ type: 'cleared', seat });
    clearTrick(next, seat, events);
    return { state: next, events };
  }

  advance(next, seat, events, same && next.options.sameSkips);
  return { state: next, events };
}

/** Der Stich ist vorbei: Wer zuletzt gelegt hat, beginnt neu – oder, wenn er ausgegangen ist, sein Nachfolger. */
function clearTrick(state: PresidentState, winner: SeatId, events: GameEvent[]): void {
  state.trick = [];
  state.passed = state.passed.map(() => false);
  state.turn = inPlay(state, winner) ? winner : nextActive(state, winner, false)!;
  events.push({ type: 'trickWon', seat: winner });
}

/** Weiter zum Nächsten – oder Stich abräumen, wenn alle anderen gepasst haben. */
function advance(state: PresidentState, from: SeatId, events: GameEvent[], skip: boolean): void {
  const leader = topPlay(state)!.seat;
  const others = state.hands.flatMap((_, s) => (s !== leader && inPlay(state, s) ? [s] : []));
  if (others.every((s) => state.passed[s])) {
    clearTrick(state, leader, events);
    return;
  }
  let turn = nextActive(state, from, true)!;
  if (skip) {
    // Gleich gelegt: Der Nächste setzt aus (er passt damit nicht).
    events.push({ type: 'skipped', seat: turn });
    turn = nextActive(state, turn, true)!;
  }
  // Wieder beim Leger angekommen: Alle anderen haben gepasst oder ausgesetzt.
  if (turn === leader) {
    clearTrick(state, leader, events);
    return;
  }
  state.turn = turn;
}

function endRound(state: PresidentState, events: GameEvent[]): void {
  const n = state.hands.length;
  for (let s = 0; s < n; s++) if (!state.finished.includes(s)) state.finished.push(s);
  const points = Array.from({ length: n }, () => 0);
  state.finished.forEach((seat, place) => {
    points[seat] = placePoints(place, n);
    state.lastPlace[seat] = place;
  });
  state.scores = state.scores.map((s, i) => s + points[i]!);
  state.lastRound = { round: state.round, order: [...state.finished], points };
  state.trick = [];
  state.ready = state.ready.map(() => false);
  state.phase = state.round >= state.options.rounds ? 'gameEnd' : 'roundEnd';
  events.push({ type: 'roundEnd', order: [...state.finished] });
}

/** Neue Runde: austeilen, Bettler gibt die besten Karten ab, Präsident wählt, was er zurückgibt. */
function startRound(state: PresidentState, events: GameEvent[]): void {
  state.round++;
  deal(state);
  const n = state.hands.length;
  const bySeat = (place: number) => state.lastPlace.indexOf(place);
  const pairs: [number, number, number][] = [[n - 1, 0, 2]];
  if (n >= 4) pairs.push([n - 2, 1, 1]);
  for (const [lowPlace, highPlace, count] of pairs) {
    const low = bySeat(lowPlace);
    const high = bySeat(highPlace);
    const up = sortCards(state, state.hands[low]!).slice(-count);
    state.hands[low] = state.hands[low]!.filter((c) => !up.includes(c));
    state.hands[high] = sortCards(state, [...state.hands[high]!, ...up]);
    state.swaps.push({ low, high, count, up, down: [], done: false });
  }
  state.phase = 'exchange';
  state.turn = bySeat(n - 1);
  state.ready = state.ready.map(() => false);
  events.push({ type: 'roundStarted', round: state.round });
}

export function result(state: PresidentState): Result | null {
  if (state.phase !== 'gameEnd') return null;
  const best = Math.max(...state.scores);
  return { kind: 'win', winners: state.scores.flatMap((s, i) => (s === best ? [i] : [])) };
}

// ── Sicht ────────────────────────────────────────────────────────────────────

export interface PresidentView extends Omit<PresidentState, 'hands' | 'rng' | 'swaps'> {
  /** Nur die eigene Hand; fremde Hände sind leer. */
  hands: CardId[][];
  counts: number[];
  /** Tausche dieser Runde: Karten sieht nur, wer daran beteiligt ist. */
  swaps: Swap[];
  viewer: SeatId | 'spectator';
}

export function playerView(state: PresidentState, seat: SeatId | 'spectator'): PresidentView {
  const { rng: _rng, hands, swaps, ...rest } = state;
  return {
    ...rest,
    hands: hands.map((h, s) => (s === seat ? [...h] : [])),
    counts: hands.map((h) => h.length),
    swaps: swaps.map((s) => (s.low === seat || s.high === seat ? { ...s, up: [...s.up], down: [...s.down] } : { ...s, up: [], down: [] })),
    viewer: seat,
  };
}

/** Verteilt die unbekannten Karten zufällig – was man selbst abgegeben hat, liegt beim Empfänger. */
export function sampleHidden(view: PresidentView, seat: SeatId, rng: Rng): PresidentState {
  const own = view.hands[seat] ?? [];
  const played = new Set(view.played);
  const hands: CardId[][] = view.counts.map((_, s) => (s === seat ? [...own] : []));
  const known = new Set<CardId>([...own, ...played]);
  for (const swap of view.swaps) {
    const given = swap.high === seat ? swap.down : swap.low === seat ? swap.up : [];
    const receiver = swap.high === seat ? swap.low : swap.high;
    for (const card of given) {
      if (known.has(card) || hands[receiver]!.length >= view.counts[receiver]!) continue;
      hands[receiver]!.push(card);
      known.add(card);
    }
  }
  const unknown = rng.shuffle(deckFor(view.deckSize).filter((c) => !known.has(c)));
  view.counts.forEach((count, s) => {
    if (s === seat) return;
    while (hands[s]!.length < count) hands[s]!.push(unknown.pop()!);
  });
  const { counts: _counts, viewer: _viewer, ...rest } = view;
  const state: PresidentState = {
    ...rest,
    hands,
    trick: view.trick.map((p) => ({ ...p, cards: [...p.cards] })),
    swaps: view.swaps.map((s) => ({ ...s })),
    rng: [...rng.state] as RngState,
  };
  state.hands = state.hands.map((h) => sortCards(state, h));
  return state;
}
