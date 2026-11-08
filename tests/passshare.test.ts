import { describe, expect, it } from 'vitest';
import { decryptSnapshot, encryptSnapshot, sanitizeSnapshot, shareId, type PassSnapshot } from '../apps/web/src/lib/passShareCore';

const KEY = 'A'.repeat(43);
const SNAP: PassSnapshot = { v: 1, name: 'Fuchs', avatar: '🦊', at: 1000, stamps: [{ gameId: 'chess', kinds: ['first', 'win'] }], trophies: [{ gameId: 'chess', at: 5 }], favorites: ['skat'] };

describe('Pass teilen (#149)', () => {
  it('verschlüsselt und entschlüsselt einen Schnappschuss', async () => {
    const data = await encryptSnapshot(KEY, SNAP);
    expect(data).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(data).not.toContain('Fuchs');
    expect(await decryptSnapshot(KEY, data)).toEqual(SNAP);
  });

  it('mit falschem Schlüssel oder beschädigten Daten kommt nichts heraus', async () => {
    const data = await encryptSnapshot(KEY, SNAP);
    expect(await decryptSnapshot('B'.repeat(43), data)).toBeNull();
    expect(await decryptSnapshot(KEY, data.slice(0, -8))).toBeNull();
  });

  it('leitet die Kennung stabil und aus dem Schlüssel ab', async () => {
    const id = await shareId(KEY);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(await shareId(KEY)).toBe(id);
    expect(await shareId('B'.repeat(43))).not.toBe(id);
  });

  it('säubert fremde Schnappschüsse', () => {
    expect(sanitizeSnapshot(null)).toBeNull();
    expect(sanitizeSnapshot({ v: 2, name: 'x', avatar: 'y' })).toBeNull();
    const dirty = sanitizeSnapshot({
      v: 1,
      name: 'N'.repeat(100),
      avatar: '🦊',
      at: 'x',
      stamps: [{ gameId: '<b>', kinds: ['win'] }, { gameId: 'chess', kinds: ['win', 'bogus'] }],
      trophies: [{ gameId: 'chess', at: Infinity }],
      favorites: ['skat', '../x'],
    });
    expect(dirty?.name).toHaveLength(30);
    expect(dirty?.at).toBe(0);
    expect(dirty?.stamps).toEqual([{ gameId: 'chess', kinds: ['win'] }]);
    expect(dirty?.trophies).toEqual([]);
    expect(dirty?.favorites).toEqual(['skat']);
  });
});
