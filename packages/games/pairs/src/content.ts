import brueche from '../../../../content/paare/brueche.json';
import einmaleins from '../../../../content/paare/einmaleins.json';
import englisch from '../../../../content/paare/englisch.json';
import ganzeZahlen from '../../../../content/paare/ganze-zahlen.json';
import groessen from '../../../../content/paare/groessen.json';
import grossesEinmaleins from '../../../../content/paare/grosses-einmaleins.json';
import kopfrechnen from '../../../../content/paare/kopfrechnen.json';
import teilbarkeit from '../../../../content/paare/teilbarkeit.json';
import tiereRaw from '../../../../content/paare/tiere.json';
import { IMAGE_PAIR_SETS, type PairEntry, type PairSet } from './imageSets';

export type { PairEntry, PairSet };

const tiere: PairSet = {
  ...tiereRaw,
  group: 'Tiere',
  pairs: tiereRaw.pairs.map((p) => ({ ...p, image: `avatar:${p.a}` })),
};

const withGroup = (set: PairSet, group: string): PairSet => ({ ...set, group });

export const PAIR_SETS: Record<string, PairSet> = {
  tiere,
  ...Object.fromEntries(IMAGE_PAIR_SETS.map((s) => [s.id, s])),
  einmaleins: withGroup(einmaleins, 'Lernen'),
  'grosses-einmaleins': withGroup(grossesEinmaleins, 'Lernen'),
  kopfrechnen: withGroup(kopfrechnen, 'Lernen'),
  groessen: withGroup(groessen, 'Lernen'),
  teilbarkeit: withGroup(teilbarkeit, 'Lernen'),
  brueche: withGroup(brueche, 'Lernen'),
  'ganze-zahlen': withGroup(ganzeZahlen, 'Lernen'),
  englisch: withGroup(englisch, 'Lernen'),
};

export function pairSet(id: string): PairSet {
  return PAIR_SETS[id] ?? tiere;
}

/** Textinhalt einer Kartenseite. */
export function faceOf(setId: string, pair: number, side: 'a' | 'b', custom?: { a: string; b: string }[]): string {
  const entry = (custom ?? pairSet(setId).pairs)[pair];
  return entry ? entry[side] : '?';
}

/** Bildschlüssel einer Kartenseite, falls das Set gemalte Bilder nutzt. */
export function faceImageOf(setId: string, pair: number, custom?: { a: string; b: string }[]): string | undefined {
  if (custom) return undefined;
  return pairSet(setId).pairs[pair]?.image;
}
