import { useSyncExternalStore } from 'react';
import { BOSSES, DREAMS, NAILS, SPELLS, TOOLS } from '../content';
import { runDrops, type DropLine } from '../drops';
import { MODS } from '../mods';
import { bossFor } from '../rules';
import type { SorterState } from '../types';
import { ATELIER_BOX_PRICE, CARD_BACKS, encodeUnlocks, openAtelierBox, THEMES, UNLOCKABLE_BY_ID, type Unlockable } from '../unlocks';

/**
 * Fortschritt über alle Läufe, gespeichert nur auf diesem Gerät (localStorage): Farbtropfen,
 * Freischaltungen, erledigte Herausforderungen, Album und Schmuck. Fehlt der Speicher (privates
 * Fenster), läuft alles im Arbeitsspeicher weiter.
 */

export type AlbumKind = 'mod' | 'spell' | 'nail' | 'dream' | 'tool' | 'boss' | 'deck';

export interface Progress {
  version: 1;
  drops: number;
  /** Insgesamt verdient (für das Album). */
  earned: number;
  unlocked: string[];
  /** Erledigte einmalige Herausforderungen. */
  done: string[];
  /** Partien, die schon gutgeschrieben sind (Kennung je Platz). */
  awarded: string[];
  album: Record<AlbumKind, string[]>;
  stats: { runs: number; wins: number; bestLevel: number; bestHand: number };
  back: string;
  theme: string;
}

const KEY = 'brett-und-blatt:farbensortierer';
const DECK_KEY = 'brett-und-blatt:farbensortierer:kartenbild';

/** Kartenbild je Gerät: französisch (Standard) oder vierfarbig. */
export type CardLook = 'french' | 'four-color';

export function readCardLook(): CardLook {
  try {
    return window.localStorage.getItem(DECK_KEY) === 'four-color' ? 'four-color' : 'french';
  } catch {
    return 'french';
  }
}

export function writeCardLook(look: CardLook): void {
  try {
    window.localStorage.setItem(DECK_KEY, look);
  } catch {
    // ohne Speicher gilt die Wahl nur bis zum Neuladen
  }
}

function empty(): Progress {
  return {
    version: 1,
    drops: 0,
    earned: 0,
    unlocked: [],
    done: [],
    awarded: [],
    album: {
      mod: [],
      spell: [],
      nail: [],
      dream: [],
      tool: [],
      boss: [],
      deck: [],
    },
    stats: { runs: 0, wins: 0, bestLevel: 0, bestHand: 0 },
    back: 'classic',
    theme: 'workshop',
  };
}

const strings = (value: unknown, max = 500): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(-max) : []);
const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);

/** Narrenhof (29.10.2026): ersetzte Narren und Privilegien werden zu ihren Nachfolgern auf demselben Platz – Freischaltungen bleiben erhalten. */
const RENAMED_UNLOCKS: Record<string, string> = {
  'mod:troubadour': 'mod:santaClaus',
  'mod:bus': 'mod:herald',
  'mod:egg': 'mod:collector',
  'mod:drunk': 'mod:monkey',
  // Schritt 4: entfallene Narren und zweite Stufen der Privilegien
  'mod:trio': 'mod:santaFan',
  'mod:growth': 'mod:broccoli',
  'mod:banana': 'mod:apple',
  'tool:superMagnet': 'tool:courtHerald',
  'tool:bigSale': 'tool:diploma',
  'tool:tidy2': 'tool:breadRight',
  'tool:extraHand2': 'tool:touringStage',
  'tool:bin2': 'tool:shelf',
  'tool:bag2': 'tool:basket',
  'tool:book2': 'tool:book',
  'tool:scope2': 'tool:scope',
};

/** Prüft einen geladenen oder eingefügten Stand Feld für Feld. */
export function sanitize(raw: unknown): Progress {
  const base = empty();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const album = (r.album ?? {}) as Record<string, unknown>;
  const stats = (r.stats ?? {}) as Record<string, unknown>;
  const unlocked = strings(r.unlocked)
    .map((id) => RENAMED_UNLOCKS[id] ?? id)
    .filter((id) => UNLOCKABLE_BY_ID[id]);
  return {
    version: 1,
    drops: count(r.drops),
    earned: count(r.earned),
    unlocked: [...new Set(unlocked)],
    done: [...new Set(strings(r.done))],
    awarded: strings(r.awarded, 200),
    album: Object.fromEntries(Object.keys(base.album).map((k) => [k, [...new Set(strings(album[k]))]])) as Progress['album'],
    stats: {
      runs: count(stats.runs),
      wins: count(stats.wins),
      bestLevel: count(stats.bestLevel),
      bestHand: count(stats.bestHand),
    },
    back: typeof r.back === 'string' && (r.back === 'classic' || unlocked.includes(`back:${r.back}`)) ? r.back : 'classic',
    theme: typeof r.theme === 'string' && (r.theme === 'workshop' || unlocked.includes(`theme:${r.theme}`)) ? r.theme : 'workshop',
  };
}

let current: Progress | null = null;
const listeners = new Set<() => void>();

function read(): Progress {
  if (current) return current;
  try {
    const text = window.localStorage.getItem(KEY);
    current = sanitize(text ? JSON.parse(text) : null);
  } catch {
    current = empty();
  }
  return current;
}

function write(next: Progress): void {
  current = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Kein Speicher: bleibt bis zum Neuladen im Arbeitsspeicher.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    current = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, read, read);
}

export function getProgress(): Progress {
  return read();
}

// ---------------------------------------------------------------- Verdienen

/** Schreibt die Farbtropfen einer beendeten Partie einmal gut und liefert die Zeilen dafür. */
export function award(view: SorterState, seats: number[]): { seat: number; lines: DropLine[] }[] {
  if (!view.winners) return [];
  let next = read();
  const out: { seat: number; lines: DropLine[] }[] = [];
  for (const seat of seats) {
    const id = `${view.key}/${seat}`;
    const run = view.runs[seat];
    if (!run || next.awarded.includes(id)) continue;
    const lines = runDrops(view, seat, new Set(next.done));
    const sum = lines.reduce((s, l) => s + l.amount, 0);
    next = {
      ...next,
      drops: next.drops + sum,
      earned: next.earned + sum,
      done: [...next.done, ...lines.flatMap((l) => (l.once ? [l.once] : []))],
      awarded: [...next.awarded, id].slice(-200),
      stats: {
        runs: next.stats.runs + 1,
        wins: next.stats.wins + (view.winners.includes(seat) ? 1 : 0),
        bestLevel: Math.max(next.stats.bestLevel, run.level),
        bestHand: Math.max(next.stats.bestHand, run.bestHand),
      },
    };
    out.push({ seat, lines });
  }
  if (out.length) write(next);
  return out;
}

/** Was eine Partie für diesen Platz eingebracht hat (nach dem Gutschreiben, zum Anzeigen). */
export function wasAwarded(view: SorterState, seat: number): boolean {
  return read().awarded.includes(`${view.key}/${seat}`);
}

// ---------------------------------------------------------------- Album

/** Trägt alles ins Album ein, was dieser Platz gerade sieht. */
export function discover(view: SorterState, seat: number): void {
  const run = view.runs[seat];
  if (!run) return;
  const found: Record<AlbumKind, string[]> = {
    mod: [],
    spell: [],
    nail: [],
    dream: [],
    tool: [],
    boss: [],
    deck: [view.deckKind],
  };
  const offers = [...(run.shop?.offers ?? []), ...(run.pack?.items ?? [])];
  for (const m of run.mods) found.mod.push(m.key);
  for (const o of offers) {
    if (o?.type === 'mod') found.mod.push(o.key);
    if (o?.type === 'consumable') found[o.item.kind].push(o.item.key);
  }
  for (const item of run.consumables) if (item.key !== '?') found[item.kind].push(item.key);
  if (run.lastSpell) found[run.lastSpell.kind].push(run.lastSpell.key);
  for (const t of run.tools) found.tool.push(t);
  if (run.shop?.tool) found.tool.push(run.shop.tool);
  if (run.current?.boss) found.boss.push(run.current.boss);
  if (run.round === 2) found.boss.push(bossFor(view, run));

  const known = {
    mod: MODS,
    spell: SPELLS,
    nail: NAILS,
    dream: DREAMS,
    tool: TOOLS,
    boss: BOSSES,
  } as Record<string, Record<string, unknown>>;
  const prev = read();
  let changed = false;
  const album = { ...prev.album };
  for (const kind of Object.keys(found) as AlbumKind[]) {
    const fresh = found[kind].filter((key) => (kind === 'deck' || known[kind]?.[key]) && !album[kind].includes(key));
    if (fresh.length) {
      album[kind] = [...album[kind], ...new Set(fresh)];
      changed = true;
    }
  }
  if (changed) write({ ...prev, album });
}

// ---------------------------------------------------------------- Atelier

export function buy(id: string): boolean {
  const prev = read();
  const item = UNLOCKABLE_BY_ID[id];
  if (!item || prev.unlocked.includes(id) || prev.drops < item.price) return false;
  write({
    ...prev,
    drops: prev.drops - item.price,
    unlocked: [...prev.unlocked, id],
  });
  return true;
}

/** Atelier-Lieferung: kostet Farbtropfen und bringt immer etwas Neues. */
export function buyBox(): Unlockable | null {
  const prev = read();
  if (prev.drops < ATELIER_BOX_PRICE) return null;
  const random = () => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0]! / 2 ** 32;
  };
  const item = openAtelierBox(new Set(prev.unlocked), random);
  if (!item) return null;
  write({
    ...prev,
    drops: prev.drops - ATELIER_BOX_PRICE,
    unlocked: [...prev.unlocked, item.id],
  });
  return item;
}

export function equip(kind: 'back' | 'theme', key: string): void {
  const prev = read();
  const free = kind === 'back' ? CARD_BACKS[0]!.key : THEMES[0]!.key;
  if (key !== free && !prev.unlocked.includes(`${kind}:${key}`)) return;
  write({ ...prev, [kind]: key });
}

/** Optionen für eine Partie auf diesem Gerät: die eigenen Freischaltungen eintragen. */
export function withUnlocks(options: Record<string, string>): Record<string, string> {
  return {
    ...options,
    unlocks: options.pool === 'mine' || options.pool === undefined ? encodeUnlocks(read().unlocked) : '',
  };
}

// ---------------------------------------------------------------- Sichern

/** Stand als Text zum Kopieren (zum Umziehen auf ein anderes Gerät). */
export function exportCode(): string {
  const json = JSON.stringify(read());
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `FS1:${btoa(binary)}`;
}

/** Übernimmt einen kopierten Stand. Gibt false zurück, wenn der Text nicht passt. */
export function importCode(code: string): boolean {
  const text = code.trim();
  if (!text.startsWith('FS1:')) return false;
  try {
    const binary = atob(text.slice(4));
    const json = new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
    write(sanitize(JSON.parse(json)));
    return true;
  } catch {
    return false;
  }
}
