/**
 * Anmeldung mit Google- oder Microsoft-Konto (Vorhaben #135, Schritt #154) – Logik ohne Anbieterbindung.
 * Konzept: `docs/spiele/konto-anmeldung.md`.
 *
 * OpenID Connect mit PKCE über den Worker. Der Worker prüft das ID-Token, bildet daraus eine Kontokennung und
 * legt ein kurzlebiges **Ticket** an. Das Ticket schaltet das **Konto-Schloss** frei: einen verschlüsselten
 * Inhalt (der Pass samt Passschlüssel), dessen Serveranteil nur nach gültigem Ticket herauskommt. Der Server
 * speichert keine E-Mail und keinen Namen, nur einen Prüfwert (HMAC mit dem Pfeffer) der Kontokennung.
 * Wahlweise kommt eine PIN dazu (`auth`/`wrap` wie beim PIN-Schloss): dann kennt der Server den zweiten Teil
 * des Schlüssels nie.
 */
import {
  LOCK_MAX_FAILS,
  LOCK_MAX_BYTES,
  isValidLockData,
  isValidLockSecret,
  lockHmac,
  lockOpenShare,
  lockSame,
  lockSealShare,
  lockToBase64Url,
  waitAfterFails,
  type LockResult,
} from './lock';

export const ACCOUNT_PROVIDERS = ['google', 'microsoft'] as const;
export type AccountProvider = (typeof ACCOUNT_PROVIDERS)[number];
export const isAccountProvider = (value: unknown): value is AccountProvider => typeof value === 'string' && (ACCOUNT_PROVIDERS as readonly string[]).includes(value);

/** Der Anmeldevorgang (state, nonce, Verifier) lebt so lange. */
export const FLOW_TTL_MS = 10 * 60 * 1000;
/** Ein Ticket gilt so lange (Zeit für Verknüpfen oder Öffnen mit PIN). */
export const TICKET_TTL_MS = 5 * 60 * 1000;
export const ACCOUNT_LABELS: Readonly<Record<AccountProvider, string>> = { google: 'Google', microsoft: 'Microsoft' };

interface ProviderConfig {
  authorize: string;
  token: string;
  jwks: string;
}
export const PROVIDER_CONFIG: Readonly<Record<AccountProvider, ProviderConfig>> = {
  google: { authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', jwks: 'https://www.googleapis.com/oauth2/v3/certs' },
  microsoft: { authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', jwks: 'https://login.microsoftonline.com/common/discovery/v2.0/keys' },
};

/**
 * Sieht die Client-Kennung nach dem richtigen Anbieter aus? Google: `…apps.googleusercontent.com`; Microsoft: eine GUID.
 * Fängt vertauschte Werte ab (ein Client-Geheimnis in der Kennungs-Zeile), bevor sie in eine Adresse gelangen.
 */
export function isPlausibleClientId(provider: AccountProvider, clientId: string): boolean {
  if (provider === 'google') return /^[0-9]+-[A-Za-z0-9_]+\.apps\.googleusercontent\.com$/.test(clientId);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);
}

const enc = new TextEncoder();

/** Zufallswert als Base64url (`bytes` Byte). */
export function randomToken(bytes = 32): string {
  return lockToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** SHA-256 als Base64url (PKCE-Prüfwert und Bindung des Browsers). */
export async function sha256Url(value: string): Promise<string> {
  return lockToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value))));
}

export interface AuthorizeParams {
  provider: AccountProvider;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  /** `sha256Url(verifier)`. */
  challenge: string;
}

/** Adresse, zu der der Browser für die Anmeldung geschickt wird. Nur der Bereich `openid`. */
export function buildAuthorizeUrl(params: AuthorizeParams): string {
  const url = new URL(PROVIDER_CONFIG[params.provider].authorize);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid');
  url.searchParams.set('state', params.state);
  url.searchParams.set('nonce', params.nonce);
  url.searchParams.set('code_challenge', params.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // Anmeldung immer sichtbar bestätigen lassen, damit nicht stillschweigend ein anderes Konto gewählt wird.
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export type ClaimsResult = { ok: true; accountKey: string } | { ok: false; reason: 'iss' | 'aud' | 'exp' | 'nonce' | 'sub' };

/**
 * Prüft die Inhalte eines (schon auf Signatur geprüften) ID-Tokens und liefert die Kontokennung.
 * Google: `sub`. Microsoft: `tid` + `sub`; der Aussteller trägt die Mandanten-Kennung und muss zur `tid` passen
 * (die Adresse „common“ liefert Tokens aus allen Mandanten).
 */
export function checkIdTokenClaims(provider: AccountProvider, claims: unknown, expect: { clientId: string; nonce: string; now: number }): ClaimsResult {
  const c = (claims && typeof claims === 'object' ? claims : {}) as Record<string, unknown>;
  const aud = c.aud;
  if (!(aud === expect.clientId || (Array.isArray(aud) && aud.includes(expect.clientId)))) return { ok: false, reason: 'aud' };
  if (typeof c.exp !== 'number' || c.exp * 1000 <= expect.now) return { ok: false, reason: 'exp' };
  if (c.nonce !== expect.nonce) return { ok: false, reason: 'nonce' };
  if (typeof c.sub !== 'string' || c.sub === '' || c.sub.length > 255) return { ok: false, reason: 'sub' };
  if (provider === 'google') {
    if (c.iss !== 'https://accounts.google.com' && c.iss !== 'accounts.google.com') return { ok: false, reason: 'iss' };
    return { ok: true, accountKey: c.sub };
  }
  if (typeof c.tid !== 'string' || !/^[0-9a-f-]{36}$/i.test(c.tid) || c.iss !== `https://login.microsoftonline.com/${c.tid}/v2.0`) return { ok: false, reason: 'iss' };
  return { ok: true, accountKey: `${c.tid.toLowerCase()}:${c.sub}` };
}

/** Kennung des Konto-Schlosses: HMAC mit dem Pfeffer, auf 128 Bit gekürzt (verrät das Konto nicht). */
export async function accountLockId(pepper: string, provider: AccountProvider, accountKey: string): Promise<string> {
  const mac = await lockHmac(pepper, 'konto', `${provider}\n${accountKey}`);
  const bytes = Uint8Array.from(atob(mac.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (mac.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
  return Array.from(bytes.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- Vorgang und Ticket

export interface FlowRecord {
  provider: AccountProvider;
  verifier: string;
  nonce: string;
  /** `sha256Url` des Geheimnisses, das nur der Browser kennt. */
  binding: string;
  /** Seite, auf die zurückgeleitet wird (geprüft gegen `ALLOWED_ORIGINS`). */
  returnTo: string;
  at: number;
}

export interface TicketRecord {
  provider: AccountProvider;
  lockId: string;
  binding: string;
  at: number;
}

/** Gilt das Ticket (noch) für diesen Browser und, wenn `lockId` angegeben ist, für dieses Schloss? */
export async function ticketValid(ticket: TicketRecord | null, lockId: string | null, bindingSecret: unknown, now: number): Promise<boolean> {
  if (!ticket || typeof bindingSecret !== 'string' || bindingSecret.length < 16 || bindingSecret.length > 128) return false;
  if (now > ticket.at + TICKET_TTL_MS || (lockId !== null && ticket.lockId !== lockId)) return false;
  return lockSame(await sha256Url(bindingSecret), ticket.binding);
}

// ---------------------------------------------------------------- Konto-Schloss

export interface AccountRecord {
  /** Serveranteil, mit dem Pfeffer verschlüsselt (Base64). */
  shareEnc: string;
  /** Im Browser verschlüsselter Inhalt (Base64); leer, bis der Browser ihn geschrieben hat. */
  data: string;
  rev: number;
  /** Mit PIN: HMAC(Pfeffer, auth); sonst null (nur Konto). */
  authMac: string | null;
  fails: number;
  until: number;
  at: number;
}

export interface AccountOutcome<T = object> {
  record: AccountRecord | null;
  result: LockResult<T>;
}

/** Legt das Konto-Schloss an oder ersetzt es (neuer Serveranteil, leerer Inhalt). `body`: `{ auth? }` – mit `auth` gilt „Konto + PIN“. */
export async function createAccountLock(body: unknown, pepper: string | undefined, now: number): Promise<LockResult<{ record: AccountRecord; share: string }>> {
  if (!pepper) return { status: 503, error: 'pepper' };
  const { auth } = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (auth !== undefined && !isValidLockSecret(auth)) return { status: 400, error: 'secret' };
  const share = crypto.getRandomValues(new Uint8Array(32));
  const record: AccountRecord = { shareEnc: await lockSealShare(pepper, share), data: '', rev: 0, authMac: auth === undefined ? null : await lockHmac(pepper, 'auth', auth as string), fails: 0, until: 0, at: now };
  return { status: 200, record, share: lockToBase64Url(share) };
}

/** Prüft bei „Konto + PIN“ den Beweis und zählt Fehler; ohne PIN-Schutz immer in Ordnung. */
async function checkAuth(record: AccountRecord, auth: unknown, pepper: string, now: number): Promise<{ record: AccountRecord; ok: boolean; result?: LockResult }> {
  if (record.authMac === null) return { record: { ...record, at: now }, ok: true };
  if (record.fails >= LOCK_MAX_FAILS) return { record, ok: false, result: { status: 423, waitMs: Infinity, locked: true } };
  if (now < record.until) return { record, ok: false, result: { status: 423, waitMs: record.until - now, locked: false } };
  if (!isValidLockSecret(auth)) return { record, ok: false, result: { status: 400, error: 'secret' } };
  if (lockSame(await lockHmac(pepper, 'auth', auth), record.authMac)) return { record: { ...record, fails: 0, until: 0, at: now }, ok: true };
  const fails = record.fails + 1;
  const wait = waitAfterFails(fails);
  return { record: { ...record, fails, until: Number.isFinite(wait) ? now + wait : 0, at: now }, ok: false, result: { status: 401, fails, left: Math.max(0, LOCK_MAX_FAILS - fails) } };
}

/** Öffnen: Serveranteil, Inhalt und Nummer (bei PIN-Schutz nur mit richtigem `auth`). */
export async function openAccountLock(record: AccountRecord, body: unknown, pepper: string | undefined, now: number): Promise<AccountOutcome<{ share: string; data: string; rev: number; pin: boolean }>> {
  if (!pepper) return { record: null, result: { status: 503, error: 'pepper' } };
  const checked = await checkAuth(record, (body as { auth?: unknown } | null)?.auth, pepper, now);
  if (!checked.ok) return { record: checked.record, result: checked.result as LockResult<{ share: string; data: string; rev: number; pin: boolean }> };
  return { record: checked.record, result: { status: 200, share: await lockOpenShare(pepper, record.shareEnc), data: record.data, rev: record.rev, pin: record.authMac !== null } };
}

/** Inhalt schreiben, mit Nummer gegen gleichzeitiges Überschreiben (bei PIN-Schutz mit `auth`). */
export async function saveAccountLock(record: AccountRecord, body: unknown, pepper: string | undefined, now: number): Promise<AccountOutcome<{ rev: number }>> {
  if (!pepper) return { record: null, result: { status: 503, error: 'pepper' } };
  const { auth, data, rev } = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const checked = await checkAuth(record, auth, pepper, now);
  if (!checked.ok) return { record: checked.record, result: checked.result as LockResult<{ rev: number }> };
  if (!isValidLockData(data) || data.length > LOCK_MAX_BYTES || typeof rev !== 'number' || !Number.isInteger(rev) || rev < 0) return { record: checked.record, result: { status: 400, error: 'data' } };
  if (rev !== record.rev) return { record: checked.record, result: { status: 409, current: { data: record.data, rev: record.rev } } };
  return { record: { ...checked.record, data, rev: rev + 1 }, result: { status: 200, rev: rev + 1 } };
}
