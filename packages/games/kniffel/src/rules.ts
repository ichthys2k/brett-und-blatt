import { Rng, sameValue, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export interface KniffelDice {
  values: [DieValue, DieValue, DieValue, DieValue, DieValue];
  held: [boolean, boolean, boolean, boolean, boolean];
}

export type UpperCategory = 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes';
export type LowerCategory =
  | 'threeOfAKind'
  | 'fourOfAKind'
  | 'fullHouse'
  | 'smallStraight'
  | 'largeStraight'
  | 'kniffel'
  | 'chance';

export type Category = UpperCategory | LowerCategory;

export const UPPER_CATEGORIES: readonly UpperCategory[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER_CATEGORIES: readonly LowerCategory[] = [
  'threeOfAKind',
  'fourOfAKind',
  'fullHouse',
  'smallStraight',
  'largeStraight',
  'kniffel',
  'chance',
];
export const ALL_CATEGORIES: readonly Category[] = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

export const CATEGORY_LABELS: Record<Category, string> = {
  ones: 'Einser',
  twos: 'Zweier',
  threes: 'Dreier',
  fours: 'Vierer',
  fives: 'Fünfer',
  sixes: 'Sechser',
  threeOfAKind: 'Dreierpasch',
  fourOfAKind: 'Viererpasch',
  fullHouse: 'Full House',
  smallStraight: 'Kleine Straße',
  largeStraight: 'Große Straße',
  kniffel: 'Kniffel',
  chance: 'Chance',
};

export interface PlayerSheet {
  scores: Partial<Record<Category, number>>;
  upperSum: number;
  upperBonus: number;
  lowerSum: number;
  total: number;
}

export interface KniffelState {
  seats: number;
  turn: SeatId;
  phase: 'roll' | 'score';
  rollsLeft: number;
  dice: KniffelDice | null;
  sheets: PlayerSheet[];
  finished: boolean;
  rng: RngState;
}

export type KniffelMove =
  | { type: 'roll' }
  | { type: 'hold'; index: number }
  | { type: 'unhold'; index: number }
  | { type: 'toggleHold'; index: number }
  | { type: 'score'; category: Category };

function emptySheet(): PlayerSheet {
  return { scores: {}, upperSum: 0, upperBonus: 0, lowerSum: 0, total: 0 };
}

function countValues(values: readonly DieValue[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return map;
}

function sum(values: readonly DieValue[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

export function calculateScore(category: Category, values: readonly DieValue[]): number {
  const counts = countValues(values);
  const vals = [...values];
  vals.sort((a, b) => a - b);

  if (category === 'ones') return values.filter((v) => v === 1).length * 1;
  if (category === 'twos') return values.filter((v) => v === 2).length * 2;
  if (category === 'threes') return values.filter((v) => v === 3).length * 3;
  if (category === 'fours') return values.filter((v) => v === 4).length * 4;
  if (category === 'fives') return values.filter((v) => v === 5).length * 5;
  if (category === 'sixes') return values.filter((v) => v === 6).length * 6;

  if (category === 'chance') return sum(values);

  const maxCount = Math.max(0, ...counts.values());

  if (category === 'threeOfAKind') {
    if (maxCount >= 3) return sum(values);
    return 0;
  }
  if (category === 'fourOfAKind') {
    if (maxCount >= 4) return sum(values);
    return 0;
  }
  if (category === 'kniffel') {
    if (maxCount >= 5) return 50;
    return 0;
  }
  if (category === 'fullHouse') {
    const values = [...counts.values()].sort((a,b)=>b-a);
    if (values[0] === 3 && values[1] === 2) return 25;
    return 0;
  }
  if (category === 'smallStraight') {
    const set = new Set(vals);
    const straights = [
      [1, 2, 3, 4],
      [2, 3, 4, 5],
      [3, 4, 5, 6],
    ];
    for (const s of straights) {
      if (s.every((n: any) => set.has(n))) return 30;
    }
    if ([1,2,3,4,5].every((n: number) => set.has(n as any))) return 30;
    if ([2,3,4,5,6].every((n: number) => set.has(n as any))) return 30;
    return 0;
  }
  if (category === 'largeStraight') {
    const set = new Set(vals);
    if ((set.has(1) && set.has(2) && set.has(3) && set.has(4) && set.has(5)) || (set.has(2) && set.has(3) && set.has(4) && set.has(5) && set.has(6))) {
      return 40;
    }
    return 0;
  }
  return 0;
}

function recomputeSheet(sheet: PlayerSheet): PlayerSheet {
  let upperSum = 0;
  for (const cat of UPPER_CATEGORIES) {
    const v = sheet.scores[cat];
    if (typeof v === 'number') upperSum += v;
  }
  const upperBonus = upperSum >= 63 ? 35 : 0;
  let lowerSum = 0;
  for (const cat of LOWER_CATEGORIES) {
    const v = sheet.scores[cat];
    if (typeof v === 'number') lowerSum += v;
  }
  const total = upperSum + upperBonus + lowerSum;
  return { ...sheet, upperSum, upperBonus, lowerSum, total };
}

function isSheetComplete(sheet: PlayerSheet): boolean {
  return ALL_CATEGORIES.every((cat) => typeof sheet.scores[cat] === 'number');
}

export function setup(seats: number, _options: Options, seed: string): KniffelState {
  const s = Math.max(1, Math.min(6, seats));
  return {
    seats: s,
    turn: 0,
    phase: 'roll',
    rollsLeft: 3,
    dice: null,
    sheets: Array.from({ length: s }, () => emptySheet()),
    finished: false,
    rng: Rng.fromSeed(seed, 'kniffel').state,
  };
}

export function currentPlayers(state: KniffelState): Actor[] {
  if (state.finished || result(state)) return [];
  return [state.turn];
}

function rollDiceValues(rngState: RngState): { values: [DieValue, DieValue, DieValue, DieValue, DieValue]; rng: RngState } {
  const rng = new Rng(rngState);
  const values: DieValue[] = [];
  for (let i = 0; i < 5; i++) {
    values.push((rng.int(6) + 1) as DieValue);
  }
  return { values: [values[0], values[1], values[2], values[3], values[4]], rng: rng.state };
}

export function legalMoves(state: KniffelState, actor: Actor): KniffelMove[] {
  if (state.finished) return [];
  if (actor !== state.turn || result(state)) return [];
  const moves: KniffelMove[] = [];
  if (state.phase === 'roll' && state.rollsLeft > 0) {
    moves.push({ type: 'roll' });
    // Nach dem ersten Wurf darf man jederzeit eintragen, nicht erst nach dem dritten.
    if (state.dice) {
      const sheet = state.sheets[state.turn]!;
      for (const cat of ALL_CATEGORIES) {
        if (typeof sheet.scores[cat] !== 'number') moves.push({ type: 'score', category: cat });
      }
    }
    return moves;
  }
  if ((state.phase === 'score' || state.rollsLeft === 0) && state.dice) {
    const sheet = state.sheets[state.turn]!;
    for (const cat of ALL_CATEGORIES) {
      if (typeof sheet.scores[cat] !== 'number') {
        moves.push({ type: 'score', category: cat });
      }
    }
    return moves;
  }
  if (state.phase === 'roll' && state.rollsLeft === 0 && state.dice) {
    const sheet = state.sheets[state.turn]!;
    for (const cat of ALL_CATEGORIES) {
      if (typeof sheet.scores[cat] !== 'number') {
        moves.push({ type: 'score', category: cat });
      }
    }
    return moves;
  }
  return moves;
}

export function applyMove(state: KniffelState, actor: Actor, move: KniffelMove): MoveResult<KniffelState> {
  if (state.finished || result(state)) throw new Error('Spiel ist beendet.');
  if (actor !== state.turn) throw new Error('Du bist nicht am Zug.');
  const events: GameEvent[] = [];

  if (move.type === 'roll') {
    if (state.rollsLeft <= 0) throw new Error('Keine Würfe mehr übrig.');
    let currentDice = state.dice;
    if (!currentDice) {
      const rolled = rollDiceValues(state.rng);
      currentDice = { values: rolled.values as [DieValue, DieValue, DieValue, DieValue, DieValue], held: [false, false, false, false, false] };
      events.push({ type: 'rolled', values: currentDice.values });
      return {
        state: {
          ...state,
          dice: currentDice,
          rollsLeft: state.rollsLeft - 1,
          phase: state.rollsLeft - 1 === 0 ? 'score' : 'roll',
          rng: rolled.rng,
        },
        events,
      };
    } else {
      const held = currentDice.held;
      const rolled = rollDiceValues(state.rng);
      const valuesArr = [...currentDice.values] as any[];
      for (let i = 0; i < 5; i++) {
        if (!held[i]) valuesArr[i] = rolled.values[i];
      }
      const newDice: KniffelDice = { values: [valuesArr[0], valuesArr[1], valuesArr[2], valuesArr[3], valuesArr[4]] as [DieValue, DieValue, DieValue, DieValue, DieValue], held };
      events.push({ type: 'rolled', values: newDice.values });
      return {
        state: {
          ...state,
          dice: newDice,
          rollsLeft: state.rollsLeft - 1,
          phase: state.rollsLeft - 1 === 0 ? 'score' : 'roll',
          rng: rolled.rng,
        },
        events,
      };
    }
  }

  if (move.type === 'toggleHold') {
    if (!state.dice) throw new Error('Noch nicht gewürfelt.');
    if (state.phase === 'score') throw new Error('Du musst jetzt eine Kategorie eintragen.');
    const held = [...state.dice.held] as [boolean, boolean, boolean, boolean, boolean];
    held[move.index] = !held[move.index];
    events.push({ type: 'toggledHold', index: move.index, held: held[move.index] });
    return { state: { ...state, dice: { ...state.dice, held } }, events };
  }

  if (move.type === 'hold') {
    if (!state.dice) throw new Error('Noch nicht gewürfelt.');
    if (state.phase === 'score') throw new Error('Du musst jetzt eine Kategorie eintragen.');
    const held = [...state.dice.held] as [boolean, boolean, boolean, boolean, boolean];
    held[move.index] = true;
    return { state: { ...state, dice: { ...state.dice, held } }, events };
  }

  if (move.type === 'unhold') {
    if (!state.dice) throw new Error('Noch nicht gewürfelt.');
    if (state.phase === 'score') throw new Error('Du musst jetzt eine Kategorie eintragen.');
    const held = [...state.dice.held] as [boolean, boolean, boolean, boolean, boolean];
    held[move.index] = false;
    return { state: { ...state, dice: { ...state.dice, held } }, events };
  }

  if (move.type === 'score') {
    if (!state.dice && state.rollsLeft === 3 && state.phase === 'roll') throw new Error('Du musst erst würfeln.');
    if (!state.dice) throw new Error('Du musst erst würfeln.');
    const sheet = state.sheets[state.turn]!;
    if (typeof sheet.scores[move.category] === 'number') throw new Error('Kategorie bereits ausgefüllt.');
    const score = calculateScore(move.category, state.dice.values);
    const newSheet = recomputeSheet({ ...sheet, scores: { ...sheet.scores, [move.category]: score } });
    const sheets = [...state.sheets];
    sheets[state.turn] = newSheet;
    events.push({ type: 'scored', category: move.category, score, seat: state.turn });

    const nextTurn = (state.turn + 1) % state.seats;
    const allComplete = sheets.every((s) => isSheetComplete(s));
    if (allComplete) {
      return {
        state: {
          ...state,
          sheets,
          turn: nextTurn,
          phase: 'roll',
          rollsLeft: 3,
          dice: null,
          finished: true,
        },
        events,
      };
    }
    return {
      state: {
        ...state,
        sheets,
        turn: nextTurn,
        phase: 'roll',
        rollsLeft: 3,
        dice: null,
        finished: false,
      },
      events,
    };
  }

  throw new Error('Unbekannter Zug');
}

export function result(state: KniffelState): Result | null {
  if (!state.finished && !state.sheets.every((s) => isSheetComplete(s))) return null;
  const maxTotal = Math.max(...state.sheets.map((s) => s.total));
  const winners = state.sheets
    .map((s, i) => ({ i, total: s.total }))
    .filter((x) => x.total === maxTotal)
    .map((x) => x.i as SeatId);
  return { kind: 'win', winners };
}

export function evaluate(state: KniffelState, seat: SeatId): number {
  return state.sheets[seat]?.total ?? 0;
}

/**
 * Würfel halten steht nicht in `legalMoves` (sonst würfeln Zufallsbots endlos hin und her),
 * ist aber nach jedem Wurf vor dem letzten erlaubt.
 */
export function isLegal(state: KniffelState, actor: Actor, move: KniffelMove): boolean {
  if (move.type === 'toggleHold') {
    return (
      actor === state.turn &&
      !state.finished &&
      state.phase === 'roll' &&
      state.rollsLeft > 0 &&
      state.dice !== null &&
      Number.isInteger(move.index) &&
      move.index >= 0 &&
      move.index < 5
    );
  }
  return legalMoves(state, actor).some((m) => sameValue(m, move));
}

/** Der Zufallszustand bleibt geheim, sonst ließen sich online die nächsten Würfe ausrechnen. */
export function playerView(state: KniffelState, _seat: SeatId | 'spectator'): KniffelState {
  return { ...state, rng: [0, 0, 0, 0] };
}

/** Für Bots: einen beliebigen neuen Zufallszustand einsetzen. */
export function sampleHidden(view: KniffelState, _seat: SeatId, rng: Rng): KniffelState {
  return { ...view, rng: rng.state };
}
