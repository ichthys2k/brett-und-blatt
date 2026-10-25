import { cardRank, computeBotMove, resolveOptions, type CardId, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { solveFreeCell } from '../src/solver/freecell';
import { solveKlondike } from '../src/solver/klondike';
import { bestPlan, progress } from '../src/solver/lookahead';
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

  it('Klondike: der Löser mit voller Information findet eine regelgerechte Lösung', () => {
    for (const draw of ['1', '3']) {
      const state = start<KlondikeState>({ variant: 'klondike', draw, solvable: 'yes' }, `löser-${draw}`);
      const solution = solveKlondike(state, { maxNodes: 30_000 });
      expect(solution.moves).not.toBeNull();
      expect(playToEnd(state, solution.moves ?? [])).toEqual({ kind: 'win', winners: [0] });
    }
  });

  it('Klondike: der Löser verlangt alle Karten', () => {
    const view = gameModule.playerView(start<KlondikeState>({ variant: 'klondike' }), 0) as KlondikeState;
    expect(() => solveKlondike(view, { maxNodes: 10 })).toThrow();
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

describe('Vorausschau im Detail', () => {
  const empty = () => ({ down: [], up: [] as CardId[] });
  const toTableau = (from: number, to: number, count = 1): SolitaireMove => ({ type: 'move', from: { kind: 'tableau', index: from }, to: { kind: 'tableau', index: to }, count });

  /** Klondike ohne Talon; fehlende Stapel bleiben leer. */
  function klondike(tableau: KlondikeState['tableau'], foundations: CardId[][] = [[], [], [], []]): KlondikeState {
    const piles = [...tableau, ...Array.from({ length: 7 - tableau.length }, empty)];
    return { ...start<KlondikeState>({ variant: 'klondike' }), tableau: piles, foundations, stock: [], waste: [] };
  }

  function spider(tableau: SpiderState['tableau']): SpiderState {
    return { ...start<SpiderState>({ variant: 'spider' }), tableau };
  }

  const view = <T extends SolitaireState>(state: T) => gameModule.playerView(state, 0) as T;

  it('plant über mehrere Züge: erst die Karo 5 ablegen, dann wird die Pik 6 frei', () => {
    const state = klondike(
      [{ down: ['C9.1'], up: ['H5.1'] }, { down: [], up: ['S6.1', 'D5.1'] }],
      [[], ['D1.1', 'D2.1', 'D3.1', 'D4.1'], [], []],
    );
    const plan = bestPlan(view(state), { timeBudgetMs: 1000 });
    expect(plan).toMatchObject({ move: { type: 'move', from: { kind: 'tableau', index: 1 }, to: { kind: 'foundation', index: 1 }, count: 1 }, length: 2 });
  });

  it('sucht nach dem Aufdecken nicht weiter – was darunter liegt, weiß niemand', () => {
    // Pik 6 freilegen und Kreuz-Ass ablegen bringen zusammen am meisten. Würde die
    // Suche nach dem Aufdecken weiterlaufen, käme das Aufdecken als erster Zug heraus.
    const state = klondike([{ down: ['C9.1'], up: ['H5.1'] }, { down: [], up: ['S6.1'] }, { down: [], up: ['C1.1'] }]);
    const plan = bestPlan(view(state), { timeBudgetMs: 1000 });
    expect(plan?.move).toEqual({ type: 'move', from: { kind: 'tableau', index: 2 }, to: { kind: 'foundation', index: 0 }, count: 1 });
    expect(plan?.length).toBe(2);
  });

  it('ohne Fortschritt gibt es keinen Plan', () => {
    // Nur ein König, der zwischen leeren Spalten wandern kann.
    expect(bestPlan(view(klondike([{ down: [], up: ['H13.1'] }])), { timeBudgetMs: 1000 })).toBeNull();
  });

  it('nimmt den direkten Weg und zieht die Planlänge vom Gewinn ab', () => {
    // Der Karo-König könnte vorher in eine leere Spalte – das ist nur ein Umweg.
    const state = klondike([{ down: ['C9.1'], up: ['H5.1'] }, { down: [], up: ['S6.1'] }, { down: ['C2.1'], up: ['D13.1'] }]);
    const plan = bestPlan(view(state), { timeBudgetMs: 1000 });
    expect(plan).toEqual({ move: toTableau(0, 1), gain: 60 - 1, length: 1 });
  });

  it('Spider: gleichfarbige Folgen zählen mehr als gemischte', () => {
    const rest = Array.from({ length: 9 }, () => ({ down: [], up: ['D2.1'] }));
    const suited = progress(spider([{ down: [], up: ['S9.1', 'S8.1'] }, ...rest]));
    const mixed = progress(spider([{ down: [], up: ['S9.1', 'H8.1'] }, ...rest]));
    expect(suited - mixed).toBe(6);
  });

  it('Spider: eine Folge König bis Ass im Plan wird abgelegt und hoch bewertet', () => {
    const run = Array.from({ length: 12 }, (_, i) => `S${13 - i}.1`);
    const rest = Array.from({ length: 8 }, () => ({ down: [], up: ['H9.1'] }));
    const state = spider([{ down: ['H5.1'], up: run }, { down: [], up: ['S1.1'] }, ...rest]);
    const plan = bestPlan(view(state), { timeBudgetMs: 1000 });
    expect(plan?.move).toEqual(toTableau(1, 0));
    expect(plan!.gain).toBeGreaterThan(600);
  });

  it('endet, auch wenn Karten hin und her pendeln können', () => {
    // Die Herz 5 passt auf beide schwarzen Sechsen; ohne Zeitgrenze hilft nur das Merken gesehener Stellungen.
    const state = klondike([{ down: [], up: ['S6.1'] }, { down: [], up: ['C6.1', 'H5.1'] }]);
    expect(bestPlan(view(state), { timeBudgetMs: 0, now: () => 0, maxNodes: Infinity })).toBeNull();
  });

  it('hält Zeit- und Knotengrenze ein und behält das Beste aus der ersten Ebene', () => {
    const reveal = klondike([{ down: ['C9.1'], up: ['H5.1'] }, { down: [], up: ['S6.1'] }]);
    expect(bestPlan(view(reveal), { timeBudgetMs: 1000, maxNodes: 0 })?.move).toEqual(toTableau(0, 1));
    // Die Uhr springt bei jeder Abfrage eine Sekunde weiter: Die Suche bricht beim ersten Zeitblick ab.
    let calls = 0;
    const now = () => ++calls * 1000;
    // Lauter einzelne Karten, die sich vielfach aufeinander stapeln lassen: weit mehr als 32 Stellungen.
    const busy = klondike(['S6.1', 'C6.1', 'H5.1', 'D5.1', 'S4.1', 'C4.1', 'H3.1'].map((card) => ({ down: [], up: [card] })));
    bestPlan(view(busy), { timeBudgetMs: 500, now });
    expect(calls).toBe(2);
    // Gegenprobe mit stehender Uhr: Die Suche läuft deutlich länger.
    calls = 0;
    bestPlan(view(busy), { timeBudgetMs: 500, now: () => (calls++, 0) });
    expect(calls).toBeGreaterThan(2);
  });

  it('arbeitet nur mit der Sicht und schlägt nur regelgerechte Züge vor', () => {
    const cases: Options[] = [{ variant: 'klondike', draw: '1' }, { variant: 'spider', spiderSuits: '1' }, { variant: 'spider', spiderSuits: '2' }, { variant: 'spider', spiderSuits: '4' }];
    for (const options of cases) {
      for (let g = 0; g < 5; g++) {
        // Ein paar Züge vorspielen, damit nicht nur Anfangsstellungen geprüft werden.
        let state: SolitaireState = start(options, `vorausschau-${g}`);
        for (let i = 0; i < g * 6 && gameModule.result(state) === null; i++) {
          const seat = gameModule.currentPlayers(state)[0]!;
          const moves = gameModule.legalMoves(state, seat);
          state = gameModule.applyMove(state, seat, moves[(i * 7 + g) % moves.length]!).state;
        }
        if (gameModule.result(state) !== null || !gameModule.currentPlayers(state).includes(0)) continue;
        const seen = view(state) as KlondikeState | SpiderState;
        const before = structuredClone(seen);
        const plan = bestPlan(seen, { timeBudgetMs: 0, now: () => 0, maxNodes: 2000 });
        expect(seen).toEqual(before);
        if (plan) {
          expect(plan.gain).toBeGreaterThan(0);
          expect(plan.length).toBeGreaterThanOrEqual(1);
          expect(gameModule.legalMoves(state, 0)).toContainEqual(plan.move);
        }
        // Andere verdeckte Karten, gleiche Sicht: derselbe Plan.
        const hidden = (state as KlondikeState | SpiderState).tableau.flatMap((p) => p.down).reverse();
        const shuffled = { ...state, tableau: (state as KlondikeState | SpiderState).tableau.map((p) => ({ up: p.up, down: hidden.splice(0, p.down.length) })) } as SolitaireState;
        expect(bestPlan(view(shuffled) as KlondikeState | SpiderState, { timeBudgetMs: 0, now: () => 0, maxNodes: 2000 })).toEqual(plan);
      }
    }
  });
});

describe('Nur lösbare Spiele', () => {
  it('Klondike und FreeCell: jedes ausgeteilte Spiel ist lösbar', () => {
    for (let g = 0; g < 4; g++) {
      const klondike = start<KlondikeState>({ variant: 'klondike', solvable: 'yes' }, `lösbar-${g}`);
      expect(solveKlondike(klondike, { maxNodes: 30_000 }).moves).not.toBeNull();
      const freecell = start<FreeCellState>({ variant: 'freecell', solvable: 'yes' }, `lösbar-${g}`);
      expect(solveFreeCell(freecell, { timeBudgetMs: 1, now: () => 0, maxNodes: 30_000 }).moves).not.toBeNull();
    }
  });

  it('das Austeilen bleibt aus dem Seed wiederholbar und vollständig', () => {
    const a = start<KlondikeState>({ variant: 'klondike', solvable: 'yes' }, 'gleich');
    expect(start({ variant: 'klondike', solvable: 'yes' }, 'gleich')).toEqual(a);
    expect(new Set(allCards(a)).size).toBe(52);
  });

  it('ohne die Option bleibt das Austeilen wie bisher', () => {
    expect(start({ variant: 'klondike', solvable: 'no' }, 'alt')).toEqual(start({ variant: 'klondike' }, 'alt'));
  });
});

/** Spielt Züge regelgerecht nach; den Rest übernimmt wie im Spiel die Automatik. */
function playToEnd(initial: SolitaireState, moves: SolitaireMove[]) {
  let state = initial;
  for (const move of moves) {
    if (!gameModule.currentPlayers(state).includes(0)) break;
    state = gameModule.applyMove(state, 0, move).state;
  }
  while (gameModule.currentPlayers(state)[0] === 'system') state = gameModule.applyMove(state, 'system', gameModule.legalMoves(state, 'system')[0]!).state;
  return gameModule.result(state);
}

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 8, botGames: 1, maxMoves: 1600 })) test(check.name, check.run);
});
