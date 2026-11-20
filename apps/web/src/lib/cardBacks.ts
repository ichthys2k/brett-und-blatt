import { isPaintedCardBack, paintedCardBackFile, paintedCardBackUrl, type CardBackId, type PaintedCardBackId } from '@brett-und-blatt/ui';
import { useActiveCardSet } from './activeCardSet';
import type { CrestSpec } from '@brett-und-blatt/engine';
import { useSyncExternalStore } from 'react';
import { loadBook } from './chronikStore';
import { currentCrest, hasCrest, useCrest } from './crestStore';
import type { Look } from './look';
import type { Book } from './partiebuch';
import { passSyncSoon, syncPassEntry } from './playerPass';
import { buildProgress, unlockFor, TRICK_GAMES, type Progress } from './unlocks';
import { familyGameIds } from './rubriken';
import { loadJesterAtelier, loadLearnDays } from './unlockSources';

export const CARD_BACK_KEY = 'brett-und-blatt:kartenruecken';

export interface CardBackUnlockState {
  book: Book;
  hasCrest: boolean;
  jesterUnlocked?: boolean;
  /** Tage mit Lernsitzung im Karteikasten (#314). */
  learnDays?: number;
  /** Spiele der Rubrik „Familie & Gesellschaft“ (`familyGameIds()` aus `rubriken.ts`; fehlt die Angabe, zählt keines). */
  familyGameIds?: readonly string[];
}

export interface CardBackDefinition {
  id: CardBackId;
  name: string;
  description: string;
  unlockCheck: (state: CardBackUnlockState) => { unlocked: boolean; progressLabel: string };
}

export { TRICK_GAMES };

/** Die Zähler zum Stand; die Regeln selbst stehen in `unlocks.ts` (#569). */
function progressOf(state: CardBackUnlockState): Progress {
  return buildProgress({ book: state.book, learnDays: state.learnDays ?? 0, jesterAtelier: Boolean(state.jesterUnlocked), familyGameIds: state.familyGameIds ?? [] });
}

const byRule = (id: string) => (state: CardBackUnlockState) => {
  const { unlocked, progressLabel } = unlockFor(id, progressOf(state));
  return { unlocked, progressLabel };
};

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
    unlockCheck: byRule('bavarian-gold'),
  },
  {
    id: 'jester-velvet',
    name: 'Narrenhof-Samt',
    description: 'Königlicher violetter Samt im Harlekin-Muster mit goldenen Glöckchen.',
    unlockCheck: byRule('jester-velvet'),
  },
  {
    id: 'dragon-scale',
    name: 'Drachenschuppen-Glut',
    description: 'Smaragdgrüne Schuppenhaut mit Obsidian-Rahmen und glühendem Drachenauge.',
    unlockCheck: byRule('dragon-scale'),
  },
] as const;

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
    unlockCheck: byRule('castle-banner'),
  },
  {
    id: 'library-ink',
    name: 'Schreibstube',
    description: 'Gemalte Buchmalerei in Nachtblau und Pergament mit Efeu und Kompassrose.',
    unlockCheck: byRule('library-ink'),
  },
  {
    id: 'garden-rose',
    name: 'Schlossgarten',
    description: 'Gemaltes Rosenspalier in Waldgrün und Rosé um einen Brunnen, von oben gesehen.',
    unlockCheck: byRule('garden-rose'),
  },
  {
    id: 'fairground',
    name: 'Jahrmarkt',
    description: 'Gemalte Harlekin-Rauten in Rot und Gold mit Glöckchen und Bändern.',
    unlockCheck: byRule('fairground'),
  },
  {
    id: 'night-sky',
    name: 'Sternenhimmel',
    description: 'Gemalter Nachthimmel mit goldenen Sternen und Sonne-und-Mond-Medaillon.',
    unlockCheck: byRule('night-sky'),
  },
];

/** Alle wählbaren Rücken: die gezeichneten und die gemalten, deren Bild vorhanden ist. */
export const CARD_BACK_CATALOG: readonly CardBackDefinition[] = [...SVG_CARD_BACKS, ...PAINTED_CARD_BACK_CATALOG.filter((entry) => paintedCardBackUrl(entry.id))];

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
  return {
    book: loadBook(),
    hasCrest: hasCrest(),
    jesterUnlocked: loadJesterAtelier(),
    learnDays: loadLearnDays(),
    familyGameIds: familyGameIds(),
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
