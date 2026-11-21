import { describe, expect, it } from 'vitest';
import { parseShellParam, parseStoredShell, resolveShell } from '../src/lib/shellCore';

describe('Darstellung Klassisch/Konsole (#607, K1)', () => {
  it('liest den Startparameter', () => {
    expect(parseShellParam('')).toBeNull();
    expect(parseShellParam('?modus=konsole')).toBe('console');
    expect(parseShellParam('?modus=klassisch')).toBe('classic');
    expect(parseShellParam('?modus=x')).toBeNull();
    expect(parseShellParam('?a=1&modus=konsole')).toBe('console');
  });

  it('liest die gespeicherte Wahl; ohne Eintrag gilt die Konsole (#639)', () => {
    expect(parseStoredShell(null)).toBe('console');
    expect(parseStoredShell('konsole')).toBe('console');
    expect(parseStoredShell('klassisch')).toBe('classic');
    expect(parseStoredShell('unsinn')).toBe('console');
  });

  it('Parameter schlägt die gespeicherte Wahl in beide Richtungen', () => {
    expect(resolveShell({ chosen: 'classic', param: 'console' })).toBe('console');
    expect(resolveShell({ chosen: 'console', param: 'classic' })).toBe('classic');
    expect(resolveShell({ chosen: 'console', param: null })).toBe('console');
    expect(resolveShell({ chosen: 'classic', param: null })).toBe('classic');
  });
});
