import { deriveKeys, open, seal, type VaultKeys } from './crypto';
import { stretchSecret, type LockSecrets } from './lock';
import { sanitizePlayerPass, type PlayerPass } from './player';
import { SyncError } from './vault';

/**
 * Browser-Seite der Anmeldung mit Google oder Microsoft (Vorhaben #135, Schritt #154); Konzept und Regeln des Servers:
 * `docs/spiele/konto-anmeldung.md`, `packages/online/src/account.ts`.
 *
 * Der Browser erzeugt ein Geheimnis (`binding`) und schickt nur dessen Hash zum Start. Nach der Anmeldung beim Anbieter
 * kommt er mit einem **Ticket** zurück; Ticket und Geheimnis zusammen schalten das Konto-Schloss frei. Der Inhalt –
 * der Pass samt Passschlüssel – ist mit `HKDF([wrap ‖] Serveranteil)` verschlüsselt; `wrap` gibt es nur bei „Konto + PIN“.
 */

export type AccountProvider = 'google' | 'microsoft';
export const ACCOUNT_PROVIDER_LABELS: Readonly<Record<AccountProvider, string>> = { google: 'Google', microsoft: 'Microsoft' };

type Server = () => string | null;
type Json = Record<string, unknown> & { status?: number };

const OFFLINE = 'Keine Verbindung zum Spieleserver. Später noch einmal versuchen.';
const enc = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
}

/** Zufälliges Geheimnis des Browsers (32 Byte); nur sein Hash geht zum Server. */
export function newAccountBinding(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256Url(value: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value))));
}

/** Eine Anmeldung, die der Browser gerade führt. */
export interface AccountSession {
  ticket: string;
  binding: string;
  lockId: string;
  provider: AccountProvider;
}

export function accountMessage(status: number, body: Json): string {
  if (status === 401 && body.error === 'ticket') return 'Die Anmeldung ist abgelaufen. Bitte noch einmal anmelden.';
  if (status === 401) {
    const left = typeof body.left === 'number' ? body.left : null;
    return left === null ? 'Das stimmt nicht.' : left > 0 ? `Falsch. Noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}, danach ist das Konto gesperrt.` : 'Falsch. Das Konto ist jetzt gesperrt.';
  }
  if (status === 423) {
    if (body.locked) return 'Diese Verknüpfung ist nach zu vielen Fehlversuchen gesperrt. Mit der Rettungskarte den Pass öffnen und das Konto neu verknüpfen.';
    return `Zu viele Fehlversuche. Bitte in ${Math.max(1, Math.ceil((Number(body.waitMs) || 60_000) / 60_000))} Minuten noch einmal versuchen.`;
  }
  if (status === 404) return 'Zu diesem Konto gibt es keine Verknüpfung.';
  if (status === 409) return 'Andere Geräte schreiben gerade gleichzeitig. Gleich noch einmal versuchen.';
  if (status === 429) return 'Zu viele Versuche von diesem Anschluss. Bitte in einer Stunde noch einmal versuchen.';
  if (status === 503) return 'Die Anmeldung mit diesem Anbieter ist auf dem Spieleserver noch nicht eingerichtet.';
  return OFFLINE;
}

async function post(serverUrl: Server, path: string, body: unknown): Promise<Json> {
  const server = serverUrl();
  if (!server) throw new SyncError('Diese Fassung kennt keinen Spieleserver.');
  let res: Response;
  try {
    res = await fetch(`${server}${path}`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new SyncError(OFFLINE);
  }
  const json = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new SyncError(accountMessage(res.status, json));
  return json;
}

/** Welche Anbieter sind auf dem Server eingerichtet? Ohne Server oder ohne Antwort: keine. */
export async function loadAccountProviders(serverUrl: Server): Promise<AccountProvider[]> {
  const server = serverUrl();
  if (!server) return [];
  try {
    const res = await fetch(`${server}/konto`, { cache: 'no-store' });
    if (!res.ok) return [];
    const list = ((await res.json()) as { providers?: unknown }).providers;
    return Array.isArray(list) ? list.filter((p): p is AccountProvider => p === 'google' || p === 'microsoft') : [];
  } catch {
    return [];
  }
}

/** Beginnt die Anmeldung: liefert die Adresse des Anbieters und das Geheimnis, das der Browser bis zur Rückkehr behalten muss. */
export async function beginAccountLogin(serverUrl: Server, provider: AccountProvider): Promise<{ url: string; binding: string }> {
  const binding = newAccountBinding();
  const done = await post(serverUrl, `/konto/${provider}/start`, { binding: await sha256Url(binding) });
  if (typeof done.url !== 'string') throw new SyncError(OFFLINE);
  return { url: done.url, binding };
}

/** Nach der Rückkehr: zu welchem Konto-Schloss gehört das Ticket? */
export async function resolveAccountTicket(serverUrl: Server, ticket: string, binding: string): Promise<AccountSession> {
  const done = await post(serverUrl, '/konto/ticket', { ticket, binding });
  if (typeof done.lockId !== 'string' || (done.provider !== 'google' && done.provider !== 'microsoft')) throw new SyncError(OFFLINE);
  return { ticket, binding, lockId: done.lockId, provider: done.provider };
}

const call = (serverUrl: Server, session: AccountSession, action: string, body: Record<string, unknown> = {}) =>
  post(serverUrl, `/konto-schloss/${session.lockId}/${action}`, { ...body, ticket: session.ticket, binding: session.binding });

/** Gibt es zu diesem Konto schon ein Schloss, und verlangt es eine PIN? */
export async function accountStatus(serverUrl: Server, session: AccountSession): Promise<{ exists: boolean; pin: boolean }> {
  const done = await call(serverUrl, session, 'status');
  return { exists: done.exists === true, pin: done.pin === true };
}

/** PIN oder Passwort für ein Konto-Schloss: Salz ist die Schloss-Kennung, damit es ohne Spielercode geht. */
export function accountSecrets(session: AccountSession, secret: string, rounds?: number): Promise<LockSecrets> {
  return stretchSecret(`konto:${session.lockId}`, secret, rounds);
}

async function contentKeys(share: string, wrap?: string): Promise<VaultKeys> {
  const part = fromBase64Url(share);
  const front = wrap ? fromBase64Url(wrap) : new Uint8Array(0);
  const joined = new Uint8Array(front.length + part.length);
  joined.set(front);
  joined.set(part, front.length);
  return deriveKeys(joined, 'code', 'brett-und-blatt/konto-inhalt/v1');
}

/** Verknüpft das Konto mit dem Pass (ersetzt eine bestehende Verknüpfung). Mit `secrets` gilt „Konto + PIN“. */
export async function linkAccount(serverUrl: Server, session: AccountSession, pass: PlayerPass, secrets?: LockSecrets): Promise<void> {
  const made = await call(serverUrl, session, 'anlegen', secrets ? { auth: secrets.auth } : {});
  const data = await seal(await contentKeys(String(made.share), secrets?.wrap), { v: 1, player: pass });
  await call(serverUrl, session, 'speichern', { ...(secrets ? { auth: secrets.auth } : {}), data, rev: 0 });
}

/** Öffnet den Pass über das Konto (neues Gerät). Bei „Konto + PIN“ gehört `secrets` dazu. */
export async function openAccountPass(serverUrl: Server, session: AccountSession, secrets?: LockSecrets): Promise<PlayerPass> {
  const opened = await call(serverUrl, session, 'oeffnen', secrets ? { auth: secrets.auth } : {});
  const data = String(opened.data ?? '');
  if (!data) throw new SyncError('Die Verknüpfung ist unvollständig. Bitte mit der Rettungskarte öffnen und das Konto neu verknüpfen.');
  try {
    const value = (await open(await contentKeys(String(opened.share), secrets?.wrap), data)) as { player?: unknown };
    const pass = sanitizePlayerPass(value?.player);
    if (pass) return pass;
  } catch {
    // fällt durch
  }
  throw new SyncError('Der Pass lässt sich nicht öffnen.');
}

/** Löst die Verknüpfung (das Schloss wird gelöscht). */
export async function unlinkAccount(serverUrl: Server, session: AccountSession): Promise<void> {
  await call(serverUrl, session, 'loeschen');
}
