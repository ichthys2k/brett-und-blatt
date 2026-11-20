/*
 * Geräte-PIN für den Wechsel in einen Pass (#559, Plan „Sperre je Pass“).
 *
 * Die PIN schützt nur vor versehentlichem oder neugierigem Wechsel am selben Gerät. Sie ist kein Konto-Schutz: Wer das Gerät
 * und seine Browser-Daten in der Hand hat, kommt an die Pass-Daten auch ohne PIN. Deshalb bleibt sie rein lokal und
 * geht nie ins Protokoll oder an den Server. Gespeichert wird nur ein salzhaltiger PBKDF2-Hash, nie die PIN selbst.
 */

export interface PinLock {
  /** Salz, Base64. */
  salt: string;
  /** PBKDF2-SHA-256-Ableitung, Base64. */
  hash: string;
  /** Rundenzahl der Ableitung. */
  iter: number;
}

export const PIN_ITERATIONS = 150_000;
export const PIN_MIN = 4;
export const PIN_MAX = 12;
/** Fehlversuche ohne Wartezeit; danach wächst die Sperrzeit (Sekunden). */
export const FREE_ATTEMPTS = 3;
export const LOCK_SECONDS = [10, 30, 60, 300] as const;

export const validPin = (pin: string): boolean => new RegExp(`^[0-9]{${PIN_MIN},${PIN_MAX}}$`).test(pin);

const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array, iter: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, key, 256);
  return b64(new Uint8Array(bits));
}

export async function createPinLock(pin: string, iter = PIN_ITERATIONS): Promise<PinLock> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: await derive(pin, salt, iter), iter };
}

export async function checkPin(lock: PinLock, pin: string): Promise<boolean> {
  try {
    const candidate = await derive(pin, unb64(lock.salt), lock.iter);
    // Vergleich ohne frühen Abbruch
    let diff = candidate.length ^ lock.hash.length;
    for (let i = 0; i < candidate.length; i += 1) diff |= candidate.charCodeAt(i) ^ (lock.hash.charCodeAt(i) || 0);
    return diff === 0;
  } catch {
    return false;
  }
}

/** Liest eine gespeicherte Sperre streng; Unpassendes wird verworfen. */
export function cleanPinLock(value: unknown): PinLock | undefined {
  const { salt, hash, iter } = (value ?? {}) as Record<string, unknown>;
  if (typeof salt !== 'string' || typeof hash !== 'string' || typeof iter !== 'number') return undefined;
  if (!/^[A-Za-z0-9+/=]{16,64}$/.test(salt) || !/^[A-Za-z0-9+/=]{32,64}$/.test(hash)) return undefined;
  if (!Number.isInteger(iter) || iter < 1000 || iter > 5_000_000) return undefined;
  return { salt, hash, iter };
}

// ---------------------------------------------------------------- Fehlversuche

export interface Attempts {
  fails: number;
  /** Zeit (ms), bis zu der gesperrt ist. */
  until: number;
}

/** Wie lange (Sekunden) nach dem n-ten Fehlversuch gewartet werden muss. */
export function waitAfter(fails: number): number {
  if (fails < FREE_ATTEMPTS) return 0;
  return LOCK_SECONDS[Math.min(fails - FREE_ATTEMPTS, LOCK_SECONDS.length - 1)]!;
}

export function remainingSeconds(attempts: Attempts | undefined, now: number): number {
  if (!attempts || attempts.until <= now) return 0;
  return Math.ceil((attempts.until - now) / 1000);
}

export function afterFailure(attempts: Attempts | undefined, now: number): Attempts {
  const fails = (attempts?.fails ?? 0) + 1;
  return { fails, until: now + waitAfter(fails) * 1000 };
}

const ATTEMPTS_KEY = 'brett-und-blatt:pass-pin-versuche';

/** Fehlversuche je Pass; liegen auf dem Gerät (nicht im Pass), damit ein Neuladen die Sperrzeit nicht aufhebt. */
export function loadAttempts(id: string): Attempts | undefined {
  try {
    const all = JSON.parse(window.localStorage.getItem(ATTEMPTS_KEY) ?? '{}') as Record<string, Attempts>;
    const a = all[id];
    return a && typeof a.fails === 'number' && typeof a.until === 'number' ? a : undefined;
  } catch {
    return undefined;
  }
}

export function saveAttempts(id: string, attempts: Attempts | null): void {
  try {
    const all = JSON.parse(window.localStorage.getItem(ATTEMPTS_KEY) ?? '{}') as Record<string, Attempts>;
    if (attempts) all[id] = attempts;
    else delete all[id];
    window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all));
  } catch {
    // Speicher gesperrt: dann gibt es keine Sperrzeit über Neuladen hinweg
  }
}

// ---------------------------------------------------------------- Passwahl beim Start

const ASK_KEY = 'brett-und-blatt:passwahl-start';
const ASKED_KEY = 'brett-und-blatt:passwahl-gefragt';

export function askAtStart(): boolean {
  try {
    return window.localStorage.getItem(ASK_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAskAtStart(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(ASK_KEY, '1');
    else window.localStorage.removeItem(ASK_KEY);
  } catch {
    // ignorieren
  }
}

/** Pro Sitzung (Tab) nur einmal fragen, sonst käme die Wahl nach jedem Seitenwechsel zur Startseite wieder. */
export function takeStartAsk(): boolean {
  try {
    if (!askAtStart() || window.sessionStorage.getItem(ASKED_KEY)) return false;
    window.sessionStorage.setItem(ASKED_KEY, '1');
    return true;
  } catch {
    return false;
  }
}
