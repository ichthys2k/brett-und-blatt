import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

export type WallNumberMode = 'natural' | 'integers' | 'decimals' | 'products';

export interface WallSubmission {
  submitted: boolean;
  values: number[] | null;
  correctCount: number | null;
  points: number | null;
}

export interface WallRoundSummary {
  round: number;
  givens: (number | null)[];
  solution: number[];
  submissions: {
    values: number[];
    correctCount: number;
    points: number;
  }[];
}

export interface NumberWallState {
  seats: number;
  numberMode: WallNumberMode;
  height: 3 | 4;
  totalRounds: number;
  round: number;
  phase: 'play' | 'done';
  /** Vorgegebene Steine der aktuellen Mauer (null = Lücke). Bei 'decimals' sind Werte in Zehnteln gespeichert! */
  givens: (number | null)[];
  /** Eindeutige Lösung aller Steine (in playerView während der Runde gleich givens, da aus givens berechenbar). */
  solution: number[];
  /** Antwort-Auswahlchips (sortiert: alle Lückenwerte + 3 plausible Ablenker). */
  choicePool: number[];
  submissions: (WallSubmission | null)[];
  scores: number[];
  lastRound: WallRoundSummary | null;
  rng: RngState;
}

export type NumberWallMove = {
  type: 'submit';
  values: number[];
};

export function totalStones(height: 3 | 4): number {
  return (height * (height + 1)) / 2;
}

/** Wandelt (Zeile von unten 0..height-1, Spalte 0..height-1-row) in den flachen Stein-Index um. */
export function stoneIndex(height: 3 | 4, row: number, col: number): number {
  let idx = 0;
  for (let r = 0; r < row; r++) {
    idx += height - r;
  }
  return idx + col;
}

/** Formatiert einen internen Zahlenwert (bei 'decimals' in Zehnteln) als deutschen Text. */
export function formatStoneValue(val: number, mode: WallNumberMode): string {
  if (mode !== 'decimals') return String(val);
  const sign = val < 0 ? '−' : '';
  const abs = Math.abs(val);
  const whole = Math.floor(abs / 10);
  const tenth = abs % 10;
  return `${sign}${whole},${tenth}`;
}

/** Schrittweise eindeutig lösbare Vorgabemuster (Indizes der vorgegebenen Steine). */
const GIVEN_PATTERNS_3: readonly (readonly number[])[] = [
  [0, 1, 2],
  [0, 1, 4],
  [1, 2, 3],
  [0, 3, 5],
  [2, 4, 5],
  [1, 3, 5],
];

const GIVEN_PATTERNS_4: readonly (readonly number[])[] = [
  [0, 1, 2, 3],
  [0, 1, 2, 6],
  [1, 2, 3, 4],
  [0, 1, 5, 8],
  [1, 2, 4, 9],
  [1, 5, 7, 9],
  [2, 5, 8, 9],
];

/** Löst eine Rechenmauer schrittweise über 2-aus-3-Dreiecke aus den vorgegebenen Steinen. */
export function solveWallFromGivens(
  givens: readonly (number | null)[],
  height: 3 | 4,
  mode: WallNumberMode,
): number[] {
  const work = [...givens];
  const isProd = mode === 'products';

  for (let pass = 0; pass < height * 3; pass++) {
    let changed = false;
    for (let r = 0; r < height - 1; r++) {
      const cols = height - 1 - r;
      for (let c = 0; c < cols; c++) {
        const iLeft = stoneIndex(height, r, c);
        const iRight = stoneIndex(height, r, c + 1);
        const iTop = stoneIndex(height, r + 1, c);

        const left = work[iLeft];
        const right = work[iRight];
        const top = work[iTop];

        if (left !== null && left !== undefined && right !== null && right !== undefined && top === null) {
          work[iTop] = isProd ? left * right : left + right;
          changed = true;
        } else if (top !== null && top !== undefined && left !== null && left !== undefined && right === null) {
          work[iRight] = isProd ? Math.round(top / left) : top - left;
          changed = true;
        } else if (top !== null && top !== undefined && right !== null && right !== undefined && left === null) {
          work[iLeft] = isProd ? Math.round(top / right) : top - right;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return work.map((v) => v ?? 0);
}

function generateWall(
  rng: Rng,
  height: 3 | 4,
  mode: WallNumberMode,
): { givens: (number | null)[]; solution: number[]; choicePool: number[] } {
  const count = totalStones(height);
  const solution = new Array<number>(count).fill(0);

  // Basiszeile (Row 0) würfeln
  for (let c = 0; c < height; c++) {
    if (mode === 'natural') {
      const span = (height === 4 ? 14 : 21);
      solution[c] = 2 + rng.int(span);
    } else if (mode === 'integers') {
      let v = -9 + rng.int(21);
      if (v === 0) v = 1 + rng.int(6);
      solution[c] = v;
    } else if (mode === 'decimals') {
      // Zehntel: z. B. 4..38 entspricht 0,4..3,8
      solution[c] = 4 + rng.int(35);
    } else {
      // products: kleine Faktoren 2..5, damit das Dach im Kopfrechenbereich bleibt
      solution[c] = 2 + rng.int(height === 4 ? 3 : 5);
    }
  }

  // Mauer nach oben berechnen
  const isProd = mode === 'products';
  for (let r = 1; r < height; r++) {
    for (let c = 0; c < height - r; c++) {
      const left = solution[stoneIndex(height, r - 1, c)]!;
      const right = solution[stoneIndex(height, r - 1, c + 1)]!;
      solution[stoneIndex(height, r, c)] = isProd ? left * right : left + right;
    }
  }

  const patterns = height === 3 ? GIVEN_PATTERNS_3 : GIVEN_PATTERNS_4;
  const givenIndices = new Set(rng.pick(patterns));
  const givens = solution.map((val, idx) => (givenIndices.has(idx) ? val : null));

  // Auswahl-Chips: alle gesuchten Lückenwerte + 3 plausible Ablenker
  const missingValues: number[] = [];
  for (let i = 0; i < count; i++) {
    if (givens[i] === null) missingValues.push(solution[i]!);
  }
  const poolSet = new Set<number>(missingValues);
  const stepDelta = mode === 'decimals' ? 5 : 1;
  for (let attempt = 0; attempt < 20 && poolSet.size < missingValues.length + 3; attempt++) {
    const ref = rng.pick(missingValues);
    const delta = rng.pick([-3, -2, -1, 1, 2, 3]) * stepDelta;
    const cand = ref + delta;
    if (mode === 'natural' && cand <= 0) continue;
    if (mode === 'products' && cand <= 1) continue;
    poolSet.add(cand);
  }
  const choicePool = [...poolSet].sort((a, b) => a - b);

  return { givens, solution, choicePool };
}

/** Berechnet korrekte Lücken und Punkte für eine abgegebene Mauer. */
export function scoreWallSubmission(
  givens: readonly (number | null)[],
  solution: readonly number[],
  values: readonly number[],
): { correctCount: number; totalBlanks: number; points: number } {
  let correctCount = 0;
  let totalBlanks = 0;
  for (let i = 0; i < solution.length; i++) {
    if (givens[i] !== null) continue;
    totalBlanks++;
    if (values[i] === solution[i]) {
      correctCount++;
    }
  }
  const bonus = correctCount === totalBlanks && totalBlanks > 0 ? 4 : 0;
  return {
    correctCount,
    totalBlanks,
    points: correctCount * 2 + bonus,
  };
}

export function setup(seats: number, options: Options, seed: string): NumberWallState {
  const numberMode: WallNumberMode =
    options.numbers === 'integers' || options.numbers === 'decimals' || options.numbers === 'products'
      ? options.numbers
      : 'natural';
  const height: 3 | 4 = options.height === '3' ? 3 : 4;
  const totalRounds = Number(options.rounds) || 5;

  const rng = Rng.fromSeed(seed, 'number-wall');
  const wall = generateWall(rng, height, numberMode);

  return {
    seats,
    numberMode,
    height,
    totalRounds,
    round: 1,
    phase: 'play',
    givens: wall.givens,
    solution: wall.solution,
    choicePool: wall.choicePool,
    submissions: Array.from({ length: seats }, () => null),
    scores: Array.from({ length: seats }, () => 0),
    lastRound: null,
    rng: rng.state,
  };
}

export function currentPlayers(state: NumberWallState): Actor[] {
  if (state.phase === 'done') return [];
  const active: Actor[] = [];
  for (let s = 0; s < state.seats; s++) {
    if (state.submissions[s] === null) active.push(s);
  }
  return active;
}

export function isLegal(state: NumberWallState, actor: Actor, move: NumberWallMove): boolean {
  if (typeof actor !== 'number' || actor < 0 || actor >= state.seats) return false;
  if (state.phase !== 'play' || state.submissions[actor] !== null) return false;
  if (!move || move.type !== 'submit' || !Array.isArray(move.values)) return false;
  const count = totalStones(state.height);
  if (move.values.length !== count) return false;
  for (let i = 0; i < count; i++) {
    const v = move.values[i];
    if (typeof v !== 'number' || !Number.isInteger(v) || Math.abs(v) > 100_000) return false;
    if (state.givens[i] !== null && v !== state.givens[i]) return false;
  }
  return true;
}

export function legalMoves(state: NumberWallState, actor: Actor): NumberWallMove[] {
  if (typeof actor !== 'number' || actor < 0 || actor >= state.seats) return [];
  if (state.phase !== 'play' || state.submissions[actor] !== null) return [];

  const solved = solveWallFromGivens(state.givens, state.height, state.numberMode);
  const oneOff = solved.map((v, idx) =>
    state.givens[idx] === null && idx === state.givens.indexOf(null) ? v + 1 : v,
  );
  const twoOff = solved.map((v, idx) => (state.givens[idx] === null ? v + 1 : v));

  return [
    { type: 'submit', values: solved },
    { type: 'submit', values: oneOff },
    { type: 'submit', values: twoOff },
  ];
}

export function applyMove(
  state: NumberWallState,
  actor: Actor,
  move: NumberWallMove,
): MoveResult<NumberWallState> {
  if (!isLegal(state, actor, move) || typeof actor !== 'number') {
    return { state, events: [] };
  }

  const solved = solveWallFromGivens(state.givens, state.height, state.numberMode);
  const { correctCount, totalBlanks, points } = scoreWallSubmission(state.givens, solved, move.values);

  const submissions = state.submissions.map((sub, idx) =>
    idx === actor
      ? {
          submitted: true,
          values: [...move.values],
          correctCount,
          points,
        }
      : sub,
  );

  const events: GameEvent[] = [
    {
      type: 'submitted',
      seat: actor,
      perfect: correctCount === totalBlanks,
    },
  ];

  if (submissions.some((s) => s === null)) {
    return {
      state: { ...state, submissions },
      events,
    };
  }

  const scores = state.scores.map((sc, idx) => sc + (submissions[idx]?.points ?? 0));
  const lastRound: WallRoundSummary = {
    round: state.round,
    givens: state.givens,
    solution: solved,
    submissions: submissions.map((s) => ({
      values: s!.values ?? solved,
      correctCount: s!.correctCount ?? 0,
      points: s!.points ?? 0,
    })),
  };

  events.push({ type: 'roundOver', round: state.round });

  if (state.round >= state.totalRounds) {
    return {
      state: {
        ...state,
        phase: 'done',
        submissions,
        scores,
        lastRound,
      },
      events,
    };
  }

  const rng = new Rng(state.rng);
  const nextWall = generateWall(rng, state.height, state.numberMode);

  return {
    state: {
      ...state,
      round: state.round + 1,
      givens: nextWall.givens,
      solution: nextWall.solution,
      choicePool: nextWall.choicePool,
      submissions: Array.from({ length: state.seats }, () => null),
      scores,
      lastRound,
      rng: rng.state,
    },
    events,
  };
}

export function playerView(state: NumberWallState, viewer: SeatId): NumberWallState {
  return {
    ...state,
    // Lösung in der Sicht auf Vorgaben reduzieren, bis die Runde vorbei ist
    solution: state.phase === 'done' ? state.solution : state.givens.map((g) => g ?? 0),
    rng: [0, 0, 0, 0],
    submissions: state.submissions.map((sub, idx) => {
      if (!sub) return null;
      if (idx === viewer || state.phase === 'done') return sub;
      return {
        submitted: true,
        values: null,
        correctCount: null,
        points: null,
      };
    }),
  };
}

export function sampleHidden(view: NumberWallState, viewer: SeatId, rng: Rng): NumberWallState {
  const solved = solveWallFromGivens(view.givens, view.height, view.numberMode);
  return {
    ...view,
    solution: solved,
    rng: rng.state,
    submissions: view.submissions.map((sub, idx) => {
      if (!sub || idx === viewer || sub.values !== null) return sub;
      return {
        submitted: true,
        values: solved,
        correctCount: solved.filter((_, i) => view.givens[i] === null).length,
        points: scoreWallSubmission(view.givens, solved, solved).points,
      };
    }),
  };
}

export function result(state: NumberWallState): Result | null {
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
