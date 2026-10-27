import brueche from '../../../../content/paare/brueche.json';
import einmaleins from '../../../../content/paare/einmaleins.json';
import englisch from '../../../../content/paare/englisch.json';
import ganzeZahlen from '../../../../content/paare/ganze-zahlen.json';
import groessen from '../../../../content/paare/groessen.json';
import grossesEinmaleins from '../../../../content/paare/grosses-einmaleins.json';
import kopfrechnen from '../../../../content/paare/kopfrechnen.json';
import teilbarkeit from '../../../../content/paare/teilbarkeit.json';
import tiere from '../../../../content/paare/tiere.json';

/** Ein Inhaltspaket mit Paaren: gleiche Bilder oder zusammengehörige Begriffe (CC BY-SA 4.0). */
export interface PairSet {
  id: string;
  name: string;
  pairs: { a: string; b: string }[];
}

export const PAIR_SETS: Record<string, PairSet> = {
  tiere,
  einmaleins,
  'grosses-einmaleins': grossesEinmaleins,
  kopfrechnen,
  groessen,
  teilbarkeit,
  brueche,
  'ganze-zahlen': ganzeZahlen,
  englisch,
};

export function pairSet(id: string): PairSet {
  return PAIR_SETS[id] ?? tiere;
}

/** Inhalt einer Kartenseite. */
export function faceOf(setId: string, pair: number, side: 'a' | 'b'): string {
  const entry = pairSet(setId).pairs[pair];
  return entry ? entry[side] : '?';
}
