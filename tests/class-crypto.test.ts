import { describe, expect, it } from 'vitest';
import { generateLeadKeys, openProgress, sealProgress } from '../apps/web/src/lib/classCrypto';

describe('Lernstand für die Leitung (verschlüsselt)', () => {
  it('nur die Leitung öffnet den Stand; jede Leitung mit ihrem eigenen Schlüssel', async () => {
    const [a, b, stranger] = await Promise.all([generateLeadKeys(), generateLeadKeys(), generateLeadKeys()]);
    expect(a.pub).toMatch(/^[A-Za-z0-9_-]{86,90}$/);
    const payload = { v: 1, at: 5, packs: [{ id: 'p1', cards: 40, weak: Array.from({ length: 200 }, (_, i) => [`g${i}`, 2, i, 1, 10])}] };
    const blob = await sealProgress(payload, [{ id: 'leadA', key: a.pub }, { id: 'leadB', key: b.pub }]);
    expect(blob).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(blob.length).toBeLessThan(60_000);
    expect(blob).not.toContain('Frage');
    expect(await openProgress(blob, 'leadA', a.priv)).toEqual(payload);
    expect(await openProgress(blob, 'leadB', b.priv)).toEqual(payload);
    // falscher Schlüssel, falsche Kennung, Fremde
    expect(await openProgress(blob, 'leadA', b.priv)).toBeNull();
    expect(await openProgress(blob, 'leadB', stranger.priv)).toBeNull();
    expect(await openProgress(blob, 'leadC', a.priv)).toBeNull();
    // beschädigt
    expect(await openProgress(blob.slice(0, -40) + 'A'.repeat(40), 'leadA', a.priv)).toBeNull();
    expect(await openProgress('kein Stand', 'leadA', a.priv)).toBeNull();
  });
  it('ohne Leitung wird nichts verschickt', async () => {
    await expect(sealProgress({}, [])).rejects.toThrow();
  });
});
