import type { AlbumSpec } from '@brett-und-blatt/ui';
import { PAIR_SETS } from '../content';
import type { PairsState } from '../rules';

const short = (text: string) => (text.length > 14 ? `${text.slice(0, 13)}…` : text);

/** Kapitel „Paare finden“ im Sammelalbum des Passes (#148): jedes selbst gefundene Paar je Inhaltspaket (Brücke zum Lernen, #103). */
export const albumSpec: AlbumSpec<PairsState> = {
  title: 'Paare finden',
  catalog: () => Object.entries(PAIR_SETS).flatMap(([setId, set]) => set.pairs.map((pair, index) => ({ id: `${setId}:${index}`, label: `${short(pair.a)} – ${short(pair.b)}`, group: set.name }))),
  finds: ({ view, seat }) => {
    const found = new Set<number>();
    view.status.forEach((status, index) => {
      if (typeof status === 'object' && status.takenBy === seat) {
        const face = view.faces[index];
        if (face) found.add(face.pair);
      }
    });
    return [...found].map((pair) => `${view.set}:${pair}`);
  },
};
