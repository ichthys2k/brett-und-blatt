import {
  Rng,
  abstainBallot,
  castBallot,
  cleanEntry,
  findWord,
  initialLetter,
  isValidBallot,
  normalizeWord,
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
import { categoryById, categoryKeys, sprintCatalog, type SprintCategory } from './catalog';

export type SprintPhase = 'write' | 'review' | 'done';
export type StopRule = 'first' | 'all';
export type CheckRule = 'vote' | 'list' | 'trust';

/** Wie eine Antwort nach dem Aufdecken eingestuft ist. */
export type AnswerStatus = 'empty' | 'wrongLetter' | 'known' | 'disputed' | 'unknown' | 'accepted' | 'rejected' | 'trusted';

export interface ReviewEntry {
  seat: SeatId;
  category: number;
}

export interface ScoredAnswer {
  text: string;
  status: AnswerStatus;
  points: number;
  /** Jemand anderes hat dasselbe Wort. */
  shared: boolean;
}

export interface RoundSummary {
  round: number;
  letter: string;
  /** [Platz][Kategorie] */
  answers: ScoredAnswer[][];
  points: number[];
}

export interface SprintState {
  seats: number;
  categoryIds: string[];
  categoryNames: string[];
  /** Buchstaben aller Runden; die Sicht zeigt nur die bisherigen. */
  letters: string[];
  round: number;
  totalRounds: number;
  phase: SprintPhase;
  stopRule: StopRule;
  checkRule: CheckRule;
  /** [Platz][Kategorie] – fremde Antworten sind in der Sicht leer, solange geschrieben wird. */
  answers: string[][];
  /** Wie viele Felder jeder Platz gefüllt hat (immer sichtbar). */
  filled: number[];
  /** Hat abgegeben. */
  finished: boolean[];
  /** Wer „Stopp!“ gerufen hat. */
  stoppedBy: SeatId | null;
  /** In der Auflösung: Einstufung jeder Antwort vor der Abstimmung. */
  status: AnswerStatus[][];
  /** Antworten, über die abgestimmt wird (Reihenfolge der Abstimmungsfragen). */
  disputed: ReviewEntry[];
  /** Abstimmung über die Zweifelsfälle; jeder gibt einen Zettel ab, auch ohne Zweifelsfall (= „Weiter“). */
  vote: VoteBox | null;
  scores: number[];
  lastRound: RoundSummary | null;
}

export type SprintMove =
  | { type: 'answer'; category: number; text: string }
  | { type: 'finish' }
  /** Je Zweifelsfall: 1 = gilt, 0 = gilt nicht, null = Enthaltung. */
  | { type: 'review'; verdicts: (number | null)[] };

/** Buchstaben, zu denen fast jede Kategorie etwas hat. */
export const EASY_LETTERS = 'ABDEFGHKLMNPRSTW'.split('');
/** Alle außer Q, X und Y. */
export const ALL_LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWZ'.split('');

/** Feste Reihenfolge im Paket „Klassisch“. */
const CLASSIC = ['stadt', 'land', 'fluss', 'tier', 'beruf', 'vorname', 'pflanze', 'essen'];

export const options: OptionSpec[] = [
  {
    id: 'pack',
    label: 'Kategorien',
    default: 'classic',
    choices: [
      { value: 'classic', label: 'Klassisch (Stadt, Land, Fluss …)' },
      { value: 'allgemein', label: 'Bunt gemischt' },
      { value: 'tiere', label: 'Tiere' },
      { value: 'bibel', label: 'Bibel' },
      { value: 'mathe', label: 'Mathe Kl. 5/6' },
    ],
  },
  {
    id: 'count',
    label: 'Kategorien je Runde',
    default: '5',
    choices: [
      { value: '3', label: '3' },
      { value: '4', label: '4' },
      { value: '5', label: '5' },
      { value: '6', label: '6' },
    ],
  },
  {
    id: 'rounds',
    label: 'Runden',
    default: '5',
    choices: [
      { value: '3', label: '3' },
      { value: '5', label: '5' },
      { value: '8', label: '8' },
    ],
  },
  {
    id: 'letters',
    label: 'Buchstaben',
    default: 'easy',
    choices: [
      { value: 'easy', label: 'Häufige Buchstaben' },
      { value: 'all', label: 'Alle (ohne Q, X, Y)' },
    ],
  },
  {
    id: 'stop',
    label: 'Rundenende',
    default: 'first',
    choices: [
      { value: 'first', label: '„Stopp!“ beendet die Runde für alle' },
      { value: 'all', label: 'Jeder gibt selbst ab' },
    ],
  },
  {
    id: 'check',
    label: 'Unbekannte Wörter',
    default: 'vote',
    choices: [
      { value: 'vote', label: 'Die Runde stimmt ab' },
      { value: 'list', label: 'Nur Wörter aus der Liste' },
      { value: 'trust', label: 'Alles mit dem richtigen Buchstaben' },
    ],
  },
];

export const timePresets: TimePresets = {
  relaxed: { kind: 'none' },
  normal: { kind: 'perMove', moveMs: 60_000, bankMs: 60_000 },
  fast: { kind: 'perMove', moveMs: 30_000, bankMs: 30_000 },
};

function pickCategories(pack: string, count: number, rng: Rng): SprintCategory[] {
  const all = sprintCatalog().categories;
  if (pack === 'classic') return CLASSIC.slice(0, count).map((id) => categoryById(id)!).filter(Boolean);
  const own = rng.shuffle(all.filter((c) => c.pack === pack));
  const filler = rng.shuffle(all.filter((c) => c.pack === 'allgemein' && !own.includes(c)));
  return [...own, ...filler].slice(0, count);
}

export function setup(seats: number, opts: Options, seed: string): SprintState {
  const rng = Rng.fromSeed(seed, 'kategorien-sprint');
  const count = Math.min(6, Math.max(3, Number(opts.count) || 5));
  const totalRounds = [3, 5, 8].includes(Number(opts.rounds)) ? Number(opts.rounds) : 5;
  const categories = pickCategories(opts.pack ?? 'classic', count, rng);
  const pool = opts.letters === 'all' ? ALL_LETTERS : EASY_LETTERS;
  const letters = rng.shuffle([...pool]).slice(0, totalRounds);
  return {
    seats,
    categoryIds: categories.map((c) => c.id),
    categoryNames: categories.map((c) => c.name),
    letters,
    round: 0,
    totalRounds,
    phase: 'write',
    stopRule: opts.stop === 'all' ? 'all' : 'first',
    checkRule: opts.check === 'list' || opts.check === 'trust' ? opts.check : 'vote',
    answers: emptySheets(seats, categories.length),
    filled: Array.from({ length: seats }, () => 0),
    finished: Array.from({ length: seats }, () => false),
    stoppedBy: null,
    status: [],
    disputed: [],
    vote: null,
    scores: Array.from({ length: seats }, () => 0),
    lastRound: null,
  };
}

function emptySheets(seats: number, count: number): string[][] {
  return Array.from({ length: seats }, () => Array.from({ length: count }, () => ''));
}

export function currentLetter(state: SprintState): string {
  return state.letters[state.round] ?? 'A';
}

export function currentPlayers(state: SprintState): Actor[] {
  if (state.phase === 'write') return state.finished.flatMap((done, seat) => (done ? [] : [seat]));
  if (state.phase === 'review' && state.vote) return state.vote.voters.filter((seat) => state.vote!.ballots[seat] === null);
  return [];
}

/** Ein Wort aus der Liste der Kategorie, das mit dem Buchstaben anfängt (für Beispielzüge und Bots). */
export function wordsFor(categoryId: string, letter: string): string[] {
  return (categoryById(categoryId)?.words ?? []).filter((w) => initialLetter(w) === letter);
}

export function isLegal(state: SprintState, actor: Actor, move: SprintMove): boolean {
  if (typeof actor !== 'number' || !move || typeof move !== 'object') return false;
  if (state.phase === 'write') {
    if (state.finished[actor] !== false) return false;
    if (move.type === 'finish') return true;
    if (move.type !== 'answer') return false;
    if (!Number.isInteger(move.category) || move.category < 0 || move.category >= state.categoryIds.length) return false;
    if (typeof move.text !== 'string') return false;
    return move.text === '' || cleanEntry(move.text) === move.text;
  }
  if (state.phase === 'review' && move.type === 'review' && state.vote) {
    return isValidBallot(state.vote, actor, move.verdicts) && move.verdicts.every((v) => v === null || v === 0 || v === 1);
  }
  return false;
}

export function legalMoves(state: SprintState, actor: Actor): SprintMove[] {
  if (typeof actor !== 'number') return [];
  if (state.phase === 'write') {
    if (state.finished[actor] !== false) return [];
    const letter = currentLetter(state);
    const moves: SprintMove[] = [];
    state.categoryIds.forEach((id, category) => {
      if (state.answers[actor]![category] !== '') return;
      const word = wordsFor(id, letter)[0];
      if (word) moves.push({ type: 'answer', category, text: word });
    });
    moves.push({ type: 'finish' });
    return moves;
  }
  if (state.phase === 'review' && state.vote && state.vote.ballots[actor] === null && state.vote.voters.includes(actor)) {
    const n = state.disputed.length;
    return [
      { type: 'review', verdicts: Array.from({ length: n }, () => 1) },
      { type: 'review', verdicts: Array.from({ length: n }, () => 0) },
      { type: 'review', verdicts: abstainBallot(state.vote) },
    ];
  }
  return [];
}

/** Einstufung beim Aufdecken – unabhängig von der Abstimmung. */
export function classify(text: string, categoryId: string, letter: string, rule: CheckRule): AnswerStatus {
  if (text === '') return 'empty';
  if (initialLetter(text) !== letter) return 'wrongLetter';
  const known = categoryKeys(categoryId).has(normalizeWord(text)) || findWord(text, categoryById(categoryId)?.words ?? []) !== null;
  if (known) return 'known';
  if (rule === 'trust') return 'trusted';
  if (rule === 'list') return 'unknown';
  return 'disputed';
}

function isValid(status: AnswerStatus): boolean {
  return status === 'known' || status === 'accepted' || status === 'trusted';
}

/** Schlüssel, unter dem gleiche Antworten zusammenfallen: das Listenwort oder die normalisierte Eingabe. */
function answerKey(text: string, categoryId: string): string {
  const match = findWord(text, categoryById(categoryId)?.words ?? []);
  return normalizeWord(match ?? text);
}

function startReview(state: SprintState, events: GameEvent[]): SprintState {
  const letter = currentLetter(state);
  // Allein gibt es niemanden, der abstimmt: Dann zählt nur, was in der Liste steht.
  const rule: CheckRule = state.seats === 1 && state.checkRule === 'vote' ? 'list' : state.checkRule;
  const status = state.answers.map((sheet) => sheet.map((text, c) => classify(text, state.categoryIds[c]!, letter, rule)));
  const disputed: ReviewEntry[] = [];
  status.forEach((sheet, seat) => sheet.forEach((s, category) => s === 'disputed' && disputed.push({ seat, category })));
  const voters = Array.from({ length: state.seats }, (_, seat) => seat);
  const vote = openVote(state.seats, voters, {
    items: disputed.length,
    choices: 2,
    secret: true,
    excluded: disputed.map((d) => [d.seat]),
  });
  events.push({ type: 'roundStopped', stoppedBy: state.stoppedBy, letter });
  return { ...state, phase: 'review', status, disputed, vote };
}

function finishReview(state: SprintState, events: GameEvent[]): SprintState {
  const vote = state.vote!;
  // Zweifelsfälle: Mehrheit entscheidet, Gleichstand und keine Stimme gelten für die Antwort.
  const status = state.status.map((sheet) => [...sheet]);
  state.disputed.forEach((entry, item) => {
    status[entry.seat]![entry.category] = voteWinner(vote, item, 1) === 1 ? 'accepted' : 'rejected';
  });

  const answers: ScoredAnswer[][] = state.answers.map((sheet, seat) =>
    sheet.map((text, c) => ({ text, status: status[seat]![c]!, points: 0, shared: false })),
  );
  state.categoryIds.forEach((id, c) => {
    const valid = answers.map((sheet) => sheet[c]!).filter((a) => isValid(a.status));
    const counts = new Map<string, number>();
    for (const a of valid) counts.set(answerKey(a.text, id), (counts.get(answerKey(a.text, id)) ?? 0) + 1);
    for (const a of valid) {
      const n = counts.get(answerKey(a.text, id)) ?? 1;
      a.shared = n > 1;
      a.points = valid.length === 1 ? 20 : n > 1 ? 5 : 10;
    }
  });
  const points = answers.map((sheet) => sheet.reduce((sum, a) => sum + a.points, 0));
  const scores = state.scores.map((s, seat) => s + points[seat]!);
  const lastRound: RoundSummary = { round: state.round + 1, letter: currentLetter(state), answers, points };
  events.push({ type: 'roundScored', points });

  const next = state.round + 1;
  if (next >= state.totalRounds) {
    events.push({ type: 'gameOver' });
    return { ...state, phase: 'done', scores, lastRound, vote, status };
  }
  events.push({ type: 'newLetter', letter: state.letters[next] });
  return {
    ...state,
    round: next,
    phase: 'write',
    answers: emptySheets(state.seats, state.categoryIds.length),
    filled: Array.from({ length: state.seats }, () => 0),
    finished: Array.from({ length: state.seats }, () => false),
    stoppedBy: null,
    status: [],
    disputed: [],
    vote: null,
    scores,
    lastRound,
  };
}

export function applyMove(state: SprintState, actor: Actor, move: SprintMove): MoveResult<SprintState> {
  if (!isLegal(state, actor, move)) throw new Error('Unerlaubter Zug im Kategorien-Sprint.');
  const seat = actor as SeatId;
  const events: GameEvent[] = [];

  if (move.type === 'answer') {
    const answers = state.answers.map((sheet, s) => (s === seat ? sheet.map((t, c) => (c === move.category ? move.text : t)) : sheet));
    const filled = state.filled.map((n, s) => (s === seat ? answers[s]!.filter((t) => t !== '').length : n));
    events.push({ type: 'answered', seat });
    return { state: { ...state, answers, filled }, events };
  }

  if (move.type === 'finish') {
    const complete = state.filled[seat] === state.categoryIds.length;
    let next: SprintState = { ...state, finished: state.finished.map((f, s) => f || s === seat) };
    events.push({ type: 'finished', seat });
    if (state.stopRule === 'first' && complete) {
      next = { ...next, stoppedBy: seat, finished: next.finished.map(() => true) };
      events.push({ type: 'stop', seat });
    }
    if (next.finished.every(Boolean)) next = startReview(next, events);
    return { state: next, events };
  }

  // Abstimmung
  const vote = castBallot(state.vote!, seat, move.verdicts);
  let next: SprintState = { ...state, vote };
  events.push({ type: 'voted', seat });
  if (voteComplete(vote)) next = finishReview(next, events);
  return { state: next, events };
}

export function result(state: SprintState): Result | null {
  if (state.phase !== 'done') return null;
  const best = Math.max(...state.scores);
  return { kind: 'win', winners: state.scores.flatMap((s, seat) => (s === best ? [seat] : [])) };
}

export function playerView(state: SprintState, viewer: SeatId | 'spectator'): SprintState {
  const writing = state.phase === 'write';
  return {
    ...state,
    letters: state.letters.slice(0, state.round + 1),
    answers: writing ? state.answers.map((sheet, seat) => (seat === viewer ? sheet : sheet.map(() => ''))) : state.answers,
    vote: state.vote ? voteView(state.vote, viewer) : null,
  };
}

/** Die Sicht ist schon ein gültiger Stand: Fremde Antworten sind leer, künftige Buchstaben unbekannt. */
export function sampleHidden(view: SprintState, _seat: SeatId, rng: Rng): SprintState {
  const missing = view.totalRounds - view.letters.length;
  const pool = EASY_LETTERS.filter((l) => !view.letters.includes(l));
  return { ...view, letters: [...view.letters, ...rng.shuffle(pool).slice(0, missing)] };
}

export function timeoutMove(state: SprintState, seat: SeatId): SprintMove {
  if (state.phase === 'review' && state.vote) return { type: 'review', verdicts: abstainBallot(state.vote) };
  return { type: 'finish' };
}

