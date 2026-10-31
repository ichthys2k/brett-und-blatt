import { DECK_STYLE_CHOICES, parseDeckStyle, type DeckStyle } from '@brett-und-blatt/engine';
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

/**
 * Zähler eines Geräts. Jedes Gerät erhöht nur seine eigene Zeile; beim Zusammenführen zweier
 * Stände (Sicherung über mehrere Geräte, W-018) gilt je Gerät und Feld der größere Wert. So geht
 * nichts verloren, was auf einem Gerät verdient oder ausgegeben wurde, und nichts zählt doppelt.
 */
export interface LedgerLine {
  earned: number;
  spent: number;
  runs: number;
  wins: number;
}

export type AlbumKind = 'mod' | 'spell' | 'nail' | 'dream' | 'tool' | 'boss' | 'deck';

export interface Progress {
  version: 1;
  /** Verfügbare Glöckchen – abgeleitet aus `ledger` (verdient minus ausgegeben). */
  drops: number;
  /** Insgesamt verdient (für das Album) – abgeleitet aus `ledger`. */
  earned: number;
  /** Zähler je Gerät (Schlüssel: zufällige Geräte-Kennung). */
  ledger: Record<string, LedgerLine>;
  /** Zeitpunkt der letzten Schmuck-Wahl (ms), damit beim Zusammenführen die jüngste gilt. */
  styledAt: number;
  unlocked: string[];
  /** Erledigte einmalige Herausforderungen. */
  done: string[];
  /** Partien, die schon gutgeschrieben sind (Kennung je Platz). */
  awarded: string[];
  album: Record<AlbumKind, string[]>;
  /** `runs` und `wins` sind abgeleitet aus `ledger`. */
  stats: { runs: number; wins: number; bestLevel: number; bestHand: number };
  back: string;
  theme: string;
}

const KEY = 'brett-und-blatt:farbensortierer';
const DECK_KEY = 'brett-und-blatt:farbensortierer:kartenbild';
const DEVICE_KEY = 'brett-und-blatt:farbensortierer:geraet';

let device: string | null = null;

/** Zufällige Kennung dieses Geräts für die eigene Zeile im Zählerbuch (verrät nichts über die Person). */
export function deviceId(): string {
  if (device) return device;
  try {
    device = window.localStorage.getItem(DEVICE_KEY);
  } catch {
    device = null;
  }
  if (!device || !/^[0-9a-f]{16}$/.test(device)) {
    device = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
    try {
      window.localStorage.setItem(DEVICE_KEY, device);
    } catch {
      // ohne Speicher gilt die Kennung bis zum Neuladen
    }
  }
  return device;
}

/** Kartenbild je Gerät: Standard ist das Turnierblatt (vierfarbig). */
export type CardLook = DeckStyle;

export function readCardLook(): CardLook {
  try {
    return parseDeckStyle(window.localStorage.getItem(DECK_KEY));
  } catch {
    return parseDeckStyle(null);
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
    ledger: {},
    styledAt: 0,
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

/** Rechnet Glöckchen, Verdienst, Läufe und Siege aus dem Zählerbuch neu aus. */
export function withTotals(p: Progress): Progress {
  const lines = Object.values(p.ledger);
  const sum = (key: keyof LedgerLine) => lines.reduce((s, l) => s + l[key], 0);
  const earned = sum('earned');
  return {
    ...p,
    earned,
    drops: Math.max(0, earned - sum('spent')),
    stats: { ...p.stats, runs: sum('runs'), wins: sum('wins') },
  };
}

/** Zeile dieses Geräts um die genannten Beträge erhöhen. */
function bump(p: Progress, add: Partial<LedgerLine>, id = deviceId()): Progress {
  const line = p.ledger[id] ?? { earned: 0, spent: 0, runs: 0, wins: 0 };
  const next: LedgerLine = {
    earned: line.earned + (add.earned ?? 0),
    spent: line.spent + (add.spent ?? 0),
    runs: line.runs + (add.runs ?? 0),
    wins: line.wins + (add.wins ?? 0),
  };
  return withTotals({ ...p, ledger: { ...p.ledger, [id]: next } });
}

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

/**
 * Führt zwei Stände zusammen (Sicherung über mehrere Geräte): Freischaltungen, Herausforderungen
 * und Hofchronik werden vereinigt, je Gerät zählt der größere Zähler, Bestwerte das Maximum,
 * der Schmuck nach der jüngsten Wahl. Reihenfolge egal, mehrfaches Zusammenführen ändert nichts.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const ledger: Record<string, LedgerLine> = { ...a.ledger };
  for (const [id, line] of Object.entries(b.ledger)) {
    const own = ledger[id];
    ledger[id] = own
      ? { earned: Math.max(own.earned, line.earned), spent: Math.max(own.spent, line.spent), runs: Math.max(own.runs, line.runs), wins: Math.max(own.wins, line.wins) }
      : line;
  }
  const newer = b.styledAt > a.styledAt || (b.styledAt === a.styledAt && `${b.back}/${b.theme}` > `${a.back}/${a.theme}`) ? b : a;
  const album = Object.fromEntries(Object.keys(a.album).map((k) => [k, union(a.album[k as AlbumKind], b.album[k as AlbumKind])])) as Progress['album'];
  return sanitize(
    withTotals({
      ...a,
      ledger,
      unlocked: union(a.unlocked, b.unlocked),
      done: union(a.done, b.done),
      awarded: union(a.awarded, b.awarded).slice(-200),
      album,
      stats: { ...a.stats, bestLevel: Math.max(a.stats.bestLevel, b.stats.bestLevel), bestHand: Math.max(a.stats.bestHand, b.stats.bestHand) },
      back: newer.back,
      theme: newer.theme,
      styledAt: Math.max(a.styledAt, b.styledAt),
    }),
  );
}

/** Gleiche Stände (zum Erkennen, ob ein Abgleich etwas geändert hat). */
export function sameProgress(a: Progress, b: Progress): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const ledgerLine = (value: unknown): LedgerLine | null => {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  return { earned: count(v.earned), spent: count(v.spent), runs: count(v.runs), wins: count(v.wins) };
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
  const ledger: Record<string, LedgerLine> = {};
  if (r.ledger && typeof r.ledger === 'object') {
    for (const [id, value] of Object.entries(r.ledger as Record<string, unknown>).slice(0, 64)) {
      const line = ledgerLine(value);
      if (line && /^[0-9A-Za-z-]{1,40}$/.test(id)) ledger[id] = line;
    }
  } else if (count(r.drops) || count(r.earned) || count(stats.runs)) {
    // Stand von vor dem Zählerbuch: alles zählt als eine Zeile „alt“ dieses Geräts.
    const earned = Math.max(count(r.earned), count(r.drops));
    ledger[`alt-${typeof window === 'undefined' ? 'x' : deviceId()}`] = {
      earned,
      spent: earned - count(r.drops),
      runs: count(stats.runs),
      wins: count(stats.wins),
    };
  }
  return withTotals({
    version: 1,
    drops: 0,
    earned: 0,
    ledger,
    styledAt: count(r.styledAt),
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
  });
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
    next = bump(
      {
        ...next,
        done: [...next.done, ...lines.flatMap((l) => (l.once ? [l.once] : []))],
        awarded: [...next.awarded, id].slice(-200),
        stats: {
          ...next.stats,
          bestLevel: Math.max(next.stats.bestLevel, run.level),
          bestHand: Math.max(next.stats.bestHand, run.bestHand),
        },
      },
      { earned: sum, runs: 1, wins: view.winners.includes(seat) ? 1 : 0 },
    );
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
  write(bump({ ...prev, unlocked: [...prev.unlocked, id] }, { spent: item.price }));
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
  write(bump({ ...prev, unlocked: [...prev.unlocked, item.id] }, { spent: ATELIER_BOX_PRICE }));
  return item;
}

export function equip(kind: 'back' | 'theme', key: string): void {
  const prev = read();
  const free = kind === 'back' ? CARD_BACKS[0]!.key : THEMES[0]!.key;
  if (key !== free && !prev.unlocked.includes(`${kind}:${key}`)) return;
  write({ ...prev, [kind]: key, styledAt: Date.now() });
}

/** Optionen für eine Partie auf diesem Gerät: die eigenen Freischaltungen eintragen. */
export function withUnlocks(options: Record<string, string>): Record<string, string> {
  return {
    ...options,
    unlocks: options.pool === 'mine' || options.pool === undefined ? encodeUnlocks(read().unlocked) : '',
  };
}

// ---------------------------------------------------------------- Sichern

/** Übernimmt einen zusammengeführten Stand (Abgleich mit der Sicherung). */
export function replaceProgress(next: Progress): void {
  if (!sameProgress(read(), next)) write(next);
}

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
