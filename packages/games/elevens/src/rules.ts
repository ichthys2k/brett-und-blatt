import { Rng, type GameEvent, type MoveResult, type Options, type RngState, type SeatId } from '@brett-und-blatt/engine';

/**
 * Elf zuerst! – Anlegespiel mit 80 Karten (1 bis 20 in vier Farben).
 *
 * Jede Farbe beginnt mit ihrer Elf; danach wird nach oben (12 … 20) und nach unten (10 … 1)
 * angelegt. Wer dran ist, legt beliebig viele passende Karten, mindestens aber eine, wenn er kann.
 * Wer nicht kann, zieht bis zu drei Karten. Wer zuerst keine Karten mehr hat, gewinnt.
 */

export const COLORS = ['r', 'y', 'g', 'b'] as const;
export type Color = (typeof COLORS)[number];
export const LOWEST = 1;
export const HIGHEST = 20;
export const START = 11;
export const HIDDEN = '?';

/** Karte als Text, z. B. „r11“ für die rote Elf. */
export type CardId = string;

export function cardId(color: Color, value: number): CardId {
  return `${color}${value}`;
}
export function colorOf(card: CardId): Color {
  return card[0] as Color;
}
export function valueOf(card: CardId): number {
  return Number(card.slice(1));
}

export function buildDeck(): CardId[] {
  const deck: CardId[] = [];
  for (const color of COLORS) for (let v = LOWEST; v <= HIGHEST; v++) deck.push(cardId(color, v));
  return deck;
}

/** Eine ausgelegte Reihe: niedrigste und höchste Karte. */
export interface Row {
  low: number;
  high: number;
}

export type DrawLimit = 1 | 3 | 'match';

export interface ElevensState {
  seats: number;
  hands: CardId[][];
  stock: CardId[];
  rows: Record<Color, Row | null>;
  turn: SeatId;
  /** Karten, die der Spieler am Zug in diesem Zug schon gelegt hat. */
  played: number;
  /** Karten, die er in diesem Zug schon gezogen hat. */
  drawn: number;
  /** Die Karte, mit der die Partie eröffnet werden muss (rote Elf), sonst null. */
  opening: CardId | null;
  drawLimit: DrawLimit;
  winner: SeatId | null;
  rng: RngState;
}

export type ElevensMove = { type: 'play'; card: CardId } | { type: 'draw' } | { type: 'end' };

/** Handkarten je Spielerzahl: zu zweit 20, sonst 60 Karten gleichmäßig verteilt; der Rest ist der Stapel. */
export function handSize(seats: number): number {
  return seats === 2 ? 20 : Math.floor(60 / seats);
}

/** Reihenfolge der Elfen, mit denen eröffnet wird. */
const OPENING_ORDER: CardId[] = ['r11', 'y11', 'g11', 'b11'];

export function parseDrawLimit(value: unknown): DrawLimit {
  if (value === '1') return 1;
  if (value === 'match') return 'match';
  return 3;
}

export function setup(seats: number, options: Options, seed: string): ElevensState {
  const count = Math.max(2, Math.min(6, Number(seats) || 2));
  const rng = Rng.fromSeed(seed);
  const deck = rng.shuffle(buildDeck());
  const size = handSize(count);
  const hands: CardId[][] = [];
  for (let s = 0; s < count; s++) hands.push(sortHand(deck.splice(0, size)));

  // Wer die rote Elf hat, beginnt mit ihr; liegt sie im Stapel, die gelbe, grüne oder blaue.
  let opening: CardId | null = null;
  let turn = 0;
  const openWithRed = options.start !== 'free';
  if (openWithRed) {
    for (const card of OPENING_ORDER) {
      const holder = hands.findIndex((hand) => hand.includes(card));
      if (holder >= 0) {
        opening = card;
        turn = holder;
        break;
      }
    }
  }

  return {
    seats: count,
    hands,
    stock: deck,
    rows: { r: null, y: null, g: null, b: null },
    turn,
    played: 0,
    drawn: 0,
    opening,
    drawLimit: parseDrawLimit(options.draw),
    winner: null,
    rng: rng.state,
  };
}

/** Sortiert nach Farbe, dann nach Wert. */
export function sortHand(hand: CardId[]): CardId[] {
  return [...hand].sort((a, b) => {
    const byColor = COLORS.indexOf(colorOf(a)) - COLORS.indexOf(colorOf(b));
    return byColor !== 0 ? byColor : valueOf(a) - valueOf(b);
  });
}

/** Passt die Karte an eine der Reihen? */
export function fits(rows: ElevensState['rows'], card: CardId): boolean {
  if (card === HIDDEN) return false;
  const row = rows[colorOf(card)];
  const value = valueOf(card);
  if (!row) return value === START;
  return value === row.low - 1 || value === row.high + 1;
}

export function playableCards(state: ElevensState, seat: SeatId): CardId[] {
  const hand = state.hands[seat] ?? [];
  if (state.opening) return hand.includes(state.opening) ? [state.opening] : [];
  return hand.filter((card) => fits(state.rows, card));
}

function drawAllowed(state: ElevensState): boolean {
  if (state.played > 0 || state.stock.length === 0) return false;
  return state.drawLimit === 'match' || state.drawn < state.drawLimit;
}

export function currentPlayers(state: ElevensState): SeatId[] {
  return state.winner === null ? [state.turn] : [];
}

export function legalMoves(state: ElevensState, seat: SeatId): ElevensMove[] {
  if (state.winner !== null || seat !== state.turn) return [];
  const plays: ElevensMove[] = playableCards(state, seat).map((card) => ({ type: 'play', card }));
  const moves = [...plays];
  // Ohne passende Karte muss gezogen werden; erst wenn das nicht mehr geht, ist der Zug vorbei.
  if (plays.length === 0 && drawAllowed(state)) moves.push({ type: 'draw' });
  if (state.played > 0 || (plays.length === 0 && !drawAllowed(state))) moves.push({ type: 'end' });
  return moves;
}

function passTurn(state: ElevensState): ElevensState {
  return { ...state, turn: (state.turn + 1) % state.seats, played: 0, drawn: 0 };
}

export function applyMove(state: ElevensState, seat: SeatId, move: ElevensMove): MoveResult<ElevensState> {
  const legal = legalMoves(state, seat);
  const isLegal = legal.some((m) => m.type === move.type && (m.type !== 'play' || (move.type === 'play' && m.card === move.card)));
  if (!isLegal) throw new Error('Unzulässiger Zug');
  const events: GameEvent[] = [];

  if (move.type === 'play') {
    const color = colorOf(move.card);
    const value = valueOf(move.card);
    const row = state.rows[color];
    const nextRow: Row = row
      ? { low: Math.min(row.low, value), high: Math.max(row.high, value) }
      : { low: value, high: value };
    const hands = state.hands.map((hand, s) => (s === seat ? hand.filter((c) => c !== move.card) : hand));
    let next: ElevensState = {
      ...state,
      hands,
      rows: { ...state.rows, [color]: nextRow },
      played: state.played + 1,
      opening: null,
    };
    events.push({ type: 'cardPlayed', seat, card: move.card });
    if (hands[seat]!.length === 0) {
      next = { ...next, winner: seat };
      events.push({ type: 'win', seat });
    } else if (legalMoves(next, seat).every((m) => m.type === 'end')) {
      // Passt nichts mehr, endet der Zug von selbst.
      next = passTurn(next);
    }
    return { state: next, events };
  }

  if (move.type === 'draw') {
    const [card, ...stock] = state.stock;
    const hands = state.hands.map((hand, s) => (s === seat ? sortHand([...hand, card!]) : hand));
    let next: ElevensState = { ...state, hands, stock, drawn: state.drawn + 1 };
    events.push({ type: 'cardDrawn', seat });
    // Weder Karte noch weiterer Zug möglich: Der Nächste ist dran.
    if (playableCards(next, seat).length === 0 && !drawAllowed(next)) {
      next = passTurn(next);
      events.push({ type: 'passed', seat });
    }
    return { state: next, events };
  }

  events.push({ type: 'turnEnded', seat });
  return { state: passTurn(state), events };
}

export function timeoutMove(state: ElevensState, seat: SeatId): ElevensMove {
  const moves = legalMoves(state, seat);
  return moves.find((m) => m.type === 'end') ?? moves.find((m) => m.type === 'play') ?? moves[0]!;
}

export function playerView(state: ElevensState, seat: SeatId | 'spectator'): ElevensState {
  const over = state.winner !== null;
  return {
    ...state,
    rng: [0, 0, 0, 0],
    hands: state.hands.map((hand, s) => (over || s === seat ? hand : hand.map(() => HIDDEN))),
    stock: state.stock.map(() => HIDDEN),
  };
}

/** Füllt fremde Hände und den Stapel mit den noch unbekannten Karten auf. */
export function sampleHidden(view: ElevensState, seat: SeatId, rng: Rng): ElevensState {
  const known = new Set<CardId>();
  for (const hand of view.hands) for (const card of hand) if (card !== HIDDEN) known.add(card);
  for (const color of COLORS) {
    const row = view.rows[color];
    if (row) for (let v = row.low; v <= row.high; v++) known.add(cardId(color, v));
  }
  const pool = rng.shuffle(buildDeck().filter((card) => !known.has(card)));
  const hands = view.hands.map((hand, s) =>
    s === seat || !hand.includes(HIDDEN) ? hand : sortHand(hand.map(() => pool.pop()!)),
  );
  return { ...view, hands, stock: pool, rng: rng.state };
}

export function result(state: ElevensState) {
  return state.winner === null ? null : { kind: 'win' as const, winners: [state.winner] };
}
