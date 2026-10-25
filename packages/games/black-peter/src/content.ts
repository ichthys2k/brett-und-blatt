import einmaleins from '../../../../content/paare/einmaleins.json';
import englisch from '../../../../content/paare/englisch.json';
import tiere from '../../../../content/paare/tiere.json';

export interface PairSet {
  id: string;
  name: string;
  pairs: { a: string; b: string }[];
}

export const PAIR_SETS: Record<string, PairSet> = { tiere, einmaleins, englisch };

/** Die Paar-Nummer des Schwarzen Peters. */
export const PETER = -1;

export function pairSet(id: string): PairSet {
  return PAIR_SETS[id] ?? tiere;
}

export function faceOf(setId: string, pair: number, side: 'a' | 'b'): string {
  if (pair === PETER) return '🐈‍⬛';
  const entry = pairSet(setId).pairs[pair];
  return entry ? entry[side] : '?';
}
