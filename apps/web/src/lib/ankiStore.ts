import { reconcileCards, type AnkiCollection, type ApkgData } from '@brett-und-blatt/engine';
import { passBook } from './passes';

/*
 * Speicher für importierte Anki-Pakete (#101, L3): IndexedDB, je Pass eine eigene Datenbank. Ein importiertes Paket ist ein eigener Behälter
 * (Sammlung mit Notiztypen, Stapeln und Notizen, Karten mit Lernstand, Protokoll, Medien); er bleibt unverändert und lässt sich verlustfrei
 * wieder nach Anki exportieren. Er reist nicht über den Pass (zu groß; Teilen kommt mit L7). Ein Austausch zwischen Geräten geht über `.apkg`.
 */

export interface StoredPack {
  id: string;
  name: string;
  importedAt: number;
  version: ApkgData['version'];
  collection: AnkiCollection;
  cards: ApkgData['cards'];
  revlog: ApkgData['revlog'];
  conf: ApkgData['conf'];
  dconf: ApkgData['dconf'];
  warnings: string[];
  mediaBytes: number;
}

export interface PackSummary {
  id: string;
  name: string;
  importedAt: number;
  notes: number;
  cards: number;
  decks: number;
  media: number;
  mediaBytes: number;
  learned: number;
}

const PACKS = 'packs';
const MEDIA = 'media';
const dbName = (): string => `brett-und-blatt-anki-${passBook.activeId() ?? 'standard'}`;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName(), 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(PACKS, { keyPath: 'id' });
      db.createObjectStore(MEDIA);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB nicht verfügbar'));
  });
}
const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Speichern fehlgeschlagen'));
    tx.onabort = () => reject(tx.error ?? new Error('Speichern abgebrochen'));
  });
const result = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Lesen fehlgeschlagen'));
  });

const mediaKey = (packId: string, name: string): string => `${packId}\u0000${name}`;

export async function savePack(name: string, data: ApkgData): Promise<string> {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');
  const mediaBytes = [...data.media.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  const pack: StoredPack = { id, name, importedAt: Date.now(), version: data.version, collection: data.collection, cards: data.cards, revlog: data.revlog, conf: data.conf, dconf: data.dconf, warnings: data.warnings, mediaBytes };
  const db = await open();
  try {
    const tx = db.transaction([PACKS, MEDIA], 'readwrite');
    tx.objectStore(PACKS).put(pack);
    for (const [file, bytes] of data.media) tx.objectStore(MEDIA).put(bytes, mediaKey(id, file));
    await done(tx);
  } finally {
    db.close();
  }
  return id;
}

export async function listPacks(): Promise<PackSummary[]> {
  const db = await open();
  try {
    const all = await result(db.transaction(PACKS).objectStore(PACKS).getAll() as IDBRequest<StoredPack[]>);
    const keys = await result(db.transaction(MEDIA).objectStore(MEDIA).getAllKeys());
    return all
      .map((p) => ({
        id: p.id,
        name: p.name,
        importedAt: p.importedAt,
        notes: p.collection.notes.length,
        cards: p.cards.length,
        decks: p.collection.decks.length,
        media: keys.filter((k) => typeof k === 'string' && k.startsWith(`${p.id}\u0000`)).length,
        mediaBytes: p.mediaBytes,
        learned: p.cards.filter((c) => c.reps > 0 || c.type > 0).length,
      }))
      .sort((a, b) => b.importedAt - a.importedAt);
  } finally {
    db.close();
  }
}

export async function loadPack(id: string): Promise<{ pack: StoredPack; media: Map<string, Uint8Array> } | null> {
  const db = await open();
  try {
    const pack = await result(db.transaction(PACKS).objectStore(PACKS).get(id) as IDBRequest<StoredPack | undefined>);
    if (!pack) return null;
    const store = db.transaction(MEDIA).objectStore(MEDIA);
    const keys = (await result(store.getAllKeys())).filter((k): k is string => typeof k === 'string' && k.startsWith(`${id}\u0000`));
    const media = new Map<string, Uint8Array>();
    for (const key of keys) {
      const value = await result(store.get(key) as IDBRequest<Uint8Array | ArrayBuffer>);
      media.set(key.slice(id.length + 1), value instanceof Uint8Array ? value : new Uint8Array(value));
    }
    return { pack, media };
  } finally {
    db.close();
  }
}

export async function deletePackStored(id: string): Promise<void> {
  const db = await open();
  try {
    const keys = (await result(db.transaction(MEDIA).objectStore(MEDIA).getAllKeys())).filter((k): k is string => typeof k === 'string' && k.startsWith(`${id}\u0000`));
    const tx = db.transaction([PACKS, MEDIA], 'readwrite');
    tx.objectStore(PACKS).delete(id);
    for (const key of keys) tx.objectStore(MEDIA).delete(key);
    await done(tx);
  } finally {
    db.close();
  }
}

/** Bittet den Browser, den Speicher nicht von selbst zu leeren (kein Fehler, wenn es abgelehnt wird). */
export async function keepStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // ohne Zusage kann der Browser den Speicher bei Platzmangel räumen; der Export bleibt der Sicherungsweg
  }
}

/** Speichert die bearbeitete Sammlung eines importierten Pakets; die Karten werden mit den Notizen abgeglichen (neuer Stand bleibt erhalten, Neues kommt dazu). */
export async function updatePackCollection(id: string, collection: AnkiCollection): Promise<void> {
  const db = await open();
  try {
    const current = await result(db.transaction(PACKS).objectStore(PACKS).get(id) as IDBRequest<StoredPack | undefined>);
    if (!current) throw new Error('Paket nicht gefunden');
    const next: StoredPack = { ...current, collection, cards: reconcileCards(collection, current.cards) };
    const tx = db.transaction(PACKS, 'readwrite');
    tx.objectStore(PACKS).put(next);
    await done(tx);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------- Medien einer Sammlung (eigene Notizen `meine` oder ein Paket)

/** Alle Medien einer Sammlung (Name → Inhalt). */
export async function loadMedia(id: string): Promise<Map<string, Uint8Array>> {
  const db = await open();
  try {
    const store = db.transaction(MEDIA).objectStore(MEDIA);
    const keys = (await result(store.getAllKeys())).filter((k): k is string => typeof k === 'string' && k.startsWith(`${id}\u0000`));
    const media = new Map<string, Uint8Array>();
    for (const key of keys) {
      const value = await result(store.get(key) as IDBRequest<Uint8Array | ArrayBuffer>);
      media.set(key.slice(id.length + 1), value instanceof Uint8Array ? value : new Uint8Array(value));
    }
    return media;
  } finally {
    db.close();
  }
}

/** Legt eine Datei zu einer Sammlung; bei einem Paket zählt `mediaBytes` mit. */
export async function putMedia(id: string, name: string, bytes: Uint8Array): Promise<void> {
  const db = await open();
  try {
    const tx = db.transaction([PACKS, MEDIA], 'readwrite');
    tx.objectStore(MEDIA).put(bytes, mediaKey(id, name));
    const request = tx.objectStore(PACKS).get(id) as IDBRequest<StoredPack | undefined>;
    request.onsuccess = () => {
      const pack = request.result;
      if (pack) tx.objectStore(PACKS).put({ ...pack, mediaBytes: pack.mediaBytes + bytes.length });
    };
    await done(tx);
  } finally {
    db.close();
  }
}
