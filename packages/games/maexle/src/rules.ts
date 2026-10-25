import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

/** Ein Wurf als Zahl: höherer Würfel vorn (4 und 2 ergibt 42), 21 ist das Mäxle. */
export type MaexleValue = number;

export const MAEXLE = 21;

/** Alle Werte von niedrig nach hoch: normale Würfe, Pasche, Mäxle. */
export const RANKING: readonly MaexleValue[] = [31, 32, 41, 42, 43, 51, 52, 53, 54, 61, 62, 63, 64, 65, 11, 22, 33, 44, 55, 66, MAEXLE];

/** Rang eines Werts (0 = niedrigster); -1 für keinen gültigen Wert. */
export function rankOf(value: MaexleValue): number {
  return RANKING.indexOf(value);
}

export function isDouble(value: MaexleValue): boolean {
  return value % 11 === 0;
}

/** Wie viele der 36 Würfe diesen Wert ergeben: Pasche 1, alle anderen (auch das Mäxle) 2. */
export function waysOf(value: MaexleValue): number {
  return isDouble(value) ? 1 : 2;
}

/** Zwei Würfel als Wert. */
export function valueOf(dice: readonly [number, number]): MaexleValue {
  const [a, b] = dice;
  return Math.max(a, b) * 10 + Math.min(a, b);
}

export interface Announcement {
  seat: SeatId;
  value: MaexleValue;
  /** Blind weitergegeben: Der Ansager hat den Wurf unter dem Becher nicht gesehen. */
  blind: boolean;
}

export interface Reveal {
  /** null, wenn ein Mäxle geglaubt und deshalb nicht aufgedeckt wurde. */
  dice: [number, number] | null;
  announcement: Announcement;
  /** Wer angezweifelt (oder das Mäxle geglaubt) hat. */
  challenger: SeatId;
  /** true: Die Ansage stimmte (Wurf mindestens so hoch). */
  truthful: boolean;
  loser: SeatId;
  /** Verlorene Leben bzw. Strafpunkte. */
  amount: number;
  believedMaexle: boolean;
}

export type Phase = 'roll' | 'announce' | 'respond';

export interface MaexleState {
  scoring: 'lives' | 'points';
  /** Startleben bzw. Strafpunkte, bei denen die Partie endet. */
  limit: number;
  /** Was das Anzweifeln eines echten Mäxle kostet. */
  maexleCost: number;
  blind: boolean;
  shake: boolean;
  /** Verlorene Leben bzw. Strafpunkte je Platz. */
  penalties: number[];
  turn: SeatId;
  phase: Phase;
  /** Der Wurf unter dem Becher. In der Sicht nur für den sichtbar, der gewürfelt hat. */
  dice: [number, number] | null;
  rolledBy: SeatId | null;
  /** Ansagen der laufenden Runde, die letzte ist die gültige. */
  history: Announcement[];
  lastReveal: Reveal | null;
  /** Gezählte Runden (für die Oberfläche). */
  round: number;
  /**
   * Aufgedeckte Ansagen je Platz, davon Lügen und Lügen knapp über der Vorgabe – das Bild,
   * das sich Bots von den Mitspielern machen.
   */
  record: { shown: number; lies: number; nearLies: number }[];
  /** Zufallsstrom „Würfel“; in jeder Sicht genullt. */
  rng: RngState;
}

export type MaexleMove =
  | { type: 'roll' }
  | { type: 'announce'; value: MaexleValue }
  | { type: 'believe' }
  | { type: 'doubt' }
  | { type: 'passBlind'; value: MaexleValue };

export function setup(seats: number, options: Options, seed: string): MaexleState {
  return {
    scoring: options.scoring === 'points' ? 'points' : 'lives',
    limit: Math.max(1, Math.min(6, Number(options.lives ?? 3) || 3)),
    maexleCost: options.maexleCost === '1' ? 1 : 2,
    blind: options.blind === 'on',
    shake: options.shake !== 'off',
    penalties: Array.from({ length: seats }, () => 0),
    turn: 0,
    phase: 'roll',
    dice: null,
    rolledBy: null,
    history: [],
    lastReveal: null,
    round: 1,
    record: Array.from({ length: seats }, () => ({ shown: 0, lies: 0, nearLies: 0 })),
    rng: Rng.fromSeed(seed, 'würfel').state,
  };
}

/** Wer noch mitspielt: bei der Wertung nach Leben, wer noch welche hat; bei Strafpunkten alle. */
export function isIn(state: Pick<MaexleState, 'scoring' | 'penalties' | 'limit'>, seat: SeatId): boolean {
  return state.scoring === 'points' || (state.penalties[seat] ?? 0) < state.limit;
}

/** Der nächste Platz nach `from`, der noch mitspielt. */
export function nextIn(state: Pick<MaexleState, 'scoring' | 'penalties' | 'limit'>, from: SeatId): SeatId {
  const n = state.penalties.length;
  for (let k = 1; k <= n; k++) {
    const seat = (from + k) % n;
    if (isIn(state, seat)) return seat;
  }
  return from;
}

export function lastAnnouncement(state: Pick<MaexleState, 'history'>): Announcement | null {
  return state.history[state.history.length - 1] ?? null;
}

/** Alle Werte, die höher sind als die letzte Ansage (ohne Ansage: alle). */
export function valuesAbove(previous: MaexleValue | null): MaexleValue[] {
  const rank = previous === null ? -1 : rankOf(previous);
  return RANKING.slice(rank + 1);
}

export function currentPlayers(state: MaexleState): Actor[] {
  return result(state) ? [] : [state.turn];
}

export function legalMoves(state: MaexleState, actor: Actor): MaexleMove[] {
  if (actor !== state.turn || result(state)) return [];
  const last = lastAnnouncement(state);
  switch (state.phase) {
    case 'roll':
      return [{ type: 'roll' }];
    case 'announce':
      return valuesAbove(last?.value ?? null).map((value) => ({ type: 'announce', value }));
    case 'respond': {
      const moves: MaexleMove[] = [{ type: 'believe' }, { type: 'doubt' }];
      if (state.blind && last) for (const value of valuesAbove(last.value)) moves.push({ type: 'passBlind', value });
      return moves;
    }
  }
}

function rollDice(state: MaexleState): { dice: [number, number]; rng: RngState } {
  const rng = new Rng(state.rng);
  const dice: [number, number] = [rng.int(6) + 1, rng.int(6) + 1];
  return { dice, rng: rng.state };
}

/** Ein Platz verliert Leben bzw. bekommt Strafpunkte; danach beginnt er die neue Runde. */
function endRound(state: MaexleState, reveal: Reveal, events: GameEvent[]): MaexleState {
  const penalties = [...state.penalties];
  penalties[reveal.loser] = Math.min(state.limit, (penalties[reveal.loser] ?? 0) + reveal.amount);
  const record = state.record.map((entry) => ({ ...entry }));
  if (reveal.dice) {
    const entry = record[reveal.announcement.seat]!;
    entry.shown++;
    if (!reveal.truthful) {
      entry.lies++;
      const before = state.history[state.history.length - 2];
      if (rankOf(reveal.announcement.value) === (before ? rankOf(before.value) : -1) + 1) entry.nearLies++;
    }
  }
  const next: MaexleState = { ...state, penalties, record, dice: null, rolledBy: null, history: [], lastReveal: reveal, phase: 'roll', round: state.round + 1 };
  events.push({ type: 'revealed', ...reveal });
  if (!isIn(next, reveal.loser)) events.push({ type: 'out', seat: reveal.loser });
  next.turn = isIn(next, reveal.loser) ? reveal.loser : nextIn(next, reveal.loser);
  return next;
}

export function applyMove(state: MaexleState, actor: Actor, move: MaexleMove): MoveResult<MaexleState> {
  if (actor !== state.turn || result(state)) throw new Error('Du bist nicht am Zug.');
  const seat = actor as SeatId;
  const last = lastAnnouncement(state);
  const events: GameEvent[] = [];
  const higher = (value: MaexleValue) => rankOf(value) >= 0 && rankOf(value) > (last ? rankOf(last.value) : -1);

  switch (move.type) {
    case 'roll': {
      if (state.phase !== 'roll') throw new Error('Gerade wird nicht gewürfelt.');
      const { dice, rng } = rollDice(state);
      events.push({ type: 'rolled', seat });
      return { state: { ...state, dice, rng, rolledBy: seat, phase: 'announce' }, events };
    }
    case 'announce': {
      if (state.phase !== 'announce') throw new Error('Gerade wird nicht angesagt.');
      if (!higher(move.value)) throw new Error('Die Ansage muss höher sein als die vorige.');
      const announcement: Announcement = { seat, value: move.value, blind: false };
      events.push({ type: 'announced', ...announcement });
      return { state: { ...state, history: [...state.history, announcement], turn: nextIn(state, seat), phase: 'respond' }, events };
    }
    case 'passBlind': {
      if (state.phase !== 'respond' || !state.blind || !last) throw new Error('Blind weitergeben geht gerade nicht.');
      if (!higher(move.value)) throw new Error('Die Ansage muss höher sein als die vorige.');
      const announcement: Announcement = { seat, value: move.value, blind: true };
      events.push({ type: 'announced', ...announcement });
      return { state: { ...state, history: [...state.history, announcement], turn: nextIn(state, seat), phase: 'respond' }, events };
    }
    case 'believe': {
      if (state.phase !== 'respond' || !last) throw new Error('Es gibt nichts zu glauben.');
      events.push({ type: 'believed', seat });
      if (last.value === MAEXLE) {
        // Höher als ein Mäxle geht nicht: Wer es glaubt, verliert ein Leben, ohne aufzudecken.
        const reveal: Reveal = { dice: null, announcement: last, challenger: seat, truthful: true, loser: seat, amount: 1, believedMaexle: true };
        return { state: endRound(state, reveal, events), events };
      }
      // Glauben heißt: selbst würfeln, ohne den alten Wurf zu sehen.
      const { dice, rng } = rollDice(state);
      events.push({ type: 'rolled', seat });
      return { state: { ...state, dice, rng, rolledBy: seat, phase: 'announce' }, events };
    }
    case 'doubt': {
      if (state.phase !== 'respond' || !last || !state.dice) throw new Error('Es gibt nichts anzuzweifeln.');
      events.push({ type: 'doubted', seat });
      const actual = valueOf(state.dice);
      const truthful = rankOf(actual) >= rankOf(last.value);
      const amount = truthful && last.value === MAEXLE ? state.maexleCost : 1;
      const reveal: Reveal = { dice: state.dice, announcement: last, challenger: seat, truthful, loser: truthful ? seat : last.seat, amount, believedMaexle: false };
      return { state: endRound(state, reveal, events), events };
    }
  }
}

export function result(state: MaexleState): Result | null {
  const seats = state.penalties.map((_, seat) => seat);
  if (state.scoring === 'points') {
    if (!state.penalties.some((p) => p >= state.limit)) return null;
    const best = Math.min(...state.penalties);
    return { kind: 'win', winners: seats.filter((seat) => state.penalties[seat] === best), reason: 'points' };
  }
  const alive = seats.filter((seat) => isIn(state, seat));
  return alive.length <= 1 ? { kind: 'win', winners: alive, reason: 'lives' } : null;
}

/** Den Wurf unter dem Becher sieht nur, wer ihn gewürfelt hat. */
export function playerView(state: MaexleState, seat: SeatId | 'spectator'): MaexleState {
  return { ...state, dice: seat === state.rolledBy ? state.dice : null, rng: [0, 0, 0, 0] };
}

/** Für Bots: einen unbekannten Wurf unter dem Becher zufällig annehmen. */
export function sampleHidden(view: MaexleState, _seat: SeatId, rng: Rng): MaexleState {
  const dice: [number, number] | null = view.dice ?? (view.rolledBy !== null ? [rng.int(6) + 1, rng.int(6) + 1] : null);
  return { ...view, dice, rng: rng.state };
}
