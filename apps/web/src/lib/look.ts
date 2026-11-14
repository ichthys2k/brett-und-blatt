import { useSyncExternalStore } from 'react';

/*
 * Aussehen der App, je Gerät: „Taverne“ (Standard) oder „Schlicht“. Die Farben
 * stehen in look.css und hängen am Attribut data-look auf <html>. Wer erhöhten
 * Kontrast eingestellt hat, bekommt immer „Schlicht“.
 *
 * Zusätzlich lassen sich Tischoberfläche (`data-table`) und Raumkulisse (`data-room`)
 * wählen (#107).
 */
export type Look = 'plain' | 'tavern';
export type TableSurface = 'auto' | 'oak' | 'walnut' | 'green-felt' | 'red-felt' | 'slate' | 'marble';
export type RoomScene = 'tavern' | 'castle' | 'library' | 'garden';

/** Lichtstimmung der Taverne im Hauptmenü (#317): nach Tageszeit und Jahreszeit oder fest gewählt. */
export type TavernMood = 'morgen' | 'tag' | 'abend' | 'nacht' | 'winter' | 'fest';
export type LightChoice = 'auto' | TavernMood;
export const TAVERN_MOODS: readonly TavernMood[] = ['morgen', 'tag', 'abend', 'nacht', 'winter', 'fest'];
export const LIGHT_CHOICES: readonly LightChoice[] = ['auto', ...TAVERN_MOODS];

export const TABLE_SURFACES: readonly TableSurface[] = ['auto', 'oak', 'walnut', 'green-felt', 'red-felt', 'slate', 'marble'];
export const ROOM_SCENES: readonly RoomScene[] = ['tavern', 'castle', 'library', 'garden'];

const LOOK_KEY = 'brett-und-blatt:aussehen';
const TABLE_KEY = 'brett-und-blatt:tisch';
const ROOM_KEY = 'brett-und-blatt:raum';
const MENU3D_KEY = 'brett-und-blatt:menue-3d';
const LIGHT_KEY = 'brett-und-blatt:licht';

function loadLook(): Look {
  try {
    return window.localStorage.getItem(LOOK_KEY) === 'plain' ? 'plain' : 'tavern';
  } catch {
    return 'tavern';
  }
}

function loadTable(): TableSurface {
  try {
    const val = window.localStorage.getItem(TABLE_KEY);
    return val && (TABLE_SURFACES as readonly string[]).includes(val) ? (val as TableSurface) : 'auto';
  } catch {
    return 'auto';
  }
}

function loadRoom(): RoomScene {
  try {
    const val = window.localStorage.getItem(ROOM_KEY);
    return val && (ROOM_SCENES as readonly string[]).includes(val) ? (val as RoomScene) : 'tavern';
  } catch {
    return 'tavern';
  }
}

/** Bewegte 3D-Taverne im Hauptmenü: nur wer sie einschaltet, bekommt Parallax, Kamerafahrt und Funken (Standard: aus). */
function loadMenu3d(): boolean {
  try {
    return window.localStorage.getItem(MENU3D_KEY) === 'an';
  } catch {
    return false;
  }
}

function loadLight(): LightChoice {
  try {
    const val = window.localStorage.getItem(LIGHT_KEY);
    return val && (LIGHT_CHOICES as readonly string[]).includes(val) ? (val as LightChoice) : 'auto';
  } catch {
    return 'auto';
  }
}

const contrastQuery = window.matchMedia('(prefers-contrast: more)');
const listeners = new Set<() => void>();
let chosen = loadLook();
let chosenTable = loadTable();
let chosenRoom = loadRoom();
let chosenMenu3d = loadMenu3d();
let chosenLight = loadLight();

/** Das Aussehen, das gerade wirklich gilt. */
export function activeLook(): Look {
  return contrastQuery.matches ? 'plain' : chosen;
}

/** Die Tischoberfläche, die gerade gilt. */
export function activeTable(): TableSurface {
  return chosenTable;
}

/** Die Raumkulisse, die gerade gilt. */
export function activeRoom(): RoomScene {
  return chosenRoom;
}

/** Farbe der Browserleiste; `dark` entspricht dem zweiten Eintrag in index.html. */
const BAR_COLORS: Record<Look, { light: string; dark: string }> = {
  plain: { light: '#1f6f5c', dark: '#121417' },
  tavern: { light: '#5a3b22', dark: '#1d1510' },
};

/** Vorab-Laden der gewählten Tisch-Textur (#313). */
const TABLE_TEXTURES: Record<string, { light?: string; dark?: string }> = {
  oak: {
    light: new URL('../assets/tische/oak-light.webp', import.meta.url).href,
    dark: new URL('../assets/tische/oak-dark.webp', import.meta.url).href,
  },
  walnut: {
    light: new URL('../assets/tische/walnut-light.webp', import.meta.url).href,
    dark: new URL('../assets/tische/walnut-dark.webp', import.meta.url).href,
  },
  'green-felt': {
    light: new URL('../assets/tische/green-felt-light.webp', import.meta.url).href,
    dark: new URL('../assets/tische/green-felt-dark.webp', import.meta.url).href,
  },
  'red-felt': {
    light: new URL('../assets/tische/red-felt-light.webp', import.meta.url).href,
    dark: new URL('../assets/tische/red-felt-dark.webp', import.meta.url).href,
  },
  'slate': {
    light: new URL('../assets/tische/slate-light.webp', import.meta.url).href,
    dark: new URL('../assets/tische/slate-dark.webp', import.meta.url).href,
  },
  'marble': {
    light: new URL('../assets/tische/marble-light.webp', import.meta.url).href,
    dark: new URL('../assets/tische/marble-dark.webp', import.meta.url).href,
  },
};

function preloadTable(table: TableSurface): void {
  if (typeof window === 'undefined') return;
  const target = table === 'auto' ? 'oak' : table;
  const urls = TABLE_TEXTURES[target];
  if (!urls) return;
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const url = isDark ? (urls.dark ?? urls.light) : urls.light;
  if (url) {
    const img = new Image();
    img.src = url;
  }
}

function apply(): void {
  const look = activeLook();
  document.documentElement.dataset.look = look;
  if (chosenTable === 'auto') {
    delete document.documentElement.dataset.table;
  } else {
    document.documentElement.dataset.table = chosenTable;
  }
  document.documentElement.dataset.room = chosenRoom;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = BAR_COLORS[look][meta.media.includes('dark') ? 'dark' : 'light'];
  }
  preloadTable(chosenTable);
  for (const listener of listeners) listener();
}

export function setLook(next: Look): void {
  chosen = next;
  try {
    window.localStorage.setItem(LOOK_KEY, next);
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
  apply();
}

export function setTableSurface(next: TableSurface): void {
  chosenTable = next;
  try {
    window.localStorage.setItem(TABLE_KEY, next);
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
  apply();
}

export function setRoomScene(next: RoomScene): void {
  chosenRoom = next;
  try {
    window.localStorage.setItem(ROOM_KEY, next);
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
  apply();
}

export function setMenu3d(next: boolean): void {
  chosenMenu3d = next;
  try {
    window.localStorage.setItem(MENU3D_KEY, next ? 'an' : 'aus');
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
  apply();
}

export function setLight(next: LightChoice): void {
  chosenLight = next;
  try {
    window.localStorage.setItem(LIGHT_KEY, next);
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
  apply();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useChosenLook = (): Look => useSyncExternalStore(subscribe, () => chosen);
export const useActiveLook = (): Look => useSyncExternalStore(subscribe, activeLook);
export const useChosenTable = (): TableSurface => useSyncExternalStore(subscribe, () => chosenTable);
export const useChosenRoom = (): RoomScene => useSyncExternalStore(subscribe, () => chosenRoom);
/** Ob die bewegte 3D-Taverne im Hauptmenü gilt (Standard: nein). */
export const menu3dEnabled = (): boolean => chosenMenu3d;
export const useChosenLight = (): LightChoice => useSyncExternalStore(subscribe, () => chosenLight);
export const lightChoice = (): LightChoice => chosenLight;
export const useMenu3d = (): boolean => useSyncExternalStore(subscribe, () => chosenMenu3d);
export const contrastForcesPlain = (): boolean => contrastQuery.matches;

contrastQuery.addEventListener('change', apply);
apply();
