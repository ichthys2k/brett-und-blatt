import type { OpenRoomListing } from './protocol';

/**
 * Das Verzeichnis offener Räume („Offene Runden“) – ohne Anbieterbindung.
 * Der Cloudflare-Adapter hält es in einem eigenen Durable Object und schickt
 * jede Änderung live an alle Browser, die die Liste gerade ansehen.
 */

/** So lange bleibt eine Runde ohne neue Meldung in der Liste. */
export const OPEN_ROOM_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Spätestens nach dieser Zeit meldet ein Raum sich erneut, auch wenn sich an seiner
 * Karte nichts geändert hat – damit eine laufende Lobby nicht nach einer Stunde
 * aus der Liste fällt.
 */
export const OPEN_ROOM_REFRESH_MS = 10 * 60 * 1000;

/** Nachricht des Verzeichnisses an die Browser: die ganze aktuelle Liste. */
export interface OpenRoomsMessage {
  type: 'openRooms';
  rooms: OpenRoomListing[];
}

/**
 * Muss ein Raum seine Karte neu melden? Nur, wenn sie sich sichtbar geändert hat
 * (Spiel, Plätze, Raumleitung …) oder die letzte Meldung zu alt ist. `updatedAt`
 * allein zählt nicht – sonst meldete sich ein Raum nach jedem Klick.
 */
export function listingNeedsSync(
  previous: OpenRoomListing | null | undefined,
  next: OpenRoomListing | null,
  refreshMs = OPEN_ROOM_REFRESH_MS,
): boolean {
  if (previous === undefined) return true; // Noch nie gemeldet (z. B. nach dem Aufwachen).
  if (previous === null || next === null) return previous !== next;
  const { updatedAt: a, ...restPrev } = previous;
  const { updatedAt: b, ...restNext } = next;
  if (JSON.stringify(restPrev) !== JSON.stringify(restNext)) return true;
  return b - a >= refreshMs;
}

/**
 * Hält die offenen Runden, entfernt veraltete und liefert die Liste sortiert
 * (zuletzt aktive zuerst). Jede Methode sagt, ob sich die Liste geändert hat.
 */
export class OpenRoomDirectory {
  private readonly listings = new Map<string, OpenRoomListing>();

  constructor(saved?: Record<string, OpenRoomListing>, private readonly maxAgeMs = OPEN_ROOM_MAX_AGE_MS) {
    if (saved) for (const [code, item] of Object.entries(saved)) this.listings.set(code, item);
  }

  update(listing: OpenRoomListing): boolean {
    const before = this.listings.get(listing.code);
    this.listings.set(listing.code, listing);
    return JSON.stringify(before) !== JSON.stringify(listing);
  }

  remove(code: string): boolean {
    return this.listings.delete(code);
  }

  /** Entfernt Runden, deren letzte Meldung länger als `maxAgeMs` zurückliegt. */
  prune(now: number): boolean {
    let changed = false;
    for (const [code, item] of this.listings) {
      if (now - item.updatedAt > this.maxAgeMs) {
        this.listings.delete(code);
        changed = true;
      }
    }
    return changed;
  }

  /** Wann die nächste Runde veraltet (für den Wecker), null bei leerer Liste. */
  nextExpiry(): number | null {
    let next: number | null = null;
    for (const item of this.listings.values()) {
      const at = item.updatedAt + this.maxAgeMs;
      if (next === null || at < next) next = at;
    }
    return next;
  }

  list(): OpenRoomListing[] {
    return [...this.listings.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  toJSON(): Record<string, OpenRoomListing> {
    return Object.fromEntries(this.listings);
  }
}
