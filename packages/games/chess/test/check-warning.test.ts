import { describe, expect, it } from 'vitest';
import { getCheckWarning, squareIndex } from '../src/ui/checkWarning';
import { legalMoves, setup, type BoardMove, type ChessState } from '../src/rules';

const boardMoves = (state: ChessState, seat: number) => legalMoves(state, seat).filter((m): m is BoardMove => m.type === 'move');

describe('Schach Fesselungs- und Warnungslogik (checkWarning)', () => {
  it('erkennt eine absolute Fesselung eines Springers an den König', () => {
    // Weißer König e1, Weißer Springer e2, Schwarzer Turm e8, Schwarzer König a8
    const fen = 'k3r3/8/8/8/8/8/4N3/4K3 w - - 0 1';
    const state = { ...setup(), fen };
    const moves = boardMoves(state, 0);

    // Klick auf den gefesselten Springer e2
    const warning = getCheckWarning(fen, squareIndex('e2'), null, moves);
    expect(warning).not.toBeNull();
    expect(warning?.text).toContain('gefesselt');
    expect(warning?.text).toContain('Turm auf e8');
    expect(warning?.pinnedSquare).toBe(squareIndex('e2'));
    expect(warning?.kingSquare).toBe(squareIndex('e1'));
    expect(warning?.attackerSquares).toContain(squareIndex('e8'));

    // Zugversuch des Springers nach d4
    const moveWarning = getCheckWarning(fen, squareIndex('e2'), squareIndex('d4'), moves);
    expect(moveWarning).not.toBeNull();
    expect(moveWarning?.text).toContain('Zug nicht erlaubt');
    expect(moveWarning?.text).toContain('gefesselt');
  });

  it('erkennt eine Fesselung entlang einer Linie bei einem Turm', () => {
    // Weißer König e1, Weißer Turm e3, Schwarze Dame e8, Schwarzer König a8
    const fen = 'k3q3/8/8/8/8/4R3/8/4K3 w - - 0 1';
    const state = { ...setup(), fen };
    const moves = boardMoves(state, 0);

    // Turm darf entlang der e-Linie ziehen, z. B. nach e4
    expect(moves.some((m) => m.from === 'e3' && m.to === 'e4')).toBe(true);

    // Klick auf den Turm weist auf die Fesselungslinie hin
    const warning = getCheckWarning(fen, squareIndex('e3'), null, moves);
    expect(warning).not.toBeNull();
    expect(warning?.text).toContain('Fesselungslinie');
    expect(warning?.text).toContain('Dame auf e8');

    // Zugversuch zur Seite (z. B. nach d3) wird verweigert
    const moveWarning = getCheckWarning(fen, squareIndex('e3'), squareIndex('d3'), moves);
    expect(moveWarning).not.toBeNull();
    expect(moveWarning?.text).toContain('Zug nicht erlaubt');
    expect(moveWarning?.text).toContain('gefesselt');
  });

  it('erkennt Schachgebot, wenn eine Figur das Schach nicht parieren kann', () => {
    // Weißer König e1, Schwarzer Turm e8 (Schach!), Weißer Springer a1, Schwarzer König a8
    const fen = 'k3r3/8/8/8/8/8/8/N3K3 w - - 0 1';
    const state = { ...setup(), fen };
    const moves = boardMoves(state, 0);

    // Springer a1 kann das Schach nicht abwehren
    const warning = getCheckWarning(fen, squareIndex('a1'), null, moves);
    expect(warning).not.toBeNull();
    expect(warning?.text).toContain('König steht im Schach');
    expect(warning?.attackerSquares).toContain(squareIndex('e8'));
  });

  it('erkennt, wenn der König auf ein angegriffenes Nachbarfeld ziehen will', () => {
    // Weißer König e1, Schwarzer Turm d8, Schwarzer König a8
    const fen = 'k2r4/8/8/8/8/8/8/4K3 w - - 0 1';
    const state = { ...setup(), fen };
    const moves = boardMoves(state, 0);

    // König will nach d1 ziehen (wird von d8-Turm kontrolliert)
    const warning = getCheckWarning(fen, squareIndex('e1'), squareIndex('d1'), moves);
    expect(warning).not.toBeNull();
    expect(warning?.text).toContain('König darf nicht ins Schach ziehen');
    expect(warning?.text).toContain('d1');
    expect(warning?.text).toContain('Turm auf d8');
  });

  it('erkennt unzulässige Rochade durch ein bedrohtes Feld', () => {
    // Weißer König e1, Turm h1, Schwarzer Läufer a6 (kontrolliert f1), Schwarzer König e8
    const fen = 'r3k2r/8/b7/8/8/8/8/R3K2R w KQkq - 0 1';
    const state = { ...setup(), fen };
    const moves = boardMoves(state, 0);

    // Kurze Rochade e1 -> g1 führt über das von a6 kontrollierte f1
    const warning = getCheckWarning(fen, squareIndex('e1'), squareIndex('g1'), moves);
    expect(warning).not.toBeNull();
    expect(warning?.text).toContain('Rochade nicht möglich');
    expect(warning?.text).toContain('f1');
  });
});
