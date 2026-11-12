/**
 * Web Push (#242, Schritt 1): Datentypen, Prüfung von Abonnements, Abo-Buch und Spam-Schutz.
 * Reine Logik ohne Anbieterbindung und ohne Krypto (die steht in `webpush.ts`).
 *
 * Sicherheitsgrenze: Der Server ruft später die Endpunkt-Adresse eines Abos an. Ohne die
 * Zulassungsliste würde er beliebige vom Browser genannte Adressen anrufen (SSRF).
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const PUSH_KINDS = ['matchCalled', 'deadline', 'tournamentStarted', 'tournamentFinished', 'yourTurn'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

export function isPushKind(value: unknown): value is PushKind {
  return typeof value === 'string' && (PUSH_KINDS as readonly string[]).includes(value);
}

/** Höchstlänge der Endpunkt-Adresse. */
export const PUSH_ENDPOINT_MAX = 600;
/** Höchstzahl Abos je Objekt (Turnier oder Raum). */
export const PUSH_BOOK_MAX = 300;
/** Höchstens eine Meldung je Person und Art in diesem Zeitraum. */
export const PUSH_LIMIT_MS = 30 * 60 * 1000;
/** Länge des unkomprimierten P-256-Schlüssels (`p256dh`) und des Geheimnisses (`auth`) in Byte. */
export const PUSH_P256DH_BYTES = 65;
export const PUSH_AUTH_BYTES = 16;

/** Erlaubte Hosts der Push-Dienste: genau der Name oder (mit führendem Punkt) jede Unteradresse. */
const ALLOWED_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
const ALLOWED_SUFFIXES = ['.push.services.mozilla.com', '.notify.windows.com', '.push.apple.com'];

const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** Länge in Byte, wenn `value` unverpacktes base64url ist; sonst `null`. */
function base64urlLength(value: unknown): number | null {
  if (typeof value !== 'string' || value === '' || value.length > 200 || !BASE64URL.test(value)) return null;
  const rest = value.length % 4;
  if (rest === 1) return null;
  return Math.floor((value.length * 3) / 4);
}

function isAllowedHost(host: string): boolean {
  if (ALLOWED_HOSTS.includes(host)) return true;
  return ALLOWED_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

export interface ParsePushOptions {
  /**
   * Nur für den lokalen Rauchtest: erlaubt `127.0.0.1` und `localhost` (auch über `http:`).
   * Darf nur gesetzt werden, wenn der Server als Testserver läuft (`ROOM_JURISDICTION === 'none'`).
   */
  allowLocal?: boolean;
}

/** Prüft ein vom Browser gemeldetes Abonnement (`PushSubscription.toJSON()`); `null` bei jedem Mangel. */
export function parsePushSubscription(raw: unknown, options: ParsePushOptions = {}): PushSubscriptionData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { endpoint, keys } = raw as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > PUSH_ENDPOINT_MAX) return null;
  if (typeof keys !== 'object' || keys === null) return null;
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  if (base64urlLength(p256dh) !== PUSH_P256DH_BYTES || base64urlLength(auth) !== PUSH_AUTH_BYTES) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.username !== '' || url.password !== '' || url.hash !== '') return null;
  const local = options.allowLocal === true && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  if (!local) {
    if (url.protocol !== 'https:' || (url.port !== '' && url.port !== '443')) return null;
    if (!isAllowedHost(url.hostname)) return null;
  } else if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  return { endpoint, keys: { p256dh: p256dh as string, auth: auth as string } };
}

interface StoredEntry {
  sub: PushSubscriptionData;
  at: number;
}

/** Abo-Buch eines Objekts: höchstens ein Abo je Geräte-Kennung, höchstens `PUSH_BOOK_MAX` Abos. */
export class PushBook {
  private entries = new Map<string, StoredEntry>();

  get size(): number {
    return this.entries.size;
  }

  /** Legt das Abo an oder ersetzt das alte der Kennung. `false`, wenn das Buch voll ist. */
  set(token: string, sub: PushSubscriptionData, now: number): boolean {
    if (!this.entries.has(token) && this.entries.size >= PUSH_BOOK_MAX) return false;
    this.entries.set(token, { sub, at: now });
    return true;
  }

  get(token: string): PushSubscriptionData | null {
    return this.entries.get(token)?.sub ?? null;
  }

  has(token: string): boolean {
    return this.entries.has(token);
  }

  remove(token: string): boolean {
    return this.entries.delete(token);
  }

  /** Entfernt alle Abos mit dieser Adresse (Push-Dienst meldete 404/410); gibt die Zahl zurück. */
  removeByEndpoint(endpoint: string): number {
    let removed = 0;
    for (const [token, entry] of this.entries) {
      if (entry.sub.endpoint === endpoint) {
        this.entries.delete(token);
        removed += 1;
      }
    }
    return removed;
  }

  /** Entfernt Abos, die vor mehr als `maxAgeMs` gemeldet wurden. */
  prune(maxAgeMs: number, now: number): number {
    let removed = 0;
    for (const [token, entry] of this.entries) {
      if (now - entry.at > maxAgeMs) {
        this.entries.delete(token);
        removed += 1;
      }
    }
    return removed;
  }

  toJSON(): { token: string; sub: PushSubscriptionData; at: number }[] {
    return [...this.entries].map(([token, entry]) => ({ token, sub: entry.sub, at: entry.at }));
  }

  /** Stellt ein Buch aus dem Speicher her; ungültige Einträge werden verworfen. */
  static fromJSON(raw: unknown, options: ParsePushOptions = {}): PushBook {
    const book = new PushBook();
    if (!Array.isArray(raw)) return book;
    for (const item of raw) {
      if (typeof item !== 'object' || item === null) continue;
      const { token, sub, at } = item as { token?: unknown; sub?: unknown; at?: unknown };
      if (typeof token !== 'string' || token === '' || typeof at !== 'number' || !Number.isFinite(at)) continue;
      const parsed = parsePushSubscription(sub, options);
      if (parsed) book.set(token, parsed, at);
    }
    return book;
  }
}

/** Spam-Schutz: je (Kennung, Art) höchstens eine Meldung in `PUSH_LIMIT_MS`. */
export class PushLimiter {
  private last = new Map<string, number>();

  constructor(private readonly windowMs: number = PUSH_LIMIT_MS) {}

  /** Erlaubt die Meldung und merkt sich den Zeitpunkt, oder lehnt sie ab (ohne den Zeitpunkt zu ändern). */
  allow(token: string, kind: PushKind, now: number): boolean {
    const key = `${token}|${kind}`;
    const previous = this.last.get(key);
    if (previous !== undefined && now - previous < this.windowMs && now >= previous) return false;
    if (this.last.size >= 2000) this.forget(now);
    this.last.set(key, now);
    return true;
  }

  /** Verwirft Einträge, deren Frist abgelaufen ist. */
  forget(now: number): void {
    for (const [key, at] of this.last) {
      if (now - at >= this.windowMs) this.last.delete(key);
    }
  }

  toJSON(): [string, number][] {
    return [...this.last];
  }

  static fromJSON(raw: unknown, windowMs: number = PUSH_LIMIT_MS): PushLimiter {
    const limiter = new PushLimiter(windowMs);
    if (!Array.isArray(raw)) return limiter;
    for (const item of raw) {
      if (Array.isArray(item) && typeof item[0] === 'string' && typeof item[1] === 'number' && Number.isFinite(item[1])) {
        limiter.last.set(item[0], item[1]);
      }
    }
    return limiter;
  }
}

/**
 * Inhalt der Meldung: nur Art und Ziel-Adresse (`#/turnier/<Code>` o. ä.), **keine Namen und keine Spielinhalte**.
 * Den sichtbaren Text baut der Service Worker aus der Art.
 */
export function pushPayload(kind: PushKind, url: string): string {
  return JSON.stringify({ k: kind, u: url });
}
