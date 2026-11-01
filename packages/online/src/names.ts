import { BLOCKED_WORD_PARTS, simplifyForFilter } from '@brett-und-blatt/engine';
import { AVATARS } from './protocol';

export const MAX_NAME_LENGTH = 16;

/**
 * Bereinigt einen Spitznamen: Steuerzeichen raus, Leerraum zusammenfassen,
 * höchstens 16 Zeichen. Gibt null zurück, wenn nichts übrig bleibt oder der Name
 * unpassend ist.
 */
export function cleanName(raw: string): string | null {
  const name = Array.from(raw.normalize('NFC').replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim())
    .slice(0, MAX_NAME_LENGTH)
    .join('')
    .trim();
  if (name.length === 0) return null;
  // Die Liste unpassender Wortteile teilen sich Spitznamen und Wortspiele (engine/words.ts).
  const simple = simplifyForFilter(name);
  if (BLOCKED_WORD_PARTS.some((word) => simple.includes(word))) return null;
  return name;
}

export function cleanAvatar(raw: string): string {
  return (AVATARS as readonly string[]).includes(raw) ? raw : AVATARS[0];
}
