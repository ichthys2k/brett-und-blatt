import { describe, expect, it } from 'vitest';
import { parseHandView, parseHandViewChoice } from '../apps/web/src/lib/handView';

/** Oberflächen aller Spiele als Text (wie `tests/repo.test.ts`: ohne Node-Typen über `?raw`). */
const uis = import.meta.glob<string>('../packages/games/*/src/ui/index.tsx', { eager: true, query: '?raw', import: 'default' });

describe('Hand-Ansicht (#100)', () => {
  it('ist nur eingeschaltet, wenn „an“ gespeichert ist', () => {
    expect(parseHandView('an')).toBe(true);
    expect(parseHandView('aus')).toBe(false);
    expect(parseHandView(null)).toBe(false);
    expect(parseHandView('quatsch')).toBe(false);
  });

  it('jedes Spiel mit handView wertet auch handOnly aus', () => {
    const withHandView: string[] = [];
    for (const [path, source] of Object.entries(uis)) {
      if (!/handView:\s*true/.test(source)) continue;
      const id = path.split('/')[3]!;
      withHandView.push(id);
      expect(source, `${id}: handOnly fehlt in der Oberfläche`).toMatch(/\bhandOnly\b/);
    }
    expect(withHandView.sort()).toEqual(['binokel', 'black-peter', 'dominoes', 'doppelkopf', 'elevens', 'kniffel', 'low-flight', 'maexle', 'mau-mau', 'president', 'quartett', 'schafkopf', 'skat', 'uno']);
  });
});

describe('Hand-Ansicht anbieten (#100)', () => {
  it('unterscheidet „noch nie gewählt“ von „aus“', () => {
    expect(parseHandViewChoice(null)).toBeNull();
    expect(parseHandViewChoice('an')).toBe('an');
    expect(parseHandViewChoice('aus')).toBe('aus');
    expect(parseHandViewChoice('quatsch')).toBeNull();
  });
});

describe('Tisch-Bildschirm-Ansicht der Spiele (#100)', () => {
  it('diese Spiele werten BoardProps.display aus (alle Plätze gleich, keine eigene Hand)', () => {
    const withDisplay: string[] = [];
    for (const [path, source] of Object.entries(uis)) {
      if (/\bdisplay(:\s*\w+)?,?\s*\}\s*:\s*BoardProps|^\s*display(:\s*\w+)?,\s*$/m.test(source)) withDisplay.push(path.split('/')[3]!);
    }
    expect(withDisplay.sort()).toEqual(['binokel', 'doppelkopf', 'low-flight', 'schafkopf', 'skat']);
  });
});
