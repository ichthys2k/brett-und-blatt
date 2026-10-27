import {
  Rng,
  type Actor,
  type GameEvent,
  type MoveResult,
  type Options,
  type OptionSpec,
  type Result,
  type RngState,
  type SeatId,
  type TimePresets,
} from '@brett-und-blatt/engine';
import {
  QUESTIONS,
  type BibleQuestion,
  type QuestionCategory,
  type QuestionDifficulty,
} from './questions';

export type { QuestionCategory, QuestionDifficulty };

export type QuizPhase = 'question' | 'reveal' | 'done';

export interface RoundQuestion {
  questionId: number;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  emojis: string;
  shuffledOptions: readonly string[];
  correctOptionIndex: number;
  info: string;
  bibleLink?: string;
}

export interface PlayerAnswer {
  submitted: boolean;
  chosenIndex: number | null;
  correct: boolean | null;
  pointsEarned: number;
}

export interface BibleQuizState {
  seats: number;
  totalRounds: number;
  currentRound: number;
  phase: QuizPhase;
  currentQuestion: RoundQuestion;
  plannedQuestionIds: number[];
  answers: (PlayerAnswer | null)[];
  scores: number[];
  streaks: number[];
  correctCounts: number[];
  rng: RngState;
}

export type BibleQuizMove =
  | { type: 'answer'; optionIndex: number }
  | { type: 'next' };

export const options: OptionSpec[] = [
  {
    id: 'rounds',
    label: 'Fragenanzahl',
    default: '10',
    choices: [
      { value: '5', label: '5 Fragen (Kurz)' },
      { value: '10', label: '10 Fragen (Standard)' },
      { value: '15', label: '15 Fragen (Ausführlich)' },
      { value: '20', label: '20 Fragen (Große Runde)' },
      { value: 'all', label: 'Alle Fragen der Kategorie' },
    ],
  },
  {
    id: 'difficulty',
    label: 'Schwierigkeitsverlauf',
    default: 'progressive',
    choices: [
      { value: 'progressive', label: 'Steigend (Leicht ➔ Mittel ➔ Schwer)' },
      { value: 'mixed', label: 'Bunt gemischt (Zufällig)' },
      { value: 'easy', label: 'Nur Leicht (⭐)' },
      { value: 'medium', label: 'Nur Mittel (⭐⭐)' },
      { value: 'hard', label: 'Nur Schwer (⭐⭐⭐)' },
    ],
  },
  {
    id: 'category',
    label: 'Themenbereich',
    default: 'all',
    choices: [
      { value: 'all', label: 'Alle Themenbereiche' },
      { value: 'at', label: 'Altes Testament' },
      { value: 'nt', label: 'Neues Testament' },
      { value: 'parables', label: 'Gleichnisse' },
      { value: 'people', label: 'Personen' },
      { value: 'verses', label: 'Verse & Zitate' },
    ],
  },
];

export const timePresets: TimePresets = {
  relaxed: { kind: 'perMove', moveMs: 45_000 },
  normal: { kind: 'perMove', moveMs: 30_000 },
  fast: { kind: 'perMove', moveMs: 15_000 },
};

export const PRAISES = [
  'Amen! 🙏',
  'Halleluja! ✨',
  'Göttlich! 🌟',
  'Gesegnet! 🕊️',
  'Weise! 📖',
  'Hervorragend! ⭐',
  'Volltreffer! 🎯',
] as const;

function filterQuestions(categoryOpt: string): BibleQuestion[] {
  if (categoryOpt === 'at') {
    return QUESTIONS.filter((q) => q.category === 'Altes Testament');
  }
  if (categoryOpt === 'nt') {
    return QUESTIONS.filter((q) => q.category === 'Neues Testament');
  }
  if (categoryOpt === 'parables') {
    return QUESTIONS.filter((q) => q.category === 'Gleichnisse');
  }
  if (categoryOpt === 'people') {
    return QUESTIONS.filter((q) => q.category === 'Personen');
  }
  if (categoryOpt === 'verses') {
    return QUESTIONS.filter((q) => q.category === 'Verse');
  }
  return [...QUESTIONS];
}

function buildRoundQuestion(raw: BibleQuestion, rng: Rng): RoundQuestion {
  const perm = rng.shuffle([0, 1, 2, 3]);
  const shuffledOptions = perm.map((idx) => raw.options[idx]!);
  const correctOptionIndex = perm.indexOf(0);
  return {
    questionId: raw.id,
    category: raw.category,
    difficulty: raw.difficulty,
    emojis: raw.emojis,
    shuffledOptions,
    correctOptionIndex,
    info: raw.info,
    bibleLink: raw.bibleLink,
  };
}

function planQuestions(
  pool: BibleQuestion[],
  difficultyOpt: string,
  targetCount: number,
  rng: Rng,
): number[] {
  if (pool.length === 0) return [1];

  let selected: BibleQuestion[] = [];

  if (difficultyOpt === 'easy' || difficultyOpt === 'medium' || difficultyOpt === 'hard') {
    const targetDiff: QuestionDifficulty = difficultyOpt === 'easy' ? 1 : difficultyOpt === 'medium' ? 2 : 3;
    const matching = rng.shuffle(pool.filter((q) => q.difficulty === targetDiff));
    const fallback = rng.shuffle(pool.filter((q) => q.difficulty !== targetDiff));
    selected = [...matching, ...fallback].slice(0, targetCount);
  } else if (difficultyOpt === 'progressive') {
    const d1 = rng.shuffle(pool.filter((q) => q.difficulty === 1));
    const d2 = rng.shuffle(pool.filter((q) => q.difficulty === 2));
    const d3 = rng.shuffle(pool.filter((q) => q.difficulty === 3));

    const count1 = Math.round(targetCount * 0.3);
    const count3 = Math.round(targetCount * 0.3);
    const count2 = Math.max(1, targetCount - count1 - count3);

    const part1 = d1.slice(0, count1);
    const part2 = d2.slice(0, count2);
    const part3 = d3.slice(0, count3);

    const usedIds = new Set([...part1, ...part2, ...part3].map((q) => q.id));
    const remainingPool = rng.shuffle(pool.filter((q) => !usedIds.has(q.id)));

    selected = [...part1, ...part2, ...part3];
    while (selected.length < targetCount && remainingPool.length > 0) {
      selected.push(remainingPool.pop()!);
    }
  } else {
    // mixed
    selected = rng.shuffle([...pool]).slice(0, targetCount);
  }

  return selected.map((q) => q.id);
}

export function setup(seats: number, gameOptions: Options, seed: string): BibleQuizState {
  const rng = Rng.fromSeed(seed, 'bible-quiz');
  const pool = filterQuestions(gameOptions.category ?? 'all');

  let targetRounds = 10;
  if (gameOptions.rounds === '5') targetRounds = 5;
  else if (gameOptions.rounds === '15') targetRounds = 15;
  else if (gameOptions.rounds === '20') targetRounds = 20;
  else if (gameOptions.rounds === 'all') targetRounds = pool.length;
  targetRounds = Math.min(targetRounds, pool.length);

  const plannedQuestionIds = planQuestions(
    pool,
    gameOptions.difficulty ?? 'progressive',
    targetRounds,
    rng,
  );

  const firstQuestionRaw =
    QUESTIONS.find((q) => q.id === plannedQuestionIds[0]) ?? pool[0] ?? QUESTIONS[0]!;
  const firstQuestion = buildRoundQuestion(firstQuestionRaw, rng);

  return {
    seats,
    totalRounds: plannedQuestionIds.length,
    currentRound: 1,
    phase: 'question',
    currentQuestion: firstQuestion,
    plannedQuestionIds,
    answers: Array.from({ length: seats }, () => null),
    scores: Array.from({ length: seats }, () => 0),
    streaks: Array.from({ length: seats }, () => 0),
    correctCounts: Array.from({ length: seats }, () => 0),
    rng: rng.state,
  };
}

export function currentPlayers(state: BibleQuizState): Actor[] {
  if (state.phase === 'done') return [];
  if (state.phase === 'reveal') {
    // In der Auflösung darf Platz 0 (Spielleitung / Einzelspieler) zur nächsten Frage schalten
    return [0];
  }
  // Phase 'question': alle Plätze, die noch nicht geantwortet haben
  const active: Actor[] = [];
  for (let s = 0; s < state.seats; s++) {
    if (state.answers[s] === null || !state.answers[s]?.submitted) {
      active.push(s);
    }
  }
  return active;
}

export function legalMoves(state: BibleQuizState, actor: Actor): BibleQuizMove[] {
  if (state.phase === 'done') return [];
  if (typeof actor !== 'number' || actor < 0 || actor >= state.seats) return [];

  if (state.phase === 'reveal') {
    return actor === 0 ? [{ type: 'next' }] : [];
  }

  if (state.phase === 'question') {
    if (state.answers[actor]?.submitted) return [];
    return [
      { type: 'answer', optionIndex: 0 },
      { type: 'answer', optionIndex: 1 },
      { type: 'answer', optionIndex: 2 },
      { type: 'answer', optionIndex: 3 },
    ];
  }

  return [];
}

export function isLegal(state: BibleQuizState, actor: Actor, move: BibleQuizMove): boolean {
  if (!move || typeof move.type !== 'string') return false;
  if (typeof actor !== 'number' || actor < 0 || actor >= state.seats) return false;

  if (state.phase === 'reveal') {
    return move.type === 'next' && actor === 0;
  }

  if (state.phase === 'question') {
    if (move.type !== 'answer') return false;
    if (state.answers[actor]?.submitted) return false;
    return Number.isInteger(move.optionIndex) && move.optionIndex >= 0 && move.optionIndex < 4;
  }

  return false;
}

export function applyMove(
  state: BibleQuizState,
  actor: Actor,
  move: BibleQuizMove,
): MoveResult<BibleQuizState> {
  if (!isLegal(state, actor, move) || typeof actor !== 'number') {
    return { state, events: [] };
  }

  if (move.type === 'answer') {
    const isCorrect = move.optionIndex === state.currentQuestion.correctOptionIndex;
    const basePoints =
      state.currentQuestion.difficulty === 3 ? 30 : state.currentQuestion.difficulty === 2 ? 20 : 10;
    const currentStreak = state.streaks[actor] ?? 0;
    const newStreak = isCorrect ? currentStreak + 1 : 0;
    const streakBonus = isCorrect && newStreak >= 3 ? 5 : 0;
    const pointsEarned = isCorrect ? basePoints + streakBonus : 0;

    const answers = state.answers.map((ans, idx) =>
      idx === actor
        ? {
            submitted: true,
            chosenIndex: move.optionIndex,
            correct: isCorrect,
            pointsEarned,
          }
        : ans,
    );

    const events: GameEvent[] = [
      {
        type: 'answered',
        seat: actor,
        correct: isCorrect,
        pointsEarned,
      },
    ];

    // Prüfen, ob alle Plätze geantwortet haben
    const allAnswered = answers.every((a) => a !== null && a.submitted);
    if (!allAnswered) {
      return {
        state: { ...state, answers },
        events,
      };
    }

    // Alle haben abgegeben -> Auswertung & Übergang in 'reveal'
    const scores = state.scores.map((sc, idx) => sc + (answers[idx]?.pointsEarned ?? 0));
    const streaks = state.streaks.map((st, idx) => (answers[idx]?.correct ? st + 1 : 0));
    const correctCounts = state.correctCounts.map(
      (cc, idx) => cc + (answers[idx]?.correct ? 1 : 0),
    );

    events.push({
      type: 'reveal',
      correctIndex: state.currentQuestion.correctOptionIndex,
      info: state.currentQuestion.info,
    });

    return {
      state: {
        ...state,
        phase: 'reveal',
        answers,
        scores,
        streaks,
        correctCounts,
      },
      events,
    };
  }

  if (move.type === 'next') {
    if (state.currentRound >= state.totalRounds) {
      const events: GameEvent[] = [{ type: 'quizDone', scores: state.scores }];
      return {
        state: {
          ...state,
          phase: 'done',
        },
        events,
      };
    }

    const nextRound = state.currentRound + 1;
    const nextQuestionId = state.plannedQuestionIds[nextRound - 1];
    const nextRaw =
      QUESTIONS.find((q) => q.id === nextQuestionId) ?? QUESTIONS[nextRound % QUESTIONS.length]!;

    const rng = new Rng(state.rng);
    const nextQuestion = buildRoundQuestion(nextRaw, rng);

    const events: GameEvent[] = [{ type: 'nextQuestion', round: nextRound }];

    return {
      state: {
        ...state,
        currentRound: nextRound,
        phase: 'question',
        currentQuestion: nextQuestion,
        answers: Array.from({ length: state.seats }, () => null),
        rng: rng.state,
      },
      events,
    };
  }

  return { state, events: [] };
}

export function playerView(state: BibleQuizState, viewer: SeatId | 'spectator'): BibleQuizState {
  if (state.phase === 'done' || state.phase === 'reveal') {
    return {
      ...state,
      rng: [0, 0, 0, 0],
      plannedQuestionIds: state.plannedQuestionIds.slice(0, state.currentRound),
    };
  }

  // Phase 'question': Verberge gegnerische Antworten und zukünftige Fragen
  return {
    ...state,
    rng: [0, 0, 0, 0],
    plannedQuestionIds: state.plannedQuestionIds.slice(0, state.currentRound),
    answers: state.answers.map((ans, idx) => {
      if (!ans) return null;
      if (idx === viewer) return ans;
      return {
        submitted: true,
        chosenIndex: null,
        correct: null,
        pointsEarned: 0,
      };
    }),
  };
}

export function sampleHidden(
  view: BibleQuizState,
  viewer: SeatId,
  rng: Rng,
): BibleQuizState {
  return {
    ...view,
    rng: rng.state,
    plannedQuestionIds: Array.from(
      { length: view.totalRounds },
      (_, idx) => view.plannedQuestionIds[idx] ?? ((idx + 1) % QUESTIONS.length) + 1,
    ),
    answers: view.answers.map((ans, idx) => {
      if (!ans || idx === viewer || ans.chosenIndex !== null) return ans;
      const dummyChosen = rng.int(4);
      const isCorrect = dummyChosen === view.currentQuestion.correctOptionIndex;
      const basePoints =
        view.currentQuestion.difficulty === 3 ? 30 : view.currentQuestion.difficulty === 2 ? 20 : 10;
      return {
        submitted: true,
        chosenIndex: dummyChosen,
        correct: isCorrect,
        pointsEarned: isCorrect ? basePoints : 0,
      };
    }),
  };
}

export function timeoutMove(state: BibleQuizState, seat: SeatId): BibleQuizMove {
  if (state.phase === 'reveal') return { type: 'next' };
  return { type: 'answer', optionIndex: 0 };
}

export function result(state: BibleQuizState): Result | null {
  if (state.phase !== 'done') return null;

  const maxScore = Math.max(...state.scores);
  const winners: SeatId[] = [];
  for (let s = 0; s < state.seats; s++) {
    if (state.scores[s] === maxScore) winners.push(s);
  }

  return {
    kind: 'win',
    winners,
  };
}
