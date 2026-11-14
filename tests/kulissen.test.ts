import { describe, expect, it } from 'vitest';
import { SCENE_BY_CATEGORY, SCENE_BY_GAME, SCENE_IDS } from '../apps/web/src/lib/sceneTable';

/** #316: Zuordnung Spiel → Kulisse; jede Kulisse hat ihre Datei (1280 und @2x), jedes zugeordnete Spiel gibt es. */
type Fs = { existsSync(path: URL): boolean; readdirSync(path: URL): string[] };
const fs = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): Fs } }).process.getBuiltinModule('node:fs');

describe('Kulissen der Spiele (#316)', () => {
  it('jede Kulisse hat eine Datei und eine @2x-Fassung', () => {
    const fehlt: string[] = [];
    for (const id of SCENE_IDS) for (const name of [`${id}.webp`, `${id}@2x.webp`]) if (!fs.existsSync(new URL(`../apps/web/src/assets/kulissen/${name}`, import.meta.url))) fehlt.push(name);
    expect(fehlt).toEqual([]);
  });

  it('jedes zugeordnete Spiel gibt es, und es gibt vier Rubrik-Kulissen', () => {
    const spiele = new Set(fs.readdirSync(new URL('../packages/games/', import.meta.url)));
    expect(Object.keys(SCENE_BY_GAME).filter((id) => !spiele.has(id))).toEqual([]);
    expect(Object.keys(SCENE_BY_CATEGORY).sort()).toEqual(['board', 'cards', 'family', 'math']);
  });

  it('alle zwölf Kulissen des Auftrags werden benutzt', () => {
    expect([...SCENE_IDS].sort()).toEqual(['acker', 'bach', 'hafen', 'marktplatz', 'nachtweide', 'rubrik-familie', 'rubrik-karten', 'rubrik-mathe', 'rubrik-strategie', 'schreibstube', 'sternwarte', 'wuerfelstube']);
  });
});
