import { PROVIDER_CONFIG, checkIdTokenClaims, type AccountProvider, type ClaimsResult } from '@brett-und-blatt/online';

/*
 * Anmeldung mit Google oder Microsoft (#154): Tausch des Codes gegen das ID-Token und Prüfung der Signatur.
 * Nur der Worker kennt das Client-Geheimnis. Die Inhalte prüft `checkIdTokenClaims` (packages/online/src/account.ts).
 */

interface Jwk {
  kid?: string;
  kty: string;
  alg?: string;
  n?: string;
  e?: string;
}

const JWKS_TTL_MS = 60 * 60 * 1000;
const jwksCache = new Map<string, { keys: Jwk[]; at: number }>();

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
  return new Uint8Array(bytes.buffer.slice(0)) as Uint8Array<ArrayBuffer>;
}

async function loadKeys(provider: AccountProvider, fetcher: typeof fetch, now: number, force: boolean): Promise<Jwk[]> {
  const cached = jwksCache.get(provider);
  if (cached && !force && now - cached.at < JWKS_TTL_MS) return cached.keys;
  const res = await fetcher(PROVIDER_CONFIG[provider].jwks);
  if (!res.ok) throw new Error('jwks');
  const keys = ((await res.json()) as { keys?: Jwk[] }).keys ?? [];
  jwksCache.set(provider, { keys, at: now });
  return keys;
}

/** Prüft die RS256-Signatur eines ID-Tokens und liefert seinen Inhalt. */
export async function verifyIdToken(provider: AccountProvider, token: string, fetcher: typeof fetch = fetch, now = Date.now()): Promise<unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('token');
  const header = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[0]!))) as { alg?: string; kid?: string };
  if (header.alg !== 'RS256') throw new Error('alg');
  let keys = await loadKeys(provider, fetcher, now, false);
  let jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) {
    // Schlüssel können wechseln: einmal frisch laden.
    keys = await loadKeys(provider, fetcher, now, true);
    jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
  }
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64Url(parts[2]!), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Error('signature');
  return JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1]!)));
}

/** Kurzer, unbedenklicher Fehlercode der Antwort des Anbieters (z. B. `invalid_client`, `AADSTS7000215`); nie ein Wert aus unserer Anfrage. */
export function errorCode(json: { error?: unknown; error_description?: unknown }): string | undefined {
  const aad = typeof json.error_description === 'string' ? /AADSTS\d{3,7}/.exec(json.error_description)?.[0] : undefined;
  const code = typeof json.error === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(json.error) ? json.error : undefined;
  return [code, aad].filter(Boolean).join(' ') || undefined;
}

export interface ExchangeParams {
  provider: AccountProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  verifier: string;
  nonce: string;
}

/** Tauscht den Code (mit PKCE und Client-Geheimnis) gegen das ID-Token und prüft es. Liefert die Kontokennung oder den Grund des Scheiterns. */
export async function exchangeCode(params: ExchangeParams, fetcher: typeof fetch = fetch, now = Date.now()): Promise<ClaimsResult | { ok: false; reason: 'token' | 'verify'; detail?: string }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code_verifier: params.verifier,
  });
  let res: Response;
  try {
    res = await fetcher(PROVIDER_CONFIG[params.provider].token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  } catch {
    return { ok: false, reason: 'token' };
  }
  const json = (await res.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown; error_description?: unknown };
  if (!res.ok || typeof json.id_token !== 'string') return { ok: false, reason: 'token', detail: errorCode(json) };
  let claims: unknown;
  try {
    claims = await verifyIdToken(params.provider, json.id_token, fetcher, now);
  } catch {
    return { ok: false, reason: 'verify' };
  }
  return checkIdTokenClaims(params.provider, claims, { clientId: params.clientId, nonce: params.nonce, now });
}
