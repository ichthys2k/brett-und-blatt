import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type SeatId } from '@brett-und-blatt/engine';
import { NUMBERS, PACKS, entryIds } from './content';

/** Platz 1 ist die Spielleitung: Sie zieht die Zahlen – und spielt je nach Option mit. */
export const CALLER: SeatId = 0;

export type Goal = 'line' | 'twoLines' | 'corners' | 'full';
export type FalseCall = 'pause' | 'out' | 'none';

export interface BingoCall {
  seat: SeatId;
  valid: boolean;
  /** Laufende Nummer aller Rufe – damit die Oberfläche jeden Ruf genau einmal einblendet. */
  n: number;
}

export interface BingoState {
  /** 'zahlen' oder die Kennung eines Inhaltspakets (Lern-Bingo). */
  content: string;
  /** Kantenlänge der Karte (3, 4 oder 5). */
  size: number;
  goal: Goal;
  autoMark: boolean;
  falseCall: FalseCall;
  /** Hat die Spielleitung eine eigene Karte? */
  callerPlays: boolean;
  /** Wie viele Einträge es insgesamt zu ziehen gibt (75 bei Zahlen). */
  total: number;
  /** Je Platz die Felder zeilenweise: Kennung des Eintrags, null = freies Feld. Leer: keine Karte. */
  cards: (number | null)[][];
  marks: boolean[][];
  /** Die ganze Ziehreihenfolge, beim Start gemischt. In jeder Sicht nur das schon Gezogene. */
  order: number[];
  drawn: number;
  /** Nach einem falschen Bingo: Rufen erst wieder ab dieser Zahl gezogener Einträge. */
  blockedUntil: number[];
  /** Ausgeschieden nach einem falschen Bingo (Option „scheidet aus“). */
  out: boolean[];
  winners: SeatId[];
  lastCall: BingoCall | null;
}

export type BingoMove = { type: 'draw' } | { type: 'mark'; cell: number } | { type: 'bingo' };

/** Alle Reihen einer Karte: waagrecht, senkrecht und die beiden Diagonalen. */
export function linesOf(size: number): number[][] {
  const lines: number[][] = [];
  const range = [...Array(size).keys()];
  for (const r of range) lines.push(range.map((c) => r * size + c));
  for (const c of range) lines.push(range.map((r) => r * size + c));
  lines.push(range.map((i) => i * size + i));
  lines.push(range.map((i) => i * size + (size - 1 - i)));
  return lines;
}

function cornersOf(size: number): number[] {
  return [0, size - 1, size * (size - 1), size * size - 1];
}

/** Hat die Karte ein freies Mittelfeld? Nur bei ungerader Kantenlänge. */
function freeCenter(size: number): number | null {
  return size % 2 === 1 ? (size * size - 1) / 2 : null;
}

function makeCard(content: string, size: number, rng: Rng): (number | null)[] {
  const center = freeCenter(size);
  if (content === NUMBERS) {
    // Spalte B hat 1–15, I 16–30 usw.
    const columns = [...Array(5).keys()].map((c) => rng.shuffle(Array.from({ length: 15 }, (_, i) => c * 15 + i + 1)).slice(0, 5));
    return Array.from({ length: 25 }, (_, i) => (i === center ? null : columns[i % 5]![Math.floor(i / 5)]!));
  }
  const ids = rng.shuffle(entryIds(content));
  let next = 0;
  return Array.from({ length: size * size }, (_, i) => (i === center ? null : ids[next++]!));
}

const cardKey = (card: (number | null)[]) => card.join(',');

export function setup(seats: number, options: Options, seed: string): BingoState {
  const rng = Rng.fromSeed(seed, 'bingo');
  const content = options.content && PACKS[options.content] ? options.content : NUMBERS;
  const size = content === NUMBERS ? 5 : [3, 4, 5].includes(Number(options.size)) ? Number(options.size) : 4;
  const goal: Goal = (['line', 'twoLines', 'corners', 'full'] as const).find((g) => g === options.goal) ?? 'line';
  const falseCall: FalseCall = options.falseCall === 'out' || options.falseCall === 'none' ? options.falseCall : 'pause';
  // Allein muss die Spielleitung mitspielen, sonst gäbe es keine Karte.
  const callerPlays = seats === 1 || options.caller !== 'leads';

  const used = new Set<string>();
  const cards = Array.from({ length: seats }, (_, seat) => {
    if (seat === CALLER && !callerPlays) return [];
    // Jede Karte ist anders – bei kleinen Paketen notfalls ein paar Versuche.
    let card = makeCard(content, size, rng);
    for (let tries = 0; used.has(cardKey(card)) && tries < 50; tries++) card = makeCard(content, size, rng);
    used.add(cardKey(card));
    return card;
  });
  const order = rng.shuffle(entryIds(content));
  return {
    content,
    size,
    goal,
    autoMark: options.marking === 'auto',
    falseCall,
    callerPlays,
    total: order.length,
    cards,
    marks: cards.map((card) => card.map((id) => id === null)),
    order,
    drawn: 0,
    blockedUntil: cards.map(() => 0),
    out: cards.map(() => false),
    winners: [],
    lastCall: null,
  };
}

/** Die schon gezogenen Einträge, in Ziehreihenfolge. */
export function drawnIds(state: Pick<BingoState, 'order' | 'drawn'>): number[] {
  return state.order.slice(0, state.drawn);
}

/**
 * Wie viele Felder einem Platz noch zum Ziel fehlen. `by: 'marks'` zählt nur markierte Felder,
 * die auch gezogen wurden; `by: 'drawn'` alles Gezogene, ob markiert oder nicht.
 */
export function missing(state: BingoState, seat: SeatId, by: 'marks' | 'drawn' = 'marks', drawnSet: Set<number> = new Set(drawnIds(state))): number {
  const card = state.cards[seat] ?? [];
  if (card.length === 0) return Infinity;
  const marks = state.marks[seat] ?? [];
  const done = (i: number) => {
    const id = card[i];
    if (id === null || id === undefined) return true;
    return drawnSet.has(id) && (by === 'drawn' || marks[i] === true);
  };
  const open = (cells: number[]) => cells.filter((i) => !done(i)).length;
  switch (state.goal) {
    case 'line':
      return Math.min(...linesOf(state.size).map(open));
    case 'twoLines': {
      const [a = 0, b = 0] = linesOf(state.size)
        .map(open)
        .sort((x, y) => x - y);
      return a + b;
    }
    case 'corners':
      return open(cornersOf(state.size));
    case 'full':
      return open([...card.keys()]);
  }
}

export function hasCard(state: BingoState, seat: SeatId): boolean {
  return (state.cards[seat]?.length ?? 0) > 0;
}

/** Spielt der Platz (noch) mit einer Karte? */
export function isPlaying(state: BingoState, seat: SeatId): boolean {
  return hasCard(state, seat) && !state.out[seat];
}

/** Darf der Platz „Bingo!“ rufen? Nach einem falschen Ruf erst wieder ab der nächsten Ziehung. */
export function canCall(state: BingoState, seat: SeatId): boolean {
  return isPlaying(state, seat) && (state.drawn >= (state.blockedUntil[seat] ?? 0) || state.drawn === state.total);
}

/** Felder mit gezogenen Einträgen, die noch nicht markiert sind. */
export function unmarkedCells(state: BingoState, seat: SeatId, drawnSet: Set<number> = new Set(drawnIds(state))): number[] {
  const card = state.cards[seat] ?? [];
  const marks = state.marks[seat] ?? [];
  return card.flatMap((id, i) => (id !== null && !marks[i] && drawnSet.has(id) ? [i] : []));
}

/** Hat der Platz als Spieler gerade etwas zu tun – markieren oder ein gültiges Bingo rufen? */
function hasSomethingToDo(state: BingoState, seat: SeatId, drawnSet: Set<number>): boolean {
  if (!isPlaying(state, seat)) return false;
  if (!state.autoMark && unmarkedCells(state, seat, drawnSet).length > 0) return true;
  return canCall(state, seat) && missing(state, seat, 'marks', drawnSet) === 0;
}

/**
 * Alle handeln gleichzeitig. Am Zug ist, wer etwas zu tun hat – sonst würden Bots ständig
 * „nichts“ ziehen. Die Spielleitung ist dabei, solange es etwas zu ziehen gibt.
 */
export function currentPlayers(state: BingoState): Actor[] {
  if (result(state)) return [];
  const drawnSet = new Set(drawnIds(state));
  const seats = state.cards.map((_, seat) => seat).filter((seat) => hasSomethingToDo(state, seat, drawnSet) || (seat === CALLER && state.drawn < state.total));
  return seats;
}

export function legalMoves(state: BingoState, actor: Actor): BingoMove[] {
  if (actor === 'system' || result(state) || actor < 0 || actor >= state.cards.length) return [];
  const moves: BingoMove[] = [];
  if (actor === CALLER && state.drawn < state.total) moves.push({ type: 'draw' });
  const drawnSet = new Set(drawnIds(state));
  if (hasSomethingToDo(state, actor, drawnSet)) {
    if (!state.autoMark) for (const cell of unmarkedCells(state, actor, drawnSet)) moves.push({ type: 'mark', cell });
    if (canCall(state, actor)) moves.push({ type: 'bingo' });
  }
  return moves;
}

export function applyMove(state: BingoState, actor: Actor, move: BingoMove): MoveResult<BingoState> {
  if (actor === 'system' || result(state)) throw new Error('Gerade ist kein Zug möglich.');
  const seat = actor;
  const events: GameEvent[] = [];
  switch (move.type) {
    case 'draw': {
      if (seat !== CALLER || state.drawn >= state.total) throw new Error('Nur die Spielleitung zieht.');
      const id = state.order[state.drawn]!;
      const marks = state.autoMark ? state.cards.map((card, s) => card.map((cell, i) => cell === id || state.marks[s]![i]!)) : state.marks;
      events.push({ type: 'drawn', id, count: state.drawn + 1 });
      return { state: { ...state, drawn: state.drawn + 1, marks }, events };
    }
    case 'mark': {
      if (state.autoMark || !unmarkedCells(state, seat).includes(move.cell)) throw new Error('Dieses Feld kann man nicht markieren.');
      const marks = state.marks.map((row, s) => (s === seat ? row.map((m, i) => m || i === move.cell) : row));
      events.push({ type: 'marked', seat, cell: move.cell });
      return { state: { ...state, marks }, events };
    }
    case 'bingo': {
      if (!legalMoves(state, seat).some((m) => m.type === 'bingo')) throw new Error('Gerade kann man nicht Bingo rufen.');
      const valid = missing(state, seat) === 0;
      const n = (state.lastCall?.n ?? 0) + 1;
      if (valid) {
        // Wer zur selben Ziehung ebenfalls fertig ist, gewinnt mit – auch ohne selbst zu rufen.
        const drawnSet = new Set(drawnIds(state));
        const winners = state.cards.map((_, s) => s).filter((s) => s === seat || (isPlaying(state, s) && missing(state, s, 'drawn', drawnSet) === 0));
        events.push({ type: 'bingo', seat, valid, winners });
        return { state: { ...state, winners, lastCall: { seat, valid, n } }, events };
      }
      const blockedUntil = state.falseCall === 'pause' ? state.blockedUntil.map((b, s) => (s === seat ? state.drawn + 1 : b)) : state.blockedUntil;
      const out = state.falseCall === 'out' ? state.out.map((o, s) => o || s === seat) : state.out;
      events.push({ type: 'bingo', seat, valid, penalty: state.falseCall });
      return { state: { ...state, blockedUntil, out, lastCall: { seat, valid, n } }, events };
    }
  }
}

export function result(state: BingoState): Result | null {
  if (state.winners.length > 0) return { kind: 'win', winners: state.winners, reason: 'bingo' };
  const players = state.cards.map((_, seat) => seat).filter((seat) => hasCard(state, seat));
  if (players.every((seat) => state.out[seat])) return { kind: 'loss', reason: 'out' };
  if (state.drawn < state.total) return null;
  // Alles gezogen und niemand kann mehr etwas tun (z. B. alle anderen ausgeschieden).
  const drawnSet = new Set(drawnIds(state));
  return players.some((seat) => hasSomethingToDo(state, seat, drawnSet)) ? null : { kind: 'loss', reason: 'empty' };
}

/** Eigene Markierungen hört/sieht nur der jeweilige Spieler, damit Mehrspieler-Partien ruhig bleiben. */
export function eventView(event: GameEvent, seat: SeatId | 'spectator'): GameEvent | null {
  if (event.type === 'marked') return event.seat === seat ? event : null;
  return event;
}

/** Die Ziehreihenfolge bleibt geheim: Jede Sicht kennt nur, was schon gezogen ist. Die Karten sind offen. */
export function playerView(state: BingoState, _seat: SeatId | 'spectator'): BingoState {
  return { ...state, order: drawnIds(state) };
}
