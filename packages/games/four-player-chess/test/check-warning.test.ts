import { describe, expect, it } from 'vitest';
import { idx, newGame, squareName } from '../src/legacy/engine';
import { legalMoves, type FourChessState } from '../src/rules';
import { getCheckWarning } from '../src/ui/checkWarning';

describe('Vierer-Schach Fesselungs- und Warnungslogik (checkWarning)', () => {
  it('erkennt eine Fesselung durch einen gegnerischen Stein über das Brett', () => {
    const state = newGame('ffa') as unknown as FourChessState;
    state.board.fill(null);
    // Gelbe Dame auf h14 (idx(0, 7)), Roter Springer auf h8 (idx(6, 7)), Roter König auf h1 (idx(13, 7))
    const yQueenSq = idx(0, 7);
    const rKnightSq = idx(6, 7);
    const rKingSq = idx(13, 7);
    const bKingSq = idx(7, 0);
    const yKingSq = idx(0, 6);
    const gKingSq = idx(7, 13);

    state.board[yQueenSq] = { c: 'y', t: 'Q' };
    state.board[rKnightSq] = { c: 'r', t: 'N' };
    state.board[rKingSq] = { c: 'r', t: 'K' };
    state.board[bKingSq] = { c: 'b', t: 'K' };
    state.board[yKingSq] = { c: 'y', t: 'K' };
    state.board[gKingSq] = { c: 'g', t: 'K' };
    state.turn = 'r';

    const moves = legalMoves(state, 0);

    // Klick auf den gefesselten Springer
    const warning = getCheckWarning(state, rKnightSq, null, moves);
    expect(warning).not.toBeNull();
    expect(warning?.text).toContain('gefesselt');
    expect(warning?.text).toContain('Gelb');
    expect(warning?.text).toContain('Dame auf ' + squareName(yQueenSq));
    expect(warning?.pinnedSquare).toBe(rKnightSq);
    expect(warning?.kingSquare).toBe(rKingSq);
    expect(warning?.attackerSquares).toContain(yQueenSq);

    // Zugversuch des Springers auf ein Feld abseits der Fesselung (z. B. f7)
    const illegalTarget = idx(5, 5);
    const moveWarning = getCheckWarning(state, rKnightSq, illegalTarget, moves);
    expect(moveWarning).not.toBeNull();
    expect(moveWarning?.text).toContain('Zug nicht erlaubt');
    expect(moveWarning?.text).toContain('Gelb');
  });

  it('erkennt Schachgebot, wenn eine Figur das Schach nicht parieren kann', () => {
    const state = newGame('ffa') as unknown as FourChessState;
    state.board.fill(null);
    const yQueenSq = idx(0, 7);
    const rKingSq = idx(13, 7);
    const rRookSq = idx(13, 3); // Turm auf d1, kann die h-Linie nicht blockieren

    state.board[yQueenSq] = { c: 'y', t: 'Q' };
    state.board[rKingSq] = { c: 'r', t: 'K' };
    state.board[rRookSq] = { c: 'r', t: 'R' };
    state.board[idx(7, 0)] = { c: 'b', t: 'K' };
    state.board[idx(0, 6)] = { c: 'y', t: 'K' };
    state.board[idx(7, 13)] = { c: 'g', t: 'K' };
    state.turn = 'r';

    const moves = legalMoves(state, 0);

    const warning = getCheckWarning(state, rRookSq, null, moves);
    expect(warning).not.toBeNull();
    expect(warning?.text).toContain('König steht im Schach durch Gelb');
    expect(warning?.attackerSquares).toContain(yQueenSq);
  });

  it('erkennt, wenn der König auf ein angegriffenes Nachbarfeld ziehen will', () => {
    const state = newGame('ffa') as unknown as FourChessState;
    state.board.fill(null);
    const rKingSq = idx(13, 6); // Roter König auf g1
    const yRookSq = idx(0, 7); // Gelber Turm auf h14, kontrolliert Spalte 7 (h-Linie)

    state.board[rKingSq] = { c: 'r', t: 'K' };
    state.board[yRookSq] = { c: 'y', t: 'R' };
    state.board[idx(7, 0)] = { c: 'b', t: 'K' };
    state.board[idx(0, 6)] = { c: 'y', t: 'K' };
    state.board[idx(7, 13)] = { c: 'g', t: 'K' };
    state.turn = 'r';

    const moves = legalMoves(state, 0);

    // König will einen Schritt zur Seite auf die bedrohte h-Linie (idx(13, 7)) ziehen
    const targetSq = idx(13, 7);
    const warning = getCheckWarning(state, rKingSq, targetSq, moves);
    expect(warning).not.toBeNull();
    expect(warning?.text).toContain('König darf nicht ins Schach ziehen');
    expect(warning?.text).toContain('Gelb');
    expect(warning?.attackerSquares).toContain(yRookSq);
  });
});
