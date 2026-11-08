import { deriveKeys, open, seal, type VaultKeys } from './crypto';
import { sanitizePlayerPass, PLAYER_EMOJIS, type PlayerPass } from './player';
import { SyncError } from './vault';

/**
 * Browser-Seite des Schlosses (Vorhaben #135, Schritt #138); die Regeln des Servers stehen in
 * `packages/online/src/lock.ts`.
 *
 * Aus Spielercode und **PIN oder Passwort** rechnet PBKDF2 zwei Werte: `auth` (der Beweis, den der Server
 * prüft) und `wrap` (bleibt im Browser). Der Inhalt – der Ausweis mit Passschlüssel – ist mit
 * `HKDF(wrap ‖ Serveranteil)` verschlüsselt. Den Serveranteil gibt der Server nur bei richtigem `auth` heraus.
 * Die **Notfallkarte** ist der Sicherungscode; aus ihm leitet HKDF den Wert `recovery` ab, mit dem sich ein
 * vergessenes oder gesperrtes Schloss zurücksetzen lässt.
 */

/** PBKDF2-Runden: auf einem schwachen Handy etwa eine Drittelsekunde. Eine Änderung macht alle Schlösser unlesbar. */
export const LOCK_ROUNDS = 200_000;
const PIN_LENGTH = 6;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

const enc = new TextEncoder();

export type SecretKind = 'pin' | 'password';

/** Das, was ein Gerät behält, um das Schloss später ohne erneute Eingabe zu beschreiben. */
export interface LockSecrets {
  auth: string;
  wrap: string;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
}

/**
 * Prüft eine Eingabe: sechs Ziffern **oder** sechs Emoji aus den 16 Bildern des Spielercodes (PIN),
 * sonst mindestens 8 Zeichen (Passwort). Liefert Art und bereinigten Wert oder null.
 */
export function parseSecret(input: string): { kind: SecretKind; value: string } | null {
  const text = input.normalize('NFC');
  const compact = Array.from(text.replace(/[\s‍︎️-]/g, ''));
  if (compact.length === PIN_LENGTH && compact.every((ch) => /^[0-9]$/.test(ch))) return { kind: 'pin', value: compact.join('') };
  const emoji = new Set<string>(PLAYER_EMOJIS);
  if (compact.length === PIN_LENGTH && compact.every((ch) => emoji.has(ch))) return { kind: 'pin', value: compact.join('') };
  if (text.length >= MIN_PASSWORD && text.length <= MAX_PASSWORD) return { kind: 'password', value: text };
  return null;
}

/** Kennung des Schlosses aus dem Spielercode (verrät ihn nicht). */
export async function lockId(code: string): Promise<string> {
  return (await deriveKeys(enc.encode(code), 'code', 'brett-und-blatt/schloss/v1')).id;
}

/** PBKDF2 über Spielercode und Geheimnis; `rounds` nur für Tests anders. */
export async function stretchSecret(code: string, secret: string, rounds = LOCK_ROUNDS): Promise<LockSecrets> {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`brett-und-blatt/schloss-pin/v1\n${code}`), iterations: rounds }, base, 512));
  return { auth: toBase64Url(bits.slice(0, 32)), wrap: toBase64Url(bits.slice(32)) };
}

/** Notfallwert aus dem Sicherungscode (die Notfallkarte). */
export async function recoveryProof(syncCode: string): Promise<string> {
  const base = await crypto.subtle.importKey('raw', enc.encode(syncCode), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('brett-und-blatt/schloss-notfall/v1'), info: enc.encode('recovery') }, base, 256);
  return toBase64Url(new Uint8Array(bits));
}

function contentKeys(secrets: LockSecrets, share: string): Promise<VaultKeys> {
  const wrap = fromBase64Url(secrets.wrap);
  const part = fromBase64Url(share);
  const joined = new Uint8Array(wrap.length + part.length);
  joined.set(wrap);
  joined.set(part, wrap.length);
  return deriveKeys(joined, 'code', 'brett-und-blatt/schloss-inhalt/v1');
}

// ---------------------------------------------------------------- Server

type Server = () => string | null;
type Json = Record<string, unknown> & { status?: number };

const OFFLINE = 'Keine Verbindung zum Spieleserver. Später noch einmal versuchen.';

function waitText(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return minutes >= 60 ? 'einer Stunde' : minutes === 1 ? 'einer Minute' : `${minutes} Minuten`;
}

/** Übersetzt eine Antwort des Servers in eine verständliche Meldung. */
export function lockMessage(status: number, body: Json): string {
  if (status === 401) {
    const left = typeof body.left === 'number' ? body.left : null;
    return left === null ? 'Das stimmt nicht.' : left > 0 ? `Falsch. Noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}, danach ist der Ausweis gesperrt.` : 'Falsch. Der Ausweis ist jetzt gesperrt.';
  }
  if (status === 423) {
    if (body.locked) return 'Dieser Ausweis ist nach zu vielen Fehlversuchen gesperrt. Mit der Notfallkarte (Sicherungscode) lässt er sich wieder öffnen.';
    return `Zu viele Fehlversuche. Bitte in ${waitText(Number(body.waitMs) || 60_000)} noch einmal versuchen.`;
  }
  if (status === 404) return 'Zu diesem Spielercode gibt es keinen Ausweis. Bitte genau abschreiben.';
  if (status === 409) return 'Andere Geräte schreiben gerade gleichzeitig. Gleich noch einmal versuchen.';
  if (status === 429) return 'Zu viele Fehlversuche von diesem Anschluss. Bitte in einer Stunde noch einmal versuchen.';
  if (status === 503) return 'Der Spieleserver ist für PIN und Passwort noch nicht eingerichtet.';
  return OFFLINE;
}

async function call(serverUrl: Server, id: string, action: string, body: unknown): Promise<Json> {
  const server = serverUrl();
  if (!server) throw new SyncError('Diese Fassung kennt keinen Spieleserver.');
  let res: Response;
  try {
    res = await fetch(`${server}/schloss/${id}/${action}`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new SyncError(OFFLINE);
  }
  const json = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new SyncError(lockMessage(res.status, json));
  return json;
}

/** Gibt es zu diesem Spielercode ein Schloss mit PIN oder Passwort? */
export async function hasPassLock(serverUrl: Server, code: string): Promise<boolean> {
  const server = serverUrl();
  if (!server) return false;
  try {
    const res = await fetch(`${server}/schloss/${await lockId(code)}`, { cache: 'no-store' });
    if (res.status === 429) throw new SyncError(lockMessage(429, {}));
    if (!res.ok) return false;
    return ((await res.json()) as { exists?: unknown }).exists === true;
  } catch (error) {
    if (error instanceof SyncError) throw error;
    return false;
  }
}

async function sealPass(secrets: LockSecrets, share: string, pass: PlayerPass): Promise<string> {
  return seal(await contentKeys(secrets, share), { v: 1, player: pass });
}

async function openPassContent(secrets: LockSecrets, share: string, data: string): Promise<PlayerPass> {
  if (!data) throw new SyncError('Das Schloss ist unvollständig. Bitte mit der Notfallkarte zurücksetzen.');
  try {
    const value = (await open(await contentKeys(secrets, share), data)) as { player?: unknown };
    const pass = sanitizePlayerPass(value?.player);
    if (pass) return pass;
  } catch {
    // fällt durch
  }
  throw new SyncError('Der Ausweis lässt sich nicht öffnen.');
}

/** Legt das Schloss an. Die Notfallkarte (Sicherungscode) muss es schon geben. */
export async function createPassLock(serverUrl: Server, code: string, secrets: LockSecrets, syncCode: string, pass: PlayerPass): Promise<void> {
  const id = await lockId(code);
  const made = await call(serverUrl, id, 'anlegen', { auth: secrets.auth, recovery: await recoveryProof(syncCode) });
  await call(serverUrl, id, 'speichern', { auth: secrets.auth, data: await sealPass(secrets, String(made.share), { ...pass, code }), rev: 0 });
}

/** Öffnet das Schloss und liefert den Ausweis samt Passschlüssel. */
export async function openPassLock(serverUrl: Server, code: string, secrets: LockSecrets): Promise<{ pass: PlayerPass; rev: number }> {
  const opened = await call(serverUrl, await lockId(code), 'oeffnen', { auth: secrets.auth });
  return { pass: { ...(await openPassContent(secrets, String(opened.share), String(opened.data))), code }, rev: Number(opened.rev) };
}

/** Schreibt den Ausweis ins Schloss (Namen, Bild, Turniere, Passschlüssel). */
export async function savePassLock(serverUrl: Server, code: string, secrets: LockSecrets, pass: PlayerPass): Promise<void> {
  const id = await lockId(code);
  for (let attempt = 0; attempt < 3; attempt++) {
    const opened = await call(serverUrl, id, 'oeffnen', { auth: secrets.auth });
    try {
      await call(serverUrl, id, 'speichern', { auth: secrets.auth, data: await sealPass(secrets, String(opened.share), { ...pass, code }), rev: Number(opened.rev) });
      return;
    } catch (error) {
      if (attempt === 2 || !(error instanceof SyncError) || !error.message.startsWith('Andere Geräte')) throw error;
    }
  }
}

/** Ändert PIN oder Passwort; das Alte muss stimmen. */
export async function changePassLock(serverUrl: Server, code: string, oldSecrets: LockSecrets, newSecrets: LockSecrets, pass: PlayerPass): Promise<void> {
  const id = await lockId(code);
  const opened = await call(serverUrl, id, 'oeffnen', { auth: oldSecrets.auth });
  await call(serverUrl, id, 'aendern', { auth: oldSecrets.auth, newAuth: newSecrets.auth, data: await sealPass(newSecrets, String(opened.share), { ...pass, code }) });
}

/** Setzt das Schloss mit der Notfallkarte zurück (vergessene oder gesperrte PIN) und setzt eine neue. */
export async function resetPassLock(serverUrl: Server, code: string, syncCode: string, newSecrets: LockSecrets, pass: PlayerPass): Promise<void> {
  const id = await lockId(code);
  // Der Serveranteil kommt erst mit der Antwort; darum zuerst mit leerem Inhalt zurücksetzen lassen, dann beschreiben.
  const recovery = await recoveryProof(syncCode);
  const placeholder = btoa('zuruecksetzen');
  const reset = await call(serverUrl, id, 'zuruecksetzen', { recovery, newAuth: newSecrets.auth, data: placeholder });
  const share = String(reset.share);
  const opened = await call(serverUrl, id, 'oeffnen', { auth: newSecrets.auth });
  await call(serverUrl, id, 'speichern', { auth: newSecrets.auth, data: await sealPass(newSecrets, share, { ...pass, code }), rev: Number(opened.rev) });
}

/** Entfernt das Schloss (mit PIN oder Notfallkarte). */
export async function removePassLock(serverUrl: Server, code: string, proof: { auth: string } | { syncCode: string }): Promise<void> {
  const body = 'auth' in proof ? { auth: proof.auth } : { recovery: await recoveryProof(proof.syncCode) };
  await call(serverUrl, await lockId(code), 'loeschen', body);
}
