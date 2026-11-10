/*
 * Klassenausweise (Vorhaben #135, Schritt #152) – reiner Kern: Start-PIN, Eintragsliste und deren Zusammenführen.
 * Die Liste liegt im Pass-Block `klassen` der Lehrkraft; der Block ist mit dem Passschlüssel der Lehrkraft verschlüsselt und
 * ist damit das „Lehrkraft-Schloss“: Wer den Pass der Lehrkraft öffnen kann, kann auch die PIN der Kinder zurücksetzen.
 */

export interface ChildPass {
  /** Klasse, zu der der Ausweis gehört. */
  classCode: string;
  name: string;
  avatar: string;
  /** Spielercode des Kindes (vier Emoji). */
  playerCode: string;
  /** Rettungscode des Kindes (für das Zurücksetzen der PIN); nie auf der Karte. */
  syncCode: string;
  /** Passschlüssel des Kindes. */
  passKey: string;
  /** Geräte-Kennung des Kindes. */
  token: string;
  /** Start-PIN von der Karte; nach einem Zurücksetzen die neue. */
  pin: string;
  at: number;
}
export type ChildPasses = ChildPass[];

export const CHILD_PASSES_MAX = 120;

/** Sechs Ziffern, gleichmäßig verteilt. */
export function randomPin(randomInt: (n: number) => number = (n) => crypto.getRandomValues(new Uint32Array(1))[0]! % n): string {
  return Array.from({ length: 6 }, () => String(randomInt(10))).join('');
}

const text = (value: unknown, max: number): string | null => (typeof value === 'string' && value.length > 0 && value.length <= max ? value : null);

export function sanitizeChildPasses(value: unknown): ChildPasses {
  if (!Array.isArray(value)) return [];
  return value.slice(0, CHILD_PASSES_MAX).flatMap((item) => {
    const v = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const classCode = text(v.classCode, 40);
    const name = text(v.name, 30);
    const avatar = text(v.avatar, 16);
    const playerCode = text(v.playerCode, 40);
    const syncCode = text(v.syncCode, 40);
    const passKey = text(v.passKey, 64);
    const token = text(v.token, 128);
    const pin = typeof v.pin === 'string' && /^\d{6}$/.test(v.pin) ? v.pin : null;
    const at = typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : 0;
    return classCode && name && avatar && playerCode && syncCode && passKey && token && pin ? [{ classCode, name, avatar, playerCode, syncCode, passKey, token, pin, at }] : [];
  });
}

/** Je Spielercode gilt der jüngere Eintrag; nichts geht verloren, was nur eine Seite kennt. */
export function mergeChildPasses(remote: ChildPasses, local: ChildPasses): ChildPasses {
  const byCode = new Map<string, ChildPass>();
  for (const item of [...remote, ...local]) {
    const known = byCode.get(item.playerCode);
    if (!known || item.at > known.at) byCode.set(item.playerCode, item);
  }
  return [...byCode.values()].slice(0, CHILD_PASSES_MAX);
}

export const sameChildPasses = (a: ChildPasses, b: ChildPasses): boolean => {
  const key = (list: ChildPasses) => JSON.stringify([...list].sort((x, y) => x.playerCode.localeCompare(y.playerCode)));
  return key(a) === key(b);
};

import { AVATARS } from '@brett-und-blatt/online';

const AVATAR_SET = new Set<string>(AVATARS);

export interface ParsedChildName {
  name: string;
  avatar?: string;
}

/** Liest eine Zeile der Namensliste: erkennt Namen und optionales Tierbild (z. B. "Mia 🦊" oder "Mia;🦊"). Unbekannte Bilder werden verworfen. */
export function parseNameLine(rawLine: string): ParsedChildName | null {
  const line = rawLine.trim();
  if (!line) return null;

  let namePart = line;
  let avatarCandidate: string | null = null;

  const delimiterMatch = /^(.*?)[;\t,]\s*(.*)$/.exec(line);
  if (delimiterMatch) {
    const left = delimiterMatch[1]!.trim();
    const right = delimiterMatch[2]!.trim();
    if (AVATAR_SET.has(right)) {
      namePart = left;
      avatarCandidate = right;
    } else if (AVATAR_SET.has(left)) {
      namePart = right;
      avatarCandidate = left;
    } else {
      if (/^\p{Extended_Pictographic}+$/u.test(right)) {
        namePart = left;
      } else if (/^\p{Extended_Pictographic}+$/u.test(left)) {
        namePart = right;
      } else {
        namePart = left;
      }
    }
  } else {
    const tokens = line.split(/\s+/);
    if (tokens.length >= 2) {
      const first = tokens[0]!;
      const last = tokens[tokens.length - 1]!;
      if (AVATAR_SET.has(last)) {
        avatarCandidate = last;
        namePart = tokens.slice(0, -1).join(' ');
      } else if (AVATAR_SET.has(first)) {
        avatarCandidate = first;
        namePart = tokens.slice(1).join(' ');
      } else if (/^\p{Extended_Pictographic}+$/u.test(last)) {
        namePart = tokens.slice(0, -1).join(' ');
      } else if (/^\p{Extended_Pictographic}+$/u.test(first)) {
        namePart = tokens.slice(1).join(' ');
      }
    }
  }

  const name = namePart.replace(/\s+/g, ' ').slice(0, 16).trim();
  if (!name) return null;

  return avatarCandidate && AVATAR_SET.has(avatarCandidate) ? { name, avatar: avatarCandidate } : { name };
}

/** Namen aus einem Textfeld: eine Zeile je Kind, leere und doppelte Zeilen fallen weg. */
export function parseNames(input: string, max = 60): ParsedChildName[] {
  const seen = new Set<string>();
  const out: ParsedChildName[] = [];
  for (const line of input.split(/\r?\n/)) {
    const parsed = parseNameLine(line);
    if (parsed && !seen.has(parsed.name.toLowerCase())) {
      seen.add(parsed.name.toLowerCase());
      out.push(parsed);
    }
  }
  return out.slice(0, max);
}

/**
 * Dubletten-Prüfung (#152): Zieht einen Spielercode und prüft, ob bereits ein Schloss mit PIN/Passwort existiert.
 * Kollidiert der Code, wird er verworfen und ein neuer Versuch unternommen.
 */
export async function pickFreePlayerCode(
  createCandidate: () => Promise<string>,
  checkHasLock: (code: string) => Promise<boolean>,
  revokeCandidate: (code: string) => Promise<void>,
  maxAttempts = 5,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = await createCandidate();
    if (await checkHasLock(candidate)) {
      await revokeCandidate(candidate).catch(() => undefined);
      continue;
    }
    return candidate;
  }
  throw new Error('Kein freier Spielercode gefunden. Noch einmal versuchen.');
}

