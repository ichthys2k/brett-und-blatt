import { computeBotMove } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import {
  countPieces,
  gameModule,
  isDarkSquare,
  squareIndex,
  squareName,
  type CheckersMove,
  type CheckersState,
} from '../src';
import { boardMoves } from '../src/rules';

describe('Dame – Regeln & Mechaniken', () => {
  it('Startaufstellung 8×8 hat je 12 Steine auf dunklen Feldern und Weiß beginnt', () => {
    const state = gameModule.setup(2, { size: '8' }, 'test') as CheckersState;
    expect(state.turn).toBe(0);
    expect(state.size).toBe(8);

    const [white, black] = countPieces(state.cells);
    expect(white.total).toBe(12);
    expect(white.kings).toBe(0);
    expect(black.total).toBe(12);
    expect(black.kings).toBe(0);

    for (let i = 0; i < state.cells.length; i++) {
      const col = i % 8;
      const row = Math.floor(i / 8);
      if (state.cells[i]) {
        expect(isDarkSquare(col, row)).toBe(true);
      }
    }

    // Weiß hat im ersten Zug genau 7 erlaubte Vorwärtszüge (b3->a4, c4; d3->c4, e4; f3->e4, g4; h3->g4)
    const moves = boardMoves(state, 0);
    expect(moves).toHaveLength(7);
  });

  it('Startaufstellung 10×10 hat je 20 Steine', () => {
    const state = gameModule.setup(2, { size: '10' }, 'test') as CheckersState;
    expect(state.size).toBe(10);
    const [white, black] = countPieces(state.cells);
    expect(white.total).toBe(20);
    expect(black.total).toBe(20);
  });

  it('Einfache Vorwärtszüge ändern das Feld und wechseln den Spieler', () => {
    const state = gameModule.setup(2, { size: '8' }, 'test') as CheckersState;
    // Weiß zieht c3-d4 (Index für c3 und d4 ermitteln)
    const from = squareIndex('c3', 8);
    const to = squareIndex('d4', 8);
    const move = boardMoves(state, 0).find((m) => m.from === from && m.to === to);
    expect(move).toBeDefined();

    const result = gameModule.applyMove(state, 0, move!);
    expect(result.state.turn).toBe(1);
    expect(result.state.cells[from]).toBeNull();
    expect(result.state.cells[to]).toEqual({ seat: 0, king: false });
    expect(result.events[0]).toMatchObject({ type: 'moved', seat: 0 });
  });

  it('Schlagpflicht zwingt zum Schlagen gegnerischer Steine', () => {
    // Stellung manuell aufbauen: Weiß auf c3 (row 5, col 2), Schwarz auf d4 (row 4, col 3)
    const state = gameModule.setup(2, { size: '8' }, 'test') as CheckersState;
    // Zellen leeren
    state.cells = Array(64).fill(null);
    const c3 = squareIndex('c3', 8);
    const d4 = squareIndex('d4', 8);
    state.cells[c3] = { seat: 0, king: false };
    state.cells[d4] = { seat: 1, king: false };
    // Noch ein weißer Stein auf a1, der normalerweise ziehen könnte
    const a1 = squareIndex('a1', 8);
    state.cells[a1] = { seat: 0, king: false };

    const moves = boardMoves(state, 0);
    // Nur der Schlagzug c3:e5 darf erlaubt sein, nicht der Zug von a1
    expect(moves).toHaveLength(1);
    expect(moves[0]?.from).toBe(c3);
    expect(moves[0]?.to).toBe(squareIndex('e5', 8));
    expect(moves[0]?.captures).toEqual([d4]);

    // Nach dem Schlag ist der schwarze Stein auf d4 weg
    const next = gameModule.applyMove(state, 0, moves[0]!).state;
    expect(next.cells[d4]).toBeNull();
    expect(next.cells[squareIndex('e5', 8)]).toEqual({ seat: 0, king: false });
  });

  it('Mehrfachschlag schlägt mehrere Steine in einer Kette', () => {
    const state = gameModule.setup(2, { size: '8' }, 'test') as CheckersState;
    state.cells = Array(64).fill(null);
    // Weiß auf c3
    const c3 = squareIndex('c3', 8);
    // Schwarz auf d4 und f6
    const d4 = squareIndex('d4', 8);
    const f6 = squareIndex('f6', 8);
    state.cells[c3] = { seat: 0, king: false };
    state.cells[d4] = { seat: 1, king: false };
    state.cells[f6] = { seat: 1, king: false };

    const moves = boardMoves(state, 0);
    expect(moves).toHaveLength(1);
    const m = moves[0]!;
    expect(m.from).toBe(c3);
    expect(m.to).toBe(squareIndex('g7', 8));
    expect(m.captures).toEqual([d4, f6]);
    expect(m.san).toBe('c3:e5:g7');

    const next = gameModule.applyMove(state, 0, m).state;
    expect(next.cells[d4]).toBeNull();
    expect(next.cells[f6]).toBeNull();
    expect(next.cells[squareIndex('g7', 8)]).toEqual({ seat: 0, king: false });
  });

  it('Klassisch Deutsch erlaubt kein Rückwärtsschlagen einfacher Steine, International schon', () => {
    // Weißer Stein auf c5, schwarzer Stein dahinter auf d4, Feld e3 frei
    const c5 = squareIndex('c5', 8);
    const d4 = squareIndex('d4', 8);

    const setupBoard = (variant: 'german' | 'international') => {
      const s = gameModule.setup(2, { variant, size: '8' }, 'test') as CheckersState;
      s.cells = Array(64).fill(null);
      s.cells[c5] = { seat: 0, king: false };
      s.cells[d4] = { seat: 1, king: false };
      return s;
    };

    const germanState = setupBoard('german');
    // In deutscher Variante darf Weiß (zieht aufwärts) nicht nach hinten (abwärts nach e3) springen
    const germanMoves = boardMoves(germanState, 0);
    expect(germanMoves.some((m) => m.from === c5 && m.to === squareIndex('e3', 8))).toBe(false);

    const intlState = setupBoard('international');
    // In internationaler Variante darf Weiß auch rückwärts schlagen
    const intlMoves = boardMoves(intlState, 0);
    expect(intlMoves.some((m) => m.from === c5 && m.to === squareIndex('e3', 8))).toBe(true);
  });

  it('Beförderung zur Dame bei Erreichen der Grundreihe', () => {
    const state = gameModule.setup(2, { size: '8' }, 'test') as CheckersState;
    state.cells = Array(64).fill(null);
    // Weiß auf c7, zieht nach d8
    const c7 = squareIndex('c7', 8);
    const d8 = squareIndex('d8', 8);
    state.cells[c7] = { seat: 0, king: false };

    const move = boardMoves(state, 0).find((m) => m.from === c7 && m.to === d8);
    expect(move).toBeDefined();

    const next = gameModule.applyMove(state, 0, move!);
    expect(next.state.cells[d8]).toEqual({ seat: 0, king: true });
    expect(next.events.some((e) => e.type === 'promoted')).toBe(true);
  });

  it('Fliegende Dame kann weit ziehen und springen', () => {
    const state = gameModule.setup(2, { size: '8' }, 'test') as CheckersState;
    state.cells = Array(64).fill(null);
    // Weiße Dame auf a1
    const a1 = squareIndex('a1', 8);
    state.cells[a1] = { seat: 0, king: true };
    // Schwarzer Stein auf c3, Diagonale dahinter (d4, e5, f6, g7, h8) frei
    const c3 = squareIndex('c3', 8);
    state.cells[c3] = { seat: 1, king: false };

    const moves = boardMoves(state, 0);
    // Fliegende Dame muss c3 schlagen und kann auf d4, e5, f6, g7 oder h8 landen
    expect(moves.length).toBe(5);
    const landingSquares = moves.map((m) => squareName(m.to, 8)).sort();
    expect(landingSquares).toEqual(['d4', 'e5', 'f6', 'g7', 'h8']);
  });

  it('Sieg wenn Gegner keine Steine mehr hat', () => {
    const state = gameModule.setup(2, { size: '8' }, 'test') as CheckersState;
    state.cells = Array(64).fill(null);
    const c3 = squareIndex('c3', 8);
    const d4 = squareIndex('d4', 8);
    state.cells[c3] = { seat: 0, king: false };
    state.cells[d4] = { seat: 1, king: false };

    const move = boardMoves(state, 0)[0]!;
    const next = gameModule.applyMove(state, 0, move).state;
    expect(next.winner).toBe(0);
    expect(gameModule.result(next)).toEqual({ kind: 'win', winners: [0], reason: 'captured' });
  });

  it('Sieg wenn Gegner vollständig blockiert ist', () => {
    const state = gameModule.setup(2, { size: '8' }, 'test') as CheckersState;
    state.cells = Array(64).fill(null);
    // Schwarz auf h8 (dunkle Ecke), Weiß auf g7 und f6 (blockiert h8 komplett ohne Sprungmöglichkeit)
    const h8 = squareIndex('h8', 8);
    const g7 = squareIndex('g7', 8);
    const f6 = squareIndex('f6', 8);
    state.cells[h8] = { seat: 1, king: false };
    state.cells[g7] = { seat: 0, king: false };
    state.cells[f6] = { seat: 0, king: false };
    state.turn = 1;

    expect(boardMoves(state, 1)).toHaveLength(0);
  });
});

describe('Plattform-Vertragsprüfungen', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 12, botGames: 1, maxMoves: 500 })) {
    test(check.name, check.run, 60_000);
  }
});

describe('Dame – Remis anbieten', () => {
  const offer: CheckersMove = { type: 'offerDraw' };

  it('Angebot, Ablehnen und Annehmen', () => {
    const start = gameModule.setup(2, {}, 'remis') as CheckersState;
    expect(gameModule.legalMoves(start, 0).some((m) => m.type === 'offerDraw')).toBe(false);
    expect(gameModule.isLegal!(start, 0, offer)).toBe(true);

    const offered = gameModule.applyMove(start, 0, offer).state;
    expect(gameModule.currentPlayers(offered)).toEqual([1]);
    expect(gameModule.legalMoves(offered, 1)).toEqual([{ type: 'acceptDraw' }, { type: 'declineDraw' }]);

    const declined = gameModule.applyMove(offered, 1, { type: 'declineDraw' }).state;
    expect(gameModule.currentPlayers(declined)).toEqual([0]);
    expect(gameModule.isLegal!(declined, 0, offer)).toBe(false);

    const accepted = gameModule.applyMove(offered, 1, { type: 'acceptDraw' }).state;
    expect(gameModule.result(accepted)).toEqual({ kind: 'draw', reason: 'agreement' });
  });
});

describe('Dame – Bot und Remis', () => {
  it('nimmt an, wenn er klar hinten liegt, sonst nicht', () => {
    const start = gameModule.setup(2, {}, 'remis-bot') as CheckersState;
    const ask = (state: CheckersState) => {
      const offered = gameModule.applyMove(state, 0, { type: 'offerDraw' }).state;
      return computeBotMove(gameModule, { gameId: 'checkers', botId: 'checkers', level: 'hard', seat: 1, view: offered, seed: 'r', timeBudgetMs: 100 }) as CheckersMove;
    };
    expect(ask(start)).toEqual({ type: 'declineDraw' });
    // Schwarz hat vier Steine weniger.
    const blackCells = start.cells.map((c, i) => i).filter((i) => start.cells[i]?.seat === 1).slice(0, 4);
    const weaker = { ...start, cells: start.cells.map((c, i) => (blackCells.includes(i) ? null : c)) };
    expect(ask(weaker)).toEqual({ type: 'acceptDraw' });
  });
});
