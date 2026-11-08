import { BLOCKED_WORD_PARTS, cleanCrest, parseCrest, simplifyForFilter } from '@brett-und-blatt/engine';
import { AVATARS } from './protocol';

export const MAX_NAME_LENGTH = 16;

/**
 * Bereinigt einen Spitznamen: Steuerzeichen raus, Leerraum zusammenfassen,
 * höchstens 16 Zeichen. Gibt null zurück, wenn nichts übrig bleibt oder der Name
 * unpassend ist.
 */
export function cleanName(raw: string, maxLength = MAX_NAME_LENGTH): string | null {
  const name = Array.from(raw.normalize('NFC').replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim())
    .slice(0, maxLength)
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

/**
 * Das Wappen aus einer Nachricht: nur eine gültige Beschreibung in Normalform, und nur, wenn die Person es im Raum
 * zeigen will (`raum:1`). Alles andere wird verworfen; der Raum zeichnet und speichert nie fremden Text.
 */
export function crestField(raw: unknown): { crest?: string } {
  const clean = cleanCrest(raw);
  return clean && parseCrest(clean)?.inRoom ? { crest: clean } : {};
}

/** Setzt oder löscht das Wappen eines Mitglieds (fehlt es in der Nachricht, will die Person keins zeigen). */
export function setCrest(member: { crest?: string }, raw: unknown): void {
  const field = crestField(raw);
  if (field.crest) member.crest = field.crest;
  else delete member.crest;
}
