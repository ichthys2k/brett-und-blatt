import { emptyCollection, type AnkiCollection } from '@brett-und-blatt/engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadPack, updatePackCollection } from './ankiStore';
import { loadCollection, saveCollection } from './library';

/*
 * Woher die Sammlung beim Bearbeiten kommt (#101, L4): `meine` (die eigene Sammlung im Pass, nur Text) oder ein importiertes Anki-Paket
 * (IndexedDB, mit Medien). Das Speichern geht an die jeweilige Stelle zurück.
 */

export const OWN = 'meine';

export interface Source {
  status: 'loading' | 'ready' | 'missing';
  name: string;
  collection: AnkiCollection;
  /** Medien des Pakets (Dateiname → Inhalt); in der eigenen Sammlung leer. */
  media: Map<string, Uint8Array>;
  /** Neuer Stand: sofort anzeigen und speichern. */
  update(next: AnkiCollection): void;
}

const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp', mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime' };

/** Adressen zum Anzeigen für die Medien eines Pakets, erst beim ersten Gebrauch erzeugt und beim Verlassen freigegeben. */
export function useMediaResolver(media: Map<string, Uint8Array>): (name: string) => string | null {
  const urls = useRef(new Map<string, string>());
  useEffect(() => {
    const created = urls.current;
    return () => {
      for (const url of created.values()) URL.revokeObjectURL(url);
      created.clear();
    };
  }, [media]);
  return useCallback(
    (name: string) => {
      const known = urls.current.get(name);
      if (known) return known;
      const bytes = media.get(name);
      if (!bytes) return null;
      const type = MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
      // SVG kann Skripte tragen; es wird nur als Bild über <img> gezeigt und nie als Dokument geöffnet.
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
      urls.current.set(name, url);
      return url;
    },
    [media],
  );
}

export function useSource(id: string): Source {
  const [state, setState] = useState<{ status: Source['status']; name: string; collection: AnkiCollection; media: Map<string, Uint8Array> }>({ status: 'loading', name: '', collection: emptyCollection(), media: new Map() });
  useEffect(() => {
    let cancelled = false;
    if (id === OWN) {
      setState({ status: 'ready', name: 'Meine Notizen', collection: loadCollection(), media: new Map() });
      return;
    }
    loadPack(id).then(
      (loaded) => {
        if (cancelled) return;
        setState(loaded ? { status: 'ready', name: loaded.pack.name, collection: loaded.pack.collection, media: loaded.media } : { status: 'missing', name: '', collection: emptyCollection(), media: new Map() });
      },
      () => !cancelled && setState({ status: 'missing', name: '', collection: emptyCollection(), media: new Map() }),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);
  const update = useCallback(
    (next: AnkiCollection) => {
      setState((s) => ({ ...s, collection: next }));
      if (id === OWN) saveCollection(next);
      else void updatePackCollection(id, next);
    },
    [id],
  );
  return useMemo(() => ({ ...state, update }), [state, update]);
}
