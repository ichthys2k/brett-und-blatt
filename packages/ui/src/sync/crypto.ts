/**
 * Schlüssel und Verschlüsselung der Sicherungen (W-018, W-050), nur mit Web Crypto.
 *
 * Aus einem Geheimnis – dem Sicherungscode oder der PRF-Ausgabe eines Passkeys – leitet HKDF
 * (SHA-256) zwei unabhängige Werte ab: die **Kennung**, unter der der Server den Block ablegt,
 * und den **Schlüssel** (AES-GCM, 256 Bit), mit dem der Browser ver- und entschlüsselt. Aus der
 * Kennung lässt sich der Schlüssel nicht zurückrechnen; der Server sieht nur Datensalat.
 */

/** 32 gut unterscheidbare Zeichen (ohne 0, 1, I, O). */
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
/** 16 Zeichen à 5 Bit = 80 Bit Zufall – zum Durchprobieren viel zu viele. */
export const CODE_LENGTH = 16;

export function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b & 31]).join('');
}

/** Für die Anzeige: vier Gruppen zu vier Zeichen. */
export function formatCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-');
}

/**
 * Liest einen eingegebenen Code: Groß/klein, Leerzeichen und Bindestriche egal, ein ganzer
 * Link mit `sicherung=` geht auch. 0, 1, I und O kommen im Code nie vor und werden abgelehnt.
 */
export function parseCode(input: string): string | null {
  let text = input.trim();
  const fromLink = /[?&#]sicherung=([^&#\s]+)/i.exec(text);
  if (fromLink) text = decodeURIComponent(fromLink[1]!);
  const code = text.toUpperCase().replace(/[\s\-_.]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

export interface VaultKeys {
  /** Kennung beim Server (32 Hex-Zeichen). */
  id: string;
  key: CryptoKey;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Der Narrenhof war zuerst da: Dieses Salt bleibt wortgleich, sonst wären seine Sicherungen nicht mehr lesbar. */
export const NARRENHOF_SALT = 'brett-und-blatt/narrenhof-sicherung/v1';

/**
 * Leitet Kennung und Schlüssel ab. `purpose` trennt Sicherungscode und Passkey-Schloss, `saltText` die
 * Spiele: Aus demselben Code entsteht je Spiel ein eigener Block.
 */
export async function deriveKeys(secret: Uint8Array, purpose: 'code' | 'passkey', saltText = NARRENHOF_SALT): Promise<VaultKeys> {
  const base = await crypto.subtle.importKey('raw', secret as BufferSource, 'HKDF', false, ['deriveBits', 'deriveKey']);
  const salt = enc.encode(saltText);
  const idBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(`${purpose}/kennung`) }, base, 128);
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(`${purpose}/schluessel`) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return { id: hex(idBits), key };
}

export function keysFromCode(code: string, saltText = NARRENHOF_SALT): Promise<VaultKeys> {
  return deriveKeys(enc.encode(code), 'code', saltText);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));
}

/** Verschlüsselt ein JSON-fähiges Objekt; Ergebnis: Base64 aus 12 Byte IV und Geheimtext. */
export async function seal(keys: VaultKeys, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(keys.id) }, keys.key, enc.encode(JSON.stringify(value)));
  const out = new Uint8Array(12 + cipher.byteLength);
  out.set(iv);
  out.set(new Uint8Array(cipher), 12);
  return toBase64(out);
}

/** Entschlüsselt einen Block; wirft, wenn Schlüssel oder Block nicht passen. */
export async function open(keys: VaultKeys, data: string): Promise<unknown> {
  const bytes = fromBase64(data);
  if (bytes.length < 13) throw new Error('Block zu kurz');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: enc.encode(keys.id) }, keys.key, bytes.slice(12));
  return JSON.parse(dec.decode(plain));
}
