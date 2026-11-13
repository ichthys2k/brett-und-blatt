/**
 * Aktives Kartenset (#270, #277): ein Anki-Paket aus der Bibliothek mit Karten für Drachenspiel,
 * Narrenhof, Quartett oder Wölfe im Schafspelz, das je Spielerpass gewählt wird. Daraus kommen
 * – die Darstellung (geänderte Namen, Bilder, Texte) über die Kartengestaltung und
 * – die Werte (Kosten, Angriff, Leben, Preise, Quartett-Zahlen) als Spieloption `customCardCatalog`
 *   beim Start einer Partie oder in der Lobby eines Online-Raums.
 * Die Spiele prüfen die Werte selbst noch einmal (`sanitizeCustomCardCatalog`).
 */
import {
  isSpecialCardNote,
  parseCustomCardCatalog,
  type AnkiNote,
  type CustomCardCatalog,
} from '@brett-und-blatt/engine';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { loadMedia, loadPack } from './ankiStore';
import { generateTemplateCollection, type GameCardTemplateId } from './gameCardTemplates';
import { passBook } from './passes';

const KEY = 'bub-active-card-set-package';
const listeners = new Set<() => void>();


/** Welche Verzeichnisse des Kartensets welches Spiel nutzt. */
export const CARD_SET_GAMES: Record<string, keyof Pick<CustomCardCatalog, 'combatCards' | 'courtCards' | 'quartettCards'>> = {
  drachenspiel: 'combatCards',
  'color-sorter': 'courtCards',
  quartett: 'quartettCards',
};

function storageKey(): string {
  return `${KEY}-${passBook.activeId() ?? 'standard'}`;
}

export function loadActiveCardSetId(): string | null {
  try {
    return window.localStorage.getItem(storageKey());
  } catch {
    return null;
  }
}

export function setActiveCardSetId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(storageKey(), id);
    else window.localStorage.removeItem(storageKey());
  } catch {
    // ohne Speicher gilt die Wahl nur bis zum Neuladen nicht – dann eben gar nicht
  }
  for (const listener of listeners) listener();
}

export function useActiveCardSetId(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => loadActiveCardSetId(),
    () => null,
  );
}

/** Notizen unter allen Schlüsseln, unter denen die Spiele nachsehen (Kennung, GUID, ohne Spiel-Präfix). */
export function overrideIndex(notes: readonly AnkiNote[]): Record<string, AnkiNote> {
  const index: Record<string, AnkiNote> = {};
  for (const note of notes) {
    if (!isSpecialCardNote(note)) continue;
    index[note.guid] = note;
    const kennung = note.fields[0]?.trim();
    if (kennung) {
      index[kennung] = note;
      const bare = kennung.replace(/^(drachenspiel|narrenhof|woelfe|quartett):/, '');
      index[bare] ??= note;
    }
  }
  return index;
}

/** Offizielle Kartensätze je Spiel, mit denen ein Kartenset verglichen wird (aus den Anki-Vorlagen). */
const OFFICIAL: Record<string, GameCardTemplateId[]> = {
  drachenspiel: ['drachenspiel'],
  'color-sorter': ['narrenhof'],
  quartett: ['quartett-tiere', 'quartett-weltraum', 'quartett-dinosaurier', 'quartett-bibel', 'quartett-geometrie'],
};
const officialCache = new Map<string, Promise<CustomCardCatalog[]>>();

function officialCatalogs(gameId: string): Promise<CustomCardCatalog[]> {
  let hit = officialCache.get(gameId);
  if (!hit) {
    hit = Promise.all((OFFICIAL[gameId] ?? []).map(async (id) => parseCustomCardCatalog(await generateTemplateCollection(id))));
    officialCache.set(gameId, hit);
  }
  return hit;
}

/** Was an einer Karte für das Spiel zählt: Name und Werte, nicht Bild oder Text. */
function cardKey(card: Record<string, unknown>): string {
  const keywords = Array.isArray(card.keywords) ? [...(card.keywords as string[])].sort() : undefined;
  return JSON.stringify([card.name, card.cost, card.attack, card.health, keywords, card.price, card.baseChips, card.multiplier, card.values]);
}

/**
 * Nur die Karten eines Kartensets, die sich vom offiziellen Satz unterscheiden – so bleibt die Option
 * klein genug für Raum und Spielstand. Ohne Unterschied: null (dann gelten die Standardkarten).
 */
export function changedCatalog(gameId: string, catalog: CustomCardCatalog | null | undefined, official: readonly CustomCardCatalog[]): CustomCardCatalog | null {
  const part = CARD_SET_GAMES[gameId];
  if (!catalog || !part) return null;
  const changed: Record<string, unknown> = {};
  for (const [id, card] of Object.entries(catalog[part])) {
    const same = official.some((base) => {
      const original = (base[part] as Record<string, unknown>)[id];
      return original !== undefined && cardKey(original as Record<string, unknown>) === cardKey(card as unknown as Record<string, unknown>);
    });
    if (!same) changed[id] = card;
  }
  if (Object.keys(changed).length === 0) return null;
  return { checksum: catalog.checksum, notices: [], combatCards: {}, courtCards: {}, quartettCards: {}, [part]: changed } as CustomCardCatalog;
}

/** Das Kartenset als Spieloption (JSON-Text) für ein Spiel, falls es dort Karten ändert. */
export async function catalogOptionFor(gameId: string, catalog: CustomCardCatalog | null | undefined): Promise<string | null> {
  if (!catalog || !CARD_SET_GAMES[gameId]) return null;
  const changed = changedCatalog(gameId, catalog, await officialCatalogs(gameId));
  return changed ? JSON.stringify(changed) : null;
}

/** Wie `catalogOptionFor`, als Hook für Hinweise und die Lobby: geänderte Karten oder null. */
export function useChangedCatalog(gameId: string | null | undefined, catalog: CustomCardCatalog | null | undefined): CustomCardCatalog | null {
  const [changed, setChanged] = useState<CustomCardCatalog | null>(null);
  useEffect(() => {
    let cancelled = false;
    setChanged(null);
    if (!gameId || !catalog || !CARD_SET_GAMES[gameId]) return;
    void officialCatalogs(gameId).then((official) => !cancelled && setChanged(changedCatalog(gameId, catalog, official)));
    return () => {
      cancelled = true;
    };
  }, [gameId, catalog]);
  return changed;
}

export interface ActiveCardSet {
  id: string;
  name: string;
  catalog: CustomCardCatalog;
  ankiOverrides: Record<string, AnkiNote>;
  mediaUrlMap: Record<string, string>;
}

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml' };

/** Liest das aktive Kartenset (ohne Bilder) – für den Spielstart. */
export async function loadActiveCatalog(): Promise<CustomCardCatalog | null> {
  const id = loadActiveCardSetId();
  if (!id) return null;
  try {
    const stored = await loadPack(id);
    if (!stored) return null;
    const notes = stored.pack.collection.notes.filter(isSpecialCardNote);
    return notes.length ? parseCustomCardCatalog({ notes }) : null;
  } catch {
    return null;
  }
}

/** Das aktive Kartenset mit Bildern für die Darstellung; lädt bei jedem Wechsel neu. */
export function useActiveCardSet(): ActiveCardSet | null {
  const id = useActiveCardSetId();
  const [set, setSet] = useState<ActiveCardSet | null>(null);
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    if (!id) {
      setSet(null);
      return;
    }
    void (async () => {
      try {
        const stored = await loadPack(id);
        if (cancelled || !stored) return void (!cancelled && setSet(null));
        const notes = stored.pack.collection.notes.filter(isSpecialCardNote);
        if (notes.length === 0) return void setSet(null);
        const media = await loadMedia(id);
        if (cancelled) return;
        const mediaUrlMap: Record<string, string> = {};
        for (const [name, bytes] of media) {
          const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'image/png' }));
          urls.push(url);
          mediaUrlMap[name] = url;
        }
        setSet({ id, name: stored.pack.name, catalog: parseCustomCardCatalog({ notes }), ankiOverrides: overrideIndex(notes), mediaUrlMap });
      } catch {
        if (!cancelled) setSet(null);
      }
    })();
    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [id]);
  return set;
}
