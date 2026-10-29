/// <reference types="vite/client" />
/*
 * Prüfungen über das ganze Repo: Regeln, die einzelne Spiele leicht vergessen und die
 * kein Test des Spiels selbst bemerkt (siehe Prüfbericht vom 28.10.2026).
 */
import type { GameInfo } from '../packages/engine/src/types';
import { describe, expect, it } from 'vitest';

const metas = import.meta.glob<GameInfo>('../packages/games/*/src/meta.ts', { eager: true, import: 'meta' });
const tests = import.meta.glob<string>('../packages/games/*/test*/*.test.ts', { eager: true, query: '?raw', import: 'default' });
// CSS liefert Vitest leer aus (auch mit `?raw`), deshalb direkt von der Platte lesen.
const fs = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): { readFileSync(path: URL, encoding: 'utf8'): string } } }).process.getBuiltinModule('node:fs');
const styles = Object.fromEntries(
  Object.keys(import.meta.glob('../packages/games/*/src/ui/*.css')).map((path) => [path, fs.readFileSync(new URL(path, import.meta.url), 'utf8')]),
);

/** Ordnername des Spiels aus einem Pfad wie „../packages/games/<ordner>/…“. */
const folderOf = (path: string) => path.split('/')[3]!;

const games = Object.entries(metas).map(([path, info]) => ({ folder: folderOf(path), info }));

/** Ruft eine Testdatei die Vertragsprüfungen nur auf oder führt sie auch aus? */
function runsContractChecks(source: string): boolean {
  if (/of\s+gameContractChecks\(/.test(source)) return true;
  const assigned = /const\s+(\w+)\s*=\s*gameContractChecks\(/.exec(source);
  return assigned !== null && new RegExp(`of\\s+${assigned[1]}\\b`).test(source);
}

describe('Repo-Regeln', () => {
  it('jedes fertige Spiel führt die Vertragsprüfungen wirklich aus', () => {
    const missing = games
      .filter(({ info }) => !info.draft)
      .filter(({ folder }) => !Object.entries(tests).some(([path, source]) => folderOf(path) === folder && runsContractChecks(source)))
      .map(({ folder }) => folder);
    // `gameContractChecks(modul)` allein liefert nur die Liste der Prüfungen – sie muss mit
    // `for (const check of gameContractChecks(modul)) it(check.name, check.run)` laufen.
    expect(missing).toEqual([]);
  });

  it('Ordnername und Spiel-id stimmen überein', () => {
    expect(games.filter(({ folder, info }) => folder !== info.id).map(({ folder }) => folder)).toEqual([]);
  });

  it('keine CSS-Klasse wird von zwei Spielen benutzt', () => {
    // Die CSS eines Spiels bleibt nach dem ersten Öffnen global aktiv. Zwei Spiele mit derselben
    // Klasse stören sich, sobald man nacheinander spielt (so zerfiel Farbe & Form nach Farbensortierer).
    const owners = new Map<string, Set<string>>();
    for (const [path, css] of Object.entries(styles)) {
      const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [, name] of withoutComments.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
        if (name!.startsWith('bub-')) continue; // Klassen des gemeinsamen Baukastens
        const set = owners.get(name!) ?? new Set<string>();
        set.add(folderOf(path));
        owners.set(name!, set);
      }
    }
    const shared = [...owners].filter(([, set]) => set.size > 1).map(([name, set]) => `${name}: ${[...set].sort().join(', ')}`);
    expect(shared).toEqual([]);
  });

  it('Bibel-Quiz lädt seinen Fragenkatalog vom Server statt aus dem Bundle', () => {
    // Der Katalog (168 Fragen) liegt in `content/bibelquiz/fragen.json` und kommt zur Laufzeit
    // über `GameModule.prepare` – ein statischer Import würde ihn wieder ins JS-Bundle holen.
    const sources = import.meta.glob<string>('../packages/games/*/src/**/*.{ts,tsx}', {
      eager: true,
      query: '?raw',
      import: 'default',
    });
    const statisch = Object.entries(sources)
      // Nur echte Importe zählen – Hinweise im Kommentar dürfen die Datei nennen.
      .filter(([, source]) => /(?:from|import\s*\()\s*['"][^'"]*content\/bibelquiz/.test(source))
      .map(([path]) => path);
    expect(statisch).toEqual([]);
  });
});
