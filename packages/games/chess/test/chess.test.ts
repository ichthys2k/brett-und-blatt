import { computeBotMove, resolveOptions } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule, type BoardMove, type ChessMove, type ChessState } from '../src';
import { loadFromPgn, positionKey, toPgn } from '../src/rules';
import { ChessSearch } from '../src/search';

const mv = (from: string, to: string, promotion?: BoardMove['promotion']): ChessMove => (promotion ? { type: 'move', from, to, promotion } : { type: 'move', from, to });

function play(moves: [string, string][]): ChessState {
  let state = gameModule.setup(2, {}, 'test');
  for (const [from, to] of moves) state = gameModule.applyMove(state, gameModule.currentPlayers(state)[0]!, mv(from, to)).state;
  return state;
}

function fromFen(fen: string): ChessState {
  return { ...gameModule.setup(2, {}, 'test'), fen, positions: { [positionKey(fen)]: 1 } };
}

describe('Regeln', () => {
  it('Weiß beginnt mit 20 möglichen Zügen', () => {
    const state = gameModule.setup(2, {}, 'test');
    expect(gameModule.currentPlayers(state)).toEqual([0]);
    expect(gameModule.legalMoves(state, 0)).toHaveLength(20);
  });

  it('erkennt das Schäfermatt', () => {
    const state = play([
      ['e2', 'e4'],
      ['e7', 'e5'],
      ['f1', 'c4'],
      ['b8', 'c6'],
      ['d1', 'h5'],
      ['g8', 'f6'],
      ['h5', 'f7'],
    ]);
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [0], reason: 'checkmate' });
    expect(state.history.at(-1)).toBe('Qxf7#');
  });

  it('erkennt Patt', () => {
    // Schwarz: König h8; Weiß: Dame g6, König f7 – Weiß zieht Dame nach g6? Hier direkt: Schwarz am Zug ohne Züge.
    const state = fromFen('7k/5K2/6Q1/8/8/8/8/8 w - - 0 1');
    const { state: next } = gameModule.applyMove(state, 0, mv('g6', 'g5'));
    expect(gameModule.result(next)).toBeNull();
    const stalemate = fromFen('7k/5K2/8/6Q1/8/8/8/8 w - - 0 1');
    const { state: end } = gameModule.applyMove(stalemate, 0, mv('g5', 'g6'));
    expect(gameModule.result(end)).toEqual({ kind: 'draw', reason: 'stalemate' });
  });

  it('Umwandlung bietet vier Figuren zur Wahl', () => {
    const state = fromFen('8/P7/8/8/8/8/8/k6K w - - 0 1');
    const promotions = gameModule.legalMoves(state, 0).filter((m): m is BoardMove => m.type === 'move' && m.from === 'a7');
    expect(promotions.map((m) => m.promotion).sort()).toEqual(['b', 'n', 'q', 'r']);
  });

  it('dreimal dieselbe Stellung ist unentschieden', () => {
    const shuffle: [string, string][] = [
      ['g1', 'f3'],
      ['g8', 'f6'],
      ['f3', 'g1'],
      ['f6', 'g8'],
    ];
    const state = play([...shuffle, ...shuffle]);
    expect(gameModule.result(state)).toEqual({ kind: 'draw', reason: 'repetition' });
  });

  it('unerlaubte Züge werden abgelehnt', () => {
    const state = gameModule.setup(2, {}, 'test');
    expect(() => gameModule.applyMove(state, 0, mv('e2', 'e5'))).toThrow();
    expect(() => gameModule.applyMove(state, 1, mv('e7', 'e5'))).toThrow();
  });
});

describe('Bot', () => {
  it('findet ein Matt in einem Zug', () => {
    // Weiß: Dame h5, Läufer c4 – Dxf7 ist matt.
    const state = fromFen('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
    for (const level of ['medium', 'hard'] as const) {
      const move = computeBotMove(gameModule, { gameId: 'chess', botId: 'chess', level, seat: 0, view: state, seed: level, timeBudgetMs: 800 }) as ChessMove;
      expect(move).toMatchObject({ from: 'h5', to: 'f7' });
    }
  });

  it('schlägt eine ungedeckte Dame', () => {
    const state = fromFen('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1');
    const move = computeBotMove(gameModule, { gameId: 'chess', botId: 'chess', level: 'medium', seat: 0, view: state, seed: 'x', timeBudgetMs: 800 }) as ChessMove;
    expect(move).toMatchObject({ from: 'd2', to: 'd5' });
  });

  it('rechnet in der Eröffnung genug Stellungen pro Sekunde', () => {
    const search = new ChessSearch(gameModule.setup(2, {}, 'x').fen);
    search.bestMove({ maxDepth: 3, timeBudgetMs: 3000 });
    expect(search.nodes).toBeGreaterThan(100);
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 4, botMoveLimit: 30 })) test(check.name, check.run, 120_000);
});

describe('Remis anbieten', () => {
  const offer: ChessMove = { type: 'offerDraw' };

  it('Angebot macht den Gegner zum Zug; Ablehnen gibt den Zug zurück', () => {
    const start = gameModule.setup(2, {}, 'remis');
    expect(gameModule.legalMoves(start, 0).some((m) => m.type === 'offerDraw')).toBe(false);
    expect(gameModule.isLegal!(start, 0, offer)).toBe(true);
    expect(gameModule.isLegal!(start, 1, offer)).toBe(false);

    const offered = gameModule.applyMove(start, 0, offer).state;
    expect(gameModule.currentPlayers(offered)).toEqual([1]);
    expect(gameModule.legalMoves(offered, 1)).toEqual([{ type: 'acceptDraw' }, { type: 'declineDraw' }]);
    expect(gameModule.legalMoves(offered, 0)).toEqual([]);

    const declined = gameModule.applyMove(offered, 1, { type: 'declineDraw' }).state;
    expect(gameModule.currentPlayers(declined)).toEqual([0]);
    expect(declined.fen).toBe(start.fen);
    // Erst nach einigen Zügen darf Weiß wieder anbieten.
    expect(gameModule.isLegal!(declined, 0, offer)).toBe(false);
    expect(gameModule.result(declined)).toBeNull();
  });

  it('Annehmen beendet die Partie unentschieden', () => {
    const offered = gameModule.applyMove(play([['e2', 'e4']]), 1, offer).state;
    const { state, events } = gameModule.applyMove(offered, 0, { type: 'acceptDraw' });
    expect(gameModule.result(state)).toEqual({ kind: 'draw', reason: 'agreement' });
    expect(events.map((e) => e.type)).toEqual(['drawAccepted', 'over']);
  });

  it('der Bot nimmt nur an, wenn er schlechter steht', () => {
    const ask = (fen: string, level: 'easy' | 'hard') => {
      const state = gameModule.applyMove(fromFen(fen), 0, offer).state;
      return computeBotMove(gameModule, { gameId: 'chess', botId: 'chess', level, seat: 1, view: state, seed: 'r', timeBudgetMs: 100 }) as ChessMove;
    };
    // Schwarz ohne Dame gegen Weiß mit Dame: annehmen; Schwarz mit Dame mehr: ablehnen.
    expect(ask('4k3/8/8/8/8/8/8/3QK3 w - - 0 1', 'hard')).toEqual({ type: 'acceptDraw' });
    expect(ask('3qk3/8/8/8/8/8/8/4K3 w - - 0 1', 'hard')).toEqual({ type: 'declineDraw' });
    expect(ask('3qk3/8/8/8/8/8/8/4K3 w - - 0 1', 'easy')).toEqual({ type: 'declineDraw' });
  });
});

describe('PGN', () => {
  it('Narrenmatt hin und zurück', () => {
    const state = play([['e2', 'e4'], ['e7', 'e5'], ['d1', 'h5'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6'], ['h5', 'f7']]);
    expect(state.end).toBe('checkmate');
    const pgn = toPgn(state, ['Anna', 'Ben'], new Date(2026, 9, 29));
    expect(pgn).toContain('[White "Anna"]');
    expect(pgn).toContain('[Date "2026.10.29"]');
    expect(pgn).toContain('[Result "1-0"]');
    expect(pgn.trim().endsWith('1-0')).toBe(true);
    const loaded = loadFromPgn(pgn);
    expect(loaded.fen).toBe(state.fen);
    expect(loaded.history).toEqual(state.history);
    expect(gameModule.result(loaded)).toEqual(gameModule.result(state));
  });

  it('laufende Partie aus fremdem PGN mit Kommentaren fortsetzen', () => {
    const pgn = '[Event "Test"]\n\n1. e4 {Königsbauer} e5 2. Nf3 Nc6 3. Bb5 a6 *';
    const options = resolveOptions(gameModule, { pgn });
    expect(options.pgn).toBe(pgn);
    const state = gameModule.setup(2, options, 'pgn') as ChessState;
    expect(state.history).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
    expect(gameModule.currentPlayers(state)).toEqual([0]);
    expect(toPgn(state).trim().endsWith('*')).toBe(true);
  });

  it('lehnt Unsinn und fremde Startstellungen ab', () => {
    expect(() => loadFromPgn('1. e5 e4')).toThrow();
    expect(() => loadFromPgn('[FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]\n[SetUp "1"]\n\n1. Kb1 *')).toThrow('Grundstellung');
    // Ungültige Option: normale Partie statt Absturz
    expect((gameModule.setup(2, { pgn: 'Quatsch' }, 'x') as ChessState).history).toEqual([]);
  });
});
