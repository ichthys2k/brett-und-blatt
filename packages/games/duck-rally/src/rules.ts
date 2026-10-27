import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type SeatId } from '@brett-und-blatt/engine';

export type RallyTopic = 'basic' | 'addSub' | 'mulDiv' | 'algebra' | 'percentPrime' | 'mix';
export type RallyDifficulty = 'easy' | 'medium' | 'hard';
export type ProblemKind = 'arith' | 'algebra' | 'percent' | 'prime';

export interface MathProblem {
  id: string;
  kind: ProblemKind;
  /** Lesbare Aufgabenstellung, z. B. "14 + 27", "3 · x + 5 = 20  ⇒  x = ?" oder "25 % von 200 = ?". */
  prompt: string;
  /** Nur bei Primzahl-Aufgaben: 6 Auswahlzahlen, unter denen genau eine Primzahl ist. */
  options: number[] | null;
  /** Exakte ganzzahlige Lösung. In `playerView` auf `null` gesetzt, aber über `solveMathProblem` berechenbar. */
  answer: number | null;
}

export interface RacerState {
  seat: SeatId;
  solvedCount: number;
  mistakes: number;
  stepMistakes: number;
  streak: number;
  bestStreak: number;
  lastResult: 'correct' | 'wrong' | null;
  /** Reihenfolge der Indizes (0..target-1), in3er-Blöcken je Sitzplatz verwürfelt. */
  order: number[];
  currentProblem: MathProblem | null;
}

export interface DuckRallyState {
  seats: number;
  topic: RallyTopic;
  difficulty: RallyDifficulty;
  target: number;
  /** Verborgener Basis-Aufgabenpool (in `playerView` leer, damit niemand kommende Aufgaben vorab sieht). */
  baseProblems: MathProblem[];
  /** Interner Seed-Schlüssel für deterministische Ersatz-Aufgaben bei Fehlversuchen (in `playerView` leer). */
  seedKey: string;
  racers: RacerState[];
  /** Sitzplätze in der Reihenfolge ihres Zieleinlaufs. */
  finishOrder: SeatId[];
}

export type DuckRallyMove = {
  type: 'answer';
  value: number;
};

/** Prüft deterministisch, ob `n` eine Primzahl ist. */
export function isPrimeNumber(n: number): boolean {
  if (!Number.isInteger(n) || n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

/**
 * Berechnet die eindeutige Lösung einer Aufgabe allein aus ihren sichtbaren Feldern (`prompt` / `options`).
 * Dadurch funktioniert die Auswertung und der Bot auch auf der gefilterten `playerView`, in der `answer: null` ist.
 */
export function solveMathProblem(problem: MathProblem): number {
  if (typeof problem.answer === 'number') return problem.answer;

  if (problem.kind === 'prime' && problem.options) {
    const found = problem.options.find((n) => isPrimeNumber(n));
    return found ?? problem.options[0] ?? 2;
  }

  if (problem.kind === 'algebra') {
    // Format: "a · x + b = c  ⇒  x = ?" oder "a · x − b = c  ⇒  x = ?"
    const m = /^(\d+)\s*·\s*x\s*([+−])\s*(\d+)\s*=\s*(\d+)/.exec(problem.prompt);
    if (m) {
      const a = Number(m[1]);
      const op = m[2];
      const b = Number(m[3]);
      const c = Number(m[4]);
      return op === '+' ? Math.round((c - b) / a) : Math.round((c + b) / a);
    }
  }

  if (problem.kind === 'percent') {
    // 1) "p % von G = ?"
    const m1 = /^(\d+)\s*%\s*von\s*(\d+)\s*=\s*\?$/.exec(problem.prompt);
    if (m1) return Math.round((Number(m1[1]) * Number(m1[2])) / 100);
    // 2) "? % von G = W"
    const m2 = /^\?\s*%\s*von\s*(\d+)\s*=\s*(\d+)$/.exec(problem.prompt);
    if (m2) return Math.round((Number(m2[2]) * 100) / Number(m2[1]));
    // 3) "p % von ? = W"
    const m3 = /^(\d+)\s*%\s*von\s*\?\s*=\s*(\d+)$/.exec(problem.prompt);
    if (m3) return Math.round((Number(m3[2]) * 100) / Number(m3[1]));
  }

  // Standard: "a + b", "a − b", "a · b", "a : b"
  const mArith = /^(\d+)\s*([+−·:])\s*(\d+)$/.exec(problem.prompt);
  if (mArith) {
    const a = Number(mArith[1]);
    const op = mArith[2];
    const b = Number(mArith[3]);
    if (op === '+') return a + b;
    if (op === '−') return a - b;
    if (op === '·') return a * b;
    if (op === ':' && b !== 0) return Math.round(a / b);
  }

  return 0;
}

/** Erzeugt eine einzelne Mathe-Aufgabe deterministisch über `rng` (nach Vorbild von `mathUtils.js` aus Der Große Preis). */
export function generateMathProblem(
  rng: Rng,
  topic: RallyTopic,
  difficulty: RallyDifficulty,
  id: string,
): MathProblem {
  // Welche Unterart wird gezogen?
  let subKind: '+' | '-' | '*' | '/' | 'algebra' | 'percent' | 'prime';
  if (topic === 'addSub') {
    subKind = rng.pick(['+', '-'] as const);
  } else if (topic === 'mulDiv') {
    subKind = rng.pick(['*', '/'] as const);
  } else if (topic === 'basic') {
    subKind = rng.pick(['+', '-', '*', '/'] as const);
  } else if (topic === 'algebra') {
    subKind = 'algebra';
  } else if (topic === 'percentPrime') {
    subKind = rng.pick(['percent', 'prime'] as const);
  } else {
    // 'mix'
    subKind = rng.pick(['+', '-', '*', '/', 'algebra', 'percent', 'prime'] as const);
  }

  if (subKind === 'algebra') {
    const isPlus = rng.chance(0.55);
    const a = difficulty === 'easy' ? 2 + rng.int(4) : difficulty === 'medium' ? 2 + rng.int(7) : 3 + rng.int(11);
    const x = difficulty === 'easy' ? 2 + rng.int(8) : difficulty === 'medium' ? 2 + rng.int(11) : 3 + rng.int(15);
    const b = difficulty === 'easy' ? 1 + rng.int(10) : difficulty === 'medium' ? 2 + rng.int(20) : 5 + rng.int(36);
    if (isPlus) {
      const c = a * x + b;
      return {
        id,
        kind: 'algebra',
        prompt: `${a} · x + ${b} = ${c}   ⇒   x = ?`,
        options: null,
        answer: x,
      };
    }
    const bSafe = Math.min(b, a * x - 1);
    const c = a * x - bSafe;
    return {
      id,
      kind: 'algebra',
      prompt: `${a} · x − ${bSafe} = ${c}   ⇒   x = ?`,
      options: null,
      answer: x,
    };
  }

  if (subKind === 'percent') {
    const pPool =
      difficulty === 'easy'
        ? [10, 20, 25, 50, 75]
        : difficulty === 'medium'
          ? [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80]
          : [2, 4, 5, 8, 10, 12, 15, 20, 25, 30, 40, 45, 60, 75, 80, 90, 120, 150];
    const gPool =
      difficulty === 'easy'
        ? [20, 40, 60, 80, 100, 200, 400]
        : difficulty === 'medium'
          ? [40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500]
          : [50, 60, 80, 120, 150, 200, 250, 300, 350, 400, 450, 600, 750, 800, 1000];

    const pairs: { p: number; G: number; W: number }[] = [];
    for (const p of pPool) {
      for (const G of gPool) {
        const prod = p * G;
        if (prod % 100 === 0) {
          pairs.push({ p, G, W: prod / 100 });
        }
      }
    }
    const chosen = rng.pick(pairs);
    const askType = difficulty === 'easy' ? 0 : rng.int(3);
    if (askType === 0) {
      return {
        id,
        kind: 'percent',
        prompt: `${chosen.p} % von ${chosen.G} = ?`,
        options: null,
        answer: chosen.W,
      };
    }
    if (askType === 1) {
      return {
        id,
        kind: 'percent',
        prompt: `? % von ${chosen.G} = ${chosen.W}`,
        options: null,
        answer: chosen.p,
      };
    }
    return {
      id,
      kind: 'percent',
      prompt: `${chosen.p} % von ? = ${chosen.W}`,
      options: null,
      answer: chosen.G,
    };
  }

  if (subKind === 'prime') {
    const minN = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 11 : 23;
    const maxN = difficulty === 'easy' ? 50 : difficulty === 'medium' ? 150 : 400;
    const primes: number[] = [];
    const composites: number[] = [];
    for (let n = minN; n <= maxN; n++) {
      if (isPrimeNumber(n)) primes.push(n);
      else if (n > 3 && (difficulty === 'easy' || n % 2 !== 0 || rng.chance(0.35))) composites.push(n);
    }
    const primeAnswer = rng.pick(primes);
    const distractors = rng.shuffle(composites).slice(0, 5);
    const options = rng.shuffle([primeAnswer, ...distractors]);
    return {
      id,
      kind: 'prime',
      prompt: 'Wähle die Primzahl!',
      options,
      answer: primeAnswer,
    };
  }

  if (subKind === '+') {
    const a = difficulty === 'easy' ? 2 + rng.int(18) : difficulty === 'medium' ? 12 + rng.int(78) : 45 + rng.int(350);
    const b = difficulty === 'easy' ? 2 + rng.int(18) : difficulty === 'medium' ? 12 + rng.int(78) : 45 + rng.int(350);
    return {
      id,
      kind: 'arith',
      prompt: `${a} + ${b}`,
      options: null,
      answer: a + b,
    };
  }

  if (subKind === '-') {
    const a = difficulty === 'easy' ? 8 + rng.int(20) : difficulty === 'medium' ? 25 + rng.int(85) : 90 + rng.int(380);
    const b = difficulty === 'easy' ? 2 + rng.int(a - 3) : difficulty === 'medium' ? 8 + rng.int(a - 12) : 25 + rng.int(a - 35);
    return {
      id,
      kind: 'arith',
      prompt: `${a} − ${b}`,
      options: null,
      answer: a - b,
    };
  }

  if (subKind === '*') {
    const a = difficulty === 'easy' ? 2 + rng.int(8) : difficulty === 'medium' ? 3 + rng.int(13) : 6 + rng.int(19);
    const b = difficulty === 'easy' ? 2 + rng.int(8) : difficulty === 'medium' ? 3 + rng.int(11) : 5 + rng.int(16);
    return {
      id,
      kind: 'arith',
      prompt: `${a} · ${b}`,
      options: null,
      answer: a * b,
    };
  }

  // Division '/'
  const divisor = difficulty === 'easy' ? 2 + rng.int(8) : difficulty === 'medium' ? 3 + rng.int(11) : 4 + rng.int(15);
  const quotient = difficulty === 'easy' ? 2 + rng.int(8) : difficulty === 'medium' ? 3 + rng.int(13) : 5 + rng.int(19);
  const dividend = divisor * quotient;
  return {
    id,
    kind: 'arith',
    prompt: `${dividend} : ${divisor}`,
    options: null,
    answer: quotient,
  };
}

/**
 * Erzeugt für einen Sitzplatz eine Reihenfolge der Indizes `0..target-1`,
 * bei der jeweils 3 aufeinanderfolgende Aufgaben untereinander gemischt werden (ab Platz 1).
 * So lösen alle Spieler über das Rennen hinweg dieselben Aufgaben, haben aber fast nie
 * im selben Moment dieselbe Zahl vor sich.
 */
function buildSeatOrder(target: number, seat: SeatId, rng: Rng): number[] {
  const indices = Array.from({ length: target }, (_, i) => i);
  if (seat === 0) return indices;
  const resultOrder: number[] = [];
  const blockSize = 3;
  for (let start = 0; start < target; start += blockSize) {
    const chunk = indices.slice(start, Math.min(target, start + blockSize));
    resultOrder.push(...rng.shuffle(chunk));
  }
  return resultOrder;
}

function maskProblem(problem: MathProblem | null): MathProblem | null {
  if (!problem) return null;
  return { ...problem, answer: null };
}

export function setup(seats: number, options: Options, seed: string): DuckRallyState {
  const topic: RallyTopic = (
    ['basic', 'addSub', 'mulDiv', 'algebra', 'percentPrime', 'mix'] as const
  ).find((t) => t === options.topic) ?? 'basic';
  const difficulty: RallyDifficulty = (['easy', 'medium', 'hard'] as const).find(
    (d) => d === options.difficulty,
  ) ?? 'medium';
  const target = [10, 15, 25].includes(Number(options.target)) ? Number(options.target) : 15;

  const problemRng = Rng.fromSeed(seed, 'duck-rally-problems');
  const baseProblems: MathProblem[] = Array.from({ length: target }, (_, i) =>
    generateMathProblem(problemRng, topic, difficulty, `base-${i + 1}`),
  );

  const racers: RacerState[] = Array.from({ length: seats }, (_, seat) => {
    const orderRng = Rng.fromSeed(seed, `duck-rally-order-${seat}`);
    const order = buildSeatOrder(target, seat, orderRng);
    const firstIdx = order[0] ?? 0;
    return {
      seat,
      solvedCount: 0,
      mistakes: 0,
      stepMistakes: 0,
      streak: 0,
      bestStreak: 0,
      lastResult: null,
      order,
      currentProblem: baseProblems[firstIdx] ?? null,
    };
  });

  return {
    seats,
    topic,
    difficulty,
    target,
    baseProblems,
    seedKey: seed,
    racers,
    finishOrder: [],
  };
}

export function currentPlayers(state: DuckRallyState): Actor[] {
  if (result(state)) return [];
  return state.racers
    .filter((r) => r.solvedCount < state.target && r.currentProblem !== null)
    .map((r) => r.seat);
}

/**
 * Erlaubte Beispielzüge für Bots und Vertragstests:
 * Liefert immer die exakte Lösung der aktuellen Aufgabe (sowie beim ersten Versuch
 * in kleinen Runden einen plausiblen Fehltipp, damit auch Fehlversuche automatisch getestet werden).
 */
export function legalMoves(state: DuckRallyState, actor: Actor): DuckRallyMove[] {
  if (actor === 'system' || actor < 0 || actor >= state.seats || result(state)) return [];
  const racer = state.racers[actor];
  if (!racer || racer.solvedCount >= state.target || !racer.currentProblem) return [];

  const exact = solveMathProblem(racer.currentProblem);
  const moves: DuckRallyMove[] = [{ type: 'answer', value: exact }];

  // Bei 0 Fehlern auf dieser Stufe in kleinen Runden einen Fehlversuch als zweiten Beispielzug anbieten
  if (racer.stepMistakes === 0 && state.seats <= 4) {
    if (racer.currentProblem.kind === 'prime' && racer.currentProblem.options) {
      const wrongOpt = racer.currentProblem.options.find((o) => o !== exact);
      if (wrongOpt !== undefined) moves.push({ type: 'answer', value: wrongOpt });
    } else {
      moves.push({ type: 'answer', value: exact + 1 });
    }
  }

  return moves;
}

/** Erlaubt jede ganzzahlige Antwort eines aktiven Spielers (bei Primzahl-Aufgaben eine der 6 Optionen). */
export function isLegal(state: DuckRallyState, actor: Actor, move: DuckRallyMove): boolean {
  if (actor === 'system' || actor < 0 || actor >= state.seats || result(state)) return false;
  if (!move || move.type !== 'answer' || typeof move.value !== 'number' || !Number.isInteger(move.value)) {
    return false;
  }
  if (move.value < -99_999 || move.value > 999_999) return false;
  const racer = state.racers[actor];
  if (!racer || racer.solvedCount >= state.target || !racer.currentProblem) return false;
  if (racer.currentProblem.kind === 'prime' && racer.currentProblem.options) {
    return racer.currentProblem.options.includes(move.value);
  }
  return true;
}

export function applyMove(
  state: DuckRallyState,
  actor: Actor,
  move: DuckRallyMove,
): MoveResult<DuckRallyState> {
  if (!isLegal(state, actor, move) || actor === 'system') {
    throw new Error('Unerlaubter Zug in Enten-Rallye.');
  }

  const racer = state.racers[actor]!;
  const problem = racer.currentProblem!;
  const expected = solveMathProblem(problem);
  const isCorrect = move.value === expected;

  const nextRacers = state.racers.slice();
  const nextFinishOrder = state.finishOrder.slice();
  const events: GameEvent[] = [];

  if (isCorrect) {
    const nextSolved = racer.solvedCount + 1;
    const nextStreak = racer.streak + 1;
    const nextBestStreak = Math.max(racer.bestStreak, nextStreak);
    const finished = nextSolved >= state.target;

    let nextProblem: MathProblem | null = null;
    if (!finished) {
      const poolIdx = racer.order[nextSolved] ?? nextSolved;
      nextProblem =
        state.baseProblems[poolIdx] ??
        generateMathProblem(
          Rng.fromSeed(state.seedKey || 'fallback', `extra-${actor}-${nextSolved}`),
          state.topic,
          state.difficulty,
          `extra-${actor}-${nextSolved}`,
        );
    } else if (!nextFinishOrder.includes(actor)) {
      nextFinishOrder.push(actor);
    }

    nextRacers[actor] = {
      ...racer,
      solvedCount: nextSolved,
      stepMistakes: 0,
      streak: nextStreak,
      bestStreak: nextBestStreak,
      lastResult: 'correct',
      currentProblem: nextProblem,
    };

    events.push({
      type: 'boost',
      seat: actor,
      solvedCount: nextSolved,
      streak: nextStreak,
    });
  } else {
    const nextMistakes = racer.mistakes + 1;
    const nextStepMistakes = racer.stepMistakes + 1;
    const retryRng = Rng.fromSeed(
      state.seedKey || 'fallback',
      `retry-${actor}-${racer.solvedCount}-${nextMistakes}`,
    );
    const replacement = generateMathProblem(
      retryRng,
      state.topic,
      state.difficulty,
      `retry-${actor}-${racer.solvedCount}-${nextMistakes}`,
    );

    nextRacers[actor] = {
      ...racer,
      mistakes: nextMistakes,
      stepMistakes: nextStepMistakes,
      streak: 0,
      lastResult: 'wrong',
      currentProblem: replacement,
    };

    events.push({
      type: 'mistake',
      seat: actor,
      mistakes: nextMistakes,
    });
  }

  return {
    state: {
      ...state,
      racers: nextRacers,
      finishOrder: nextFinishOrder,
    },
    events,
  };
}

/**
 * Blendet den Vorrat kommender Aufgaben (`baseProblems`), den internen Seed-Schlüssel
 * und die vorab gespeicherte Lösungszahl `answer` aus.
 */
export function playerView(state: DuckRallyState, _seat: SeatId | 'spectator'): DuckRallyState {
  return {
    ...state,
    baseProblems: [],
    seedKey: '',
    racers: state.racers.map((r) => ({
      ...r,
      currentProblem: maskProblem(r.currentProblem),
    })),
  };
}

/** Sortiert alle Enten nach Rennstand: 1. Zieleinlauf, 2. gelöste Aufgaben, 3. wenigste Fehler, 4. beste Serie. */
export function rankRacers(state: DuckRallyState): RacerState[] {
  return [...state.racers].sort((a, b) => {
    const finA = state.finishOrder.indexOf(a.seat);
    const finB = state.finishOrder.indexOf(b.seat);
    if (finA !== -1 && finB !== -1) return finA - finB;
    if (finA !== -1) return -1;
    if (finB !== -1) return 1;
    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
    if (a.mistakes !== b.mistakes) return a.mistakes - b.mistakes;
    if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
    return a.seat - b.seat;
  });
}

export function result(state: DuckRallyState): Result | null {
  if (state.finishOrder.length === 0) return null;
  return {
    kind: 'win',
    winners: [state.finishOrder[0]!],
  };
}
