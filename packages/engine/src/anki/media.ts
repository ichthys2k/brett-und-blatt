import { sha1Hex } from './sha1';

/*
 * Neue Bilder und Ton für Notizen (Vorhaben #101, L4): welche Dateien erlaubt sind, wie groß sie sein dürfen und wie sie heißen. Der Name
 * ist der, unter dem die Datei im Feld und später im Anki-Paket steht (kein Pfad, keine Sonderzeichen).
 */

export const IMAGE_TYPES: Readonly<Record<string, string>> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
export const AUDIO_TYPES: Readonly<Record<string, string>> = { mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4', wav: 'audio/wav' };
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const AUDIO_MAX_BYTES = 10 * 1024 * 1024;
/** Alle Medien einer Sammlung zusammen. */
export const MEDIA_TOTAL_MAX_BYTES = 50 * 1024 * 1024;

export type MediaKind = 'image' | 'audio';

export const extensionOf = (name: string): string => name.split('.').pop()?.toLowerCase() ?? '';
export function kindOf(name: string): MediaKind | null {
  const ext = extensionOf(name);
  return IMAGE_TYPES[ext] ? 'image' : AUDIO_TYPES[ext] ? 'audio' : null;
}

/** Meldung, warum eine Datei nicht genommen wird; `null`, wenn sie in Ordnung ist. SVG ist ausgeschlossen (kann Skripte tragen). */
export function checkMediaFile(name: string, size: number, usedBytes = 0): string | null {
  const kind = kindOf(name);
  if (!kind) return 'Erlaubt sind Bilder (JPG, PNG, GIF, WebP) und Ton (MP3, OGG, M4A, WAV).';
  if (size <= 0) return 'Die Datei ist leer.';
  if (size > (kind === 'image' ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES)) return `Die Datei ist zu groß (Bilder höchstens ${IMAGE_MAX_BYTES / 1024 / 1024} MB, Ton höchstens ${AUDIO_MAX_BYTES / 1024 / 1024} MB).`;
  if (usedBytes + size > MEDIA_TOTAL_MAX_BYTES) return `Der Platz für Bilder und Ton ist voll (höchstens ${MEDIA_TOTAL_MAX_BYTES / 1024 / 1024} MB).`;
  return null;
}

/**
 * Ein freier Dateiname für `original`: Sonderzeichen werden `_`, die Endung klein. Gibt es den Namen schon mit anderem Inhalt, kommt ein Stück
 * der Prüfsumme dazu; mit gleichem Inhalt wird die vorhandene Datei wiederverwendet (`existing: true`).
 */
export function mediaFileName(original: string, bytes: Uint8Array, taken: ReadonlyMap<string, Uint8Array>): { name: string; existing: boolean } {
  const dot = original.lastIndexOf('.');
  const stem = (dot > 0 ? original.slice(0, dot) : original).normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^[._-]+/, '').slice(0, 60) || 'datei';
  const ext = extensionOf(original);
  const name = `${stem}.${ext}`;
  const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && sha1Hex(a) === sha1Hex(b);
  const known = taken.get(name);
  if (!known) return { name, existing: false };
  if (same(known, bytes)) return { name, existing: true };
  return { name: `${stem}-${sha1Hex(bytes).slice(0, 6)}.${ext}`, existing: taken.has(`${stem}-${sha1Hex(bytes).slice(0, 6)}.${ext}`) };
}
