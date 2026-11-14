/**
 * Die Regeln von Speed (und der Variante Spit) für 2 bis 4 Spieler.
 *
 * Zu zweit: 52 Karten (1 Deck), 2 Ablagestapel und 2 Seitenstapel.
 * Zu dritt/viert: 104 Karten (2 Decks), 4 Ablagestapel und 2 Seitenstapel.
 *
 * Grundform (Speed): Jeder hat bis zu 5 Handkarten und einen verdeckten Nachziehstapel.
 * Nachziehen wahlweise automatisch (`drawMode: 'auto'`) oder aktiv per Antippen (`drawMode: 'manual'`).
 *
 * Variante Spit: Jeder Spieler hat fünf Auslagestapel (1, 2, 3, 4, 5 Karten), deren jeweils oberste
 * Karte offen in `hand` liegt (und die verdeckten Karten darunter in `spitDown`), sowie seinen
 * persönlichen Spit-Vorrat (`draw`), von dem beim „Spit!“/Festfahren aufgedeckt wird.
 */
import { Rng, parseDeckStyle, type DeckStyle, cardRank, createDeck, type Actor, type CardId, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

export const HAND_SIZE = 5;
export const DRAW_SIZE = 15;
export const SIDE_SIZE = 5;

export type Goal = 'r1' | 'b3' | 'b5';
export type SpeedVariant = 'speed' | 'spit';
export type DrawMode = 'auto' | 'manual';

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
  /** Offene Handkarten (bzw. bei Spit die bis zu 5 offenen Spitzen der Auslagestapel). */
  hand: CardId[];
  /** Verdeckter Nachziehstapel, Index 0 wird als Nächstes nachgezogen. */
  draw: CardId[];
  /** Bei Spit: die verdeckten Karten unter den 5 Auslagestapeln (0..4 verdeckte Karten je Slot). */
  spitDown: CardId[][];
  /** „Ich komme nicht weiter“ – bis eine neue Karte in der Mitte liegt. */
  stuck: boolean;
  /** Nach dem Rundenende: bereit für die nächste Runde. */
  ready: boolean;
  wins: number;
}

export interface RoundSummary {
  round: number;
  winner: SeatId;
  /** Karten, die jeder noch hatte (Hand, Nachziehstapel und ggf. verdeckte Spit-Stapel). */
  left: number[];
}

export interface SpeedState {
  phase: 'play' | 'roundEnd' | 'gameEnd';
  variant: SpeedVariant;
  drawMode: DrawMode;
  players: PlayerState[];
  /** Die offenen Ablagestapel (2 bei 2 Spielern, 4 bei 3–4 Spielern); die letzte Karte liegt oben. */
  piles: CardId[][];
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
  /** Eine Handkarte auf einen Ablagestapel. Passt sie dort nicht mehr, landet sie auf einem anderen passenden Stapel. */
  | { type: 'play'; card: CardId; pile: number }
  /** Aktiv eine Karte vom eigenen Nachziehstapel auf die Hand nehmen (bei `drawMode: 'manual'`). */
  | { type: 'draw' }
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
  const out: number[] = [];
  for (let i = 0; i < piles.length; i++) {
    if (fits(card, topOf(piles[i]!), wrap)) out.push(i);
  }
  return out;
}

function deckCountForSeats(seats: number): number {
  return seats > 2 ? 2 : 1;
}

function pileCountForSeats(seats: number): number {
  return seats > 2 ? 4 : 2;
}

function totalCardsLeft(p: Pick<PlayerState, 'hand' | 'draw' | 'spitDown'>): number {
  const down = p.spitDown.reduce((sum, s) => sum + s.length, 0);
  return p.hand.length + p.draw.length + down;
}

function deal(state: Pick<SpeedState, 'players' | 'piles' | 'sides' | 'variant'>, rng: Rng): void {
  const seats = state.players.length;
  const decks = deckCountForSeats(seats);
  const numPiles = pileCountForSeats(seats);
  const deck = rng.shuffle(createDeck(decks));
  const take = (n: number) => deck.splice(0, n);

  if (state.variant === 'spit') {
    // Spit: Jeder erhält 5 Auslagestapel (1..5 Karten: 1 offen in hand, 0..4 verdeckt in spitDown = 15 Karten).
    // Die restlichen Karten werden nach Abzug der Startkarten in der Mitte gleichmäßig auf die Spit-Vorräte (`draw`) verteilt.
    for (const p of state.players) {
      p.hand = [];
      p.spitDown = [];
      for (let col = 0; col < HAND_SIZE; col++) {
        p.hand.push(take(1)[0]!);
        p.spitDown.push(take(col));
      }
      p.stuck = false;
      p.ready = false;
    }
    state.piles = Array.from({ length: numPiles }, () => take(1));
    state.sides = [[], []];
    const perPlayerDraw = Math.floor(deck.length / seats);
    for (const p of state.players) {
      p.draw = take(perPlayerDraw);
    }
    // Falls Restkarten übrig sind (z. B. bei 3 Spielern), in die Seitenstapel legen
    const half = Math.ceil(deck.length / 2);
    state.sides = [deck.splice(0, half), deck.splice(0)];
    return;
  }

  // Klassisches Speed:
  // Bei 2 Spielern: 52 Karten -> je 5 Hand + 15 Draw = 40, plus 2x5 Seitenstapel + 2 Ablagestapel = 52.
  // Bei 3 Spielern (104 Karten, 4 Ablagestapel): 2x5 Seitenstapel + 4 Ablagestapel = 14 -> 90 / 3 = 30 je Spieler (5 Hand + 25 Draw).
  // Bei 4 Spielern (104 Karten, 4 Ablagestapel): 2x6 Seitenstapel + 4 Ablagestapel = 16 -> 88 / 4 = 22 je Spieler (5 Hand + 17 Draw).
  const sideSize = seats === 4 ? 6 : SIDE_SIZE;
  const drawSize = Math.floor((deck.length - numPiles - sideSize * 2) / seats) - HAND_SIZE;
  for (const p of state.players) {
    p.hand = take(HAND_SIZE);
    p.draw = take(drawSize);
    p.spitDown = [];
    p.stuck = false;
    p.ready = false;
  }
  state.sides = [take(sideSize), take(sideSize)];
  state.piles = Array.from({ length: numPiles }, () => take(1));
}

export function setup(seats: number, options: Options, seed: string): SpeedState {
  const rng = Rng.fromSeed(seed, 'speed');
  const goal = (GOALS.some((g) => g.value === options.goal) ? options.goal : 'b3') as Goal;
  const variant: SpeedVariant = options.variant === 'spit' ? 'spit' : 'speed';
  const drawMode: DrawMode = variant === 'spit' ? 'auto' : options.drawMode === 'manual' ? 'manual' : 'auto';
  const state: SpeedState = {
    phase: 'play',
    variant,
    drawMode,
    players: Array.from({ length: seats }, () => ({ hand: [], draw: [], spitDown: [], stuck: false, ready: false, wins: 0 })),
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

export function legalMoves(state: SpeedState | SpeedView, actor: Actor): SpeedMove[] {
  if (actor === 'system') return [];
  const player = state.players[actor];
  if (!player) return [];
  if (state.phase === 'roundEnd') return player.ready ? [] : [{ type: 'ready' }];
  if (state.phase !== 'play' || player.stuck) return [];
  const moves: SpeedMove[] = [...playsFor(state, player.hand)];
  const drawRemaining = 'draw' in player ? player.draw.length : (player as PlayerView).drawCount;
  if (state.variant === 'speed' && state.drawMode === 'manual' && player.hand.length < HAND_SIZE && drawRemaining > 0) {
    moves.push({ type: 'draw' });
  }
  // „Festgefahren“ geht immer – wer eine passende Karte übersieht, verliert nur Zeit.
  moves.push({ type: 'stuck' });
  return moves;
}

/**
 * Gleichzeitiges Spiel: Hat der andere den gewünschten Stapel gerade verändert, landet die Karte
 * auf einem anderen Stapel, wenn sie dort passt. Erst wenn sie nirgends passt, ist der Zug ungültig.
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
    players: state.players.map((p) => ({
      ...p,
      hand: [...p.hand],
      draw: [...p.draw],
      spitDown: p.spitDown.map((col) => [...col]),
    })),
    piles: state.piles.map((p) => [...p]),
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

  if (move.type === 'draw') {
    const card = player.draw.shift()!;
    player.hand.push(card);
    events.push({ type: 'drew', seat, card });
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
  const slotIdx = player.hand.indexOf(move.card);
  next.piles[pile]!.push(move.card);
  events.push({ type: 'played', seat, card: move.card, pile });

  if (next.variant === 'spit') {
    // Bei Spit deckt sich die oberste verdeckte Karte unter dem gespielten Auslagestapel auf.
    const downCol = player.spitDown[slotIdx];
    if (downCol && downCol.length > 0) {
      const revealed = downCol.shift()!;
      player.hand[slotIdx] = revealed;
    } else {
      player.hand.splice(slotIdx, 1);
      player.spitDown.splice(slotIdx, 1);
    }
  } else {
    player.hand.splice(slotIdx, 1);
    if (next.drawMode === 'auto') {
      while (player.hand.length < HAND_SIZE && player.draw.length > 0) {
        player.hand.push(player.draw.shift()!);
      }
    }
  }

  // Neue Karte in der Mitte: Wer festhing, kann vielleicht wieder.
  for (const p of next.players) p.stuck = false;

  const finished =
    next.variant === 'spit'
      ? player.hand.length === 0 && player.spitDown.every((c) => c.length === 0)
      : player.hand.length === 0 && player.draw.length === 0;
  if (finished) endRound(next, seat, events);
  return { state: next, events };
}

/**
 * Keiner kommt weiter:
 * - Im klassischen Speed kommt von den Seitenstapeln (und bei manualDraw ggf. aus den eigenen Nachziehstapeln) eine neue Karte auf die Ablagestapel.
 * - Bei Spit deckt jeder Spieler eine Karte von seinem Spit-Vorrat (`draw`) auf einen Ablagestapel auf.
 * Sind keine verdeckten Vorratskarten mehr da, werden die Ablagestapel ohne ihre obersten Karten gemischt und neu verteilt.
 */
function unjam(state: SpeedState, events: GameEvent[]): void {
  // Beim manuellen Nachziehen füllt „Festgefahren“ zunächst auch unvollständige Hände um 1 Karte auf, falls möglich.
  if (state.variant === 'speed' && state.drawMode === 'manual') {
    let drewAny = false;
    for (const p of state.players) {
      while (p.hand.length < HAND_SIZE && p.draw.length > 0) {
        p.hand.push(p.draw.shift()!);
        drewAny = true;
      }
    }
    if (drewAny) {
      for (const p of state.players) p.stuck = false;
      events.push({ type: 'flipped', cards: [] });
      return;
    }
  }

  if (state.variant === 'spit') {
    const anyDraw = state.players.some((p) => p.draw.length > 0);
    if (!anyDraw) {
      const rng = new Rng(state.rng);
      const rest = rng.shuffle(state.piles.flatMap((pile) => pile.slice(0, -1)));
      state.rng = rng.state;
      state.piles = state.piles.map((pile) => pile.slice(-1));
      const perPlayer = Math.ceil(rest.length / state.players.length);
      for (let i = 0; i < state.players.length; i++) {
        state.players[i]!.draw = rest.slice(i * perPlayer, (i + 1) * perPlayer);
      }
      events.push({ type: 'reshuffled' });
    }
    const cards: (CardId | null)[] = state.piles.map(() => null);
    for (let i = 0; i < state.piles.length; i++) {
      const donor = state.players[i % state.players.length]!;
      const card = donor.draw.shift() ?? state.players.find((p) => p.draw.length > 0)?.draw.shift();
      if (card) {
        state.piles[i]!.push(card);
        cards[i] = card;
      }
    }
    for (const p of state.players) p.stuck = false;
    events.push({ type: 'flipped', cards });
    return;
  }

  if (state.sides[0].length === 0 && state.sides[1].length === 0) {
    const rng = new Rng(state.rng);
    const rest = rng.shuffle(state.piles.flatMap((pile) => pile.slice(0, -1)));
    state.rng = rng.state;
    state.piles = state.piles.map((pile) => pile.slice(-1));
    const half = Math.ceil(rest.length / 2);
    state.sides = [rest.slice(0, half), rest.slice(half)];
    events.push({ type: 'reshuffled' });
  }
  const cards: (CardId | null)[] = state.piles.map(() => null);
  for (let i = 0; i < state.piles.length; i++) {
    const sideIdx = (i % 2) as 0 | 1;
    const card = state.sides[sideIdx].shift() ?? state.sides[(1 - sideIdx) as 0 | 1].shift();
    if (card) {
      state.piles[i]!.push(card);
      cards[i] = card;
    }
  }
  for (const p of state.players) p.stuck = false;
  events.push({ type: 'flipped', cards });
}

function endRound(state: SpeedState, winner: SeatId, events: GameEvent[]): void {
  state.players[winner]!.wins++;
  state.lastRound = { round: state.round, winner, left: state.players.map((p) => totalCardsLeft(p)) };
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
  /** Anzahl verdeckter Karten unter jedem offenen Spit-Slot. */
  spitDownCounts: number[];
  stuck: boolean;
  ready: boolean;
  wins: number;
}

export interface SpeedView extends Omit<SpeedState, 'players' | 'sides' | 'rng'> {
  players: PlayerView[];
  sideCounts: [number, number];
}

/** Verdeckt bleiben nur Nachzieh-, Spit-Unterkarten und Seitenstapel (als Anzahl) sowie der Zufallsstand. */
export function playerView(state: SpeedState, _seat: SeatId | 'spectator'): SpeedView {
  const { rng: _rng, players, sides, ...rest } = state;
  return {
    ...rest,
    piles: state.piles.map((p) => [...p]),
    players: players.map((p) => ({
      hand: [...p.hand],
      drawCount: p.draw.length,
      spitDownCounts: p.spitDown.map((col) => col.length),
      stuck: p.stuck,
      ready: p.ready,
      wins: p.wins,
    })),
    sideCounts: [sides[0].length, sides[1].length],
  };
}

/** Verteilt die unbekannten Karten zufällig auf Nachzieh-, Spit- und Seitenstapel. */
export function sampleHidden(view: SpeedView, _seat: SeatId, rng: Rng): SpeedState {
  const seen = new Set<CardId>([...view.piles.flat(), ...view.players.flatMap((p) => p.hand)]);
  const decks = deckCountForSeats(view.players.length);
  const unknown = rng.shuffle(createDeck(decks).filter((c) => !seen.has(c)));
  const take = (n: number) => unknown.splice(0, Math.max(0, n));
  const players = view.players.map(
    (p): PlayerState => ({
      hand: [...p.hand],
      draw: take(p.drawCount),
      spitDown: p.spitDownCounts.map((count) => take(count)),
      stuck: p.stuck,
      ready: p.ready,
      wins: p.wins,
    }),
  );
  const { players: _players, sideCounts, ...rest } = view;
  return {
    ...rest,
    piles: view.piles.map((p) => [...p]),
    players,
    sides: [take(sideCounts[0]), take(sideCounts[1])],
    rng: [...rng.state] as RngState,
  };
}
