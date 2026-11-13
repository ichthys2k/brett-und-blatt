/*
 * Originale-Archiv (G0, #307): Originale der gemalten Bilder liegen nur im privaten Repo
 * `ichthys2k/brett-und-blatt-grafik`, nie im öffentlichen. Dieser Test passt darauf auf,
 * dass kein Ordner `original/` und kein großes PNG ins öffentliche Repo rutscht, und dass
 * die Ausnahmeliste der verlorenen Originale nicht veraltet.
 */
import { describe, expect, it } from 'vitest';

type Dirent = { name: string; isDirectory(): boolean };
type Fs = {
  readdirSync(path: URL, options: { withFileTypes: true }): Dirent[];
  statSync(path: URL): { size: number };
  existsSync(path: URL): boolean;
  readFileSync(path: URL, encoding: 'utf8'): string;
};
const fs = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): Fs } }).process.getBuiltinModule('node:fs');
const root = new URL('../', import.meta.url);

/** Ordner, die nicht zum Quellstand gehören (Bauergebnisse, Abhängigkeiten, lokale Rohbilder). */
const SKIPPED = new Set(['node_modules', 'dist', '.git', '.wrangler', 'grafik-roh', 'test-results', 'playwright-report', 'coverage']);
/*
 * Die Drachenspiel-Master liegen noch im öffentlichen Repo, bis Cornelius sie mit
 * `node scripts/grafik/master-umziehen.mjs` ins private Repo verschoben hat. Danach diese
 * Ausnahme löschen.
 */
const LEGACY_MASTERS = 'packages/games/drachenspiel/assets/kulissen/';
const PNG_MAX_BYTES = 1024 * 1024;

function walk(relative: string, visit: (path: string, isDir: boolean) => void) {
  for (const entry of fs.readdirSync(new URL(relative, root), { withFileTypes: true })) {
    if (SKIPPED.has(entry.name)) continue;
    const path = `${relative}${entry.name}`;
    const isDir = entry.isDirectory();
    visit(path, isDir);
    if (isDir) walk(`${path}/`, visit);
  }
}

describe('Originale-Archiv', () => {
  it('kein Ordner original/ unter apps/ und packages/', () => {
    const found: string[] = [];
    for (const top of ['apps/', 'packages/']) walk(top, (path, isDir) => isDir && /(^|\/)original(e)?$/.test(path) && found.push(path));
    expect(found).toEqual([]);
  });

  it('kein PNG über 1 MB im öffentlichen Repo', () => {
    const found: string[] = [];
    walk('', (path, isDir) => {
      if (isDir || !path.toLowerCase().endsWith('.png') || path.startsWith(LEGACY_MASTERS)) return;
      if (fs.statSync(new URL(path, root)).size > PNG_MAX_BYTES) found.push(path);
    });
    expect(found).toEqual([]);
  });

  it('die Ausnahmeliste verlorener Originale nennt nur vorhandene WebP-Dateien', () => {
    const list = JSON.parse(fs.readFileSync(new URL('scripts/grafik/originale-fehlen.json', root), 'utf8')) as { dateien: string[] };
    expect(list.dateien.length).toBeGreaterThan(0);
    expect(list.dateien.filter((path) => !path.endsWith('.webp') || !fs.existsSync(new URL(path, root)))).toEqual([]);
    expect(new Set(list.dateien).size).toBe(list.dateien.length);
  });
});
