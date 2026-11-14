/*
 * Block `einstellungen` des Spielerpasses (Vorhaben #135, Schritt #140).
 *
 * Die Einstellungen liegen weiter dort, wo die Module sie lesen (`localStorage`), und werden hier nur beobachtet: Beim
 * Abgleich vergleicht der Block jeden Wert mit dem Stand beim letzten Abgleich und vergibt bei einer Änderung den
 * Zeitstempel `t`. Zusammengeführt wird je Eintrag nach der jüngsten Änderung. Was am Gerät hängt, steht nicht hier:
 * Lautstärken und Klang an/aus (`brett-und-blatt:ton`), die Hand-Ansicht und der Kontrastwunsch des Systems.
 */

export interface Item {
  /** Der gespeicherte Text oder null: Die Einstellung wurde zurückgesetzt. */
  v: string | null;
  /** Zeitpunkt der Änderung (ms). */
  t: number;
}
export type Items = Record<string, Item>;

/** Einstellungen mit festem Schlüssel: Name im Block → Schlüssel im `localStorage`. */
export const SYNCED_KEYS: Readonly<Record<string, string>> = {
  lieblingsspiele: 'brett-und-blatt:lieblingsspiele',
  musik: 'brett-und-blatt:musik',
  aussehen: 'brett-und-blatt:aussehen',
  bildkarten: 'brett-und-blatt:bildkarten',
  kartenbild: 'brett-und-blatt:farbensortierer:kartenbild',
  'bot-vorschlag': 'brett-und-blatt:botvorschlag',
  wappen: 'brett-und-blatt:wappen',
  figuren: 'brett-und-blatt:figuren',
  'zoom-go': 'bub-go-zoom',
  'zoom-vierer-schach': 'bub-four-player-chess-zoom',
};
/** Zuletzt gewählte Einrichtung je Spiel: `brett-und-blatt:einstellungen:<id>` heißt im Block `spiel:<id>`. */
const GAME_KEY_PREFIX = 'brett-und-blatt:einstellungen:';
const GAME_NAME_PREFIX = 'spiel:';

const MAX_ITEMS = 120;
const MAX_VALUE = 8000;
const MAX_TOTAL = 40_000;
const NAME_PATTERN = /^(?:[a-z][a-z0-9-]{1,30}|spiel:[a-z0-9-]{1,40})$/;

export const nameToKey = (name: string): string | null => {
  if (Object.hasOwn(SYNCED_KEYS, name)) return SYNCED_KEYS[name]!;
  return name.startsWith(GAME_NAME_PREFIX) && NAME_PATTERN.test(name) ? `${GAME_KEY_PREFIX}${name.slice(GAME_NAME_PREFIX.length)}` : null;
};

/** Alle Einträge, die dieses Gerät gerade hat (feste Schlüssel plus Einrichtung je Spiel). */
export function syncedNames(allKeys: readonly string[]): string[] {
  const games = allKeys.filter((key) => key.startsWith(GAME_KEY_PREFIX)).map((key) => `${GAME_NAME_PREFIX}${key.slice(GAME_KEY_PREFIX.length)}`);
  return [...Object.keys(SYNCED_KEYS), ...games.filter((name) => NAME_PATTERN.test(name))];
}

/** Macht aus fremden Daten einen gültigen Stand; der frühere Block (nur Lieblingsspiele) wird übernommen. */
export function sanitizeItems(value: unknown): Items {
  const out: Items = {};
  if (!value || typeof value !== 'object') return out;
  const legacy = value as { favorites?: unknown; changed?: unknown; items?: unknown };
  if (Array.isArray(legacy.favorites)) {
    const ids = legacy.favorites.filter((id): id is string => typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id));
    out.lieblingsspiele = { v: JSON.stringify([...new Set(ids)].slice(0, 100)), t: typeof legacy.changed === 'number' && legacy.changed > 0 ? Math.floor(legacy.changed) : 0 };
  }
  if (legacy.items && typeof legacy.items === 'object') {
    let total = 0;
    for (const [name, item] of Object.entries(legacy.items as Record<string, unknown>)) {
      if (Object.keys(out).length >= MAX_ITEMS) break;
      if (!nameToKey(name)) continue;
      const { v, t } = (item ?? {}) as Partial<Item>;
      if (v !== null && (typeof v !== 'string' || v.length > MAX_VALUE)) continue;
      if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) continue;
      total += v?.length ?? 0;
      if (total > MAX_TOTAL) break;
      out[name] = { v: v ?? null, t: Math.floor(t) };
    }
  }
  return out;
}

/** Je Eintrag gewinnt die jüngere Änderung; bei Gleichstand der eigene Stand. */
export function mergeItems(remote: Items, local: Items): Items {
  const out: Items = { ...local };
  for (const [name, item] of Object.entries(remote)) {
    const mine = out[name];
    if (!mine || item.t > mine.t) out[name] = item;
  }
  return out;
}

export function sameItems(a: Items, b: Items): boolean {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const name of names) if (a[name]?.v !== b[name]?.v || a[name]?.t !== b[name]?.t) return false;
  return true;
}

/**
 * Stand dieses Geräts: Jeder Wert, der vom Stand beim letzten Abgleich (`known`) abweicht, gilt als jetzt geändert.
 * Einträge, die es nie gab und die auch jetzt fehlen, tauchen nicht auf.
 */
export function collectItems(read: (key: string) => string | null, names: readonly string[], known: Items, now: number): Items {
  const out: Items = {};
  for (const name of new Set([...names, ...Object.keys(known)])) {
    const key = nameToKey(name);
    if (!key) continue;
    const current = read(key);
    const before = known[name];
    if (before && before.v === current) out[name] = before;
    else if (before || current !== null) out[name] = { v: current, t: now };
  }
  return out;
}

/** Schreibt die Gewinner in den Speicher; nur, was sich unterscheidet. Liefert, ob etwas geändert wurde. */
export function applyItems(items: Items, read: (key: string) => string | null, write: (key: string, value: string | null) => void): boolean {
  let changed = false;
  for (const [name, item] of Object.entries(items)) {
    const key = nameToKey(name);
    if (!key || read(key) === item.v) continue;
    write(key, item.v);
    changed = true;
  }
  return changed;
}
