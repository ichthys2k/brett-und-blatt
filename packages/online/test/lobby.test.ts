import { describe, expect, it } from 'vitest';
import { OpenRoomDirectory, listingNeedsSync, type OpenRoomListing } from '../src';

const listing = (code: string, updatedAt: number, filledSeats = 1): OpenRoomListing => ({
  code,
  gameId: 'chess',
  gameName: 'Schach',
  gameEmoji: '♟️',
  hostName: 'Anna',
  hostAvatar: '🦊',
  totalSeats: 2,
  filledSeats,
  createdAt: 0,
  updatedAt,
});

describe('listingNeedsSync', () => {
  it('meldet beim ersten Mal und bei Wechsel zwischen sichtbar und unsichtbar', () => {
    expect(listingNeedsSync(undefined, null)).toBe(true);
    expect(listingNeedsSync(null, null)).toBe(false);
    expect(listingNeedsSync(null, listing('a', 1))).toBe(true);
    expect(listingNeedsSync(listing('a', 1), null)).toBe(true);
  });

  it('meldet nicht bloß wegen neuer Aktivität, aber bei sichtbaren Änderungen', () => {
    expect(listingNeedsSync(listing('a', 1000), listing('a', 5000))).toBe(false);
    expect(listingNeedsSync(listing('a', 1000), listing('a', 5000, 2))).toBe(true);
  });

  it('frischt nach der Wartezeit auf, damit die Runde nicht veraltet', () => {
    expect(listingNeedsSync(listing('a', 0), listing('a', 9_999), 10_000)).toBe(false);
    expect(listingNeedsSync(listing('a', 0), listing('a', 10_000), 10_000)).toBe(true);
  });
});

describe('OpenRoomDirectory', () => {
  it('sagt, ob sich die Liste ändert, und sortiert nach letzter Aktivität', () => {
    const dir = new OpenRoomDirectory();
    expect(dir.update(listing('a', 1))).toBe(true);
    expect(dir.update(listing('a', 1))).toBe(false);
    expect(dir.update(listing('b', 2))).toBe(true);
    expect(dir.list().map((l) => l.code)).toEqual(['b', 'a']);
    expect(dir.remove('a')).toBe(true);
    expect(dir.remove('a')).toBe(false);
  });

  it('räumt veraltete Runden ab und nennt den nächsten Ablauf', () => {
    const dir = new OpenRoomDirectory(undefined, 100);
    dir.update(listing('a', 0));
    dir.update(listing('b', 50));
    expect(dir.nextExpiry()).toBe(100);
    expect(dir.prune(100)).toBe(false);
    expect(dir.prune(101)).toBe(true);
    expect(dir.list().map((l) => l.code)).toEqual(['b']);
    dir.prune(1000);
    expect(dir.nextExpiry()).toBeNull();
  });

  it('übersteht Speichern und Laden', () => {
    const dir = new OpenRoomDirectory();
    dir.update(listing('a', 1));
    expect(new OpenRoomDirectory(dir.toJSON()).list()).toEqual(dir.list());
  });
});
