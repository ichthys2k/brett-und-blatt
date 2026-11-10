import { sha1 } from './sha1';

/*
 * Kennungen wie in Anki: Notizen und Stapel haben Zeitstempel in Millisekunden als `id`, Notizen zusätzlich eine `guid`
 * (Basis 91, über Geräte und Sammlungen stabil). Daran erkennt Anki beim Import, was schon da ist.
 */

const TABLE = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';

/** Zahl zur Basis 91 mit Anki-Alphabet (`to_base_n` in `rslib/src/notes/mod.rs`). */
export function toBase91(value: bigint): string {
  if (value === 0n) return '';
  let out = '';
  let n = value;
  const base = BigInt(TABLE.length);
  while (n > 0n) {
    out = TABLE[Number(n % base)] + out;
    n /= base;
  }
  return out;
}

const u64 = (bytes: Uint8Array): bigint => bytes.slice(0, 8).reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);

/** Zufällige Notiz-Kennung (64 Bit). */
export function newGuid(): string {
  return toBase91(u64(crypto.getRandomValues(new Uint8Array(8))));
}
/** Dieselbe Kennung zu demselben Text, z. B. für Notizen, die beim Umstellen auf jedem Gerät gleich entstehen müssen. */
export const guidFromSeed = (seed: string): string => toBase91(u64(sha1(seed)));

const ID_BASE = 1_600_000_000_000;
/** Feste Kennung zu einem Text (Zeitstempel-ähnlich, damit Anki sie als Kennung annimmt). */
export function idFromSeed(seed: string): number {
  const hash = sha1(seed);
  return ID_BASE + ((((hash[0]! << 24) | (hash[1]! << 16) | (hash[2]! << 8) | hash[3]!) >>> 0) % 100_000_000_000);
}

/** Neue Kennung aus der Uhr; bei Zusammenstößen mit `taken` geht es eine Millisekunde weiter. */
export function newId(now: number, taken: ReadonlySet<number>): number {
  let id = Math.floor(now);
  while (taken.has(id)) id++;
  return id;
}
