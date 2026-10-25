import { cardRank, computeBotMove, resolveOptions, type CardId, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { solveFreeCell } from '../src/solver/freecell';
import { bestPlan } from '../src/solver/lookahead';
import { gameModule, isFree, type FreeCellState, type KlondikeState, type PyramidState, type SolitaireMove, type SolitaireState, type SpiderState } from '../src';

function start<T extends SolitaireState>(options: Options, seed = 'test'): T {
  return gameModule.setup(1, resolveOptions(gameModule, options), seed) as T;
}

function allCards(state: SolitaireState): CardId[] {
  const cards: CardId[] = [];
  const collect = (value: unknown): void => {
    if (typeof value === 'string' && /^[CDHS]\d+\.\d+$/.test(value)) cards.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect({ ...state, lastMove: null });
  return cards;
}

describe('Austeilen', () => {
  it('Klondike: 7 Stapel mit 1–7 Karten, 24 im Talon, jede Karte genau einmal', () => {
    const state = start<KlondikeState>({ variant: 'klondike' });
    expect(state.tableau.map((p) => p.down.length + p.up.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(state.tableau.every((p) => p.up.length === 1)).toBe(true);
    expect(state.stock).toHaveLength(24);
    expect(new Set(allCards(state)).size).toBe(52);
  });

  it('FreeCell: alle 52 offen in 8 Spalten', () => {
    const state = start<FreeCellState>({ variant: 'freecell' });
    expect(state.tableau.map((c) => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    expect(new Set(allCards(state)).size).toBe(52);
  });

  it('Spider: 104 Karten, 54 ausgeteilt, 50 im Talon', () => {
    for (const suits of ['1', '2', '4']) {
      const state = start<SpiderState>({ variant: 'spider', spiderSuits: suits });
      expect(allCards(state)).toHaveLength(104);
      expect(new Set(allCards(state)).size).toBe(104);
      expect(state.stock).toHaveLength(50);
    }
  });

  it('Pyramide: 28 Karten in sieben Reihen, 24 im Talon', () => {
    const state = start<PyramidState>({ variant: 'pyramid' });
    expect(state.pyramid).toHaveLength(28);
    expect(state.stock).toHaveLength(24);
    expect(state.pyramid.map((_, i) => isFree(state, i)).filter(Boolean)).toHaveLength(7);
  });

  it('ist aus dem Seed wiederholbar', () => {
    expect(start({ variant: 'klondike' }, 'x')).toEqual(start({ variant: 'klondike' }, 'x'));
    expect(start({ variant: 'klondike' }, 'x')).not.toEqual(start({ variant: 'klondike' }, 'y'));
  });
});

describe('Klondike', () => {
  it('ein Ass geht auf die Ablage, die Karte darunter wird aufgedeckt', () => {
    let state = start<KlondikeState>({ variant: 'klondike' });
    // Ass von Hand oben auf Stapel 1 legen.
    state = { ...state, tableau: state.tableau.map((p, i) => (i === 1 ? { down: p.down, up: ['H1.1'] } : p)) };
    const move = gameModule.legalMoves(state, 0).find((m) => m.type === 'move' && m.to.kind === 'foundation')!;
    const { state: next, events } = gameModule.applyMove(state, 0, move);
    expect(next.variant === 'klondike' && next.foundations[2]).toEqual(['H1.1']);
    expect(events.some((e) => e.type === 'flipped')).toBe(true);
  });

  it('Talon: ziehen, bis er leer ist, dann umdrehen', () => {
    let state = start<KlondikeState>({ variant: 'klondike', draw: '3' });
    for (let i = 0; i < 8; i++) state = gameModule.applyMove(state, 0, { type: 'draw' }).state as KlondikeState;
    expect(state.stock).toHaveLength(0);
    expect(state.waste).toHaveLength(24);
    expect(gameModule.legalMoves(state, 0)).toContainEqual({ type: 'recycle' });
  });

  it('leere Stapel nehmen nur Könige', () => {
    const state = start<KlondikeState>({ variant: 'klondike' });
    const custom: KlondikeState = { ...state, tableau: [{ down: [], up: [] }, { down: [], up: ['S12.1'] }, { down: [], up: ['H13.1'] }, ...state.tableau.slice(3)] };
    const toEmpty = gameModule.legalMoves(custom, 0).filter((m) => m.type === 'move' && m.to.kind === 'tableau' && m.to.index === 0);
    expect(toEmpty.every((m) => m.type === 'move' && m.from.kind === 'tableau' && m.from.index === 2)).toBe(true);
  });

  it('die Sicht verrät keine verdeckten Karten', () => {
    const view = gameModule.playerView(start<KlondikeState>({ variant: 'klondike' }), 0) as KlondikeState;
    expect(view.tableau.flatMap((p) => p.down).every((c) => c === null)).toBe(true);
    expect(view.stock.every((c) => c === null)).toBe(true);
  });

  it('am Ende legt die Automatik den Rest selbst ab', () => {
    const state = start<KlondikeState>({ variant: 'klondike' });
    // Alles offen: Jeder Stapel enthält eine Farbe absteigend von König bis Ass.
    const suitRun = (suit: string) => Array.from({ length: 13 }, (_, i) => `${suit}${13 - i}.1`);
    const custom: KlondikeState = {
      ...state,
      tableau: [{ down: [], up: suitRun('C') }, { down: [], up: suitRun('D') }, { down: [], up: suitRun('H') }, { down: [], up: suitRun('S') }, { down: [], up: [] }, { down: [], up: [] }, { down: [], up: [] }],
      stock: [],
      waste: [],
    };
    expect(gameModule.currentPlayers(custom)).toEqual(['system']);
  });
});

describe('FreeCell', () => {
  it('Mehrfachverschieben richtet sich nach freien Zellen und Spalten', () => {
    const state = start<FreeCellState>({ variant: 'freecell' });
    const custom: FreeCellState = {
      ...state,
      tableau: [['S9.1', 'H8.1', 'C7.1', 'D6.1'], ['H10.1'], ['C2.1'], ['D3.1'], ['S4.1'], ['H5.1'], ['C9.1'], ['D9.1']],
      cells: ['S1.1', 'H1.1', 'C1.1', null],
    };
    // Eine freie Zelle, keine leere Spalte: höchstens zwei Karten auf einmal.
    const moves = gameModule.legalMoves(custom, 0).filter((m) => m.type === 'move' && m.from.kind === 'tableau' && m.from.index === 0 && m.to.kind === 'tableau');
    expect(moves.every((m) => m.type === 'move' && m.count <= 2)).toBe(true);
    // Die ganze Folge (4 Karten) passt auf die Herz 10 nicht, weil zu wenig frei ist.
    expect(moves.some((m) => m.type === 'move' && m.count === 4)).toBe(false);
  });
});

describe('Spider', () => {
  it('eine vollständige Folge König bis Ass wird abgelegt', () => {
    const state = start<SpiderState>({ variant: 'spider' });
    const run = Array.from({ length: 12 }, (_, i) => `S${13 - i}.1`);
    const custom: SpiderState = {
      ...state,
      tableau: [{ down: ['H5.1'], up: run }, { down: [], up: ['S1.1'] }, ...state.tableau.slice(2)],
    };
    const move: SolitaireMove = { type: 'move', from: { kind: 'tableau', index: 1 }, to: { kind: 'tableau', index: 0 }, count: 1 };
    const { state: next, events } = gameModule.applyMove(custom, 0, move);
    expect(next.variant === 'spider' && next.completed).toEqual(['S13.1']);
    expect(events.some((e) => e.type === 'completed')).toBe(true);
    expect(next.variant === 'spider' && next.tableau[0]!.up).toEqual(['H5.1']);
  });

  it('Austeilen geht nicht, solange eine Spalte leer ist', () => {
    const state = start<SpiderState>({ variant: 'spider' });
    const custom: SpiderState = { ...state, tableau: [{ down: [], up: [] }, ...state.tableau.slice(1)] };
    expect(gameModule.legalMoves(custom, 0)).not.toContainEqual({ type: 'draw' });
    expect(gameModule.legalMoves(state, 0)).toContainEqual({ type: 'draw' });
  });
});

describe('Pyramide', () => {
  it('Paare mit zusammen 13 und Könige allein', () => {
    const state = start<PyramidState>({ variant: 'pyramid' });
    for (const move of gameModule.legalMoves(state, 0)) {
      if (move.type !== 'pair') continue;
      const ranks = move.cards.map((loc) => cardRank((loc.kind === 'waste' ? state.waste.at(-1) : state.pyramid[loc.index]) as CardId));
      expect(ranks.length === 1 ? ranks[0] : ranks[0]! + ranks[1]!).toBe(13);
    }
  });

  it('der Talon darf nur zweimal umgedreht werden', () => {
    let state = start<PyramidState>({ variant: 'pyramid' });
    state = { ...state, stock: [], waste: ['S2.1'], recycles: 2 };
    expect(gameModule.legalMoves(state, 0)).not.toContainEqual({ type: 'recycle' });
  });
});

describe('Bot', () => {
  it('legt ein freies Ass sofort ab', () => {
    const state = start<KlondikeState>({ variant: 'klondike' });
    const custom: KlondikeState = { ...state, waste: ['D1.1'] };
    const move = computeBotMove(gameModule, { gameId: 'solitaire', botId: 'solitaire', level: 'hard', seat: 0, view: gameModule.playerView(custom, 0), seed: 'x', timeBudgetMs: 10 }) as SolitaireMove;
    expect(move).toMatchObject({ type: 'move', to: { kind: 'foundation' } });
  });
});

describe('Löser und Vorausschau', () => {
  it('FreeCell: der Löser findet eine Lösung, die sich regelgerecht nachspielen lässt', () => {
    let state: SolitaireState = start<FreeCellState>({ variant: 'freecell' });
    const solution = solveFreeCell(state as FreeCellState, { timeBudgetMs: 5000 });
    expect(solution.moves).not.toBeNull();
    for (const move of solution.moves ?? []) {
      // Liegt alles sortiert, legt die Spielleitung den Rest selbst ab.
      if (!gameModule.currentPlayers(state).includes(0)) break;
      state = gameModule.applyMove(state, 0, move).state;
    }
    while (gameModule.currentPlayers(state)[0] === 'system') state = gameModule.applyMove(state, 'system', gameModule.legalMoves(state, 'system')[0]!).state;
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [0] });
  });

  it('Klondike: die Vorausschau legt eine verdeckte Karte frei', () => {
    const empty = { down: [], up: [] };
    const state: KlondikeState = {
      ...start<KlondikeState>({ variant: 'klondike' }),
      tableau: [{ down: ['C9.1'], up: ['H5.1'] }, { down: [], up: ['S6.1'] }, empty, empty, empty, empty, empty],
      stock: [],
      waste: [],
    };
    const plan = bestPlan(gameModule.playerView(state, 0) as KlondikeState, { timeBudgetMs: 1000 });
    expect(plan?.move).toEqual({ type: 'move', from: { kind: 'tableau', index: 0 }, to: { kind: 'tableau', index: 1 }, count: 1 });
  });

  it('Spider: ohne sinnvollen Zug rät der Tipp zum Austeilen', () => {
    const base = start<SpiderState>({ variant: 'spider' });
    const tableau = base.tableau.map((_, i) => ({ down: ['S1.1'], up: [`S${(i % 2) * 6 + 2}.1`] }));
    const state: SpiderState = { ...base, tableau };
    const move = computeBotMove(gameModule, { gameId: 'solitaire', botId: 'solitaire', level: 'hard', seat: 0, view: gameModule.playerView(state, 0), seed: 'x', timeBudgetMs: 200 }) as SolitaireMove;
    expect(move).toEqual({ type: 'draw' });
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 8, botGames: 1, maxMoves: 1600 })) test(check.name, check.run);
});
