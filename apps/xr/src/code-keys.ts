/**
 * Emoji-Tastatur für den Raumcode (#393): reine Helfer ohne React, damit `tests/xr-codetasten.test.ts`
 * sie prüfen kann. Der Code besteht aus vier der 16 `ROOM_EMOJIS`.
 */
import { ROOM_CODE_LENGTH, ROOM_EMOJIS } from '@brett-und-blatt/online';

const KNOWN = new Set<string>(ROOM_EMOJIS);

/** Die bereits gewählten Code-Emoji aus einer Eingabe (Leerzeichen und Varianten-Zeichen ignoriert, höchstens vier). */
export function codeEmojis(input: string): string[] {
  return Array.from(input.normalize('NFC').replace(/[\s︎️‍]/g, ''))
    .filter((p) => KNOWN.has(p))
    .slice(0, ROOM_CODE_LENGTH);
}

/** Hängt ein Emoji an; bei vollem Code bleibt alles, wie es ist. */
export function pressEmoji(input: string, emoji: string): string {
  const now = codeEmojis(input);
  if (!KNOWN.has(emoji) || now.length >= ROOM_CODE_LENGTH) return now.join('');
  return [...now, emoji].join('');
}

/** Löscht das letzte Emoji. */
export function pressBackspace(input: string): string {
  return codeEmojis(input).slice(0, -1).join('');
}

export function codeComplete(input: string): boolean {
  return codeEmojis(input).length === ROOM_CODE_LENGTH;
}
