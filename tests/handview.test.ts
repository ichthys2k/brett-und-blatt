import { describe, expect, it } from 'vitest';
import { parseHandView } from '../apps/web/src/lib/handView';

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
    expect(withHandView.sort()).toEqual(['mau-mau', 'skat', 'uno']);
  });
});
