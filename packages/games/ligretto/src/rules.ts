/**
 * Die Regeln von Ligretto.
 *
 * Jeder Platz hat ein eigenes Blatt mit 40 Karten (vier Farben, 1–10). Ausgelegt werden ein
 * Ligretto-Stapel mit 10 Karten (oberste offen), eine offene Reihe (5/4/3 Karten bei 2/3/ab 4
 * Plätzen) und der Rest als verdeckte Hand, die man in Dreierschritten auf den eigenen Talon
 * umblättert. Alle spielen gleichzeitig: Die oberste Ligretto-Karte, jede Karte der Reihe und
 * die oberste Talon-Karte dürfen in die Mitte. Dort beginnt jeder Stapel mit einer 1 und wächst
 * in derselben Farbe bis 10; volle Stapel werden abgeräumt. Eine Lücke in der Reihe füllt sofort
 * der Ligretto-Stapel. Wer seinen Ligretto-Stapel leer hat, beendet die Runde.
 *
 * Wertung je Runde: +1 für jede eigene Karte in der Mitte, −2 für jede Karte im Ligretto-Stapel.
 */
import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

export type Suit = 'red' | 'yellow' | 'green' | 'blue';

export const SUITS: readonly Suit[] = ['red', 'yellow', 'green', 'blue'];

export const LIGRETTO_SIZE = 10;
export const TOP_VALUE = 10;

export interface Card {
  /** Eindeutig am Tisch: Besitzer, Farbe, Wert. */
  id: string;
  suit: Suit;
  value: number;
  owner: SeatId;
}

export interface PlayerState {
  /** Index 0 ist die oberste, offene Karte. */
  ligretto: Card[];
  /** Offene Reihe; null nur kurz, wenn der Ligretto-Stapel leer ist. */
  row: (Card | null)[];
  /** Verdeckt, Index 0 wird als Nächstes umgeblättert. */
  hand: Card[];
  /** Offen, die letzte Karte liegt oben. */
  talon: Card[];
  /** Karten, die dieser Platz in der laufenden Runde in die Mitte gelegt hat. */
  played: number;
  /** „Ich komme nicht weiter“ – bis sich in der Mitte etwas tut oder alle festhängen. */
  stuck: boolean;
  /** Wie oft seit der letzten Änderung in der Mitte umgeblättert wurde (für Bots und Hinweise). */
  idleFlips: number;
  /** Nach dem Rundenende: bereit für die nächste Runde. */
  ready: boolean;
}

export interface CenterPile {
  /** Feste Kennung, damit gleichzeitige Züge nicht auf einem anderen Stapel landen. */
  id: number;
  suit: Suit;
  cards: Card[];
}

export type Goal = 'r1' | 'r3' | 'r5' | 'p50' | 'p99';

export interface RoundSummary {
  round: number;
  endedBy: SeatId | null;
  /** Punkte dieser Runde je Platz, dazu die Aufschlüsselung. */
  points: number[];
  played: number[];
  left: number[];
}

export interface LigrettoState {
  phase: 'play' | 'roundEnd' | 'gameEnd';
  players: PlayerState[];
  center: CenterPile[];
  /** Abgeräumte volle Stapel (für Bots und die Anzeige der Menge). */
  cleared: Card[];
  nextPileId: number;
  round: number;
  goal: Goal;
  /** 3 = klassisch, 1 = Handkarten einzeln umblättern (leichter). */
  flipCount: number;
  /** Punkte je Platz und Runde. */
  scores: number[][];
  lastRound: RoundSummary | null;
  rng: RngState;
}

export type CardSource = { from: 'ligretto' } | { from: 'talon' } | { from: 'row'; slot: number };

export type LigrettoMove =
  /** `pile` ist die Kennung eines Mittelstapels oder null für einen neuen Stapel (nur mit einer 1). */
  | { type: 'play'; source: CardSource; pile: number | null }
  | { type: 'flip' }
  | { type: 'stuck' }
  | { type: 'ready' };

export const GOALS: { value: Goal; label: string }[] = [
  { value: 'r1', label: 'Eine Runde' },
  { value: 'r3', label: '3 Runden' },
  { value: 'r5', label: '5 Runden' },
  { value: 'p50', label: 'Bis 50 Punkte' },
  { value: 'p99', label: 'Bis 99 Punkte' },
];

export function rowSize(seats: number): number {
  if (seats <= 2) return 5;
  if (seats === 3) return 4;
  return 3;
}

export function fullDeck(owner: SeatId): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (let value = 1; value <= TOP_VALUE; value++) cards.push({ id: `${owner}-${suit}-${value}`, suit, value, owner });
  }
  return cards;
}

function deal(owner: SeatId, seats: number, rng: Rng): PlayerState {
  const deck = rng.shuffle(fullDeck(owner));
  const ligretto = deck.slice(0, LIGRETTO_SIZE);
  const size = rowSize(seats);
  const row = deck.slice(LIGRETTO_SIZE, LIGRETTO_SIZE + size);
  const hand = deck.slice(LIGRETTO_SIZE + size);
  return { ligretto, row, hand, talon: [], played: 0, stuck: false, idleFlips: 0, ready: false };
}

export function setup(seats: number, options: Options, seed: string): LigrettoState {
  const rng = Rng.fromSeed(seed, 'ligretto');
  const goal = (GOALS.some((g) => g.value === options.goal) ? options.goal : 'r3') as Goal;
  return {
    phase: 'play',
    players: Array.from({ length: seats }, (_, seat) => deal(seat, seats, rng)),
    center: [],
    cleared: [],
    nextPileId: 0,
    round: 1,
    goal,
    flipCount: options.flip === 'one' ? 1 : 3,
    scores: Array.from({ length: seats }, () => []),
    lastRound: null,
    rng: rng.state,
  };
}

export function currentPlayers(state: LigrettoState): Actor[] {
  if (state.phase === 'play') return seatsWhere(state, (p) => !p.stuck);
  if (state.phase === 'roundEnd') return seatsWhere(state, (p) => !p.ready);
  return [];
}

function seatsWhere(state: LigrettoState, test: (p: PlayerState) => boolean): SeatId[] {
  const seats: SeatId[] = [];
  state.players.forEach((p, seat) => {
    if (test(p)) seats.push(seat);
  });
  return seats;
}

/** Die Karte an einer Quelle, falls dort eine liegt. */
export function cardAt(player: PlayerState, source: CardSource): Card | null {
  if (source.from === 'ligretto') return player.ligretto[0] ?? null;
  if (source.from === 'talon') return player.talon[player.talon.length - 1] ?? null;
  return player.row[source.slot] ?? null;
}

/** Alle Quellen eines Platzes in fester Reihenfolge: Ligretto, Reihe, Talon. */
export function sources(player: PlayerState): CardSource[] {
  const list: CardSource[] = [{ from: 'ligretto' }];
  player.row.forEach((_, slot) => list.push({ from: 'row', slot }));
  list.push({ from: 'talon' });
  return list;
}

/** Auf welche Stapel passt eine Karte? null steht für einen neuen Stapel. */
export function targetsFor(center: readonly Pick<CenterPile, 'id' | 'suit' | 'cards'>[], card: Pick<Card, 'suit' | 'value'>): (number | null)[] {
  if (card.value === 1) return [null];
  const targets: number[] = [];
  for (const pile of center) {
    if (pile.suit === card.suit && pile.cards.length === card.value - 1) targets.push(pile.id);
  }
  return targets;
}

export function canFlip(player: PlayerState): boolean {
  return player.hand.length > 0 || player.talon.length > 1;
}

export function legalMoves(state: LigrettoState, actor: Actor): LigrettoMove[] {
  if (actor === 'system') return [];
  const player = state.players[actor];
  if (!player) return [];
  if (state.phase === 'roundEnd') return player.ready ? [] : [{ type: 'ready' }];
  if (state.phase !== 'play' || player.stuck) return [];
  const moves: LigrettoMove[] = [];
  for (const source of sources(player)) {
    const card = cardAt(player, source);
    if (!card) continue;
    for (const pile of targetsFor(state.center, card)) moves.push({ type: 'play', source, pile });
  }
  if (canFlip(player)) moves.push({ type: 'flip' });
  moves.push({ type: 'stuck' });
  return moves;
}

/**
 * Gleichzeitiges Spiel: Hat jemand den gewünschten Stapel gerade weitergelegt, landet die Karte
 * auf einem anderen passenden Stapel. Erst wenn sie nirgends mehr passt, ist der Zug ungültig.
 */
export function isLegal(state: LigrettoState, actor: Actor, move: LigrettoMove): boolean {
  if (move.type !== 'play') return legalMoves(state, actor).some((m) => m.type === move.type);
  if (actor === 'system' || state.phase !== 'play') return false;
  const player = state.players[actor];
  if (!player || player.stuck) return false;
  const card = cardAt(player, move.source);
  return card !== null && targetsFor(state.center, card).length > 0;
}

function resolveTarget(state: LigrettoState, card: Card, wanted: number | null): number | null {
  const targets = targetsFor(state.center, card);
  return targets.includes(wanted) ? wanted : targets[0]!;
}

function clonePlayer(p: PlayerState): PlayerState {
  return { ...p, ligretto: [...p.ligretto], row: [...p.row], hand: [...p.hand], talon: [...p.talon] };
}

export function applyMove(state: LigrettoState, actor: Actor, move: LigrettoMove): MoveResult<LigrettoState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist gerade nicht erlaubt.');
  const seat = actor as SeatId;
  const next: LigrettoState = {
    ...state,
    players: state.players.map((p, i) => (i === seat ? clonePlayer(p) : p)),
    center: [...state.center],
    scores: state.scores.map((s) => [...s]),
  };
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

  if (move.type === 'flip') {
    if (player.hand.length === 0) {
      // Talon umdrehen: Die zuerst umgeblätterte Karte kommt wieder als Erste.
      player.hand = player.talon;
      player.talon = [];
      events.push({ type: 'turnedOver', seat });
    }
    const flipped = player.hand.splice(0, state.flipCount);
    player.talon.push(...flipped);
    player.idleFlips++;
    events.push({ type: 'flipped', seat, card: player.talon[player.talon.length - 1] });
    return { state: next, events };
  }

  // Karte in die Mitte
  const { source } = move;
  const card = cardAt(player, source)!;
  if (source.from === 'ligretto') player.ligretto.shift();
  else if (source.from === 'talon') player.talon.pop();
  else player.row[source.slot] = player.ligretto.shift() ?? null;
  player.played++;

  let pileId: number;
  const target = resolveTarget(state, card, move.pile);
  if (target === null) {
    pileId = next.nextPileId++;
    next.center.push({ id: pileId, suit: card.suit, cards: [card] });
  } else {
    pileId = target;
    const index = next.center.findIndex((p) => p.id === pileId);
    const pile = next.center[index]!;
    next.center[index] = { ...pile, cards: [...pile.cards, card] };
  }
  events.push({ type: 'played', seat, card, source, pile: pileId });

  const pile = next.center.find((p) => p.id === pileId)!;
  if (pile.cards.length === TOP_VALUE) {
    next.center = next.center.filter((p) => p.id !== pileId);
    next.cleared = [...next.cleared, ...pile.cards];
    events.push({ type: 'pileCleared', pile: pileId, seat });
  }

  // Neue Karte in der Mitte: Wer festhing, kann vielleicht wieder.
  next.players = next.players.map((p) => (p.stuck || p.idleFlips > 0 ? { ...p, stuck: false, idleFlips: 0 } : p));

  if (next.players[seat]!.ligretto.length === 0) endRound(next, seat, events);
  return { state: next, events };
}

/**
 * Niemand kommt weiter: Alle legen die oberste Ligretto-Karte unter ihren Stapel und die
 * oberste Talon-Karte unter ihre Hand – so taucht beim nächsten Durchblättern anderes auf.
 */
function unjam(state: LigrettoState, events: GameEvent[]): void {
  state.players = state.players.map((p) => {
    const q = clonePlayer(p);
    if (q.ligretto.length > 1) q.ligretto.push(q.ligretto.shift()!);
    if (q.talon.length > 0) q.hand.push(q.talon.pop()!);
    q.stuck = false;
    q.idleFlips = 0;
    return q;
  });
  events.push({ type: 'unjammed' });
}

function endRound(state: LigrettoState, endedBy: SeatId | null, events: GameEvent[]): void {
  const played = state.players.map((p) => p.played);
  const left = state.players.map((p) => p.ligretto.length);
  const points = state.players.map((_, i) => played[i]! - 2 * left[i]!);
  state.scores = state.scores.map((s, i) => [...s, points[i]!]);
  state.lastRound = { round: state.round, endedBy, points, played, left };
  events.push({ type: 'ligretto', seat: endedBy, points });
  state.phase = isGameOver(state) ? 'gameEnd' : 'roundEnd';
  state.players = state.players.map((p) => ({ ...p, stuck: false, idleFlips: 0, ready: false }));
}

function startRound(state: LigrettoState, events: GameEvent[]): void {
  const rng = new Rng(state.rng);
  const seats = state.players.length;
  state.players = state.players.map((_, seat) => deal(seat, seats, rng));
  state.rng = rng.state;
  state.center = [];
  state.cleared = [];
  state.round++;
  state.phase = 'play';
  events.push({ type: 'roundStarted', round: state.round });
}

export function totals(scores: number[][]): number[] {
  return scores.map((s) => s.reduce((a, b) => a + b, 0));
}

function isGameOver(state: LigrettoState): boolean {
  const kind = state.goal[0];
  const n = Number(state.goal.slice(1));
  if (kind === 'r') return state.round >= n;
  return totals(state.scores).some((t) => t >= n);
}

export function result(state: LigrettoState): Result | null {
  if (state.phase !== 'gameEnd') return null;
  const sums = totals(state.scores);
  const best = Math.max(...sums);
  const winners = sums.flatMap((t, i) => (t === best ? [i] : []));
  if (winners.length === sums.length) return { kind: 'draw' };
  return { kind: 'win', winners };
}

/** Was ein Platz von einem Mitspieler sieht – das Gleiche, was am echten Tisch offen liegt. */
export interface PlayerView {
  ligrettoTop: Card | null;
  ligrettoCount: number;
  row: (Card | null)[];
  talonTop: Card | null;
  talonCount: number;
  handCount: number;
  played: number;
  stuck: boolean;
  idleFlips: number;
  ready: boolean;
}

export interface LigrettoView extends Omit<LigrettoState, 'players' | 'rng'> {
  players: PlayerView[];
}

export function viewOfPlayer(p: PlayerState): PlayerView {
  return {
    ligrettoTop: p.ligretto[0] ?? null,
    ligrettoCount: p.ligretto.length,
    row: p.row,
    talonTop: p.talon[p.talon.length - 1] ?? null,
    talonCount: p.talon.length,
    handCount: p.hand.length,
    played: p.played,
    stuck: p.stuck,
    idleFlips: p.idleFlips,
    ready: p.ready,
  };
}

/** Am Tisch ist alles Offene für alle sichtbar; verdeckt bleiben nur Stapel- und Handreihenfolge. */
export function playerView(state: LigrettoState, _seat: SeatId | 'spectator'): LigrettoView {
  const { rng: _rng, players, ...rest } = state;
  return { ...rest, players: players.map(viewOfPlayer) };
}

/** Füllt die verdeckten Karten mit den noch fehlenden Karten des jeweiligen Blatts auf. */
export function sampleHidden(view: LigrettoView, _seat: SeatId, rng: Rng): LigrettoState {
  const seen = new Set<string>();
  for (const pile of view.center) for (const c of pile.cards) seen.add(c.id);
  for (const c of view.cleared) seen.add(c.id);
  const players = view.players.map((p, owner): PlayerState => {
    const visible = [p.ligrettoTop, p.talonTop, ...p.row].filter((c): c is Card => c !== null);
    for (const c of visible) seen.add(c.id);
    const unknown = rng.shuffle(fullDeck(owner).filter((c) => !seen.has(c.id)));
    const take = (n: number) => unknown.splice(0, Math.max(0, n));
    const ligretto = p.ligrettoTop ? [p.ligrettoTop, ...take(p.ligrettoCount - 1)] : [];
    const talonRest = take(p.talonCount - (p.talonTop ? 1 : 0));
    const talon = p.talonTop ? [...talonRest, p.talonTop] : talonRest;
    const hand = take(p.handCount);
    return { ligretto, row: [...p.row], hand, talon, played: p.played, stuck: p.stuck, idleFlips: p.idleFlips, ready: p.ready };
  });
  const { players: _players, ...rest } = view;
  return { ...rest, players, rng: [...rng.state] as RngState };
}
