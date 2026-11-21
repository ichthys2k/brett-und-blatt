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

  it('liest die gespeicherte Wahl', () => {
    expect(parseStoredShell(null)).toBe('classic');
    expect(parseStoredShell('konsole')).toBe('console');
    expect(parseStoredShell('unsinn')).toBe('classic');
  });

  it('Parameter schlägt die gespeicherte Wahl in beide Richtungen', () => {
    expect(resolveShell({ chosen: 'classic', param: 'console', width: 1280, height: 800 })).toBe('console');
    expect(resolveShell({ chosen: 'console', param: 'classic', width: 1280, height: 800 })).toBe('classic');
    expect(resolveShell({ chosen: 'console', param: null, width: 1280, height: 800 })).toBe('console');
  });

  it('Konsole nur im Querformat ab der Mindestgröße', () => {
    expect(resolveShell({ chosen: 'console', param: null, width: 699, height: 500 })).toBe('classic');
    expect(resolveShell({ chosen: 'console', param: null, width: 800, height: 399 })).toBe('classic');
    expect(resolveShell({ chosen: 'console', param: null, width: 800, height: 900 })).toBe('classic');
    expect(resolveShell({ chosen: 'console', param: null, width: 700, height: 400 })).toBe('console');
  });
});
