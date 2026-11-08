/*
 * Mehrere Pässe an einem Gerät (Vorhaben #135, Schritt #139).
 *
 * Alles, was zu einer Person gehört (Profil, Raum-Kennung, Spielercode, Turniere, Passschlüssel, Schloss, Lieblingsspiele,
 * Einstellungen je Spiel, Narrenhof- und Drachenspiel-Stand, Sicherungsverbindung), liegt für den **aktiven** Pass unter
 * den gewohnten Schlüsseln – der übrige Code ändert sich nicht. Die Daten der anderen Pässe liegen beiseite unter
 * `brett-und-blatt:pass:<Kennung>:<Schlüssel>`. Ein Wechsel räumt den aktiven Pass beiseite, holt den gewählten
 * hervor und lädt die Seite neu; das trennt von selbst alle Online-Verbindungen und Zwischenspeicher.
 * Gerätedaten (Lautstärke, Aussehen, Kartenbild, Geräte-Zähler) bleiben unberührt.
 */

export interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

export interface PassEntry {
  id: string;
  name: string;
  avatar: string;
  /** Gibt es einen Spielercode oder Sicherungscode? Ohne ginge der Pass mit dem Gerät verloren. */
  hasCode: boolean;
  /** Gast: zeichnet nichts auf, seine Daten werden beim Wechsel gelöscht. */
  guest?: boolean;
}

export const PASSES_KEY = 'brett-und-blatt:paesse';
export const ACTIVE_PASS_KEY = 'brett-und-blatt:pass-aktiv';
const STASH_PREFIX = 'brett-und-blatt:pass:';
const MAX_PASSES = 12;

/** Schlüssel, die zu einem Pass gehören und beim Wechsel mitwandern. */
export const SCOPED_KEYS = [
  'brett-und-blatt:profil',
  'brett-und-blatt:geraet',
  'brett-und-blatt:spielercode',
  'brett-und-blatt:turniere',
  'brett-und-blatt:passschluessel',
  'brett-und-blatt:schloss',
  'brett-und-blatt:lieblingsspiele',
  'brett-und-blatt:musik',
  'brett-und-blatt:aussehen',
  'brett-und-blatt:bildkarten',
  'brett-und-blatt:farbensortierer:kartenbild',
  'bub-go-zoom',
  'bub-four-player-chess-zoom',
  'brett-und-blatt:einstellungen-staende',
  'brett-und-blatt:partiebuch',
  'brett-und-blatt:farbensortierer',
  'brett-und-blatt:farbensortierer:sicherung',
  'brett-und-blatt:drachenspiel:decks',
] as const;
export const SCOPED_PREFIXES = ['brett-und-blatt:einstellungen:'] as const;

function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeList(value: unknown): PassEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: PassEntry[] = [];
  for (const item of value) {
    const { id, name, avatar, hasCode, guest } = (item ?? {}) as Record<string, unknown>;
    if (typeof id !== 'string' || !/^[0-9a-f]{12}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: typeof name === 'string' ? name.slice(0, 40) : '', avatar: typeof avatar === 'string' ? avatar.slice(0, 20) : '', hasCode: hasCode === true, ...(guest === true ? { guest: true } : {}) });
  }
  return out.slice(0, MAX_PASSES);
}

export function createPassBook(store: Store) {
  const list = (): PassEntry[] => {
    try {
      return sanitizeList(JSON.parse(store.get(PASSES_KEY) ?? 'null'));
    } catch {
      return [];
    }
  };
  const saveList = (entries: PassEntry[]) => store.set(PASSES_KEY, JSON.stringify(entries));
  const activeId = (): string | null => {
    const id = store.get(ACTIVE_PASS_KEY);
    return id && list().some((entry) => entry.id === id) ? id : null;
  };

  const isScoped = (key: string) => !key.startsWith(STASH_PREFIX) && ((SCOPED_KEYS as readonly string[]).includes(key) || SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix)));

  /** Räumt die Daten des aktiven Passes beiseite. */
  function stash(id: string): void {
    for (const key of store.keys().filter(isScoped)) {
      const value = store.get(key);
      if (value !== null) store.set(`${STASH_PREFIX}${id}:${key}`, value);
      store.remove(key);
    }
  }
  /** Holt die Daten eines Passes hervor. */
  function unstash(id: string): void {
    const prefix = `${STASH_PREFIX}${id}:`;
    for (const key of store.keys().filter((k) => k.startsWith(prefix))) {
      const value = store.get(key);
      if (value !== null) store.set(key.slice(prefix.length), value);
      store.remove(key);
    }
  }
  function purgeStashed(id: string): void {
    const prefix = `${STASH_PREFIX}${id}:`;
    for (const key of store.keys().filter((k) => k.startsWith(prefix))) store.remove(key);
  }
  function purgeActiveData(): void {
    for (const key of store.keys().filter(isScoped)) store.remove(key);
  }

  /**
   * Der aktive Pass bekommt einen Eintrag (beim ersten Mal wird das bisherige Profil des Geräts zum ersten Pass, mit derselben
   * Kennung) und frische Anzeigedaten. Ohne Profil und ohne bisherige Pässe gibt es noch nichts einzutragen.
   */
  function touch(info: { name: string; avatar: string; hasCode: boolean }): string | null {
    const entries = list();
    let id = activeId();
    if (!id) {
      if (!info.name && !info.avatar && !info.hasCode) return null;
      id = randomId();
      entries.push({ id, name: '', avatar: '', hasCode: false });
      store.set(ACTIVE_PASS_KEY, id);
    }
    saveList(entries.map((entry) => (entry.id === id ? { ...entry, name: info.name || entry.name, avatar: info.avatar || entry.avatar, hasCode: info.hasCode } : entry)));
    return id;
  }

  /** Auf einen anderen Pass wechseln. Danach muss die Seite neu geladen werden. */
  function switchTo(targetId: string, current: { name: string; avatar: string; hasCode: boolean }): boolean {
    const entries = list();
    if (!entries.some((entry) => entry.id === targetId)) return false;
    const leaving = touch(current);
    if (leaving === targetId) return true;
    if (leaving) {
      const was = entries.find((entry) => entry.id === leaving);
      if (was?.guest) {
        purgeActiveData();
        saveList(list().filter((entry) => entry.id !== leaving));
      } else stash(leaving);
    } else purgeActiveData();
    unstash(targetId);
    store.set(ACTIVE_PASS_KEY, targetId);
    return true;
  }

  /** Neuer, leerer Pass (oder Gast) und sofort aktiv. Danach muss die Seite neu geladen werden. */
  function createNew(current: { name: string; avatar: string; hasCode: boolean }, options: { guest?: boolean } = {}): string | null {
    if (list().length >= MAX_PASSES) return null;
    const leaving = touch(current);
    if (leaving) {
      const was = list().find((entry) => entry.id === leaving);
      if (was?.guest) {
        purgeActiveData();
        saveList(list().filter((entry) => entry.id !== leaving));
      } else stash(leaving);
    }
    const id = randomId();
    saveList([...list(), { id, name: '', avatar: '', hasCode: false, ...(options.guest ? { guest: true, name: 'Gast', avatar: '👤' } : {}) }]);
    store.set(ACTIVE_PASS_KEY, id);
    return id;
  }

  /** Pass von diesem Gerät entfernen. Ist es der aktive, geht das Gerät auf einen anderen oder auf „leer“. Danach neu laden. */
  function remove(id: string): void {
    const entries = list();
    if (activeId() === id) {
      purgeActiveData();
      const next = entries.find((entry) => entry.id !== id);
      saveList(entries.filter((entry) => entry.id !== id));
      if (next) {
        unstash(next.id);
        store.set(ACTIVE_PASS_KEY, next.id);
      } else store.remove(ACTIVE_PASS_KEY);
      return;
    }
    purgeStashed(id);
    saveList(entries.filter((entry) => entry.id !== id));
  }

  /**
   * Ändert einen Wert eines Passes, auch wenn er gerade nicht aktiv ist (Hot-Seat: Das Ergebnis geht an den Pass des Platzes).
   * `id` null oder der aktive Pass: der gewohnte Schlüssel; sonst der beiseite gelegte.
   */
  function updateStored(id: string | null, key: string, change: (raw: string | null) => string): void {
    const target = id === null || id === activeId() || !list().some((entry) => entry.id === id) ? key : `${STASH_PREFIX}${id}:${key}`;
    store.set(target, change(store.get(target)));
  }

  return { list, activeId, touch, switchTo, createNew, remove, updateStored };
}

// ---------------------------------------------------------------- Browser

const browserStore: Store = {
  get: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Speicher voll oder gesperrt
    }
  },
  remove: (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignorieren
    }
  },
  keys: () => {
    try {
      return Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i)).filter((key): key is string => key !== null);
    } catch {
      return [];
    }
  },
};

export const passBook = createPassBook(browserStore);
