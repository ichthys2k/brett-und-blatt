import { isPaintedCardBack, paintedCardBackFile, paintedCardBackUrl, type CardBackId, type PaintedCardBackId } from '@brett-und-blatt/ui';
import { useActiveCardSet } from './activeCardSet';
import type { CrestSpec } from '@brett-und-blatt/engine';
import { useSyncExternalStore } from 'react';
import { loadBook } from './chronikStore';
import { currentCrest, hasCrest, useCrest } from './crestStore';
import { loadLearnBook } from './learnStore';
import type { Look } from './look';
import { totals, type Book } from './partiebuch';
import { passSyncSoon, syncPassEntry } from './playerPass';
import { stampCount } from './stamps';

export const CARD_BACK_KEY = 'brett-und-blatt:kartenruecken';

export interface CardBackUnlockState {
  book: Book;
  hasCrest: boolean;
  jesterUnlocked?: boolean;
  /** Tage mit Lernsitzung im Karteikasten (#314). */
  learnDays?: number;
  /** Spiele der Rubrik „Familie & Gesellschaft“ (aus der Startseite, nachgeladen). */
  familyGameIds?: readonly string[];
}

export interface CardBackDefinition {
  id: CardBackId;
  name: string;
  description: string;
  unlockCheck: (state: CardBackUnlockState) => { unlocked: boolean; progressLabel: string };
}

export const TRICK_GAMES = ['skat', 'schafkopf', 'doppelkopf', 'binokel'] as const;

const SVG_CARD_BACKS: readonly CardBackDefinition[] = [
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

/** Wie oft in einem Spiel gespielt bzw. gewonnen wurde, über alle Geräte und Modi. */
function gameCount(book: Book, gameId: string, field: 'played' | 'won'): number {
  return totals(book, gameId)[field];
}

function progress(have: number, needed: number, done: string, todo: (missing: number) => string): { unlocked: boolean; progressLabel: string } {
  return have >= needed ? { unlocked: true, progressLabel: done } : { unlocked: false, progressLabel: `${todo(needed - have)} (${have}/${needed})` };
}

/**
 * Gemalte Rücken (#314). Die Freischaltregeln sind Cornelius' Vorschläge aus dem Issue. Angeboten wird
 * ein Rücken erst, wenn sein Bild im Repo liegt (`paintedCardBackUrl`).
 */
export const PAINTED_CARD_BACK_CATALOG: readonly (CardBackDefinition & { id: PaintedCardBackId })[] = [
  {
    id: 'tavern-lantern',
    name: 'Tavernenlaterne',
    description: 'Gemalte Hopfenranken und Gerstenähren um eine runde Laternenrosette, in Braun und Bernstein.',
    unlockCheck: () => ({ unlocked: true, progressLabel: 'Von Anfang an verfügbar' }),
  },
  {
    id: 'castle-banner',
    name: 'Burgsaal',
    description: 'Gemalter Damast in Burgunder und Gold mit Lilien und Schildbuckel.',
    unlockCheck: (state) => {
      const played = totals(state.book).played;
      return progress(played, 10, 'Freigeschaltet nach 10 Partien', (n) => `Noch ${n} ${n === 1 ? 'Partie' : 'Partien'}`);
    },
  },
  {
    id: 'library-ink',
    name: 'Schreibstube',
    description: 'Gemalte Buchmalerei in Nachtblau und Pergament mit Efeu und Kompassrose.',
    unlockCheck: (state) =>
      progress(state.learnDays ?? 0, 5, 'Freigeschaltet durch 5 Lerntage im Karteikasten', (n) => `Noch ${n} ${n === 1 ? 'Lerntag' : 'Lerntage'} im Karteikasten`),
  },
  {
    id: 'garden-rose',
    name: 'Schlossgarten',
    description: 'Gemaltes Rosenspalier in Waldgrün und Rosé um einen Brunnen, von oben gesehen.',
    unlockCheck: (state) => {
      const distinct = (state.familyGameIds ?? []).filter((id) => gameCount(state.book, id, 'played') > 0).length;
      return progress(distinct, 3, 'Freigeschaltet durch 3 verschiedene Familienspiele', (n) => `Noch ${n} ${n === 1 ? 'Familienspiel' : 'verschiedene Familienspiele'}`);
    },
  },
  {
    id: 'fairground',
    name: 'Jahrmarkt',
    description: 'Gemalte Harlekin-Rauten in Rot und Gold mit Glöckchen und Bändern.',
    unlockCheck: (state) =>
      progress(gameCount(state.book, 'color-sorter', 'won') > 0 ? 1 : 0, 1, 'Freigeschaltet durch Sieg im Narrenhof', () => 'Erfordert 1 Sieg im Narrenhof'),
  },
  {
    id: 'night-sky',
    name: 'Sternenhimmel',
    description: 'Gemalter Nachthimmel mit goldenen Sternen und Sonne-und-Mond-Medaillon.',
    unlockCheck: (state) =>
      progress(totals(state.book, undefined, 'tournament').played > 0 ? 1 : 0, 1, 'Freigeschaltet durch ein Turnier', () => 'Erfordert 1 beendetes Turnier'),
  },
];

/** Alle wählbaren Rücken: die gezeichneten und die gemalten, deren Bild vorhanden ist. */
export const CARD_BACK_CATALOG: readonly CardBackDefinition[] = [...SVG_CARD_BACKS, ...PAINTED_CARD_BACK_CATALOG.filter((entry) => paintedCardBackUrl(entry.id))];

export function getCardBackDefinition(id: CardBackId): CardBackDefinition {
  return CARD_BACK_CATALOG.find((entry) => entry.id === id) ?? CARD_BACK_CATALOG[0]!;
}

let familyGameIds: readonly string[] | undefined;
let familyLoading = false;
/** Die Familienspiele kommen aus der Startseite; nachgeladen, damit dieses Modul klein bleibt (wie `crestProgress`). */
function loadFamilyGames(): readonly string[] {
  if (!familyGameIds && !familyLoading && typeof window !== 'undefined') {
    familyLoading = true;
    void import('../screens/Home')
      .then(({ CATEGORIES }) => {
        familyGameIds = CATEGORIES.find((category) => category.id === 'family')?.gameIds ?? [];
        notifyChange();
      })
      .catch(() => {
        familyLoading = false;
      });
  }
  return familyGameIds ?? [];
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
  let learnDays = 0;
  try {
    learnDays = loadLearnBook().days.length;
  } catch {
    // ohne Lernbuch keine Lerntage
  }
  return {
    book,
    hasCrest: hasCrest(),
    jesterUnlocked,
    learnDays,
    familyGameIds: loadFamilyGames(),
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

import { useActivePlayingCardOverrides, useSheetMediaUrl } from './activeSheetPackage';
import type { CardCosmetics } from '@brett-und-blatt/ui';

/**
 * Liefert die Kosmetik-Daten (Kartenrücken, Pass-Wappen und aktive Anki-Spielblatt-Overrides) für den CardCosmeticsProvider.
 */
export function useActiveCardCosmetics(look: Look = 'tavern'): CardCosmetics {
  const chosenBack = useActiveCardBack();
  // „Schlicht“ und erhöhter Kontrast (`activeLook`): statt eines gemalten Rückens der ruhige SVG-Rücken (#314).
  const plainBack = look === 'plain' && isPaintedCardBack(chosenBack);
  // Ein in Anki ersetztes Bild gleichen Namens (im aktiven Spielblatt-Paket) hat Vorrang.
  const replaced = useSheetMediaUrl(isPaintedCardBack(chosenBack) && !plainBack ? paintedCardBackFile(chosenBack) : null);
  const cardBack: CardBackId = plainBack ? 'classic-red' : replaced ? 'custom-media' : chosenBack;
  const crest = useCrest();
  const playingCardOverrides = useActivePlayingCardOverrides();
  // Bilder, Namen und Texte der Spezialkarten aus dem aktiven Kartenset (#270).
  const cardSet = useActiveCardSet();
  return { cardBack, crest, playingCardOverrides, ...(replaced ? { customImageUrl: replaced } : {}), ...(cardSet ? { ankiOverrides: cardSet.ankiOverrides, mediaUrlMap: cardSet.mediaUrlMap } : {}) };
}
