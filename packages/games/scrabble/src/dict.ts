import { DAWG_BASE64, WORD_COUNT } from './dict/dawg';

/**
 * Wörterbuch als minimierter Wortgraph (DAWG), gebaut von `scripts/build-dict.mjs` aus der
 * „german-wordlist“ von Tanglet (CC0 1.0, https://github.com/enz/german-wordlist): Wörter nach
 * den Scrabble-Regeln (keine Namen, Abkürzungen, veralteten Schreibungen), ß als SS.
 *
 * Ein Knoten ist der Index seiner ersten Kante (0 = keine Kanten). Je Kante: Buchstabe,
 * „letzte Kante“, „Wortende“ und der Zielknoten.
 */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ';
export type DictNode = number;
export const ROOT: DictNode = 1;

function decode(base64: string): Uint32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Uint32Array(bytes.buffer);
}

// Erst bei Bedarf entpacken, damit andere Spiele (und der Spieleserver beim Start) nichts bezahlen.
let cache: Uint32Array | null = null;
const data = () => (cache ??= decode(DAWG_BASE64));

/** Ruft `visit` für jede Kante des Knotens auf: Buchstabe, Zielknoten, endet dort ein Wort? */
export function forEachEdge(node: DictNode, visit: (letter: string, child: DictNode, end: boolean) => void): void {
  if (node === 0) return;
  const edges = data();
  for (let i = node; ; i++) {
    const e = edges[i]!;
    visit(ALPHABET[e & 31]!, e >>> 7, (e & 64) !== 0);
    if (e & 32) return;
  }
}

/** Folgt einem Buchstaben; null, wenn es kein Wort mit diesem Anfang gibt. */
export function step(node: DictNode, letter: string): { node: DictNode; end: boolean } | null {
  if (node === 0) return null;
  const code = ALPHABET.indexOf(letter);
  const edges = data();
  for (let i = node; ; i++) {
    const e = edges[i]!;
    if ((e & 31) === code) return { node: e >>> 7, end: (e & 64) !== 0 };
    if (e & 32) return null;
  }
}

export function isValidWord(word: string): boolean {
  if (word.length < 2) return false;
  let node: DictNode = ROOT;
  let end = false;
  for (const ch of word.toUpperCase()) {
    const next = step(node, ch);
    if (!next) return false;
    node = next.node;
    end = next.end;
  }
  return end;
}

export function getDictionarySize(): number {
  return WORD_COUNT;
}
