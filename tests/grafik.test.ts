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
      if (isDir || !path.toLowerCase().endsWith('.png')) return;
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

/*
 * Kein Alkohol, kein Tabak, keine Drogen (Stilbibel Abschnitt 1, Cornelius 13.11.2026): Jedes
 * Manifest verbietet sie im Feld `ohne`, und kein Prompt bestellt sie.
 */
type Motif = { id: string; prompt?: string; stil?: string; ohne?: string };
type Manifest = { stil?: string; ohne?: string; motive?: Motif[] };
const manifests = import.meta.glob<Manifest>('../scripts/grafik/manifeste/*.json', { eager: true, import: 'default' });
const ASKS_FOR_INTOXICANTS = /\b(beer|ale|tankards?|liquor|spirits|cider|mead|schnapps|tobacco|cigars?|cigarettes?|drunk\w*|smoking pipes?|(red|white) wine|wine (glass|glasses|bottles?)|(glass|goblet|bottle|cup) of wine)\b/i;

describe('Grafik-Manifeste', () => {
  it('jedes Feld ohne verbietet Alkohol, Tabak und Drogen', () => {
    const missing: string[] = [];
    for (const [path, manifest] of Object.entries(manifests)) {
      const name = path.split('/').pop()!;
      for (const [where, ohne] of [['Manifest', manifest.ohne] as const, ...(manifest.motive ?? []).filter((m) => m.ohne !== undefined).map((m) => [m.id, m.ohne] as const)]) {
        if (!ohne || !/\balcohol\b/.test(ohne) || !/\btobacco\b/.test(ohne) || !/\bdrugs\b/.test(ohne)) missing.push(`${name}: ${where}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('kein Stil-Kopf und kein Motiv-Prompt bestellt Alkohol oder Tabak', () => {
    const found: string[] = [];
    for (const [path, manifest] of Object.entries(manifests)) {
      const name = path.split('/').pop()!;
      for (const [where, text] of [['stil', manifest.stil] as const, ...(manifest.motive ?? []).flatMap((m) => [[m.id, m.prompt], [`${m.id} stil`, m.stil]] as const)]) {
        const hit = text && ASKS_FOR_INTOXICANTS.exec(text);
        if (hit) found.push(`${name} ${where}: „${hit[0]}“`);
      }
    }
    expect(found).toEqual([]);
  });
});
