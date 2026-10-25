import { AVATARS } from './protocol';

export const MAX_NAME_LENGTH = 16;

/**
 * Grobe Liste unpassender Wörter für Spitznamen. Sie fängt nicht alles ab, das ist
 * auch nicht ihr Anspruch: Dazu kommen private Räume und die Raumleitung, die
 * Mitspieler entfernen kann. Geprüft wird auf Wortteile, nach dem Vereinfachen
 * von Schreibweisen wie „4“ für „a“.
 */
const BLOCKED = [
  'arsch', 'fick', 'fotze', 'hure', 'nutte', 'wichser', 'wixer', 'schlampe', 'missgeburt', 'spast',
  'schwuchtel', 'kanake', 'nigg', 'neger', 'hitler', 'nazi', 'fuck', 'shit', 'bitch',
  'cunt', 'pussy', 'porn', 'sex', 'penis', 'vagina', 'titten', 'muschi', 'kotze',
];

function simplify(text: string): string {
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
  const simple = simplify(name);
  if (BLOCKED.some((word) => simple.includes(word))) return null;
  return name;
}

export function cleanAvatar(raw: string): string {
  return (AVATARS as readonly string[]).includes(raw) ? raw : AVATARS[0];
}
