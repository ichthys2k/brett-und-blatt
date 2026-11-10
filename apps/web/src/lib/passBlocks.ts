import { onPassSyncRequest, registerPassBlock } from '@brett-und-blatt/ui/sync';
import { onFavoritesChanged } from './favorites';
import { passSyncSoon } from './playerPass';
import { sameChronik, mergeChronik, sanitizeChronik, type Chronik } from './chronik';
import { CHRONIK_KEY } from './chronikStore';
import { ALBUM_KEY, mergeAlbum, sameAlbum, sanitizeAlbum, type Album } from './album';
import { BOOK_KEY, TROPHIES_KEY } from './passRecorder';
import { mergeTrophies, sameTrophies, sanitizeTrophies, type Trophy } from './pokale';
import { emptyBook, mergeBooks, sameBooks, sanitizeBook, type Book } from './partiebuch';
import { CHILD_PASSES_KEY } from './classPasses';
import { LIBRARY_KEY } from './library';
import { LEARN_KEY } from './learnStore';
import { LEAD_KEYS_KEY } from './classLearning';
import type { LeadKeyPair } from './classCrypto';
import { collectionFromStored, compactCollection, compactLearnBook, emptyCollection, emptyLearnBook, learnBookToStored, mergeCollections, mergeLearnBooks, sameCollection, sameLearnBook, sanitizeCollection, sanitizeLearnBook, type AnkiCollection, type LearnBook } from '@brett-und-blatt/engine';
import { mergeChildPasses, sameChildPasses, sanitizeChildPasses, type ChildPasses } from './classPassesCore';
import { applyItems, collectItems, mergeItems, sameItems, sanitizeItems, syncedNames, type Items } from './settingsBlock';

/*
 * Blöcke des Spielerpasses, die die Web-App selbst beisteuert (Vorhaben #135). Jeder Block meldet sich bei
 * `registerPassBlock` an; der Abgleich läuft über den Passschlüssel (`passSyncSoon`).
 */

/** Stand beim letzten Abgleich (zusammen mit dem Pass, siehe `SCOPED_KEYS` in `passes.ts`). */
const KNOWN_KEY = 'brett-und-blatt:einstellungen-staende';

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null): void => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Speicher gesperrt – dann gilt es nur bis zum Neuladen.
  }
};
const allKeys = (): string[] => {
  try {
    return Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i)).filter((key): key is string => key !== null);
  } catch {
    return [];
  }
};
const loadKnown = (): Items => {
  try {
    return sanitizeItems({ items: JSON.parse(read(KNOWN_KEY) ?? 'null') });
  } catch {
    return {};
  }
};

function sanitizeLeadKeys(value: unknown): LeadKeyPair | null {
  const v = value as Partial<LeadKeyPair> | null;
  return v && typeof v.pub === 'string' && /^[A-Za-z0-9_-]{86,90}$/.test(v.pub) && v.priv && typeof v.priv === 'object' && typeof v.at === 'number' ? { pub: v.pub, priv: v.priv, at: v.at } : null;
}

let registered = false;

/** Meldet die Blöcke der Web-App an und verbindet Änderungen mit dem Abgleich. Einmal beim Start. */
export function registerWebPassBlocks(): void {
  if (registered) return;
  registered = true;
  registerPassBlock<Items>({
    name: 'einstellungen',
    read: () => collectItems(read, syncedNames(allKeys()), loadKnown(), Date.now()),
    write: (items) => {
      applyItems(items, read, write);
      write(KNOWN_KEY, JSON.stringify(items));
    },
    // Der Block liegt als Eintragsliste vor; der frühere Stand (nur Lieblingsspiele) hatte die Form { favorites, changed }.
    sanitize: (value) => sanitizeItems(value && typeof value === 'object' && 'favorites' in value ? value : { items: value }),
    merge: mergeItems,
    same: sameItems,
  });
  // Klassenausweise (#152): die Kinder-Pässe der Leitung samt Rettungscode für das Zurücksetzen der PIN („Lehrkraft-Schloss“).
  registerPassBlock<ChildPasses>({
    name: 'klassen',
    read: () => {
      try {
        return sanitizeChildPasses(JSON.parse(read(CHILD_PASSES_KEY) ?? 'null'));
      } catch {
        return [];
      }
    },
    write: (list) => write(CHILD_PASSES_KEY, JSON.stringify(list)),
    sanitize: sanitizeChildPasses,
    merge: mergeChildPasses,
    same: sameChildPasses,
  });
  // Bibliothek (#101, L1): Sammlung im Anki-Modell (Notizen, Stapel, Notiztypen); je Notiz gilt die jüngere Änderung, Löschvermerke verhindern,
  // dass ein Gerät Gelöschtes zurückbringt. Die frühere Liste von Paketen (ältere Geräte) wird beim Einlesen umgestellt.
  registerPassBlock<AnkiCollection>({
    name: 'bibliothek',
    read: () => {
      try {
        return compactCollection(collectionFromStored(JSON.parse(read(LIBRARY_KEY) ?? 'null')));
      } catch {
        return compactCollection(emptyCollection());
      }
    },
    write: (col) => write(LIBRARY_KEY, JSON.stringify(compactCollection(col))),
    sanitize: (value) => compactCollection(collectionFromStored(value)),
    merge: (remote, local) => compactCollection(mergeCollections(sanitizeCollection(remote), sanitizeCollection(local))),
    same: (a, b) => sameCollection(sanitizeCollection(a), sanitizeCollection(b)),
  });
  // Lernbuch (#101, L5): Lernstand der eigenen Sammlung; je Karte gilt die jüngste Antwort, das Protokoll vereint sich (30 Tage), höchstens 60 000 Zeichen.
  registerPassBlock<LearnBook>({
    name: 'lernen',
    read: () => {
      try {
        return sanitizeLearnBook(JSON.parse(read(LEARN_KEY) ?? 'null'));
      } catch {
        return emptyLearnBook();
      }
    },
    write: (book) => write(LEARN_KEY, JSON.stringify(learnBookToStored(book))),
    sanitize: (value) => sanitizeLearnBook(value),
    merge: (remote, local) => compactLearnBook(mergeLearnBooks(sanitizeLearnBook(remote), sanitizeLearnBook(local)), Date.now()),
    same: (a, b) => sameLearnBook(sanitizeLearnBook(a), sanitizeLearnBook(b)),
  });
  // Schlüssel der Leitung für den Lernstand der Klasse (#224): das älteste Paar gilt auf allen Geräten, damit jede Leitung ihre Stände öffnen kann.
  registerPassBlock<LeadKeyPair | null>({
    name: 'klassenschluessel',
    read: () => {
      try {
        return sanitizeLeadKeys(JSON.parse(read(LEAD_KEYS_KEY) ?? 'null'));
      } catch {
        return null;
      }
    },
    write: (keys) => (keys ? write(LEAD_KEYS_KEY, JSON.stringify(keys)) : undefined),
    sanitize: sanitizeLeadKeys,
    merge: (remote, local) => {
      const [a, b] = [sanitizeLeadKeys(remote), sanitizeLeadKeys(local)];
      return !a ? b : !b ? a : a.at <= b.at ? a : b;
    },
    same: (a, b) => JSON.stringify(sanitizeLeadKeys(a)) === JSON.stringify(sanitizeLeadKeys(b)),
  });
  // Partiebuch (#142): Zähler je Gerät (wachsen nur), die letzten Partien als Kopfzeilen.
  registerPassBlock<Book>({
    name: 'partiebuch',
    read: () => {
      try {
        return sanitizeBook(JSON.parse(read(BOOK_KEY) ?? 'null'));
      } catch {
        return emptyBook();
      }
    },
    write: (book) => write(BOOK_KEY, JSON.stringify(book)),
    sanitize: sanitizeBook,
    merge: mergeBooks,
    same: sameBooks,
  });
  // Chronik (#143): angeheftete Partien mit Zugliste; die jüngere Änderung je Partie gewinnt.
  registerPassBlock<Chronik>({
    name: 'chronik',
    read: () => {
      try {
        return sanitizeChronik(JSON.parse(read(CHRONIK_KEY) ?? 'null'));
      } catch {
        return {};
      }
    },
    write: (chronik) => write(CHRONIK_KEY, JSON.stringify(chronik)),
    sanitize: sanitizeChronik,
    merge: mergeChronik,
    same: sameChronik,
  });
  // Pokalschrank (#146): die letzten 60 Siege; die Zahl der Siege je Spiel kommt aus den Zählern des Partiebuchs.
  registerPassBlock<Trophy[]>({
    name: 'pokale',
    read: () => {
      try {
        return sanitizeTrophies(JSON.parse(read(TROPHIES_KEY) ?? 'null'));
      } catch {
        return [];
      }
    },
    write: (list) => write(TROPHIES_KEY, JSON.stringify(list)),
    sanitize: sanitizeTrophies,
    merge: mergeTrophies,
    same: sameTrophies,
  });
  // Sammelalbum (#148): Funde je Kapitel mit dem Zeitpunkt des ersten Fundes; die früheste Zeit gewinnt.
  registerPassBlock<Album>({
    name: 'album',
    read: () => {
      try {
        return sanitizeAlbum(JSON.parse(read(ALBUM_KEY) ?? 'null'));
      } catch {
        return {};
      }
    },
    write: (album) => write(ALBUM_KEY, JSON.stringify(album)),
    sanitize: sanitizeAlbum,
    merge: mergeAlbum,
    same: sameAlbum,
  });
  onFavoritesChanged(passSyncSoon);
  // Spiele melden sich mit eigenen Blöcken (Narrenhof, Drachenspiel) und bitten um Abgleich.
  onPassSyncRequest(() => passSyncSoon());
  // Änderungen an Musik, Aussehen & Co. werden beim nächsten Abgleich bemerkt: beim Start und wenn die Seite in den Hintergrund geht.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') passSyncSoon(500);
  });
}
