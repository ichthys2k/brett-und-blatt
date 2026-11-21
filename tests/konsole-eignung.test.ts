/// <reference types="vite/client" />
import type { GameInfo } from '../packages/engine/src/types';
import { describe, expect, it } from 'vitest';
import grades from '../apps/web/src/lib/controllerGrades.json';

/*
 * Controller-Eignung (#607, K0): Jedes fertige Spiel hat einen gemessenen Eintrag in
 * `apps/web/src/lib/controllerGrades.json`. Ein neues Spiel misst sich mit
 * `node scripts/controller-audit.mjs <id>` und trägt seine Zeile ein.
 */
const metas = import.meta.glob<GameInfo>('../packages/games/*/src/meta.ts', { eager: true, import: 'meta' });
const finished = Object.entries(metas)
  .filter(([, info]) => !info.draft)
  .map(([path]) => path.split('/')[3]!);
const table = grades as Record<string, { grade: string }>;

describe('Controller-Eignung je Spiel (#608)', () => {
  it('jedes fertige Spiel hat einen Eintrag mit gültiger Stufe', () => {
    const missing = finished.filter((id) => !['direct', 'carousel', 'cursor'].includes(table[id]?.grade ?? ''));
    expect(missing).toEqual([]);
  });

  it('kein Eintrag ohne Spielordner', () => {
    const folders = new Set(Object.keys(metas).map((path) => path.split('/')[3]!));
    expect(Object.keys(table).filter((id) => !folders.has(id))).toEqual([]);
  });
});
