import { afterEach, describe, expect, it, vi } from 'vitest';
import { nameToKey, SYNCED_KEYS } from '../apps/web/src/lib/settingsBlock';

/** #325: Figurensätze je Spiel; Standard „classic“, eigene Wahl vor allem, bei Kontrast oder „Schlicht“ klassisch. */
const KEY = 'brett-und-blatt:figuren';
type Fs = { existsSync(path: URL): boolean };
const { existsSync } = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): Fs } }).process.getBuiltinModule('node:fs');

let attributes: Record<string, string> = {};

async function lade(store: Record<string, string>, opts: { contrast?: boolean; look?: string } = {}) {
  vi.resetModules();
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: Boolean(opts.contrast) }),
    localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) },
  });
  const attrs: Record<string, string> = {};
  attributes = attrs;
  vi.stubGlobal('document', {
    documentElement: {
      dataset: { look: opts.look ?? 'tavern' },
      setAttribute: (k: string, v: string) => void (attrs[k] = v),
      removeAttribute: (k: string) => void delete attrs[k],
    },
  });
  return import('../packages/ui/src/pieces/pieceSets');
}

afterEach(() => vi.unstubAllGlobals());

describe('Figurensätze (#325)', () => {
  it('ohne Wahl gilt der Standard des Spiels: überall Holz, unbekannte Spiele klassisch', async () => {
    const p = await lade({});
    expect(p.resolvePieceSet('chess')).toBe('wood');
    expect(p.resolvePieceSet('battleship')).toBe('wood');
    expect(p.resolvePieceSet('unbekannt')).toBe('classic');
    expect(p.chosenPieceSet('chess')).toBeNull();
  });

  it('speichert die Wahl je Spiel und gibt sie zurück', async () => {
    const store: Record<string, string> = {};
    const p = await lade(store);
    p.setPieceSet('chess', 'wood');
    expect(p.resolvePieceSet('chess')).toBe('wood');
    p.setPieceSet('chess', 'metal');
    expect(p.resolvePieceSet('chess')).toBe('metal');
    expect(p.resolvePieceSet('checkers')).toBe('wood');
    expect(JSON.parse(store[KEY]!)).toEqual({ chess: 'metal' });
    expect(attributes['data-pieces-chess']).toBe('metal');
    p.setPieceSet('chess', 'classic');
    expect(p.resolvePieceSet('chess')).toBe('classic');
    expect(attributes['data-pieces-chess']).toBeUndefined();
    p.setPieceSet('chess', null);
    expect(p.resolvePieceSet('chess')).toBe('wood');
    expect(attributes['data-pieces-chess']).toBe('wood');
  });

  it('ignoriert ungültige gespeicherte Werte', async () => {
    const p = await lade({ [KEY]: JSON.stringify({ chess: 'gold', go: 'metal', ludo: 5 }) });
    expect(p.resolvePieceSet('chess')).toBe('wood');
    expect(p.resolvePieceSet('go')).toBe('metal');
    expect(p.resolvePieceSet('ludo')).toBe('wood');
  });

  it('bei erhöhtem Kontrast und im Aussehen „Schlicht“ bleibt es klassisch, eine eigene Wahl gewinnt', async () => {
    const a = await lade({ [KEY]: JSON.stringify({ chess: 'fable' }) }, { contrast: true });
    expect(a.resolvePieceSet('chess')).toBe('fable');
    const b = await lade({}, { look: 'plain' });
    expect(b.resolvePieceSet('chess')).toBe('classic');
  });

  it('zu jeder Schachfigur gibt es in allen drei Sätzen ein Bild', () => {
    const dir = new URL('../packages/games/chess/src/ui/figuren/', import.meta.url);
    const fehlt: string[] = [];
    for (const set of ['wood', 'metal', 'fable']) for (const t of 'kqrbnp') for (const c of 'wb') if (!existsSync(new URL(`${set}-${t}-${c}.webp`, dir))) fehlt.push(`${set}-${t}-${c}`);
    expect(fehlt).toEqual([]);
  });

  it('die Figurenwahl reist im Einstellungsblock des Passes mit', () => {
    expect(SYNCED_KEYS.figuren).toBe(KEY);
    expect(nameToKey('figuren')).toBe(KEY);
  });

  it('jedes Spiel mit Standardsatz hat Bilder für Holz, Metall und Märchen', async () => {
    const p = await lade({});
    type FsDir = { readdirSync(path: URL): string[] };
    const { readdirSync } = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): FsDir } }).process.getBuiltinModule('node:fs');
    const fehlt: string[] = [];
    for (const game of Object.keys(p.PIECE_SET_DEFAULTS)) {
      const files = readdirSync(new URL(`../packages/games/${game}/src/ui/figuren/`, import.meta.url));
      for (const set of ['wood', 'metal', 'fable']) if (!files.some((f) => f.startsWith(`${set}-`))) fehlt.push(`${game}/${set}`);
    }
    expect(fehlt).toEqual([]);
  });
});
