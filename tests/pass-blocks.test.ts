import { describe, expect, it, vi } from 'vitest';

vi.mock('../apps/web/src/lib/playerPass', () => ({ passSyncSoon: () => undefined }));
const { mergeSettings, sanitizeSettings } = await import('../apps/web/src/lib/passBlocks');

describe('Pass-Block „einstellungen“ (#137)', () => {
  it('die jüngere Änderung gewinnt, bei Gleichstand der eigene Stand', () => {
    const a = { favorites: ['chess'], changed: 10 };
    const b = { favorites: ['go'], changed: 20 };
    expect(mergeSettings(b, a)).toBe(b);
    expect(mergeSettings(a, b)).toBe(b);
    expect(mergeSettings({ ...a }, a)).toEqual(a);
  });

  it('bereinigt fremde Daten', () => {
    expect(sanitizeSettings(null)).toEqual({ favorites: [], changed: 0 });
    expect(sanitizeSettings({ favorites: ['chess', 3, '<b>', 'chess'], changed: 'x' })).toEqual({ favorites: ['chess'], changed: 0 });
    expect(sanitizeSettings({ favorites: ['go'], changed: 12.7 })).toEqual({ favorites: ['go'], changed: 12 });
  });
});
