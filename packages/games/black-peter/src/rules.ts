import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';
import { PETER, pairSet } from './content';

export interface Card {
  /** Paar-Nummer; der Schwarze Peter hat PETER (-1). */
  pair: number;
  side: 'a' | 'b';
}

export interface BlackPeterState {
  set: string;
  /** Hände je Platz. In der Sicht sind fremde Karten null (nur die Anzahl ist bekannt). */
  hands: (Card | null)[][];
  /** Offen abgelegte Paare in der Reihenfolge des Ablegens. */
  discarded: { seat: SeatId; pair: number }[];
  turn: SeatId;
  /** Darf nur einmal pro Zug mischen – sonst endete eine Partie unter Zufallsspielern nie. */
  shuffledThisTurn: boolean;
  /** Zufallsstrom für Mischen und Einsortieren der gezogenen Karte. */
  rng: RngState;
  loser: SeatId | null;
  lastDraw: { from: SeatId; to: SeatId; pair: boolean } | null;
}

export type BlackPeterMove = { type: 'draw'; index: number } | { type: 'shuffle' };

/** Paare aus einer Hand ablegen. */
function removePairs(hand: Card[]): { hand: Card[]; pairs: number[] } {
  const bySide = new Map<number, Card[]>();
  for (const card of hand) bySide.set(card.pair, [...(bySide.get(card.pair) ?? []), card]);
  const pairs = [...bySide].filter(([pair, cards]) => pair !== PETER && cards.length >= 2).map(([pair]) => pair);
  return { hand: hand.filter((card) => !pairs.includes(card.pair)), pairs };
}

export function setup(seats: number, options: Options, seed: string): BlackPeterState {
  const set = pairSet(options.set ?? 'tiere');
  const rng = Rng.fromSeed(seed, 'karten');
  const pairCount = Math.min(Number(options.pairs ?? 12), set.pairs.length);
  const chosen = rng.shuffle(set.pairs.map((_, i) => i)).slice(0, pairCount);
  const deck = rng.shuffle<Card>([...chosen.flatMap((pair): Card[] => [{ pair, side: 'a' }, { pair, side: 'b' }]), { pair: PETER, side: 'a' }]);

  const hands: Card[][] = Array.from({ length: seats }, () => []);
  deck.forEach((card, i) => hands[i % seats]!.push(card));
  const discarded: BlackPeterState['discarded'] = [];
  const cleaned = hands.map((hand, seat) => {
    const { hand: rest, pairs } = removePairs(hand);
    for (const pair of pairs) discarded.push({ seat, pair });
    return rest;
  });
  const state: BlackPeterState = { set: set.id, hands: cleaned, discarded, turn: 0, shuffledThisTurn: false, rng: rng.state, loser: null, lastDraw: null };
  return { ...state, turn: nextWithCards(state, seats - 1) ?? 0 };
}

/** Der nächste Platz nach `from` (im Kreis), der noch Karten hat. */
function nextWithCards(state: Pick<BlackPeterState, 'hands'>, from: SeatId): SeatId | null {
  const n = state.hands.length;
  for (let k = 1; k <= n; k++) {
    const seat = (from + k) % n;
    if ((state.hands[seat]?.length ?? 0) > 0) return seat;
  }
  return null;
}

/** Bei wem zieht, wer am Zug ist? Beim nächsten Mitspieler, der noch Karten hat. */
export function sourceOf(state: Pick<BlackPeterState, 'hands' | 'turn'>): SeatId | null {
  const source = nextWithCards(state, state.turn);
  return source === state.turn ? null : source;
}

export function currentPlayers(state: BlackPeterState): Actor[] {
  return state.loser !== null ? [] : [state.turn];
}

export function legalMoves(state: BlackPeterState, actor: Actor): BlackPeterMove[] {
  if (actor !== state.turn || state.loser !== null) return [];
  const source = sourceOf(state);
  if (source === null) return [];
  const moves: BlackPeterMove[] = (state.hands[source] ?? []).map((_, index) => ({ type: 'draw', index }));
  if (!state.shuffledThisTurn && (state.hands[actor]?.length ?? 0) > 1) moves.push({ type: 'shuffle' });
  return moves;
}

export function applyMove(state: BlackPeterState, actor: Actor, move: BlackPeterMove): MoveResult<BlackPeterState> {
  if (actor !== state.turn || state.loser !== null) throw new Error('Du bist nicht am Zug.');
  const seat = actor as SeatId;
  const rng = new Rng(state.rng);
  const hands = state.hands.map((hand) => [...hand]);

  if (move.type === 'shuffle') {
    if (state.shuffledThisTurn || (hands[seat]?.length ?? 0) < 2) throw new Error('Mischen geht gerade nicht.');
    hands[seat] = rng.shuffle(hands[seat] as Card[]);
    return { state: { ...state, hands, rng: rng.state, shuffledThisTurn: true }, events: [{ type: 'shuffled', seat }] };
  }

  const source = sourceOf(state);
  const sourceHand = source === null ? undefined : hands[source];
  const card = sourceHand?.[move.index];
  if (source === null || !sourceHand || !card) throw new Error('Diese Karte gibt es nicht.');
  sourceHand.splice(move.index, 1);

  // Die gezogene Karte kommt an eine zufällige Stelle – sonst wüssten alle, wo sie steckt.
  const own = hands[seat] as Card[];
  own.splice(rng.int(own.length + 1), 0, card);
  const { hand, pairs } = removePairs(own);
  hands[seat] = hand;
  const discarded = [...state.discarded, ...pairs.map((pair) => ({ seat, pair }))];
  const events: GameEvent[] = [{ type: 'drawn', from: source, to: seat, index: move.index }];
  for (const pair of pairs) events.push({ type: 'discarded', seat, pair });

  const next: BlackPeterState = { ...state, hands, discarded, rng: rng.state, shuffledThisTurn: false, lastDraw: { from: source, to: seat, pair: pairs.length > 0 } };
  const remaining = hands.reduce((sum, h) => sum + h.length, 0);
  if (remaining <= 1) {
    next.loser = hands.findIndex((h) => h.length > 0);
    events.push({ type: 'lost', seat: next.loser });
    return { state: next, events };
  }
  // Weiter geht es bei dem, bei dem gezogen wurde – oder beim nächsten mit Karten.
  next.turn = (hands[source]?.length ?? 0) > 0 ? source : (nextWithCards(next, source) ?? source);
  return { state: next, events };
}

export function result(state: BlackPeterState): Result | null {
  if (state.loser === null) return null;
  return { kind: 'win', winners: state.hands.map((_, seat) => seat).filter((seat) => seat !== state.loser), reason: 'peter' };
}

/** Jeder sieht nur die eigene Hand; von den anderen nur, wie viele Karten sie haben. */
export function playerView(state: BlackPeterState, seat: SeatId | 'spectator'): BlackPeterState {
  return { ...state, hands: state.hands.map((hand, s) => (s === seat ? hand : hand.map(() => null))), rng: [0, 0, 0, 0] };
}

/** Für Bots: unbekannte Karten zufällig auf die fremden Hände verteilen. */
export function sampleHidden(view: BlackPeterState, seat: SeatId, rng: Rng): BlackPeterState {
  const own = (view.hands[seat] ?? []).filter((c): c is Card => c !== null);
  const used = new Set([...own.map((c) => `${c.pair}${c.side}`), ...view.discarded.flatMap((d) => [`${d.pair}a`, `${d.pair}b`])]);
  const hiddenCount = view.hands.reduce((sum, hand, s) => sum + (s === seat ? 0 : hand.length), 0);
  // Welche Paare im Spiel sind, ist nicht bekannt – erfundene Paare tun es für den Bot genauso.
  const pool: Card[] = [{ pair: PETER, side: 'a' }];
  for (let pair = 0; pool.length < hiddenCount + used.size + 1; pair++) {
    for (const side of ['a', 'b'] as const) if (!used.has(`${pair}${side}`)) pool.push({ pair, side });
  }
  const unknown = rng.shuffle(pool.filter((c) => !used.has(`${c.pair}${c.side}`)));
  // Der Peter muss bei den anderen stecken, wenn man ihn nicht selbst hat.
  const hasPeter = own.some((c) => c.pair === PETER);
  const cards = hasPeter ? unknown.filter((c) => c.pair !== PETER) : [{ pair: PETER, side: 'a' as const }, ...unknown.filter((c) => c.pair !== PETER)];
  const shuffled = rng.shuffle(cards.slice(0, hiddenCount));
  let next = 0;
  return { ...view, hands: view.hands.map((hand, s) => (s === seat ? hand : hand.map(() => shuffled[next++] ?? { pair: 999, side: 'a' }))), rng: rng.state };
}
