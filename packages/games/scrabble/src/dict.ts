import words from './dict/words-de.json';

const dictionary = new Set<string>(words as string[]);

export function isValidWord(word: string): boolean {
  if (word.length < 2) return false;
  return dictionary.has(word.toUpperCase());
}

export function getDictionarySize(): number {
  return dictionary.size;
}

export function findWords(prefix: string): string[] {
  const p = prefix.toUpperCase();
  const result: string[] = [];
  for (const w of dictionary) {
    if (w.startsWith(p)) result.push(w);
    if (result.length > 100) break;
  }
  return result;
}

export default dictionary;
