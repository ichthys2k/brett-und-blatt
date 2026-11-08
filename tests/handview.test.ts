import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseHandView } from '../apps/web/src/lib/handView';

describe('Hand-Ansicht (#100)', () => {
  it('ist nur eingeschaltet, wenn „an“ gespeichert ist', () => {
    expect(parseHandView('an')).toBe(true);
    expect(parseHandView('aus')).toBe(false);
    expect(parseHandView(null)).toBe(false);
    expect(parseHandView('quatsch')).toBe(false);
  });

  it('jedes Spiel mit handView wertet auch handOnly aus', () => {
    const withHandView: string[] = [];
    for (const id of readdirSync('packages/games')) {
      const file = `packages/games/${id}/src/ui/index.tsx`;
      if (!existsSync(file)) continue;
      const source = readFileSync(file, 'utf8');
      if (!/handView:\s*true/.test(source)) continue;
      withHandView.push(id);
      expect(source, `${id}: handOnly fehlt in der Oberfläche`).toMatch(/\bhandOnly\b/);
    }
    expect(withHandView.sort()).toEqual(['mau-mau', 'skat', 'uno']);
  });
});
