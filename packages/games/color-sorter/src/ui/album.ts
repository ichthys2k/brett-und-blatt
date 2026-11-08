import type { AlbumSpec } from '@brett-und-blatt/ui';
import { ALBUM_PAGES } from './albumPages';
import { getProgress } from './progress';

/** Kapitel „Narrenhof“ im Sammelalbum des Passes (#148): spiegelt die Hofchronik (Narren, Kunststücke, Kuriositäten, Privilegien, Herrschaften, Kappen). */
export const albumSpec: AlbumSpec = {
  title: 'Narrenhof',
  catalog: () => ALBUM_PAGES.flatMap((page) => page.items.map((item) => ({ id: `${page.kind}:${item.key}`, label: item.name, group: page.title, icon: item.emoji }))),
  // Die Hofchronik führt das Spiel selbst; hier wird sie nur gespiegelt (alles, was schon freigeschaltet ist).
  finds: () => Object.entries(getProgress().album).flatMap(([kind, keys]) => keys.map((key) => `${kind}:${key}`)),
};
