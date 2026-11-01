/*
 * Baustein für Wortspiele: freie Texteingabe prüfen und vergleichen (Kategorien-Sprint,
 * Wer bin ich?, Verboten!). Alles rein und ohne Zufall, damit Regeln, Bots und
 * Oberfläche dieselbe Prüfung nutzen. Freien Chat gibt es nicht – jede Eingabe ist ein
 * Spielzug, kurz und gefiltert.
 */

/** Längste erlaubte Eingabe in Zeichen (Antwort, Rateversuch, Sperrwort). */
export const MAX_ENTRY_LENGTH = 30;

/**
 * Grobe Liste unpassender Wortteile – für Spitznamen und Eingaben in Wortspielen.
 * Sie fängt nicht alles ab: Dazu kommen private Räume und die Raumleitung, die
 * Mitspieler entfernen kann. Geprüft wird auf Wortteile nach dem Vereinfachen von
 * Schreibweisen wie „4“ für „a“.
 */
export const BLOCKED_WORD_PARTS: readonly string[] = [
  'arsch', 'fick', 'fotze', 'hure', 'nutte', 'wichser', 'wixer', 'schlampe', 'missgeburt', 'spast',
  'schwuchtel', 'kanake', 'nigg', 'neger', 'hitler', 'nazi', 'fuck', 'shit', 'bitch',
  'cunt', 'pussy', 'porn', 'sex', 'penis', 'vagina', 'titten', 'muschi', 'kotze',
];

/**
 * Unbedenkliche Wörter, die einen gesperrten Wortteil zufällig enthalten (Warschau, Barsch,
 * Essex …) – nach `simplifyForFilter`. Sie werden vor der Prüfung aus dem Wort entfernt,
 * „Flussbarsch“ bleibt also erlaubt, „Arschloch“ nicht. Kurz halten; im Zweifel lieber sperren.
 */
const FILTER_EXCEPTIONS: readonly string[] = ['warschau', 'barsch', 'marsch', 'harsch', 'essex', 'sussex', 'sexta', 'sextant', 'sextett', 'sexualkunde', 'spastik'];

/** Vereinfacht für den Filter: Kleinbuchstaben a–z, Ziffern als Buchstaben gelesen. */
export function simplifyForFilter(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[0@4]/g, (c) => (c === '0' ? 'o' : 'a'))
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z]/g, '');
}

/**
 * Enthält der Text einen unpassenden Wortteil? Prüft jedes Wort einzeln; besteht der Text
 * nur aus einzelnen Buchstaben („a r s c h“), auch alles am Stück.
 */
export function isBlockedText(text: string): boolean {
  const words = text.split(/[\s\-_.,;:/]+/).map(simplifyForFilter).filter(Boolean);
  const whole = simplifyForFilter(text);
  const hit = (word: string) => {
    const rest = FILTER_EXCEPTIONS.reduce((w, ok) => w.split(ok).join(' '), word);
    return BLOCKED_WORD_PARTS.some((part) => rest.includes(part));
  };
  return words.some(hit) || (words.length > 1 && words.every((w) => w.length <= 2) && hit(whole));
}

/**
 * Bereinigt eine Eingabe: Steuerzeichen raus, Leerraum zusammenfassen, höchstens
 * `maxLength` Zeichen. null, wenn nichts übrig bleibt oder der Text unpassend ist.
 */
export function cleanEntry(raw: unknown, maxLength = MAX_ENTRY_LENGTH): string | null {
  if (typeof raw !== 'string') return null;
  const text = Array.from(raw.normalize('NFC').replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim())
    .slice(0, maxLength)
    .join('')
    .trim();
  if (text.length === 0) return null;
  if (isBlockedText(text)) return null;
  return text;
}

/**
 * Vergleichsschlüssel: Großbuchstaben, Umlaute als AE/OE/UE, ß als SS, ohne Akzente,
 * Leerzeichen, Bindestriche und Satzzeichen. „Bären-Höhle“ → „BAERENHOEHLE“.
 */
export function normalizeWord(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/ẞ/g, 'SS')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Anfangsbuchstabe für Kategorien-Spiele: Umlaute zählen zum Grundbuchstaben
 * („Ärztin“ gilt für A). Leer, wenn kein Buchstabe vorkommt.
 */
export function initialLetter(raw: string): string {
  const first = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .charAt(0);
  return first;
}

/** Levenshtein-Abstand, bricht ab, sobald er `limit` überschreitet (dann `limit + 1`). */
export function editDistance(a: string, b: string, limit = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * Gilt eine Eingabe als dasselbe Wort? Nach `normalizeWord` gleich, oder ab fünf
 * Buchstaben mit höchstens einem Tippfehler (Buchstabe zu viel, zu wenig oder vertauscht).
 * Kurze Wörter müssen stimmen, sonst wäre „Hund“ dasselbe wie „Mund“.
 */
export function sameWord(a: string, b: string): boolean {
  const x = normalizeWord(a);
  const y = normalizeWord(b);
  if (x.length === 0 || y.length === 0) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) < 5) return false;
  return editDistance(x, y, 1) <= 1;
}

/** Passt die Eingabe zu einem der Wörter? Liefert den Treffer oder null. */
export function findWord<T extends string>(entry: string, words: readonly T[]): T | null {
  const key = normalizeWord(entry);
  if (!key) return null;
  for (const word of words) if (normalizeWord(word) === key) return word;
  for (const word of words) if (sameWord(entry, word)) return word;
  return null;
}

/** Häufige deutsche Endungen, längste zuerst – für den groben Wortstamm. */
const SUFFIXES = ['chen', 'lein', 'ungen', 'ung', 'heit', 'keit', 'ern', 'em', 'en', 'er', 'es', 'el', 'e', 'n', 's'];

/**
 * Grober Wortstamm für den Sperrwort-Filter: normalisiert, eine häufige Endung ab,
 * mindestens vier Buchstaben bleiben. „Bäume“ → „BAEUM“, „Hundes“ → „HUND“.
 */
export function wordStem(raw: string): string {
  const key = normalizeWord(raw);
  for (const suffix of SUFFIXES) {
    const cut = suffix.toUpperCase();
    if (key.endsWith(cut) && key.length - cut.length >= 4) return key.slice(0, -cut.length);
  }
  return key;
}

/** Stämme mit ä/ö/ü auch ohne Umlaut („BAEUM“ → auch „BAUM“), damit „Baum“ und „Bäume“ zusammenfallen. */
function stemVariants(stem: string): string[] {
  const plain = stem.replace(/AE/g, 'A').replace(/OE/g, 'O').replace(/UE/g, 'U');
  return plain === stem ? [stem] : [stem, plain];
}

/**
 * Welches gesperrte Wort steckt im Text? Jedes Wort des Textes wird mit jedem
 * gesperrten Wort verglichen: gleicher Stamm, Tippfehler (ab fünf Buchstaben) oder
 * Stamm als Teil eines zusammengesetzten Wortes („Hundehütte“ enthält „Hund“).
 * Gibt das gesperrte Wort zurück oder null.
 */
export function forbiddenWordIn(text: string, forbidden: readonly string[]): string | null {
  const tokens = text.split(/[\s\-_.,;:!?/()"'„“]+/).map((t) => normalizeWord(t)).filter(Boolean);
  // Auch zwei benachbarte Wörter zusammen („drei Ecken“ enthält „Dreieck“).
  const keys = [...tokens, ...tokens.slice(1).map((t, i) => tokens[i]! + t)];
  for (const word of forbidden) {
    const stems = stemVariants(wordStem(word));
    if (stems[0]!.length === 0) continue;
    for (const key of keys) {
      const tokenStems = stemVariants(wordStem(key));
      // Ungestemmt nur für genaue Treffer und Teilwörter („Äpfel“ ohne Umlaut ist „Apfel“).
      const whole = [...new Set([...tokenStems, ...stemVariants(key)])];
      for (const stem of stems) {
        if (whole.includes(stem)) return word;
        if (stem.length >= 4 && whole.some((t) => t.includes(stem))) return word;
        if (stem.length >= 5 && tokenStems.some((t) => editDistance(t, stem, 1) <= 1)) return word;
      }
    }
  }
  return null;
}

/**
 * Zählt freie Vorschläge mehrerer Spieler (z. B. Sperrwörter): Gleiche Wörter (auch mit
 * Tippfehler) zählen zusammen. Ergebnis nach Stimmen absteigend; bei Gleichstand gewinnt,
 * was zuerst genannt wurde (Reihenfolge der Eingaben).
 */
export function rankProposals(proposals: readonly (readonly string[])[]): { word: string; votes: number }[] {
  const ranked: { word: string; votes: number; order: number }[] = [];
  let order = 0;
  for (const list of proposals) {
    const seen = new Set<number>();
    for (const word of list) {
      const index = ranked.findIndex((entry) => sameWord(entry.word, word));
      if (index >= 0) {
        if (!seen.has(index)) ranked[index]!.votes++;
        seen.add(index);
      } else {
        ranked.push({ word, votes: 1, order: order++ });
        seen.add(ranked.length - 1);
      }
    }
  }
  return ranked.sort((a, b) => b.votes - a.votes || a.order - b.order).map(({ word, votes }) => ({ word, votes }));
}
