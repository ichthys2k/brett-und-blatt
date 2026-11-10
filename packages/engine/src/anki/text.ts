import { sha1 } from './sha1';

/*
 * Textfunktionen im Sinne von Anki (Quellen: `rslib/src/text.rs`, `rslib/src/notes/mod.rs`): Felder einer Notiz werden mit dem
 * Zeichen 0x1F getrennt gespeichert, die Prüfsumme des ersten Feldes (`csum`) und das Sortierfeld (`sfld`) entstehen aus dem Text
 * ohne HTML, wobei die Dateinamen von Bildern und Ton erhalten bleiben.
 */

export const FIELD_SEPARATOR = '\x1f';

export const joinFields = (fields: readonly string[]): string => fields.join(FIELD_SEPARATOR);
export const splitFields = (text: string): string[] => text.split(FIELD_SEPARATOR);

/** Alles aus `<img>`, `<audio>`, `<video>`, `<object>`, `<source>`, was auf eine Datei zeigt (`src` oder `data`), wie `HTML_MEDIA_TAGS`. */
const MEDIA_TAGS = /<\b(?:img|audio|video|object|source)\b(?:[^>]|"[^"]+?"|'[^']+?')+?\b(?:src|data)\b=(?:"([^"]+?)"[^>]*>|'([^']+?)'[^>]*>|([^ >]+?)(?: [^>]*>|>))/gis;
/** Kommentare, Stil- und Skriptblöcke und alle Tags, wie `HTML`. */
const HTML = /(<!--.*?-->)|(<style.*?>.*?<\/style>)|(<script.*?>.*?<\/script>)|(<.*?>)/gis;

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Ersetzt die gebräuchlichen Zeichenverweise (`&amp;`, `&#39;`, `&#x20AC;`); Unbekanntes bleibt stehen. */
export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text
    .replace(/&#(\d{1,7});/g, (whole, code: string) => safeChar(Number(code), whole))
    .replace(/&#x([0-9a-f]{1,6});/gi, (whole, code: string) => safeChar(parseInt(code, 16), whole))
    .replace(/&([a-z]+);/gi, (whole, name: string) => NAMED[name.toLowerCase()] ?? whole)
    .replace(/ /g, ' ');
}
function safeChar(code: number, fallback: string): string {
  return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : fallback;
}

/** Text ohne HTML. */
export const stripHtml = (html: string): string => decodeEntities(html.replace(HTML, ''));

/** Text ohne HTML; der Dateiname eines Bildes oder Tons bleibt als Wort stehen. */
export const stripHtmlKeepMedia = (html: string): string => stripHtml(html.replace(MEDIA_TAGS, ' $1$2$3 '));

/** Prüfsumme des ersten Feldes: die ersten vier Byte von SHA-1 (hoch zuerst) als Zahl. */
export function fieldChecksum(text: string): number {
  const hash = sha1(text);
  return ((hash[0]! << 24) | (hash[1]! << 16) | (hash[2]! << 8) | hash[3]!) >>> 0;
}

/** Ist das Feld leer? Leer ist auch, was nur Leerraum, unsichtbare Leerzeichen oder HTML ohne Inhalt trägt. */
export const fieldIsEmpty = (html: string): boolean => /^[\s​]*$/.test(stripHtmlKeepMedia(html));

/** Anki lässt in Feldern keine Steuerzeichen außer Zeilenumbruch und Tabulator zu. */
export const cleanFieldText = (text: string): string => text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');

/** Sortierfeld und Prüfsumme einer Notiz. */
export function noteKeys(fields: readonly string[], sortField: number): { sfld: string; csum: number } {
  const first = stripHtmlKeepMedia(fields[0] ?? '');
  const sfld = sortField === 0 ? first : stripHtmlKeepMedia(fields[sortField] ?? '');
  return { sfld, csum: fieldChecksum(first) };
}
