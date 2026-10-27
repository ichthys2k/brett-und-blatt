import brueche from '../../../../content/paare/brueche.json';
import einmaleins from '../../../../content/paare/einmaleins.json';
import englisch from '../../../../content/paare/englisch.json';
import ganzeZahlen from '../../../../content/paare/ganze-zahlen.json';
import groessen from '../../../../content/paare/groessen.json';
import grossesEinmaleins from '../../../../content/paare/grosses-einmaleins.json';
import kopfrechnen from '../../../../content/paare/kopfrechnen.json';
import teilbarkeit from '../../../../content/paare/teilbarkeit.json';
import tiere from '../../../../content/paare/tiere.json';

/**
 * Lern-Bingo nutzt die Paare-Pakete (CC BY-SA 4.0): `a` wird angesagt, `b` steht auf der Karte.
 * Die `b`-Seiten eines Pakets müssen eindeutig sein.
 */
export interface BingoPack {
  id: string;
  name: string;
  pairs: { a: string; b: string }[];
}

export const PACKS: Record<string, BingoPack> = {
  einmaleins,
  'grosses-einmaleins': grossesEinmaleins,
  kopfrechnen,
  groessen,
  teilbarkeit,
  brueche,
  'ganze-zahlen': ganzeZahlen,
  englisch,
  tiere,
};

/** Zahlen-Bingo: 75 Zahlen in fünf Spalten B, I, N, G, O zu je 15. */
export const NUMBERS = 'zahlen';
export const NUMBER_COUNT = 75;
export const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;

/** Spalte einer Bingo-Zahl (0 = B … 4 = O). */
export function columnOf(n: number): number {
  return Math.min(4, Math.floor((n - 1) / 15));
}

/** Alle Kennungen eines Inhalts: bei Zahlen 1–75, sonst die Nummern der Paare. */
export function entryIds(content: string): number[] {
  const pack = PACKS[content];
  if (!pack) return Array.from({ length: NUMBER_COUNT }, (_, i) => i + 1);
  return pack.pairs.map((_, i) => i);
}

/** Was auf der Karte steht. */
export function faceOf(content: string, id: number): string {
  const pack = PACKS[content];
  return pack ? (pack.pairs[id]?.b ?? '?') : String(id);
}

/** Was angesagt wird: bei Zahlen mit Spaltenbuchstabe („B 7“), im Lern-Bingo die Aufgabe. */
export function callOf(content: string, id: number): string {
  const pack = PACKS[content];
  return pack ? (pack.pairs[id]?.a ?? '?') : `${LETTERS[columnOf(id)]} ${id}`;
}
