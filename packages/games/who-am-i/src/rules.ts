import {
  Rng,
  castBallot,
  cleanEntry,
  findWord,
  isValidBallot,
  openVote,
  voteComplete,
  voteView,
  voteWinner,
  type Actor,
  type GameEvent,
  type MoveResult,
  type Options,
  type OptionSpec,
  type Result,
  type SeatId,
  type TimePresets,
  type VoteBox,
} from '@brett-und-blatt/engine';
import { packById, termOf, truthOf, type WhoPack, type WhoTerm } from './catalog';

export type WhoMode = 'catalog' | 'free';
export type WhoPhase = 'ask' | 'answer' | 'done';

/** Antworten: 0 = Ja, 1 = Nein, 2 = Vielleicht. */
export type Answer = 0 | 1 | 2;
export const YES = 0;
export const NO = 1;
export const MAYBE = 2;

export type HistoryEntry =
  /** `question` null: laut gestellte Frage (freier Modus). */
  | { kind: 'ask'; question: string | null; answer: Answer }
  /** `term` null: per Eingabe geraten und falsch – der Text wird nicht gespeichert. */
  | { kind: 'guess'; term: string | null; correct: boolean }
  | { kind: 'pass' };

export interface WhoState {
  seats: number;
  packId: string;
  mode: WhoMode;
  maxTurns: number;
  /** Begriff je Platz; der eigene ist in der Sicht null, bis er erraten ist. */
  terms: (string | null)[];
  solved: boolean[];
  scores: number[];
  turnsTaken: number[];
  turn: SeatId;
  asksThisTurn: number;
  phase: WhoPhase;
  /** Freier Modus: Die anderen beantworten gerade eine Frage. */
  pending: { question: string | null; vote: VoteBox } | null;
  history: HistoryEntry[][];
  /** Reihenfolge, in der Plätze ihren Begriff erraten haben. */
  solveOrder: SeatId[];
}

export type WhoMove =
  | { type: 'ask'; question: string }
  | { type: 'askAloud' }
  | { type: 'guess'; term: string }
  | { type: 'guessText'; text: string }
  | { type: 'pass' }
  | { type: 'answer'; value: Answer | null };

/** Nach so vielen Fragen mit „Ja“ in Folge ist trotzdem der Nächste dran. */
export const MAX_ASKS_PER_TURN = 3;

export const options: OptionSpec[] = [
  {
    id: 'pack',
    label: 'Begriffe',
    default: 'tiere',
    choices: [
      { value: 'tiere', label: 'Tiere' },
      { value: 'berufe', label: 'Berufe' },
      { value: 'bibel', label: 'Personen der Bibel' },
    ],
  },
  {
    id: 'mode',
    label: 'Fragen',
    default: 'catalog',
    choices: [
      { value: 'catalog', label: 'Fragenkatalog (das Spiel antwortet, Bots spielen mit)' },
      { value: 'free', label: 'Frei (laut fragen, die anderen antworten)' },
    ],
  },
  {
    id: 'turns',
    label: 'Züge je Spieler',
    default: '12',
    choices: [
      { value: '8', label: '8 (kurz)' },
      { value: '12', label: '12' },
      { value: '20', label: '20 (lang)' },
    ],
  },
];

export const timePresets: TimePresets = {
  relaxed: { kind: 'none' },
  normal: { kind: 'perMove', moveMs: 45_000, bankMs: 60_000 },
  fast: { kind: 'perMove', moveMs: 20_000, bankMs: 30_000 },
};

export function packOf(state: WhoState): WhoPack {
  return packById(state.packId);
}

export function setup(seats: number, opts: Options, seed: string): WhoState {
  const rng = Rng.fromSeed(seed, 'wer-bin-ich');
  const pack = packById(opts.pack ?? 'tiere');
  const terms = rng.shuffle(pack.terms.map((t) => t.id)).slice(0, seats);
  const maxTurns = [8, 12, 20].includes(Number(opts.turns)) ? Number(opts.turns) : 12;
  return {
    seats,
    packId: pack.id,
    mode: opts.mode === 'free' ? 'free' : 'catalog',
    maxTurns,
    terms,
    solved: Array.from({ length: seats }, () => false),
    scores: Array.from({ length: seats }, () => 0),
    turnsTaken: Array.from({ length: seats }, () => 0),
    turn: rng.int(seats),
    asksThisTurn: 0,
    phase: 'ask',
    pending: null,
    history: Array.from({ length: seats }, () => []),
    solveOrder: [],
  };
}

export function currentPlayers(state: WhoState): Actor[] {
  if (state.phase === 'ask') return [state.turn];
  if (state.phase === 'answer' && state.pending) return state.pending.vote.voters.filter((s) => state.pending!.vote.ballots[s] === null);
  return [];
}

/** Fragen, die dieser Platz noch nicht gestellt hat. */
export function openQuestions(state: WhoState, seat: SeatId): string[] {
  const asked = new Set(state.history[seat]!.flatMap((h) => (h.kind === 'ask' && h.question ? [h.question] : [])));
  return packOf(state).questions.map((q) => q.id).filter((q) => !asked.has(q));
}

export function isLegal(state: WhoState, actor: Actor, move: WhoMove): boolean {
  if (typeof actor !== 'number' || !move || typeof move !== 'object') return false;
  const pack = packOf(state);
  if (state.phase === 'ask') {
    if (actor !== state.turn) return false;
    switch (move.type) {
      case 'ask':
        return openQuestions(state, actor).includes(move.question);
      case 'askAloud':
        return state.mode === 'free';
      case 'guess':
        return state.mode === 'catalog' && pack.terms.some((t) => t.id === move.term);
      case 'guessText':
        return state.mode === 'free' && typeof move.text === 'string' && cleanEntry(move.text) === move.text;
      case 'pass':
        return true;
      default:
        return false;
    }
  }
  if (state.phase === 'answer' && state.pending && move.type === 'answer') {
    return isValidBallot(state.pending.vote, actor, [move.value]);
  }
  return false;
}

export function legalMoves(state: WhoState, actor: Actor): WhoMove[] {
  if (typeof actor !== 'number') return [];
  if (state.phase === 'ask' && actor === state.turn) {
    const moves: WhoMove[] = openQuestions(state, actor).map((question) => ({ type: 'ask', question }));
    if (state.mode === 'free') {
      moves.push({ type: 'askAloud' });
      for (const term of packOf(state).terms.slice(0, 3)) moves.push({ type: 'guessText', text: term.name });
    } else {
      for (const term of packOf(state).terms) moves.push({ type: 'guess', term: term.id });
    }
    moves.push({ type: 'pass' });
    return moves;
  }
  if (state.phase === 'answer' && state.pending && state.pending.vote.voters.includes(actor) && state.pending.vote.ballots[actor] === null) {
    return [YES, NO, MAYBE, null].map((value) => ({ type: 'answer', value: value as Answer | null }));
  }
  return [];
}

/** Nächster Platz, der noch rät und Züge übrig hat – oder null, wenn alle fertig sind. */
function nextSeat(state: WhoState, from: SeatId): SeatId | null {
  for (let i = 1; i <= state.seats; i++) {
    const seat = (from + i) % state.seats;
    if (!state.solved[seat] && state.turnsTaken[seat]! < state.maxTurns) return seat;
  }
  return null;
}

function endTurn(state: WhoState, events: GameEvent[]): WhoState {
  const turnsTaken = state.turnsTaken.map((n, s) => (s === state.turn ? n + 1 : n));
  const after: WhoState = { ...state, turnsTaken, asksThisTurn: 0, phase: 'ask', pending: null };
  const next = nextSeat(after, state.turn);
  if (next === null) {
    events.push({ type: 'gameOver' });
    return { ...after, phase: 'done' };
  }
  events.push({ type: 'nextTurn', seat: next });
  return { ...after, turn: next };
}

function record(state: WhoState, seat: SeatId, entry: HistoryEntry): HistoryEntry[][] {
  return state.history.map((h, s) => (s === seat ? [...h, entry] : h));
}

/** Nach einer Antwort: Bei „Ja“ darf weitergefragt werden (höchstens dreimal), sonst ist der Nächste dran. */
function afterAnswer(state: WhoState, answer: Answer, question: string | null, events: GameEvent[]): WhoState {
  const seat = state.turn;
  const next: WhoState = { ...state, history: record(state, seat, { kind: 'ask', question, answer }), asksThisTurn: state.asksThisTurn + 1, pending: null, phase: 'ask' };
  events.push({ type: 'answered', seat, answer });
  if (answer === YES && next.asksThisTurn < MAX_ASKS_PER_TURN) return next;
  return endTurn(next, events);
}

function solve(state: WhoState, seat: SeatId, entry: HistoryEntry, events: GameEvent[]): WhoState {
  // Je früher, desto mehr: alle übrigen Züge plus einer.
  const points = state.maxTurns - state.turnsTaken[seat]!;
  const next: WhoState = {
    ...state,
    history: record(state, seat, entry),
    solved: state.solved.map((s, i) => s || i === seat),
    scores: state.scores.map((s, i) => (i === seat ? s + points : s)),
    solveOrder: [...state.solveOrder, seat],
  };
  events.push({ type: 'solved', seat, term: state.terms[seat], points });
  return endTurn(next, events);
}

export function applyMove(state: WhoState, actor: Actor, move: WhoMove): MoveResult<WhoState> {
  if (!isLegal(state, actor, move)) throw new Error('Unerlaubter Zug bei Wer bin ich?');
  const seat = actor as SeatId;
  const events: GameEvent[] = [];
  const pack = packOf(state);
  const own = termOf(pack, state.terms[seat] ?? null);

  switch (move.type) {
    case 'ask': {
      if (state.mode === 'catalog') {
        const answer: Answer = own && truthOf(own, move.question) ? YES : NO;
        events.push({ type: 'asked', seat, question: move.question });
        return { state: afterAnswer(state, answer, move.question, events), events };
      }
      return { state: startAnswering(state, move.question, events), events };
    }
    case 'askAloud':
      return { state: startAnswering(state, null, events), events };
    case 'guess': {
      if (move.term === state.terms[seat]) return { state: solve(state, seat, { kind: 'guess', term: move.term, correct: true }, events), events };
      events.push({ type: 'wrongGuess', seat });
      return { state: endTurn({ ...state, history: record(state, seat, { kind: 'guess', term: move.term, correct: false }) }, events), events };
    }
    case 'guessText': {
      if (own && matchesTerm(move.text, own)) return { state: solve(state, seat, { kind: 'guess', term: own.id, correct: true }, events), events };
      events.push({ type: 'wrongGuess', seat });
      return { state: endTurn({ ...state, history: record(state, seat, { kind: 'guess', term: null, correct: false }) }, events), events };
    }
    case 'pass':
      events.push({ type: 'passed', seat });
      return { state: endTurn({ ...state, history: record(state, seat, { kind: 'pass' }) }, events), events };
    case 'answer': {
      const vote = castBallot(state.pending!.vote, seat, [move.value]);
      const next: WhoState = { ...state, pending: { ...state.pending!, vote } };
      events.push({ type: 'voted', seat });
      if (!voteComplete(vote)) return { state: next, events };
      // Mehrheit entscheidet; Gleichstand oder keine Stimme heißt „Vielleicht“.
      const answer = (voteWinner(vote, 0, MAYBE) ?? MAYBE) as Answer;
      return { state: afterAnswer(next, answer, state.pending!.question, events), events };
    }
  }
}

function startAnswering(state: WhoState, question: string | null, events: GameEvent[]): WhoState {
  const voters = Array.from({ length: state.seats }, (_, s) => s).filter((s) => s !== state.turn);
  events.push({ type: 'asked', seat: state.turn, question });
  return { ...state, phase: 'answer', pending: { question, vote: openVote(state.seats, voters, { items: 1, choices: 3, secret: true }) } };
}

/** Passt der geratene Text zum Begriff (Name oder anderer Name, Tippfehler ab fünf Buchstaben erlaubt)? */
export function matchesTerm(text: string, term: WhoTerm): boolean {
  return findWord(text, [term.name, ...(term.aliases ?? [])]) !== null;
}

export function result(state: WhoState): Result | null {
  if (state.phase !== 'done') return null;
  const best = Math.max(...state.scores);
  if (best <= 0) return { kind: 'draw', reason: 'Niemand hat seinen Begriff erraten.' };
  return { kind: 'win', winners: state.scores.flatMap((s, seat) => (s === best ? [seat] : [])) };
}

export function playerView(state: WhoState, viewer: SeatId | 'spectator'): WhoState {
  const hideOwn = typeof viewer === 'number' && state.phase !== 'done' && !state.solved[viewer];
  return {
    ...state,
    terms: hideOwn ? state.terms.map((t, s) => (s === viewer ? null : t)) : state.terms,
    pending: state.pending ? { ...state.pending, vote: voteView(state.pending.vote, viewer) } : null,
  };
}

/**
 * Begriffe, die für diesen Platz noch in Frage kommen: nicht bei anderen vergeben, nicht schon
 * falsch geraten und passend zu allen Ja-/Nein-Antworten auf Katalogfragen.
 */
export function candidates(view: WhoState, seat: SeatId): WhoTerm[] {
  const pack = packOf(view);
  const taken = new Set(view.terms.filter((t, s): t is string => s !== seat && t !== null));
  const history = view.history[seat] ?? [];
  const wrong = new Set(history.flatMap((h) => (h.kind === 'guess' && !h.correct && h.term ? [h.term] : [])));
  return pack.terms.filter(
    (term) =>
      !taken.has(term.id) &&
      !wrong.has(term.id) &&
      history.every((h) => h.kind !== 'ask' || h.question === null || h.answer === MAYBE || truthOf(term, h.question) === (h.answer === YES)),
  );
}

export function sampleHidden(view: WhoState, seat: SeatId, rng: Rng): WhoState {
  if (view.terms[seat] !== null) return view;
  const options = candidates(view, seat);
  const taken = new Set(view.terms.filter((t): t is string => t !== null));
  const fallback = packOf(view).terms.filter((t) => !taken.has(t.id));
  const pick = rng.pick(options.length > 0 ? options : fallback);
  return { ...view, terms: view.terms.map((t, s) => (s === seat ? pick.id : t)) };
}

export function timeoutMove(state: WhoState, _seat: SeatId): WhoMove {
  return state.phase === 'answer' ? { type: 'answer', value: null } : { type: 'pass' };
}
