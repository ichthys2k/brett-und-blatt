/**
 * Schloss des Spielerausweises (Vorhaben #135, Schritt #138) – Logik ohne Anbieterbindung.
 *
 * Ein Spielercode aus vier Emoji hat nur 65 536 Möglichkeiten. Darum öffnet er den Pass nicht allein:
 * Der Browser rechnet aus Spielercode und **PIN oder Passwort** mit PBKDF2 zwei Werte, `auth` (der Beweis)
 * und `wrap` (der Schlüssel). Der Server kennt `wrap` nie. Er speichert nur
 *
 * - `HMAC(Pfeffer, auth)` – wer den Speicher kopiert, kann damit nichts durchprobieren, denn der Pfeffer liegt
 *   als Geheimnis (`PASS_PEPPER`) nur im Worker, nicht im Speicher;
 * - einen **Serveranteil** (zufällig, mit dem Pfeffer verschlüsselt), der erst bei richtigem `auth` herausgegeben wird.
 *   Der Inhalt ist im Browser mit `HKDF(wrap ‖ Serveranteil)` verschlüsselt: Ohne Server ist er nicht zu öffnen,
 *   ohne PIN auch nicht;
 * - einen **Fehlversuchszähler je Ausweis**: ab 5 Fehlern wachsende Wartezeit, ab 10 gesperrt, bis die
 *   **Notfallkarte** (der Sicherungscode) das Schloss zurücksetzt.
 *
 * Die Notfallkarte beweist sich mit `recovery`, einem aus dem Sicherungscode abgeleiteten Wert; der Server
 * speichert auch davon nur den HMAC.
 */

/** Kennung eines Schlosses: 128 Bit als Hexadezimalzahl. */
export const LOCK_ID_PATTERN = /^[0-9a-f]{32}$/;
/** Beweis- und Notfallwerte: 32 Byte als Base64url. */
export const LOCK_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** Höchstgröße des Inhalts (Base64), wie bei Sicherungen. */
export const LOCK_MAX_BYTES = 64 * 1024;
/** Unbenutzte Schlösser werden nach rund 13 Monaten gelöscht. */
export const LOCK_TTL_MS = 400 * 24 * 60 * 60 * 1000;
/** Ab so vielen Fehlern in Folge beginnt die Wartezeit. */
export const LOCK_FREE_TRIES = 5;
/** Ab so vielen Fehlern in Folge ist das Schloss gesperrt (nur die Notfallkarte öffnet es wieder). */
export const LOCK_MAX_FAILS = 10;
/** Wartezeit nach dem 5., 6., 7., 8. und 9. Fehler (ms): 1, 5, 15, 60, 60 Minuten. */
export const LOCK_WAITS_MS = [1, 5, 15, 60, 60].map((minutes) => minutes * 60 * 1000);

export interface LockRecord {
  /** HMAC(Pfeffer, auth), Base64url. */
  authMac: string;
  /** HMAC(Pfeffer, recovery), Base64url. */
  recoveryMac: string;
  /** Serveranteil, mit dem Pfeffer verschlüsselt (Base64). */
  shareEnc: string;
  /** Im Browser verschlüsselter Inhalt (Base64). */
  data: string;
  rev: number;
  /** Fehlversuche in Folge. */
  fails: number;
  /** Bis wann (ms) nicht geöffnet werden darf. */
  until: number;
  /** Letzter Zugriff (ms), für das Löschen. */
  at: number;
}

export type LockResult<T = object> =
  | ({ status: 200 } & T)
  | { status: 400; error: string }
  | { status: 401; fails: number; left: number }
  /** Wartezeit läuft (`waitMs`) oder gesperrt (`locked`). */
  | { status: 423; waitMs: number; locked: boolean }
  | { status: 409; current: { data: string; rev: number } | null }
  | { status: 503; error: 'pepper' };

const enc = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));
}
function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(pepper: string, purpose: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${purpose}\n${value}`))));
}

async function pepperKey(pepper: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`brett-und-blatt/schloss-anteil/v1\n${pepper}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function sealShare(pepper: string, share: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await pepperKey(pepper), share as BufferSource));
  const out = new Uint8Array(12 + cipher.length);
  out.set(iv);
  out.set(cipher, 12);
  return toBase64(out);
}

async function openShare(pepper: string, sealed: string): Promise<string> {
  const bytes = fromBase64(sealed);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await pepperKey(pepper), bytes.slice(12));
  return toBase64Url(new Uint8Array(plain));
}

/** Vergleich in gleichbleibender Zeit. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const validSecret = (value: unknown): value is string => typeof value === 'string' && LOCK_SECRET_PATTERN.test(value);
const validData = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= LOCK_MAX_BYTES && /^[A-Za-z0-9+/=]+$/.test(value);

/** Wartezeit nach dem n-ten Fehler in Folge (0 = keine, Infinity = gesperrt). */
export function waitAfterFails(fails: number): number {
  if (fails < LOCK_FREE_TRIES) return 0;
  if (fails >= LOCK_MAX_FAILS) return Infinity;
  return LOCK_WAITS_MS[fails - LOCK_FREE_TRIES]!;
}

/** Neues Schloss. `body`: `{ auth, recovery }`. Antwort enthält den Serveranteil, damit der Browser den Inhalt verschlüsseln kann. */
export async function createLock(body: unknown, pepper: string | undefined, now: number): Promise<LockResult<{ record: LockRecord; share: string }>> {
  if (!pepper) return { status: 503, error: 'pepper' };
  const { auth, recovery } = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (!validSecret(auth) || !validSecret(recovery)) return { status: 400, error: 'secret' };
  const share = crypto.getRandomValues(new Uint8Array(32));
  const record: LockRecord = {
    authMac: await hmac(pepper, 'auth', auth),
    recoveryMac: await hmac(pepper, 'recovery', recovery),
    shareEnc: await sealShare(pepper, share),
    data: '',
    rev: 0,
    fails: 0,
    until: 0,
    at: now,
  };
  return { status: 200, record, share: toBase64Url(share) };
}

/** Prüft `auth` gegen das Schloss und zählt Fehler. Liefert den neuen Datensatz (immer zu speichern) und das Ergebnis. */
async function check(record: LockRecord, auth: unknown, pepper: string, now: number): Promise<{ record: LockRecord; ok: boolean; result?: LockResult }> {
  if (record.fails >= LOCK_MAX_FAILS) return { record, ok: false, result: { status: 423, waitMs: Infinity, locked: true } };
  if (now < record.until) return { record, ok: false, result: { status: 423, waitMs: record.until - now, locked: false } };
  if (!validSecret(auth)) return { record, ok: false, result: { status: 400, error: 'secret' } };
  if (same(await hmac(pepper, 'auth', auth), record.authMac)) return { record: { ...record, fails: 0, until: 0, at: now }, ok: true };
  const fails = record.fails + 1;
  const wait = waitAfterFails(fails);
  const next = { ...record, fails, until: Number.isFinite(wait) ? now + wait : 0, at: now };
  return { record: next, ok: false, result: { status: 401, fails, left: Math.max(0, LOCK_MAX_FAILS - fails) } };
}

export interface LockOutcome<T = object> {
  /** Neuer Datensatz oder null (nichts ändern). */
  record: LockRecord | null;
  result: LockResult<T>;
}

/** Öffnen: bei richtigem `auth` kommen Serveranteil, Inhalt und `rev` heraus. */
export async function openLock(record: LockRecord, body: unknown, pepper: string | undefined, now: number): Promise<LockOutcome<{ share: string; data: string; rev: number }>> {
  if (!pepper) return { record: null, result: { status: 503, error: 'pepper' } };
  const checked = await check(record, (body as { auth?: unknown } | null)?.auth, pepper, now);
  if (!checked.ok) return { record: checked.record, result: checked.result as LockResult<{ share: string; data: string; rev: number }> };
  return { record: checked.record, result: { status: 200, share: await openShare(pepper, record.shareEnc), data: record.data, rev: record.rev } };
}

/** Inhalt schreiben (nach richtigem `auth`), mit Nummer gegen gleichzeitiges Überschreiben. */
export async function saveLock(record: LockRecord, body: unknown, pepper: string | undefined, now: number): Promise<LockOutcome<{ rev: number }>> {
  if (!pepper) return { record: null, result: { status: 503, error: 'pepper' } };
  const { auth, data, rev } = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const checked = await check(record, auth, pepper, now);
  if (!checked.ok) return { record: checked.record, result: checked.result as LockResult<{ rev: number }> };
  if (!validData(data) || typeof rev !== 'number' || !Number.isInteger(rev) || rev < 0) return { record: checked.record, result: { status: 400, error: 'data' } };
  if (rev !== record.rev) return { record: checked.record, result: { status: 409, current: { data: record.data, rev: record.rev } } };
  return { record: { ...checked.record, data, rev: rev + 1 }, result: { status: 200, rev: rev + 1 } };
}

/** PIN oder Passwort ändern: `auth` bestätigt das Alte, `newAuth` ersetzt es; der Browser schickt den neu verschlüsselten Inhalt mit. */
export async function changeLock(record: LockRecord, body: unknown, pepper: string | undefined, now: number): Promise<LockOutcome<{ rev: number }>> {
  if (!pepper) return { record: null, result: { status: 503, error: 'pepper' } };
  const { auth, newAuth, data } = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const checked = await check(record, auth, pepper, now);
  if (!checked.ok) return { record: checked.record, result: checked.result as LockResult<{ rev: number }> };
  if (!validSecret(newAuth) || !validData(data)) return { record: checked.record, result: { status: 400, error: 'data' } };
  return { record: { ...checked.record, authMac: await hmac(pepper, 'auth', newAuth), data, rev: record.rev + 1 }, result: { status: 200, rev: record.rev + 1 } };
}

/**
 * Zurücksetzen mit der Notfallkarte: `recovery` beweist den Sicherungscode, `newAuth` und `data` ersetzen PIN und Inhalt,
 * Zähler und Wartezeit werden gelöscht. Der Serveranteil bleibt; der Browser holt ihn mit der Antwort.
 */
export async function resetLock(record: LockRecord, body: unknown, pepper: string | undefined, now: number): Promise<LockOutcome<{ share: string; rev: number }>> {
  if (!pepper) return { record: null, result: { status: 503, error: 'pepper' } };
  const { recovery, newAuth, data } = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (!validSecret(recovery) || !validSecret(newAuth) || !validData(data)) return { record: null, result: { status: 400, error: 'secret' } };
  if (!same(await hmac(pepper, 'recovery', recovery), record.recoveryMac)) {
    // Die Notfallkarte ist lang und zufällig; Durchprobieren begrenzt der Absender-Zähler im Server.
    return { record: null, result: { status: 401, fails: record.fails, left: Math.max(0, LOCK_MAX_FAILS - record.fails) } };
  }
  const next: LockRecord = { ...record, authMac: await hmac(pepper, 'auth', newAuth), data, rev: record.rev + 1, fails: 0, until: 0, at: now };
  return { record: next, result: { status: 200, share: await openShare(pepper, record.shareEnc), rev: next.rev } };
}

/** Schloss löschen (etwa wenn der Spielercode erneuert wird); nur mit `auth` oder `recovery`. */
export async function mayRemoveLock(record: LockRecord, body: unknown, pepper: string | undefined, now: number): Promise<LockOutcome> {
  if (!pepper) return { record: null, result: { status: 503, error: 'pepper' } };
  const { auth, recovery } = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (validSecret(recovery) && same(await hmac(pepper, 'recovery', recovery), record.recoveryMac)) return { record: null, result: { status: 200 } };
  const checked = await check(record, auth, pepper, now);
  return { record: checked.record, result: checked.ok ? { status: 200 } : checked.result! };
}

export { validData as isValidLockData };
