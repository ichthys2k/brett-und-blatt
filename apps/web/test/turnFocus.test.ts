import { describe, expect, it } from 'vitest';
import { boardFocusTarget, type BoardFocusInput } from '../src/lib/turnFocus';

const base: BoardFocusInput = { source: 'gamepad', focusLost: true, focusInBoard: false, menuOpen: false, dialogOpen: false, handover: false, result: false, yourMove: true };

describe('Fokus am Spieltisch (#618)', () => {
  it('mit Maus nie', () => expect(boardFocusTarget({ ...base, source: 'pointer' })).toBe('none'));
  it('offenes Menü oder Fenster: nichts', () => {
    expect(boardFocusTarget({ ...base, menuOpen: true, handover: true })).toBe('none');
    expect(boardFocusTarget({ ...base, dialogOpen: true, result: true })).toBe('none');
  });
  it('Übergabe vor Ergebnis vor Spielfeld', () => {
    expect(boardFocusTarget({ ...base, handover: true, result: true })).toBe('handover');
    expect(boardFocusTarget({ ...base, result: true })).toBe('result');
  });
  it('eigener Zug: ins Spielfeld, wenn der Fokus verloren oder außerhalb ist', () => {
    expect(boardFocusTarget(base)).toBe('board');
    expect(boardFocusTarget({ ...base, focusLost: false, focusInBoard: false })).toBe('board');
    expect(boardFocusTarget({ ...base, focusLost: false, focusInBoard: true })).toBe('none');
    expect(boardFocusTarget({ ...base, yourMove: false })).toBe('none');
  });
  it('Tastatur zählt wie Controller', () => expect(boardFocusTarget({ ...base, source: 'keyboard' })).toBe('board'));
});
