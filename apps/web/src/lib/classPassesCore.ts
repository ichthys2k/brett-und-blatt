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

/** Namen aus einem Textfeld: eine Zeile je Kind, leere und doppelte Zeilen fallen weg. */
export function parseNames(input: string, max = 60): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of input.split(/\r?\n/)) {
    const name = line.trim().replace(/\s+/g, ' ').slice(0, 16);
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out.slice(0, max);
}
