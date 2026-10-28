import words from './dict/words-de.json';

/**
 * Wörterbuch als Präfixbaum (Trie) für Prüfung und Zugsuche.
 *
 * Die Liste enthält viele Abkürzungen und Namen. Beim Laden fallen Wörter ohne Selbstlaut
 * (z. B. „CD“, „KG“) weg, und Wörter aus zwei Buchstaben gelten nur, wenn sie in der kleinen
 * Liste unten stehen. Herkunft, Lizenz und Güte der Liste sind noch zu klären (Etappe 4).
 */
export interface TrieNode {
  end: boolean;
  next: Map<string, TrieNode>;
}

const VOWEL = /[AEIOUÄÖÜY]/;

/** Erlaubte Wörter aus zwei Buchstaben (nach Duden, inkl. Tonsilben und Ausrufe). */
const TWO_LETTER = new Set(
  'AB AH AM AN AS AU BÖ DA DO DU EH EI ER ES FA GO HA HE HI HM HO IM IN JA JE JO LA MA MI MU NA NE NU OB OH OM PI PO QI RE SI SO TU UH UM UR WO XI ZU ÄH ÖL ÜB'.split(' '),
);
const WORD = /^[A-ZÄÖÜ]{2,15}$/;

const root: TrieNode = { end: false, next: new Map() };
let size = 0;

for (const raw of words as string[]) {
  const word = raw.toUpperCase();
  if (!WORD.test(word) || !VOWEL.test(word)) continue;
  if (word.length === 2 && !TWO_LETTER.has(word)) continue;
  let node = root;
  for (const ch of word) {
    let child = node.next.get(ch);
    if (!child) {
      child = { end: false, next: new Map() };
      node.next.set(ch, child);
    }
    node = child;
  }
  if (!node.end) size++;
  node.end = true;
}

export const trieRoot: TrieNode = root;

export function isValidWord(word: string): boolean {
  if (word.length < 2) return false;
  let node: TrieNode | undefined = root;
  for (const ch of word.toUpperCase()) {
    node = node.next.get(ch);
    if (!node) return false;
  }
  return node.end;
}

export function getDictionarySize(): number {
  return size;
}
