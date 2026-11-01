import { Rng } from './random';
import type { Actor, BotLevel, GameEvent, GameInfo, GameModule, MoveResult, Options, OptionSpec, PrepareContext, Result, SeatId } from './types';

/*
 * Baustein für Klassenspiele: Eine Frage, alle antworten gleichzeitig und verdeckt, die Zeit
 * läuft, dann folgt die Auflösung und die nächste Frage. Jeder gibt je Runde genau einen Zug ab,
 * also bleibt auch eine Klasse mit 30 Kindern für den Server tragbar. Die Regeln kennen keine Uhr:
 * Den Zeitablauf löst die Spielleitung als Systemzug aus (`systemDelayMs`).
 */

export type RoundPhase = 'answer' | 'reveal' | 'finished';

export interface RoundState<Q, A> {
  seats: number;
  /** Künftige Fragen sind in der Sicht null, die laufende ohne Lösung. */
  questions: (Q | null)[];
  round: number;
  phase: RoundPhase;
  /** Fremde Antworten sind bis zur Auflösung verdeckt. */
  answers: (A | null)[];
  answered: boolean[];
  scores: number[];
  /** Punkte der letzten aufgelösten Runde. */
  gained: number[];
  answerMs: number | null;
  revealMs: number;
  /** Auflösung: Weiter von selbst oder durch Platz 1, etwa die Lehrkraft nach dem Besprechen. */
  advance: 'auto' | 'lead';
}

export type RoundMove<A> = { type: 'answer'; answer: A } | { type: 'close' } | { type: 'next' };

export interface RoundGameSpec<Q, A> {
  info: GameInfo;
  options?: OptionSpec[];
  defaultSeconds: number;
  prepare?(context: PrepareContext): Promise<void>;
  /** Fragen der Partie; `count` ist die gewählte Anzahl. */
  pickQuestions(options: Options, count: number, rng: Rng): Q[];
  /** Die Frage ohne Lösung. Muss bei einer schon verdeckten Frage dasselbe ergeben. */
  publicQuestion(question: Q): Q;
  isValidAnswer(question: Q, answer: unknown): answer is A;
  /** Beispiele für `legalMoves`; erlaubt ist mehr, das prüft `isValidAnswer`. */
  sampleAnswers(question: Q): A[];
  scoreRound(question: Q, answers: (A | null)[]): number[];
  botAnswer(question: Q, level: BotLevel, rng: Rng): A;
  botName: string;
}

/** Auswahl für alle Klassenspiele: Anzahl, Zeit und wie es nach der Auflösung weitergeht. */
export function roundOptions(defaultSeconds: number): OptionSpec[] {
  const seconds = [15, 20, 30, 45, 60];
  return [
    {
      id: 'count',
      label: 'Anzahl der Runden',
      choices: [5, 10, 15].map((n) => ({ value: String(n), label: String(n) })),
      default: '10',
    },
    {
      id: 'seconds',
      label: 'Antwortzeit',
      choices: [...seconds.map((s) => ({ value: String(s), label: `${s} Sekunden` })), { value: 'none', label: 'Ohne Zeitlimit' }],
      default: String(defaultSeconds),
    },
    {
      id: 'advance',
      label: 'Nach der Auflösung',
      description: 'Zum Besprechen in der Klasse wartet das Spiel auf Platz 1.',
      choices: [
        { value: 'auto', label: 'Geht von selbst weiter' },
        { value: 'lead', label: 'Platz 1 tippt „Weiter“' },
      ],
      default: 'auto',
    },
  ];
}

export function makeRoundGame<Q, A>(spec: RoundGameSpec<Q, A>): GameModule<RoundState<Q, A>, RoundMove<A>> {
  type State = RoundState<Q, A>;
  type Move = RoundMove<A>;

  const open = (state: State): SeatId[] => state.answered.flatMap((done, seat) => (done ? [] : [seat]));

  const reveal = (state: State, events: GameEvent[]): State => {
    const gained = spec.scoreRound(state.questions[state.round]!, state.answers);
    events.push({ type: 'revealed', round: state.round });
    return { ...state, phase: 'reveal', gained, scores: state.scores.map((score, seat) => score + (gained[seat] ?? 0)) };
  };

  const next = (state: State, events: GameEvent[]): State => {
    const round = state.round + 1;
    if (round >= state.questions.length) {
      events.push({ type: 'gameOver' });
      return { ...state, phase: 'finished' };
    }
    events.push({ type: 'nextRound', round });
    return { ...state, round, phase: 'answer', answers: new Array(state.seats).fill(null), answered: new Array(state.seats).fill(false) };
  };

  const module: GameModule<State, Move> = {
    info: spec.info,
    options: [...(spec.options ?? []), ...roundOptions(spec.defaultSeconds)],
    timePresets: { relaxed: { kind: 'none' }, normal: { kind: 'none' }, fast: { kind: 'none' } },
    prepare: spec.prepare,
    setup(seats, options, seed) {
      const count = Number(options.count ?? 10);
      const seconds = options.seconds ?? String(spec.defaultSeconds);
      const rng = Rng.fromSeed(seed, spec.info.id);
      return {
        seats,
        questions: spec.pickQuestions(options, count, rng),
        round: 0,
        phase: 'answer',
        answers: new Array(seats).fill(null),
        answered: new Array(seats).fill(false),
        scores: new Array(seats).fill(0),
        gained: new Array(seats).fill(0),
        answerMs: seconds === 'none' ? null : Number(seconds) * 1000,
        revealMs: 9000,
        advance: options.advance === 'lead' ? 'lead' : 'auto',
      };
    },
    currentPlayers(state): Actor[] {
      if (state.phase === 'finished') return [];
      if (state.phase === 'reveal') return state.advance === 'lead' ? [0] : ['system'];
      return state.answerMs === null ? open(state) : [...open(state), 'system'];
    },
    legalMoves(state, actor) {
      if (state.phase === 'reveal') return (actor === 'system') === (state.advance === 'auto') && (actor === 'system' || actor === 0) ? [{ type: 'next' }] : [];
      if (state.phase !== 'answer') return [];
      if (actor === 'system') return state.answerMs === null ? [] : [{ type: 'close' }];
      if (state.answered[actor]) return [];
      return spec.sampleAnswers(state.questions[state.round]!).map((answer) => ({ type: 'answer' as const, answer }));
    },
    isLegal(state, actor, move) {
      if (!move || typeof move !== 'object') return false;
      if (move.type === 'answer') return state.phase === 'answer' && actor !== 'system' && !state.answered[actor] && spec.isValidAnswer(state.questions[state.round]!, move.answer);
      return module.legalMoves(state, actor).some((m) => m.type === move.type);
    },
    applyMove(state, actor, move): MoveResult<State> {
      if (!module.isLegal!(state, actor, move)) throw new Error('Unerlaubter Zug.');
      const events: GameEvent[] = [];
      if (move.type === 'close') return { state: reveal(state, events), events };
      if (move.type === 'next') return { state: next(state, events), events };
      const seat = actor as SeatId;
      const answers = [...state.answers];
      answers[seat] = move.answer;
      const answered = [...state.answered];
      answered[seat] = true;
      events.push({ type: 'answered', seat });
      const after = { ...state, answers, answered };
      // Haben alle abgegeben, muss niemand auf die Uhr warten.
      return { state: answered.every(Boolean) ? reveal(after, events) : after, events };
    },
    systemDelayMs(state) {
      if (state.phase === 'answer') return state.answerMs ?? 0;
      return state.phase === 'reveal' ? state.revealMs : 0;
    },
    systemTimerKey: (state) => `${state.phase}:${state.round}`,
    playerView(state, seat) {
      const shown = state.phase !== 'answer';
      return {
        ...state,
        questions: state.questions.map((question, i) => {
          if (question === null || i > state.round) return null;
          return i === state.round && !shown ? spec.publicQuestion(question) : question;
        }),
        answers: shown ? state.answers : state.answers.map((answer, i) => (i === seat ? answer : null)),
      };
    },
    sampleHidden: (view) => structuredClone(view),
    result(state): Result | null {
      if (state.phase !== 'finished') return null;
      const best = Math.max(...state.scores);
      return { kind: 'win', winners: state.scores.flatMap((score, seat) => (score === best ? [seat] : [])) };
    },
    bots: [
      {
        id: `${spec.info.id}-bot`,
        name: spec.botName,
        levels: ['easy', 'medium', 'hard'],
        chooseMove({ view, seat, level, rng }) {
          if (view.phase !== 'answer') return { type: 'next' };
          void seat;
          return { type: 'answer', answer: spec.botAnswer(view.questions[view.round]!, level, rng) };
        },
        delayMs: ({ view, move, rng }) => {
          if (move.type === 'next') return 6000;
          const limit = view.answerMs ?? 8000;
          return 1000 + rng.next() * limit * 0.4;
        },
      },
    ],
  };
  return module;
}
