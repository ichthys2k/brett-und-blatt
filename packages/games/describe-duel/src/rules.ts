import {
  Rng,
  cleanEntry,
  findWord,
  forbiddenWordIn,
  rankProposals,
  sameWord,
  teamMembers,
  teamOption,
  teamsFromOptions,
  type Actor,
  type GameEvent,
  type MoveResult,
  type Options,
  type OptionSpec,
  type Result,
  type SeatId,
  type TimePresets,
} from '@brett-und-blatt/engine';
import { duelPack, type DuelPack, type DuelTerm } from './catalog';

export type DuelMode = 'write' | 'speak';
export type DuelPhase = 'block' | 'explain' | 'done';

/** Höchstens so viele Sperrwörter je Begriff (die meistgenannten gelten). */
export const MAX_BLOCKED = 3;
/** Höchstens so viele getippte Hinweise je Begriff. */
export const MAX_CLUES = 8;
/** Länge eines Hinweises in Zeichen. */
export const MAX_CLUE_LENGTH = 40;
/** Rateversuche je Ratendem und Hinweis. */
export const GUESSES_PER_CLUE = 2;

export interface TurnSummary {
  term: string;
  team: number;
  explainer: SeatId;
  blocked: string[];
  outcome: 'guessed' | 'skipped' | 'buzzed';
  points: number;
  /** Wer erraten hat (Schreib-Modus). */
  guessedBy: SeatId | null;
}

export interface DuelState {
  seats: number;
  teams: number[];
  packId: string;
  mode: DuelMode;
  totalTurns: number;
  turnIndex: number;
  /** Reihenfolge der Begriffe (Index im Paket); die Sicht zeigt nur die gespielten. */
  deck: number[];
  /** Aktueller Begriff – in der Sicht null für alle, die raten (und Zuschauer). */
  term: number | null;
  team: number;
  explainer: SeatId;
  /** Je Team: wer als Nächstes erklärt (Index in der Mitgliederliste). */
  rotation: number[];
  phase: DuelPhase;
  /** Sperrwort-Vorschläge je Platz (null: noch nicht abgegeben). Fremde sind in der Sicht leer. */
  proposals: (string[] | null)[];
  blocked: string[];
  clues: string[];
  guesses: { seat: SeatId; text: string; correct: boolean }[];
  /** Ratende, die für diesen Begriff aufgegeben haben. */
  passed: SeatId[];
  scores: number[];
  lastTurn: TurnSummary | null;
}

export type DuelMove =
  | { type: 'block'; words: string[] }
  | { type: 'clue'; text: string }
  | { type: 'guess'; text: string }
  | { type: 'pass' }
  | { type: 'skip' }
  /** Sprech-Modus: Das eigene Team hat erraten (drückt, wer erklärt). */
  | { type: 'correct' }
  /** Sprech-Modus: Ein Sperrwort ist gefallen (das andere Team, auch außer der Reihe, oder wer erklärt). */
  | { type: 'buzz' };

export const options: OptionSpec[] = [
  {
    id: 'pack',
    label: 'Begriffe',
    default: 'alltag',
    choices: [
      { value: 'alltag', label: 'Alltag' },
      { value: 'natur', label: 'Tiere und Natur' },
      { value: 'schule', label: 'Schule und Mathe Kl. 5/6' },
      { value: 'bibel', label: 'Bibel' },
    ],
  },
  {
    id: 'mode',
    label: 'Erklären',
    default: 'write',
    choices: [
      { value: 'write', label: 'Schreiben (online, mit Bots)' },
      { value: 'speak', label: 'Sprechen (am Tisch, im Klassenzimmer)' },
    ],
  },
  {
    id: 'turns',
    label: 'Begriffe je Partie',
    default: '12',
    choices: [
      { value: '8', label: '8' },
      { value: '12', label: '12' },
      { value: '20', label: '20' },
    ],
  },
  teamOption(),
];

export const timePresets: TimePresets = {
  relaxed: { kind: 'none' },
  normal: { kind: 'perMove', moveMs: 45_000, bankMs: 45_000 },
  fast: { kind: 'perMove', moveMs: 25_000, bankMs: 20_000 },
};

export function packOf(state: DuelState): DuelPack {
  return duelPack(state.packId);
}

export function termOf(state: DuelState, index: number | null): DuelTerm | undefined {
  return index === null ? undefined : packOf(state).terms[index];
}

export function setup(seats: number, opts: Options, seed: string): DuelState {
  const rng = Rng.fromSeed(seed, 'umschreibe-duell');
  const pack = duelPack(opts.pack ?? 'alltag');
  const totalTurns = Math.min(pack.terms.length, [8, 12, 20].includes(Number(opts.turns)) ? Number(opts.turns) : 12);
  const deck = rng.shuffle(pack.terms.map((_, i) => i)).slice(0, totalTurns);
  const teams = teamsFromOptions(opts, seats, 2, 2);
  const team = rng.int(2);
  const state: DuelState = {
    seats,
    teams,
    packId: pack.id,
    mode: opts.mode === 'speak' ? 'speak' : 'write',
    totalTurns,
    turnIndex: 0,
    deck,
    term: deck[0]!,
    team,
    explainer: teamMembers(teams, team)[0]!,
    rotation: [0, 0],
    phase: 'block',
    proposals: Array.from({ length: seats }, () => null),
    blocked: [],
    clues: [],
    guesses: [],
    passed: [],
    scores: [0, 0],
    lastTurn: null,
  };
  return { ...state, rotation: state.rotation.map((r, t) => (t === team ? 1 : r)) };
}

/** Wer im anderen Team sitzt (legt Sperrwörter fest, drückt „Gesagt!“). */
export function blockers(state: DuelState): SeatId[] {
  return teamMembers(state.teams, 1 - state.team);
}

/** Wer im erklärenden Team rät. */
export function guessers(state: DuelState): SeatId[] {
  return teamMembers(state.teams, state.team).filter((s) => s !== state.explainer);
}

function guessesBy(state: DuelState, seat: SeatId): number {
  return state.guesses.filter((g) => g.seat === seat).length;
}

/** Darf dieser Ratende gerade raten? Höchstens zwei Versuche je Hinweis. */
function mayGuess(state: DuelState, seat: SeatId): boolean {
  return state.clues.length > 0 && !state.passed.includes(seat) && guessesBy(state, seat) < state.clues.length * GUESSES_PER_CLUE;
}

export function currentPlayers(state: DuelState): Actor[] {
  if (state.phase === 'block') return blockers(state).filter((s) => state.proposals[s] === null);
  if (state.phase !== 'explain') return [];
  if (state.mode === 'speak') return [state.explainer];
  return [state.explainer, ...guessers(state).filter((s) => mayGuess(state, s))];
}

/** Wörter, die beim Erklären tabu sind: der Begriff, seine anderen Namen und die Sperrwörter. */
export function forbiddenWords(state: DuelState): string[] {
  const term = termOf(state, state.term);
  return term ? [term.name, ...(term.aliases ?? []), ...state.blocked] : state.blocked;
}

/** Problem eines Hinweises – oder null, wenn er erlaubt ist. */
export function clueProblem(state: DuelState, text: string): string | null {
  if (cleanEntry(text, MAX_CLUE_LENGTH) !== text) return 'Dieser Hinweis geht so nicht.';
  const hit = forbiddenWordIn(text, forbiddenWords(state));
  if (hit) return `„${hit}“ ist gesperrt.`;
  if (state.clues.some((c) => sameWord(c, text))) return 'Diesen Hinweis gab es schon.';
  return null;
}

function validProposal(state: DuelState, words: unknown): words is string[] {
  if (!Array.isArray(words) || words.length > MAX_BLOCKED) return false;
  const term = termOf(state, state.term);
  return words.every(
    (w, i) =>
      typeof w === 'string' &&
      cleanEntry(w) === w &&
      !w.includes(' ') &&
      !words.slice(0, i).some((v) => sameWord(v as string, w)) &&
      !(term && sameWord(w, term.name)),
  );
}

export function isLegal(state: DuelState, actor: Actor, move: DuelMove): boolean {
  if (typeof actor !== 'number' || !move || typeof move !== 'object') return false;
  if (state.phase === 'block') {
    return move.type === 'block' && blockers(state).includes(actor) && state.proposals[actor] === null && validProposal(state, move.words);
  }
  if (state.phase !== 'explain') return false;
  const isExplainer = actor === state.explainer;
  switch (move.type) {
    case 'skip':
      return isExplainer;
    case 'clue':
      return isExplainer && state.mode === 'write' && state.clues.length < MAX_CLUES && typeof move.text === 'string' && clueProblem(state, move.text) === null;
    case 'guess':
      return state.mode === 'write' && guessers(state).includes(actor) && mayGuess(state, actor) && typeof move.text === 'string' && cleanEntry(move.text) === move.text;
    case 'pass':
      return state.mode === 'write' && guessers(state).includes(actor) && !state.passed.includes(actor);
    case 'correct':
      return isExplainer && state.mode === 'speak';
    case 'buzz':
      return state.mode === 'speak' && (isExplainer || blockers(state).includes(actor));
    default:
      return false;
  }
}

export function legalMoves(state: DuelState, actor: Actor): DuelMove[] {
  if (typeof actor !== 'number') return [];
  const term = termOf(state, state.term);
  if (state.phase === 'block') {
    if (!blockers(state).includes(actor) || state.proposals[actor] !== null) return [];
    const hints = (term?.hints ?? []).filter((h) => !h.includes(' ') && !(term && sameWord(h, term.name)));
    const blocks: { type: 'block'; words: string[] }[] = [
      { type: 'block', words: hints.slice(0, MAX_BLOCKED) },
      { type: 'block', words: [] },
    ];
    return blocks.filter((m) => validProposal(state, m.words));
  }
  if (state.phase !== 'explain') return [];
  const moves: DuelMove[] = [];
  if (actor === state.explainer) {
    if (state.mode === 'speak') return [{ type: 'correct' }, { type: 'buzz' }, { type: 'skip' }];
    const clue = term?.clues.find((c) => isLegal(state, actor, { type: 'clue', text: c }));
    if (clue) moves.push({ type: 'clue', text: clue });
    moves.push({ type: 'skip' });
    return moves;
  }
  if (state.mode === 'write' && guessers(state).includes(actor)) {
    if (mayGuess(state, actor)) {
      // Beispiele: der Begriff selbst und ein anderer aus dem Paket.
      const other = packOf(state).terms.find((t, i) => i !== state.term);
      for (const text of [term?.name, other?.name]) if (text && cleanEntry(text) === text) moves.push({ type: 'guess', text });
    }
    if (!state.passed.includes(actor)) moves.push({ type: 'pass' });
  }
  return moves;
}

function pointsFor(clues: number): number {
  return clues <= 2 ? 3 : clues <= 4 ? 2 : 1;
}

function endTurn(state: DuelState, outcome: TurnSummary['outcome'], points: number, scoringTeam: number, guessedBy: SeatId | null, events: GameEvent[]): DuelState {
  const term = termOf(state, state.term);
  const lastTurn: TurnSummary = { term: term?.name ?? '', team: state.team, explainer: state.explainer, blocked: state.blocked, outcome, points, guessedBy };
  const scores = state.scores.map((s, t) => (t === scoringTeam ? s + points : s));
  events.push({ type: outcome, team: scoringTeam, points, term: lastTurn.term });
  const turnIndex = state.turnIndex + 1;
  if (turnIndex >= state.totalTurns) {
    events.push({ type: 'gameOver' });
    return { ...state, scores, lastTurn, turnIndex, phase: 'done' };
  }
  const team = 1 - state.team;
  const members = teamMembers(state.teams, team);
  const explainer = members[state.rotation[team]! % members.length]!;
  events.push({ type: 'nextTerm', team, explainer });
  return {
    ...state,
    scores,
    lastTurn,
    turnIndex,
    term: state.deck[turnIndex]!,
    team,
    explainer,
    rotation: state.rotation.map((r, t) => (t === team ? r + 1 : r)),
    phase: 'block',
    proposals: Array.from({ length: state.seats }, () => null),
    blocked: [],
    clues: [],
    guesses: [],
    passed: [],
  };
}

export function applyMove(state: DuelState, actor: Actor, move: DuelMove): MoveResult<DuelState> {
  if (!isLegal(state, actor, move)) throw new Error('Unerlaubter Zug im Umschreibe-Duell.');
  const seat = actor as SeatId;
  const events: GameEvent[] = [];
  const team = state.team;

  switch (move.type) {
    case 'block': {
      const proposals = state.proposals.map((p, s) => (s === seat ? move.words : p));
      let next: DuelState = { ...state, proposals };
      events.push({ type: 'proposed', seat });
      if (blockers(next).every((s) => proposals[s] !== null)) {
        const ranked = rankProposals(blockers(next).map((s) => proposals[s]!));
        next = { ...next, phase: 'explain', blocked: ranked.slice(0, MAX_BLOCKED).map((r) => r.word) };
        events.push({ type: 'blocked', count: next.blocked.length });
      }
      return { state: next, events };
    }
    case 'clue':
      events.push({ type: 'clue', seat });
      return { state: { ...state, clues: [...state.clues, move.text] }, events };
    case 'guess': {
      const term = termOf(state, state.term)!;
      const correct = findWord(move.text, [term.name, ...(term.aliases ?? [])]) !== null;
      const next: DuelState = { ...state, guesses: [...state.guesses, { seat, text: move.text, correct }] };
      if (correct) return { state: endTurn(next, 'guessed', pointsFor(state.clues.length), team, seat, events), events };
      events.push({ type: 'wrongGuess', seat });
      return { state: settle(next, events), events };
    }
    case 'pass':
      return { state: settle({ ...state, passed: [...state.passed, seat] }, events), events };
    case 'skip':
      return { state: endTurn(state, 'skipped', 0, team, null, events), events };
    case 'correct':
      return { state: endTurn(state, 'guessed', 2, team, null, events), events };
    case 'buzz':
      return { state: endTurn(state, 'buzzed', 1, 1 - team, null, events), events };
  }
}

/** Kann niemand mehr raten und gibt es keine Hinweise mehr, ist der Begriff verloren. */
function settle(state: DuelState, events: GameEvent[]): DuelState {
  const stuck = state.clues.length >= MAX_CLUES && guessers(state).every((s) => !mayGuess(state, s));
  const allPassed = guessers(state).every((s) => state.passed.includes(s));
  return stuck || allPassed ? endTurn(state, 'skipped', 0, state.team, null, events) : state;
}

export function result(state: DuelState): Result | null {
  if (state.phase !== 'done') return null;
  const [a, b] = state.scores as [number, number];
  if (a === b) return { kind: 'draw' };
  const winner = a > b ? 0 : 1;
  return { kind: 'win', winners: teamMembers(state.teams, winner) };
}

/** Sieht dieser Platz den aktuellen Begriff? Wer erklärt und das andere Team – nicht die Ratenden, nicht Zuschauer (Tafel). */
export function seesTerm(state: DuelState, viewer: SeatId | 'spectator'): boolean {
  if (state.phase === 'done') return true;
  if (viewer === 'spectator') return false;
  return viewer === state.explainer || state.teams[viewer] !== state.team;
}

export function playerView(state: DuelState, viewer: SeatId | 'spectator'): DuelState {
  const sees = seesTerm(state, viewer);
  return {
    ...state,
    deck: state.deck.slice(0, state.turnIndex),
    term: sees ? state.term : null,
    blocked: sees ? state.blocked : [],
    proposals: state.proposals.map((p, s) => (p === null || s === viewer ? p : [])),
  };
}

export function sampleHidden(view: DuelState, _seat: SeatId, rng: Rng): DuelState {
  const pack = packOf(view);
  const used = new Set(view.deck);
  if (view.term !== null) used.add(view.term);
  const rest = rng.shuffle(pack.terms.map((_, i) => i).filter((i) => !used.has(i)));
  const term = view.term ?? rest.shift() ?? 0;
  const future = rest.slice(0, Math.max(0, view.totalTurns - view.turnIndex - 1));
  return { ...view, term, deck: [...view.deck, term, ...future] };
}

export function timeoutMove(state: DuelState, seat: SeatId): DuelMove {
  if (state.phase === 'block') return { type: 'block', words: [] };
  if (seat === state.explainer) return { type: 'skip' };
  return { type: 'pass' };
}
