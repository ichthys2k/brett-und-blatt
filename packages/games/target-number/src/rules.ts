import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

export type TargetMode = 'classic24' | 'target100' | 'target500';
export type AllowedOps = 'all' | 'addSubMul';
export type MathOp = '+' | '-' | '*' | '/';

export interface CalcStep {
  a: number;
  op: MathOp;
  b: number;
}

export interface EvalItem {
  value: number;
  expr: string;
  prec: number;
}

export interface PlayerSubmission {
  submitted: boolean;
  value: number | null;
  expr: string | null;
  usedAll: boolean;
  points: number | null;
}

export interface RoundSummary {
  round: number;
  target: number;
  cards: number[];
  solutionExpr: string;
  submissions: {
    value: number;
    expr: string;
    usedAll: boolean;
    points: number;
  }[];
}

export interface TargetNumberState {
  seats: number;
  mode: TargetMode;
  allowedOps: AllowedOps;
  totalRounds: number;
  round: number;
  phase: 'play' | 'done';
  target: number;
  cards: number[];
  submissions: (PlayerSubmission | null)[];
  scores: number[];
  lastRound: RoundSummary | null;
  rng: RngState;
}

export type TargetNumberMove = {
  type: 'submit';
  steps: CalcStep[];
  finalIndex: number;
};

/** Kuratierte 4er-Kombinationen für den Klassik-24-Modus (alle mit +, −, · lösbar). */
const CLASSIC_24_POOL: readonly (readonly [number, number, number, number])[] = [
  [1, 2, 3, 4],
  [1, 3, 4, 6],
  [1, 4, 5, 6],
  [2, 3, 4, 6],
  [2, 3, 5, 12],
  [2, 4, 6, 8],
  [2, 5, 7, 10],
  [3, 3, 6, 6],
  [3, 4, 5, 8],
  [3, 4, 7, 9],
  [3, 5, 6, 9],
  [3, 6, 8, 10],
  [4, 4, 6, 8],
  [4, 5, 6, 9],
  [4, 6, 7, 9],
  [4, 7, 8, 9],
  [5, 5, 7, 11],
  [5, 6, 7, 8],
  [6, 6, 8, 8],
  [2, 6, 9, 12],
];

export function allowedOpList(allowedOps: AllowedOps): readonly MathOp[] {
  return allowedOps === 'addSubMul' ? ['+', '-', '*'] : ['+', '-', '*', '/'];
}

export function applySingleStep(left: EvalItem, op: MathOp, right: EvalItem, allowedOps: AllowedOps): EvalItem | null {
  if (op === '/' && allowedOps === 'addSubMul') return null;
  let value = 0;
  let prec = 1;
  let sym = '+';
  switch (op) {
    case '+':
      value = left.value + right.value;
      prec = 1;
      sym = '+';
      break;
    case '-':
      if (left.value < right.value) return null;
      value = left.value - right.value;
      prec = 1;
      sym = '−';
      break;
    case '*':
      value = left.value * right.value;
      prec = 2;
      sym = '·';
      break;
    case '/':
      if (right.value <= 0 || left.value % right.value !== 0) return null;
      value = left.value / right.value;
      prec = 2;
      sym = ':';
      break;
  }
  const leftStr = left.prec < prec ? `(${left.expr})` : left.expr;
  const rightStr =
    right.prec < prec || (right.prec === prec && (op === '-' || op === '/'))
      ? `(${right.expr})`
      : right.expr;
  return {
    value,
    expr: `${leftStr} ${sym} ${rightStr}`,
    prec,
  };
}

/** Führt eine Folge von Rechenschritten auf den Startkarten aus. */
export function simulateSteps(
  initialCards: readonly number[],
  steps: readonly CalcStep[],
  allowedOps: AllowedOps,
): EvalItem[] | null {
  let items: EvalItem[] = initialCards.map((v) => ({ value: v, expr: String(v), prec: 3 }));
  for (const step of steps) {
    if (
      !Number.isInteger(step.a) ||
      !Number.isInteger(step.b) ||
      step.a < 0 ||
      step.a >= items.length ||
      step.b < 0 ||
      step.b >= items.length ||
      step.a === step.b
    ) {
      return null;
    }
    const combined = applySingleStep(items[step.a]!, step.op, items[step.b]!, allowedOps);
    if (!combined) return null;
    const next: EvalItem[] = [];
    for (let i = 0; i < items.length; i++) {
      if (i !== step.a && i !== step.b) next.push(items[i]!);
    }
    next.push(combined);
    items = next;
  }
  return items;
}

/** Berechnet die Punktzahl für ein eingereichtes Ergebnis. */
export function scoreSubmission(value: number, target: number, usedAll: boolean): number {
  const diff = Math.abs(value - target);
  if (diff === 0) return usedAll ? 12 : 10;
  if (diff <= 2) return 7;
  if (diff <= 5) return 5;
  if (diff <= 10) return 3;
  return 1;
}

export interface CandidateSolution {
  move: TargetNumberMove;
  value: number;
  expr: string;
  diff: number;
  usedAll: boolean;
  points: number;
}

/**
 * Sucht deterministisch nach guten und exakten Zügen für die aktuellen Tischkarten.
 * Liefert absteigend nach Punktzahl sortierte Kandidaten (exakt mit allen Karten zuerst).
 */
export function findCandidateMoves(
  cards: readonly number[],
  target: number,
  allowedOps: AllowedOps,
  maxDepth = 3,
): CandidateSolution[] {
  const ops = allowedOpList(allowedOps);
  const candidates: CandidateSolution[] = [];
  const seenKeys = new Set<string>();

  const record = (steps: CalcStep[], finalIndex: number, item: EvalItem, remainingCount: number) => {
    const usedAll = remainingCount === 1 && steps.length === cards.length - 1;
    const key = `${item.value}|${usedAll ? 1 : 0}|${steps.length}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    const diff = Math.abs(item.value - target);
    const points = scoreSubmission(item.value, target, usedAll);
    candidates.push({
      move: { type: 'submit', steps: [...steps], finalIndex },
      value: item.value,
      expr: item.expr,
      diff,
      usedAll,
      points,
    });
  };

  // 0-Schritt-Kandidat (beste Einzelkarte)
  let bestZeroIdx = 0;
  for (let i = 1; i < cards.length; i++) {
    if (Math.abs(cards[i]! - target) < Math.abs(cards[bestZeroIdx]! - target)) {
      bestZeroIdx = i;
    }
  }
  record(
    [],
    bestZeroIdx,
    { value: cards[bestZeroIdx]!, expr: String(cards[bestZeroIdx]!), prec: 3 },
    cards.length,
  );

  let foundExactAll = false;
  const depthLimit = Math.min(maxDepth, cards.length - 1);

  const dfs = (items: EvalItem[], steps: CalcStep[]) => {
    if (foundExactAll && candidates.length >= 8) return;
    if (steps.length >= depthLimit) return;

    const n = items.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        // Bei kommutativen Operatoren (+ und *) nur i < j prüfen, um Suchbaum klein zu halten
        for (const op of ops) {
          if ((op === '+' || op === '*') && i > j) continue;
          const combined = applySingleStep(items[i]!, op, items[j]!, allowedOps);
          if (!combined) continue;
          const nextItems: EvalItem[] = [];
          for (let k = 0; k < n; k++) {
            if (k !== i && k !== j) nextItems.push(items[k]!);
          }
          nextItems.push(combined);
          const nextSteps = [...steps, { a: i, op, b: j }];
          const finalIdx = nextItems.length - 1;
          if (
            combined.value === target ||
            Math.abs(combined.value - target) <= 10 ||
            nextSteps.length <= 2
          ) {
            record(nextSteps, finalIdx, combined, nextItems.length);
            if (combined.value === target && nextItems.length === 1) {
              foundExactAll = true;
            }
          }
          if (!foundExactAll && nextItems.length > 1 && nextSteps.length < depthLimit) {
            dfs(nextItems, nextSteps);
          }
        }
      }
    }
  };

  dfs(
    cards.map((v) => ({ value: v, expr: String(v), prec: 3 })),
    [],
  );

  candidates.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.diff !== b.diff) return a.diff - b.diff;
    if (a.usedAll !== b.usedAll) return a.usedAll ? -1 : 1;
    return b.move.steps.length - a.move.steps.length;
  });

  return candidates;
}

/** Erzeugt eine garantiert lösbare Aufgabe für die aktuelle Runde. */
function generateRoundPuzzle(
  rng: Rng,
  mode: TargetMode,
  allowedOps: AllowedOps,
): { cards: number[]; target: number } {
  if (mode === 'classic24') {
    const tuple = rng.pick(CLASSIC_24_POOL);
    const cards = rng.shuffle([...tuple]);
    return { cards, target: 24 };
  }

  const ops = allowedOpList(allowedOps);
  const is500 = mode === 'target500';
  const minTarget = is500 ? 105 : 18;
  const maxTarget = is500 ? 499 : 99;

  for (let attempt = 0; attempt < 25; attempt++) {
    const smallPool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const bigPool = is500 ? [10, 20, 25, 50, 75] : [10, 12, 15, 20, 25];
    const cards: number[] = [];
    const smallCount = is500 ? 4 : 4;
    const bigCount = is500 ? 2 : 1;
    for (let i = 0; i < smallCount; i++) cards.push(rng.pick(smallPool));
    for (let i = 0; i < bigCount; i++) cards.push(rng.pick(bigPool));

    // Konstruiere durch 3 gültige Zufallsschritte eine erreichbare Zielzahl
    let work = [...cards];
    const stepCount = 3;
    for (let s = 0; s < stepCount && work.length >= 2; s++) {
      const a = rng.int(work.length);
      let b = rng.int(work.length - 1);
      if (b >= a) b++;
      const op = rng.pick(ops);
      const item = applySingleStep(
        { value: work[a]!, expr: '', prec: 3 },
        op,
        { value: work[b]!, expr: '', prec: 3 },
        allowedOps,
      );
      if (!item || item.value <= 0 || item.value > maxTarget * 2) break;
      const next: number[] = [];
      for (let k = 0; k < work.length; k++) {
        if (k !== a && k !== b) next.push(work[k]!);
      }
      next.push(item.value);
      work = next;
    }
    const candidateTarget = work[work.length - 1]!;
    if (candidateTarget >= minTarget && candidateTarget <= maxTarget && !cards.includes(candidateTarget)) {
      return { cards: rng.shuffle(cards), target: candidateTarget };
    }
  }

  // Garantierter Fallback
  return is500
    ? { cards: [25, 10, 6, 4, 3, 2], target: 158 }
    : { cards: [15, 6, 4, 3, 2], target: 62 };
}

export function setup(seats: number, options: Options, seed: string): TargetNumberState {
  const mode: TargetMode =
    options.mode === 'target100' || options.mode === 'target500' ? options.mode : 'classic24';
  const allowedOps: AllowedOps = options.ops === 'addSubMul' ? 'addSubMul' : 'all';
  const totalRounds = Number(options.rounds) || 5;

  const rng = Rng.fromSeed(seed, 'target-number');
  const puzzle = generateRoundPuzzle(rng, mode, allowedOps);

  return {
    seats,
    mode,
    allowedOps,
    totalRounds,
    round: 1,
    phase: 'play',
    target: puzzle.target,
    cards: puzzle.cards,
    submissions: Array.from({ length: seats }, () => null),
    scores: Array.from({ length: seats }, () => 0),
    lastRound: null,
    rng: rng.state,
  };
}

export function currentPlayers(state: TargetNumberState): Actor[] {
  if (state.phase === 'done') return [];
  const active: Actor[] = [];
  for (let s = 0; s < state.seats; s++) {
    if (state.submissions[s] === null) active.push(s);
  }
  return active;
}

export function isLegal(state: TargetNumberState, actor: Actor, move: TargetNumberMove): boolean {
  if (typeof actor !== 'number' || actor < 0 || actor >= state.seats) return false;
  if (state.phase !== 'play' || state.submissions[actor] !== null) return false;
  if (!move || move.type !== 'submit' || !Array.isArray(move.steps)) return false;
  const items = simulateSteps(state.cards, move.steps, state.allowedOps);
  if (!items) return false;
  if (!Number.isInteger(move.finalIndex) || move.finalIndex < 0 || move.finalIndex >= items.length) {
    return false;
  }
  return true;
}

export function legalMoves(state: TargetNumberState, actor: Actor): TargetNumberMove[] {
  if (typeof actor !== 'number' || actor < 0 || actor >= state.seats) return [];
  if (state.phase !== 'play' || state.submissions[actor] !== null) return [];
  const candidates = findCandidateMoves(state.cards, state.target, state.allowedOps, 3);
  return candidates.slice(0, 5).map((c) => c.move);
}

export function applyMove(
  state: TargetNumberState,
  actor: Actor,
  move: TargetNumberMove,
): MoveResult<TargetNumberState> {
  if (!isLegal(state, actor, move) || typeof actor !== 'number') {
    return { state, events: [] };
  }
  const items = simulateSteps(state.cards, move.steps, state.allowedOps)!;
  const chosen = items[move.finalIndex]!;
  const usedAll = items.length === 1 && move.steps.length === state.cards.length - 1;
  const points = scoreSubmission(chosen.value, state.target, usedAll);

  const submissions = state.submissions.map((sub, idx) =>
    idx === actor
      ? {
          submitted: true,
          value: chosen.value,
          expr: chosen.expr,
          usedAll,
          points,
        }
      : sub,
  );

  const events: GameEvent[] = [
    {
      type: 'submitted',
      seat: actor,
      exact: chosen.value === state.target,
    },
  ];

  // Prüfen, ob alle Plätze abgegeben haben
  if (submissions.some((s) => s === null)) {
    return {
      state: { ...state, submissions },
      events,
    };
  }

  // Runde auswerten
  const scores = state.scores.map((sc, idx) => sc + (submissions[idx]?.points ?? 0));
  const bestCandidate = findCandidateMoves(state.cards, state.target, state.allowedOps, 3)[0];
  const solutionExpr = bestCandidate
    ? `${bestCandidate.expr} = ${bestCandidate.value}`
    : String(state.target);

  const lastRound: RoundSummary = {
    round: state.round,
    target: state.target,
    cards: state.cards,
    solutionExpr,
    submissions: submissions.map((s) => ({
      value: s!.value ?? 0,
      expr: s!.expr ?? '0',
      usedAll: s!.usedAll,
      points: s!.points ?? 0,
    })),
  };

  events.push({ type: 'roundOver', round: state.round, target: state.target, solutionExpr });

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
  const nextPuzzle = generateRoundPuzzle(rng, state.mode, state.allowedOps);

  return {
    state: {
      ...state,
      round: state.round + 1,
      target: nextPuzzle.target,
      cards: nextPuzzle.cards,
      submissions: Array.from({ length: state.seats }, () => null),
      scores,
      lastRound,
      rng: rng.state,
    },
    events,
  };
}

export function playerView(state: TargetNumberState, viewer: SeatId): TargetNumberState {
  return {
    ...state,
    rng: [0, 0, 0, 0],
    submissions: state.submissions.map((sub, idx) => {
      if (!sub) return null;
      if (idx === viewer || state.phase === 'done') return sub;
      return {
        submitted: true,
        value: null,
        expr: null,
        usedAll: false,
        points: null,
      };
    }),
  };
}

export function sampleHidden(view: TargetNumberState, viewer: SeatId, rng: Rng): TargetNumberState {
  const fallbackVal = view.cards[0] ?? 0;
  return {
    ...view,
    rng: rng.state,
    submissions: view.submissions.map((sub, idx) => {
      if (!sub || idx === viewer || sub.value !== null) return sub;
      return {
        submitted: true,
        value: fallbackVal,
        expr: String(fallbackVal),
        usedAll: false,
        points: scoreSubmission(fallbackVal, view.target, false),
      };
    }),
  };
}

export function result(state: TargetNumberState): Result | null {
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
