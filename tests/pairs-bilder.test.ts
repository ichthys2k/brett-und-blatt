/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { PAIR_SETS } from '../packages/games/pairs/src/content';
import avatarMap from '../apps/web/src/lib/avatarMap.json';

const fs = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): { existsSync(path: URL): boolean } } }).process.getBuiltinModule('node:fs');

function assetUrlFor(key: string): URL | null {
  const colon = key.indexOf(':');
  if (colon < 0) return null;
  const kind = key.slice(0, colon);
  const id = key.slice(colon + 1);
  const rel = (path: string) => new URL(`../${path}`, import.meta.url);
  switch (kind) {
    case 'avatar': {
      const slug = (avatarMap as Record<string, string>)[id.replace(/\uFE0F/g, '')];
      return slug ? rel(`apps/web/src/assets/avatare/avatar-${slug}.webp`) : null;
    }
    case 'quartett':
      return rel(`content/quartett/bilder/${id}`);
    case 'drachenspiel':
      return rel(`packages/games/drachenspiel/src/ui/karten/bub-ds-${id}.webp`);
    case 'drachenspiel-champ':
      return rel(`packages/games/drachenspiel/src/ui/champions/${id}.webp`);
    case 'bot':
      return rel(`packages/ui/src/bots/portraits/bot-${id}.webp`);
    case 'jahrmarkt':
      return rel(`packages/games/color-sorter/src/ui/items/${id}.webp`);
    case 'narrenhof':
      return rel(`packages/games/color-sorter/src/ui/portraits/${id}.webp`);
    case 'wappen':
      return rel(`apps/web/src/wappen/${id}.webp`);
    case 'hofkarte':
      return rel(`packages/ui/src/cards/portraits/${id}.webp`);
    case 'grafschaft-q':
      return rel(`packages/games/grafschaft/src/ui/auftraege/${id}.webp`);
    case 'grafschaft-l':
      return rel(`packages/games/grafschaft/src/ui/land/${id}.webp`);
    case 'marktplatz-fig':
      return rel(`packages/games/marketplace/src/ui/figures/${id}.webp`);
    case 'marktplatz-fld':
      return rel(`packages/games/marketplace/src/ui/fields/${id}.webp`);
    default:
      return null;
  }
}

describe('Paare finden – Bildsets', () => {
  it('jedes Bild-Paar verweist auf eine vorhandene Datei', () => {
    const missing: string[] = [];
    let checked = 0;
    for (const set of Object.values(PAIR_SETS)) {
      for (const pair of set.pairs) {
        if (!pair.image) continue;
        checked++;
        const url = assetUrlFor(pair.image);
        if (!url || !fs.existsSync(url)) missing.push(`${set.id}: ${pair.image} -> ${url?.pathname}`);
      }
    }
    expect(checked).toBeGreaterThan(400);
    expect(missing).toEqual([]);
  });
});
