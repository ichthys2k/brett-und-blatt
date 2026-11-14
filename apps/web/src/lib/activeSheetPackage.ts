import {
  extractPlayingCardOverrides,
  type PlayingCardOverride,
} from '@brett-und-blatt/engine';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { loadMedia, loadPack } from './ankiStore';
import { passBook } from './passes';

const ACTIVE_SHEET_KEY = 'bub-active-playing-card-package';

const listeners = new Set<() => void>();

function notifyChange(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Listener-Fehler fangen
    }
  }
}

let memoryStore: Record<string, string> = {};

function getStorage(): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // fallback
  }
  return {
    getItem: (k: string) => memoryStore[k] ?? null,
    setItem: (k: string, v: string) => {
      memoryStore[k] = v;
    },
    removeItem: (k: string) => {
      delete memoryStore[k];
    },
  };
}

/**
 * Liest die ID des aktuell aktivierten Anki-Spielblatt-Pakets.
 */
export function loadActiveSheetPackageId(): string | null {
  try {
    const store = getStorage();
    if (!store) return null;
    const passId = passBook.activeId() ?? 'standard';
    return store.getItem(`${ACTIVE_SHEET_KEY}-${passId}`) ?? store.getItem(ACTIVE_SHEET_KEY);
  } catch {
    return null;
  }
}

/**
 * Aktiviert oder deaktiviert ein Anki-Spielblatt-Paket.
 */
export function setActiveSheetPackageId(id: string | null): void {
  try {
    const store = getStorage();
    if (store) {
      const passId = passBook.activeId() ?? 'standard';
      if (id) {
        store.setItem(`${ACTIVE_SHEET_KEY}-${passId}`, id);
        store.setItem(ACTIVE_SHEET_KEY, id);
      } else {
        store.removeItem(`${ACTIVE_SHEET_KEY}-${passId}`);
        store.removeItem(ACTIVE_SHEET_KEY);
      }
    }
  } catch {
    // ignorieren
  }
  notifyChange();
}

/**
 * React Hook für die ID des aktuell aktiven Spielblatt-Pakets.
 */
export function useActiveSheetPackageId(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => loadActiveSheetPackageId(),
    () => null,
  );
}

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

/**
 * React Hook, der die PlayingCardOverrides aus dem aktuell aktiven Anki-Paket
 * asynchron lädt und bei Änderungen aktualisiert.
 */
export function useActivePlayingCardOverrides(): Record<string, PlayingCardOverride> | undefined {
  const activePackageId = useActiveSheetPackageId();
  const [overrides, setOverrides] = useState<Record<string, PlayingCardOverride> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    if (!activePackageId) {
      setOverrides(undefined);
      return;
    }

    const createdBlobUrls: string[] = [];

    const load = async () => {
      try {
        const stored = await loadPack(activePackageId);
        if (cancelled || !stored) {
          if (!cancelled) setOverrides(undefined);
          return;
        }

        const media = await loadMedia(activePackageId);
        if (cancelled) return;

        const mediaResolver = (name: string): string | null => {
          const bytes = media.get(name);
          if (!bytes) return null;
          const ext = name.split('.').pop()?.toLowerCase() ?? '';
          const type = MIME_MAP[ext] ?? 'image/png';
          const blob = new Blob([bytes as BlobPart], { type });
          const url = URL.createObjectURL(blob);
          createdBlobUrls.push(url);
          return url;
        };

        const extracted = extractPlayingCardOverrides(stored.pack.collection, { mediaResolver });
        if (!cancelled) {
          setOverrides(extracted);
        }
      } catch {
        if (!cancelled) setOverrides(undefined);
      }
    };

    void load();

    return () => {
      cancelled = true;
      for (const url of createdBlobUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [activePackageId]);

  return overrides;
}

/**
 * Ein ersetzter Kartenrücken aus dem aktiven Spielblatt-Paket (#314): Liegt dort ein Medium mit dem
 * Namen des gewählten gemalten Rückens (`bub-ruecken-<id>.webp`), zeigt die App dieses Bild.
 */
export function useSheetMediaUrl(name: string | null): string | undefined {
  const activePackageId = useActiveSheetPackageId();
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    let created: string | undefined;
    setUrl(undefined);
    if (!activePackageId || !name) return;
    void loadMedia(activePackageId)
      .then((media) => {
        const bytes = media.get(name);
        if (cancelled || !bytes) return;
        const ext = name.split('.').pop()?.toLowerCase() ?? '';
        created = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME_MAP[ext] ?? 'image/png' }));
        setUrl(created);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [activePackageId, name]);
  return url;
}
