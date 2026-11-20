import { describe, expect, it, vi } from 'vitest';
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

describe('Stufe teilen (#573)', () => {
  it('der Schnappschuss trägt nur eine gültige Stufenzahl', async () => {
    const data = await encryptSnapshot(KEY, { ...SNAP, level: 2 });
    expect((await decryptSnapshot(KEY, data))?.level).toBe(2);
    expect(sanitizeSnapshot({ v: 1, name: 'x', avatar: 'y', level: 'Meister' })?.level).toBeUndefined();
    expect(sanitizeSnapshot({ v: 1, name: 'x', avatar: 'y', level: 2.5 })?.level).toBeUndefined();
    expect(sanitizeSnapshot({ v: 1, name: 'x', avatar: 'y', level: -1 })?.level).toBeUndefined();
    expect(sanitizeSnapshot({ v: 1, name: 'x', avatar: 'y', level: 99 })?.level).toBeUndefined();
    expect(sanitizeSnapshot(SNAP)?.level).toBeUndefined();
  });

  it('Auswahlzeile „Stufe“ ist da, gehört aber nicht zur Vorgabe', async () => {
    const { SHARE_SECTIONS, SHARE_LABEL } = await import('../apps/web/src/lib/passShareCore');
    expect(SHARE_SECTIONS).toContain('level');
    expect(SHARE_LABEL.level).toBe('Stufe und Titel');
  });
});

describe('buildSnapshot mit Stufe (#573)', () => {
  const state = { guest: false, hidden: false };
  vi.resetModules();
  vi.doMock('../apps/web/src/lib/storage', () => ({ storage: { loadProfile: () => ({ name: 'Mia', avatar: '🦊' }) } }));
  vi.doMock('../apps/web/src/lib/passes', () => ({ passBook: { activeIsGuest: () => state.guest } }));
  vi.doMock('../apps/web/src/lib/rewards', () => ({
    rewardsHidden: () => state.hidden,
    // Zähler für Stufe 2 (Zunftmitglied)
    currentProgress: () => ({ rated: 40, ratedGames: 8, beatMediumGames: 1, beatHardGames: 0, categoriesComplete: 0, humanRated: 5, learnDays: 0 }),
  }));
  vi.doMock('../apps/web/src/lib/chronikStore', () => ({ loadBook: () => ({ counts: {} }) }));
  vi.doMock('../apps/web/src/lib/crestStore', () => ({ currentCrest: () => ({}), hasCrest: () => false, onCrestSaved: () => undefined }));
  vi.doMock('../apps/web/src/lib/stamps', () => ({ stampsFor: () => [], STAMP_KINDS: ['first', 'win'] }));
  vi.doMock('../apps/web/src/lib/server', () => ({ GAME_SERVER: '' }));
  const load = async () => (await import('../apps/web/src/lib/passShare')).buildSnapshot;

  it('ohne Wahl keine Stufe, mit Wahl Stufe 2', async () => {
    const build = await load();
    expect(build(['stamps'])?.level).toBeUndefined();
    expect(build(['level'])?.level).toBe(2);
  });

  it('bei Gast-Pass oder „Belohnungen nicht anzeigen“ nie, auch nicht auf Wunsch', async () => {
    const build = await load();
    state.guest = true;
    expect(build(['level'])?.level).toBeUndefined();
    state.guest = false;
    state.hidden = true;
    expect(build(['level'])?.level).toBeUndefined();
    state.hidden = false;
  });
});
