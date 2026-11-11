import type { CardBackId } from '@brett-und-blatt/ui';
import type { CrestSpec } from '@brett-und-blatt/engine';
import { useSyncExternalStore } from 'react';
import { loadBook } from './chronikStore';
import { currentCrest, hasCrest, useCrest } from './crestStore';
import type { Book } from './partiebuch';
import { passSyncSoon, syncPassEntry } from './playerPass';
import { stampCount } from './stamps';

export const CARD_BACK_KEY = 'brett-und-blatt:kartenruecken';

export interface CardBackUnlockState {
  book: Book;
  hasCrest: boolean;
  jesterUnlocked?: boolean;
}

export interface CardBackDefinition {
  id: CardBackId;
  name: string;
  description: string;
  unlockCheck: (state: CardBackUnlockState) => { unlocked: boolean; progressLabel: string };
}

export const TRICK_GAMES = ['skat', 'schafkopf', 'doppelkopf', 'binokel'] as const;

export const CARD_BACK_CATALOG: readonly CardBackDefinition[] = [
  {
    id: 'classic-red',
    name: 'Klassisch Karmin',
    description: 'Traditionelles französisches Rautenmuster in edlem Kardinalrot mit feinem Zierrand.',
    unlockCheck: () => ({
      unlocked: true,
      progressLabel: 'Von Anfang an verfügbar',
    }),
  },
  {
    id: 'classic-blue',
    name: 'Klassisch Königsblau',
    description: 'Königliches Mitternachtsblau mit klassischem Gittermuster und Sternrosette.',
    unlockCheck: () => ({
      unlocked: true,
      progressLabel: 'Von Anfang an verfügbar',
    }),
  },
  {
    id: 'tavern-oak',
    name: 'Tavernen-Eiche',
    description: 'Rustikale Holzmaserung mit bronzenen Eckbeschlägen und Tavernen-Medaillon.',
    unlockCheck: () => ({
      unlocked: true,
      progressLabel: 'Von Anfang an verfügbar',
    }),
  },
  {
    id: 'royal-crest',
    name: 'Eigenes Hauswappen',
    description: 'Präsentiert dein im Spielerpass gestaltetes Wappen auf königlichem Damast.',
    unlockCheck: (state) => ({
      unlocked: true,
      progressLabel: state.hasCrest ? 'Nutzt dein gestaltetes Wappen' : 'Wappen im Spielerpass anpassen',
    }),
  },
  {
    id: 'bavarian-gold',
    name: 'Wirtshaus-Raute Gold',
    description: 'Bayerisches Traditionsmuster mit barockem Goldrahmen für gesellige Runden.',
    unlockCheck: (state) => {
      const count = stampCount(state.book, TRICK_GAMES);
      const needed = 3;
      if (count >= needed) {
        return {
          unlocked: true,
          progressLabel: `Freigeschaltet (${count}/${needed} Stichspiel-Stempel)`,
        };
      }
      const remaining = needed - count;
      return {
        unlocked: false,
        progressLabel: `Noch ${remaining} ${remaining === 1 ? 'Stichspiel-Stempel' : 'Stichspiel-Stempel'} bis zur Freischaltung (${count}/${needed})`,
      };
    },
  },
  {
    id: 'jester-velvet',
    name: 'Narrenhof-Samt',
    description: 'Königlicher violetter Samt im Harlekin-Muster mit goldenen Glöckchen.',
    unlockCheck: (state) => {
      const playedNarrenhof = Object.values(state.book.counts).some(
        (dev) => dev['color-sorter'] && Object.values(dev['color-sorter']).some((c) => c.played > 0),
      );
      const unlocked = playedNarrenhof || Boolean(state.jesterUnlocked);
      if (unlocked) {
        return {
          unlocked: true,
          progressLabel: 'Freigeschaltet durch den Narrenhof',
        };
      }
      return {
        unlocked: false,
        progressLabel: 'Erfordert 1 Partie im Narrenhof oder Narren im Atelier',
      };
    },
  },
  {
    id: 'dragon-scale',
    name: 'Drachenschuppen-Glut',
    description: 'Smaragdgrüne Schuppenhaut mit Obsidian-Rahmen und glühendem Drachenauge.',
    unlockCheck: (state) => {
      const wonDragon = Object.values(state.book.counts).some(
        (dev) => dev['drachenspiel'] && Object.values(dev['drachenspiel']).some((c) => c.won > 0),
      );
      if (wonDragon) {
        return {
          unlocked: true,
          progressLabel: 'Freigeschaltet durch Sieg im Drachenspiel',
        };
      }
      return {
        unlocked: false,
        progressLabel: 'Erfordert 1 Sieg im Drachenspiel',
      };
    },
  },
] as const;

export function getCardBackDefinition(id: CardBackId): CardBackDefinition {
  return CARD_BACK_CATALOG.find((entry) => entry.id === id) ?? CARD_BACK_CATALOG[0]!;
}

const listeners = new Set<() => void>();
let changeVersion = 0;

function notifyChange(): void {
  changeVersion++;
  for (const listener of listeners) listener();
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    // ignorieren
  }
  return null;
}

/**
 * Ermittelt den aktuellen Fortschrittsstand des aktiven Passes.
 */
export function currentUnlockState(): CardBackUnlockState {
  const book = loadBook();
  let jesterUnlocked = false;
  try {
    const store = getStorage();
    const raw = store ? store.getItem('brett-und-blatt:farbensortierer') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.unlocked) && parsed.unlocked.length > 0) jesterUnlocked = true;
      if (Array.isArray(parsed?.ledger) && parsed.ledger.length > 0) jesterUnlocked = true;
    }
  } catch {
    // ignorieren
  }
  return {
    book,
    hasCrest: hasCrest(),
    jesterUnlocked,
  };
}

/**
 * Prüft, ob ein bestimmter Kartenrücken freigeschaltet ist.
 */
export function isCardBackUnlocked(id: CardBackId, state?: CardBackUnlockState): boolean {
  const def = getCardBackDefinition(id);
  return def.unlockCheck(state ?? currentUnlockState()).unlocked;
}

/**
 * Liest den aktuell aktiven Kartenrücken aus dem Speicher.
 * Falls die gespeicherte Wahl nicht (mehr) freigeschaltet ist, wird auf 'classic-red' zurückgegriffen.
 */
export function loadActiveCardBack(): CardBackId {
  try {
    const store = getStorage();
    if (!store) return 'classic-red';
    const raw = store.getItem(CARD_BACK_KEY);
    if (raw && CARD_BACK_CATALOG.some((entry) => entry.id === raw)) {
      const id = raw as CardBackId;
      if (isCardBackUnlocked(id)) {
        return id;
      }
    }
  } catch {
    // ignorieren
  }
  return 'classic-red';
}

/**
 * Speichert den gewählten Kartenrücken und stößt Pass-Synchronisation an.
 */
export function setActiveCardBack(id: CardBackId): boolean {
  if (!isCardBackUnlocked(id)) return false;
  try {
    const store = getStorage();
    if (store) {
      store.setItem(CARD_BACK_KEY, id);
    }
  } catch {
    return false;
  }
  notifyChange();
  syncPassEntry();
  passSyncSoon();
  return true;
}

/**
 * React Hook für den gewählten Kartenrücken; aktualisiert Komponenten sofort bei Änderung.
 */
export function useActiveCardBack(): CardBackId {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => loadActiveCardBack(),
    () => 'classic-red',
  );
}

/**
 * Liefert die Kosmetik-Daten (Kartenrücken + Pass-Wappen) für den CardCosmeticsProvider.
 */
export function useActiveCardCosmetics(): { cardBack: CardBackId; crest: CrestSpec } {
  const cardBack = useActiveCardBack();
  const crest = useCrest();
  return { cardBack, crest };
}
