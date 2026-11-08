import { deriveKeys, type VaultKeys } from './crypto';
import { SyncError, syncBlockWithKeys, type SyncBlock } from './vault';

/**
 * Spielerpass (Vorhaben #135, Schritt #137): ein zufälliger **Passschlüssel** hinter dem Ausweis.
 *
 * Aus ihm leitet HKDF für jeden Block des Passes (`einstellungen`, `partiebuch`, `chronik`, `album`, …) eine eigene
 * Kennung und einen eigenen Schlüssel ab. Wer den Passschlüssel hat, öffnet alle Blöcke; der Server sieht nur
 * verschlüsselte Daten. Der Passschlüssel selbst liegt im Ausweis (`PlayerPass.passKey`), den Sicherungscode,
 * Spielercode und Passkey öffnen – später zusätzlich hinter PIN oder Passwort (#138).
 *
 * Blöcke melden sich mit `registerPassBlock` an, statt in einer festen Liste zu stehen. Die älteren Blöcke
 * (Narrenhof, Drachenspiel, Ausweis) leiten ihre Schlüssel weiter aus dem Sicherungscode ab und bleiben unverändert.
 */

const KEY_BYTES = 32;
const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const NAME_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
}

/** Neuer Passschlüssel: 256 Bit Zufall als 43 Zeichen Base64url. */
export function randomPassKey(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));
}

/** Gültiger Passschlüssel oder null. */
export function parsePassKey(value: unknown): string | null {
  return typeof value === 'string' && KEY_PATTERN.test(value) ? value : null;
}

/** Salt eines Blocks: trennt die Blöcke eines Passes voneinander. */
export function passBlockSalt(name: string): string {
  return `brett-und-blatt/pass/${name}/v1`;
}

/** Kennung (beim Server) und Schlüssel (im Browser) eines Blocks aus dem Passschlüssel. */
export function deriveBlockKeys(passKey: string, name: string): Promise<VaultKeys> {
  const key = parsePassKey(passKey);
  if (!key) throw new SyncError('Der Passschlüssel ist ungültig.');
  return deriveKeys(fromBase64Url(key), 'code', passBlockSalt(name));
}

/** Was ein Block des Passes beisteuert; Kennung und Schlüssel ergeben sich aus dem Namen. */
export interface PassBlock<T> extends Omit<SyncBlock<T>, 'salt' | 'field' | 'serverUrl'> {
  /** Kleinbuchstaben, Ziffern und Bindestrich, z. B. `einstellungen`. */
  name: string;
}

const registry = new Map<string, PassBlock<never>>();

/** Meldet einen Block an. Ein zweites Anmelden desselben Namens ersetzt das erste (nützlich bei Neuladen im Entwicklungsmodus). */
export function registerPassBlock<T>(block: PassBlock<T>): void {
  if (!NAME_PATTERN.test(block.name)) throw new Error(`Ungültiger Blockname: ${block.name}`);
  registry.set(block.name, block as unknown as PassBlock<never>);
}

export function passBlockNames(): string[] {
  return [...registry.keys()];
}

export interface PassSyncResult {
  synced: string[];
  /** Blockname → Meldung. Ein fehlerhafter Block hält die anderen nicht auf. */
  failed: Record<string, string>;
}

async function syncOne<T>(block: PassBlock<T>, passKey: string, serverUrl: () => string | null): Promise<void> {
  const keys = await deriveBlockKeys(passKey, block.name);
  await syncBlockWithKeys({ ...block, salt: passBlockSalt(block.name), field: block.name, serverUrl }, keys, false);
}

/** Gleicht alle angemeldeten Blöcke ab (nacheinander, der Server soll nicht überrannt werden). */
export async function syncPassBlocks(passKey: string, serverUrl: () => string | null): Promise<PassSyncResult> {
  const result: PassSyncResult = { synced: [], failed: {} };
  for (const [name, block] of registry) {
    try {
      await syncOne(block, passKey, serverUrl);
      result.synced.push(name);
    } catch (error) {
      result.failed[name] = error instanceof SyncError ? error.message : 'Das hat nicht geklappt.';
    }
  }
  return result;
}
