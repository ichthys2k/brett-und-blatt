/*
 * Sammelalbum des Spielerpasses (Vorhaben #135, Schritt #148): ein Kapitel je Spiel, das mitmacht. Gespeichert wird nur,
 * wann ein Eintrag zum ersten Mal gefunden wurde; Namen und leere Plätze liefert der Katalog des Spiels (`GameUi.album`),
 * der erst beim Aufklappen eines Kapitels geladen wird. Beim Zusammenführen gewinnt die früheste Zeit, nichts geht verloren.
 */

/** Spiele mit Album-Kapitel (Kapitelkennung = Spiel-ID). */
export const ALBUM_GAMES = ['color-sorter', 'drachenspiel', 'quartett', 'pairs', 'bible-quiz'] as const;

export interface Chapter {
  /** Wie viele Einträge der Katalog beim letzten Spielen hatte (für „3 von 81“ ohne das Spiel zu laden). */
  total: number;
  /** Eintrag → Zeitpunkt des ersten Fundes (ms). */
  found: Record<string, number>;
}
export type Album = Record<string, Chapter>;

export const ALBUM_KEY = 'brett-und-blatt:album';
const MAX_CHAPTERS = 12;
const MAX_ITEMS = 700;
const ID_PATTERN = /^[\w.:/ -]{1,60}$/;
const CHAPTER_PATTERN = /^[a-z0-9-]{1,40}$/;
const MAX_TIME = 10_000_000_000_000;

export const emptyAlbum = (): Album => ({});

/** Trägt Funde ein; schon bekannte behalten ihre Zeit. Liefert dasselbe Objekt, wenn nichts neu ist. */
export function recordFinds(album: Album, chapter: string, total: number, ids: readonly string[], at: number): Album {
  const before = album[chapter];
  const fresh = ids.filter((id) => ID_PATTERN.test(id) && !(before && id in before.found));
  const nextTotal = Math.max(before?.total ?? 0, Math.min(total, MAX_ITEMS));
  if (fresh.length === 0 && before && before.total === nextTotal) return album;
  const found = { ...(before?.found ?? {}) };
  for (const id of fresh) if (Object.keys(found).length < MAX_ITEMS) found[id] = at;
  return { ...album, [chapter]: { total: nextTotal, found } };
}

/** Macht aus fremden Daten ein gültiges Album. */
export function sanitizeAlbum(value: unknown): Album {
  const out: Album = {};
  if (!value || typeof value !== 'object') return out;
  for (const [chapter, raw] of Object.entries(value as Record<string, unknown>).slice(0, MAX_CHAPTERS)) {
    if (!CHAPTER_PATTERN.test(chapter) || !raw || typeof raw !== 'object') continue;
    const { total, found } = raw as { total?: unknown; found?: unknown };
    const items: Record<string, number> = {};
    if (found && typeof found === 'object') {
      for (const [id, at] of Object.entries(found as Record<string, unknown>)) {
        if (Object.keys(items).length >= MAX_ITEMS) break;
        if (ID_PATTERN.test(id) && typeof at === 'number' && Number.isFinite(at) && at > 0 && at <= MAX_TIME) items[id] = Math.floor(at);
      }
    }
    out[chapter] = { total: typeof total === 'number' && Number.isFinite(total) && total >= 0 ? Math.min(Math.floor(total), MAX_ITEMS) : 0, found: items };
  }
  return out;
}

/** Vereinigung der Funde mit der früheren Zeit; die größere Gesamtzahl gilt. */
export function mergeAlbum(remote: Album, local: Album): Album {
  const out: Album = {};
  for (const chapter of new Set([...Object.keys(remote), ...Object.keys(local)])) {
    const a = remote[chapter];
    const b = local[chapter];
    const found: Record<string, number> = { ...(b?.found ?? {}) };
    for (const [id, at] of Object.entries(a?.found ?? {})) found[id] = id in found ? Math.min(found[id]!, at) : at;
    out[chapter] = { total: Math.max(a?.total ?? 0, b?.total ?? 0), found };
  }
  return out;
}

export function sameAlbum(a: Album, b: Album): boolean {
  const key = (album: Album) => JSON.stringify(Object.keys(album).sort().map((chapter) => [chapter, album[chapter]!.total, Object.keys(album[chapter]!.found).sort().map((id) => [id, album[chapter]!.found[id]])]));
  return key(a) === key(b);
}

export const foundCount = (album: Album, chapter: string): number => Object.keys(album[chapter]?.found ?? {}).length;
