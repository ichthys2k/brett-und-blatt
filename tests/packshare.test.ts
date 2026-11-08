import { describe, expect, it } from 'vitest';
import { openJson, sealJson, shareId } from '../apps/web/src/lib/passShareCore';

const KEY = 'K'.repeat(43);

describe('Pakete teilen (#101)', () => {
  it('verschlüsselt ein Paket und liest es mit dem Schlüssel wieder', async () => {
    const value = { v: 1, pack: { name: 'Vokabeln', rows: [{ id: 'r-000001', a: 'house', b: 'Haus' }] } };
    const data = await sealJson(KEY, value);
    expect(data).not.toContain('Vokabeln');
    expect(await openJson(KEY, data)).toEqual(value);
    expect(await openJson('L'.repeat(43), data)).toBeNull();
  });
  it('leitet die Kennung aus dem Schlüssel ab', async () => {
    expect(await shareId(KEY)).toMatch(/^[0-9a-f]{32}$/);
  });
});
