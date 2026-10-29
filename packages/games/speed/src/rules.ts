/**
 * Die Regeln von Speed.
 *
 * 52 Karten, zwei Spieler. Jeder bekommt 15 Karten als verdeckten Nachziehstapel und 5 auf die
 * Hand. In die Mitte kommen zwei verdeckte Seitenstapel zu je 5 Karten und zwei offene Karten,
 * mit denen die beiden Ablagestapel beginnen (Anordnung 5 – 1 – 1 – 5). Beide legen gleichzeitig
 * Handkarten auf einen Ablagestapel, wenn sie genau einen Rang höher oder niedriger sind (Farbe
 * egal, das Ass ist auf Wunsch rund: K–A–2). Die Hand füllt sich sofort wieder auf fünf auf.
 * Kommt keiner weiter, deckt jeder eine Karte von einem Seitenstapel auf; sind die Seitenstapel
 * leer, werden die Ablagestapel (ohne die obersten Karten) gemischt und neu verteilt.
 * Wer zuerst Hand und Nachziehstapel leer hat, gewinnt die Runde.
 */
import { Rng, parseDeckStyle, type DeckStyle, cardRank, createDeck, type Actor, type CardId, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

export const HAND_SIZE = 5;
export const DRAW_SIZE = 15;
export const SIDE_SIZE = 5;

export type Goal = 'r1' | 'b3' | 'b5';

export const GOALS: { value: Goal; label: string }[] = [
  { value: 'r1', label: 'Eine Runde' },
  { value: 'b3', label: 'Best of 3 (2 Siege)' },
  { value: 'b5', label: 'Best of 5 (3 Siege)' },
];

/** Wie viele Rundensiege die Partie entscheiden. */
export function winsNeeded(goal: Goal): number {
  return goal === 'b5' ? 3 : goal === 'b3' ? 2 : 1;
}

export interface PlayerState {
  /** Höchstens fünf Karten. */
  hand: CardId[];
  /** Verdeckt, Index 0 wird als Nächstes nachgezogen. */
  draw: CardId[];
  /** „Ich komme nicht weiter“ – bis eine neue Karte in der Mitte liegt. */
  stuck: boolean;
  /** Nach dem Rundenende: bereit für die nächste Runde. */
  ready: boolean;
  wins: number;
}

export interface RoundSummary {
  round: number;
  winner: SeatId;
  /** Karten, die jeder noch hatte (Hand und Nachziehstapel). */
  left: number[];
}

export interface SpeedState {
  phase: 'play' | 'roundEnd' | 'gameEnd';
  players: PlayerState[];
  /** Die beiden Ablagestapel; die letzte Karte liegt oben. */
  piles: [CardId[], CardId[]];
  /** Die beiden verdeckten Seitenstapel; Index 0 wird als Nächstes aufgedeckt. */
  sides: [CardId[], CardId[]];
  /** Ass rund: K–A–2 sind Nachbarn. */
  wrap: boolean;
  goal: Goal;
  deckStyle: DeckStyle;
  round: number;
  lastRound: RoundSummary | null;
  rng: RngState;
}

export type SpeedMove =
  /** Eine Handkarte auf Stapel 0 oder 1. Passt sie dort nicht mehr, landet sie auf dem anderen. */
  | { type: 'play'; card: CardId; pile: number }
  | { type: 'stuck' }
  | { type: 'ready' };

/** Passt eine Karte auf eine andere? Genau ein Rang Abstand, mit „Ass rund“ auch K–A. */
export function fits(card: CardId, top: CardId | undefined, wrap: boolean): boolean {
  if (!top) return false;
  const diff = Math.abs(cardRank(card) - cardRank(top));
  return diff === 1 || (wrap && diff === 12);
}

export function topOf(pile: readonly CardId[]): CardId | undefined {
  return pile[pile.length - 1];
}

/** Auf welche Ablagestapel passt eine Karte? */
export function targetsFor(piles: readonly (readonly CardId[])[], card: CardId, wrap: boolean): number[] {
  return [0, 1].filter((i) => fits(card, topOf(piles[i]!), wrap));
}

function deal(state: Pick<SpeedState, 'players' | 'piles' | 'sides'>, rng: Rng): void {
  const deck = rng.shuffle(createDeck());
  const take = (n: number) => deck.splice(0, n);
  for (const p of state.players) {
    p.hand = take(HAND_SIZE);
    p.draw = take(DRAW_SIZE);
    p.stuck = false;
    p.ready = false;
  }
  state.sides = [take(SIDE_SIZE), take(SIDE_SIZE)];
  state.piles = [take(1), take(1)];
}

export function setup(seats: number, options: Options, seed: string): SpeedState {
  const rng = Rng.fromSeed(seed, 'speed');
  const goal = (GOALS.some((g) => g.value === options.goal) ? options.goal : 'b3') as Goal;
  const state: SpeedState = {
    phase: 'play',
    players: Array.from({ length: seats }, () => ({ hand: [], draw: [], stuck: false, ready: false, wins: 0 })),
    piles: [[], []],
    sides: [[], []],
    wrap: options.wrap !== 'off',
    goal,
    deckStyle: parseDeckStyle(options.deck),
    round: 1,
    lastRound: null,
    rng: rng.state,
  };
  deal(state, rng);
  state.rng = rng.state;
  return state;
}

function seatsWhere(state: SpeedState, test: (p: PlayerState) => boolean): SeatId[] {
  return state.players.flatMap((p, seat) => (test(p) ? [seat] : []));
}

export function currentPlayers(state: SpeedState): Actor[] {
  if (state.phase === 'play') return seatsWhere(state, (p) => !p.stuck);
  if (state.phase === 'roundEnd') return seatsWhere(state, (p) => !p.ready);
  return [];
}

export function playsFor(state: Pick<SpeedState, 'piles' | 'wrap'>, hand: readonly CardId[]): SpeedMove[] {
  const moves: SpeedMove[] = [];
  for (const card of hand) for (const pile of targetsFor(state.piles, card, state.wrap)) moves.push({ type: 'play', card, pile });
  return moves;
}

export function legalMoves(state: SpeedState, actor: Actor): SpeedMove[] {
  if (actor === 'system') return [];
  const player = state.players[actor];
  if (!player) return [];
  if (state.phase === 'roundEnd') return player.ready ? [] : [{ type: 'ready' }];
  if (state.phase !== 'play' || player.stuck) return [];
  // „Festgefahren“ geht immer – wer eine passende Karte übersieht, verliert nur Zeit.
  return [...playsFor(state, player.hand), { type: 'stuck' }];
}

/**
 * Gleichzeitiges Spiel: Hat der andere den gewünschten Stapel gerade verändert, landet die Karte
 * auf dem anderen Stapel, wenn sie dort passt. Erst wenn sie nirgends passt, ist der Zug ungültig.
 */
export function isLegal(state: SpeedState, actor: Actor, move: SpeedMove): boolean {
  if (move.type !== 'play') return legalMoves(state, actor).some((m) => m.type === move.type);
  if (actor === 'system' || state.phase !== 'play') return false;
  const player = state.players[actor];
  if (!player || player.stuck || !player.hand.includes(move.card)) return false;
  return targetsFor(state.piles, move.card, state.wrap).length > 0;
}

function clone(state: SpeedState): SpeedState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, hand: [...p.hand], draw: [...p.draw] })),
    piles: [[...state.piles[0]], [...state.piles[1]]],
    sides: [[...state.sides[0]], [...state.sides[1]]],
  };
}

export function applyMove(state: SpeedState, actor: Actor, move: SpeedMove): MoveResult<SpeedState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist gerade nicht erlaubt.');
  const seat = actor as SeatId;
  const next = clone(state);
  const player = next.players[seat]!;
  const events: GameEvent[] = [];

  if (move.type === 'ready') {
    player.ready = true;
    if (next.players.every((p) => p.ready)) startRound(next, events);
    return { state: next, events };
  }

  if (move.type === 'stuck') {
    player.stuck = true;
    events.push({ type: 'stuck', seat });
    if (next.players.every((p) => p.stuck)) unjam(next, events);
    return { state: next, events };
  }

  const targets = targetsFor(next.piles, move.card, next.wrap);
  const pile = targets.includes(move.pile) ? move.pile : targets[0]!;
  player.hand = player.hand.filter((c) => c !== move.card);
  next.piles[pile]!.push(move.card);
  events.push({ type: 'played', seat, card: move.card, pile });
  // Hand sofort wieder auf fünf auffüllen.
  while (player.hand.length < HAND_SIZE && player.draw.length > 0) player.hand.push(player.draw.shift()!);
  // Neue Karte in der Mitte: Wer festhing, kann vielleicht wieder.
  for (const p of next.players) p.stuck = false;

  if (player.hand.length === 0 && player.draw.length === 0) endRound(next, seat, events);
  return { state: next, events };
}

/**
 * Keiner kommt weiter: Von jedem Seitenstapel kommt eine Karte auf den Ablagestapel daneben.
 * Sind beide Seitenstapel leer, werden die Ablagestapel ohne ihre obersten Karten gemischt und
 * als neue Seitenstapel ausgelegt.
 */
function unjam(state: SpeedState, events: GameEvent[]): void {
  if (state.sides[0].length === 0 && state.sides[1].length === 0) {
    const rng = new Rng(state.rng);
    const rest = rng.shuffle([...state.piles[0].slice(0, -1), ...state.piles[1].slice(0, -1)]);
    state.rng = rng.state;
    state.piles = [state.piles[0].slice(-1), state.piles[1].slice(-1)];
    const half = Math.ceil(rest.length / 2);
    state.sides = [rest.slice(0, half), rest.slice(half)];
    events.push({ type: 'reshuffled' });
  }
  const cards: (CardId | null)[] = [null, null];
  for (const i of [0, 1] as const) {
    const card = state.sides[i].shift();
    if (card) {
      state.piles[i].push(card);
      cards[i] = card;
    }
  }
  for (const p of state.players) p.stuck = false;
  events.push({ type: 'flipped', cards });
}

function endRound(state: SpeedState, winner: SeatId, events: GameEvent[]): void {
  state.players[winner]!.wins++;
  state.lastRound = { round: state.round, winner, left: state.players.map((p) => p.hand.length + p.draw.length) };
  events.push({ type: 'speed', seat: winner });
  state.phase = state.players[winner]!.wins >= winsNeeded(state.goal) ? 'gameEnd' : 'roundEnd';
  for (const p of state.players) {
    p.stuck = false;
    p.ready = false;
  }
}

function startRound(state: SpeedState, events: GameEvent[]): void {
  const rng = new Rng(state.rng);
  deal(state, rng);
  state.rng = rng.state;
  state.round++;
  state.phase = 'play';
  events.push({ type: 'roundStarted', round: state.round });
}

export function result(state: SpeedState): Result | null {
  if (state.phase !== 'gameEnd') return null;
  const best = Math.max(...state.players.map((p) => p.wins));
  return { kind: 'win', winners: seatsWhere(state, (p) => p.wins === best) };
}

/**
 * Was alle von einem Spieler sehen. Die Hände liegen offen: Am geteilten Bildschirm sehen sich
 * beide ohnehin in die Karten, und für das Tempo-Spiel verrät die fremde Hand wenig.
 */
export interface PlayerView {
  hand: CardId[];
  drawCount: number;
  stuck: boolean;
  ready: boolean;
  wins: number;
}

export interface SpeedView extends Omit<SpeedState, 'players' | 'sides' | 'rng'> {
  players: PlayerView[];
  sideCounts: [number, number];
}

/** Verdeckt bleiben nur Nachzieh- und Seitenstapel (als Anzahl) und der Zufallsstand. */
export function playerView(state: SpeedState, _seat: SeatId | 'spectator'): SpeedView {
  const { rng: _rng, players, sides, ...rest } = state;
  return {
    ...rest,
    players: players.map((p) => ({
      hand: [...p.hand],
      drawCount: p.draw.length,
      stuck: p.stuck,
      ready: p.ready,
      wins: p.wins,
    })),
    sideCounts: [sides[0].length, sides[1].length],
  };
}

/** Verteilt die unbekannten Karten zufällig auf Nachzieh- und Seitenstapel. */
export function sampleHidden(view: SpeedView, _seat: SeatId, rng: Rng): SpeedState {
  const seen = new Set<CardId>([...view.piles[0], ...view.piles[1], ...view.players.flatMap((p) => p.hand)]);
  const unknown = rng.shuffle(createDeck().filter((c) => !seen.has(c)));
  const take = (n: number) => unknown.splice(0, Math.max(0, n));
  const players = view.players.map(
    (p): PlayerState => ({
      hand: [...p.hand],
      draw: take(p.drawCount),
      stuck: p.stuck,
      ready: p.ready,
      wins: p.wins,
    }),
  );
  const { players: _players, sideCounts, ...rest } = view;
  return {
    ...rest,
    piles: [[...view.piles[0]], [...view.piles[1]]],
    players,
    sides: [take(sideCounts[0]), take(sideCounts[1])],
    rng: [...rng.state] as RngState,
  };
}
