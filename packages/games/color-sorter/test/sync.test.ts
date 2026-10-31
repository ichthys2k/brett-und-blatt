import { describe, expect, it } from 'vitest';
import { mergeProgress, sanitize, type Progress } from '../src/ui/progress';
import { CODE_LENGTH, deriveKeys, formatCode, keysFromCode, open, parseCode, randomCode, seal } from '../src/ui/syncCrypto';

/** Ein Stand mit Zählerbuch; `sanitize` rechnet Glöckchen, Läufe und Siege daraus aus. */
function progress(ledger: Progress['ledger'], extra: Record<string, unknown> = {}): Progress {
  return sanitize({ ledger, ...extra });
}

describe('Narrenhof-Sicherung: Zusammenführen', () => {
  const a = progress(
    { geraetA: { earned: 100, spent: 30, runs: 4, wins: 1 } },
    { unlocked: ['mod:herald'], done: ['erster-sieg'], awarded: ['k1/0'], stats: { bestLevel: 5, bestHand: 900 }, album: { mod: ['herald'] } },
  );
  const b = progress(
    { geraetA: { earned: 60, spent: 30, runs: 2, wins: 0 }, geraetB: { earned: 40, spent: 25, runs: 2, wins: 1 } },
    { unlocked: ['mod:collector'], awarded: ['k2/0'], stats: { bestLevel: 7, bestHand: 400 }, album: { mod: ['collector'] } },
  );

  it('zählt jedes Gerät einmal und vereinigt Freischaltungen', () => {
    const m = mergeProgress(a, b);
    expect(m.ledger).toEqual({ geraetA: { earned: 100, spent: 30, runs: 4, wins: 1 }, geraetB: { earned: 40, spent: 25, runs: 2, wins: 1 } });
    expect(m.drops).toBe(140 - 55);
    expect(m.earned).toBe(140);
    expect(m.stats).toEqual({ runs: 6, wins: 2, bestLevel: 7, bestHand: 900 });
    expect(m.unlocked.sort()).toEqual(['mod:collector', 'mod:herald']);
    expect(m.awarded.sort()).toEqual(['k1/0', 'k2/0']);
    expect(m.album.mod.sort()).toEqual(['collector', 'herald']);
  });

  it('ist vertauschbar und mehrfach anwendbar ohne Änderung', () => {
    const ab = mergeProgress(a, b);
    const ba = mergeProgress(b, a);
    expect(ba.drops).toBe(ab.drops);
    expect(ba.ledger).toEqual(ab.ledger);
    expect(mergeProgress(ab, b)).toEqual(ab);
    expect(mergeProgress(ab, ab)).toEqual(ab);
  });

  it('nimmt den Schmuck der jüngsten Wahl', () => {
    const unlocked = ['theme:forest', 'back:wave'];
    const x = progress({}, { unlocked, theme: 'forest', styledAt: 10 });
    const y = progress({}, { unlocked, back: 'wave', styledAt: 20 });
    expect(mergeProgress(x, y)).toMatchObject({ back: 'wave', theme: 'workshop', styledAt: 20 });
    expect(mergeProgress(y, x)).toMatchObject({ back: 'wave', theme: 'workshop', styledAt: 20 });
  });

  it('übernimmt alte Stände ohne Zählerbuch', () => {
    const old = sanitize({ version: 1, drops: 50, earned: 80, stats: { runs: 3, wins: 1, bestLevel: 4, bestHand: 10 } });
    expect(old.drops).toBe(50);
    expect(old.earned).toBe(80);
    expect(old.stats.runs).toBe(3);
    expect(Object.keys(old.ledger)).toHaveLength(1);
    // Ein zweites Lesen desselben Stands ergibt dieselbe Zeile (keine doppelte Zählung beim Abgleich).
    expect(mergeProgress(old, sanitize(JSON.parse(JSON.stringify(old)))).drops).toBe(50);
  });

  it('wird nie negativ, wenn zwei Geräte gleichzeitig ausgeben', () => {
    const p = progress({ a: { earned: 10, spent: 10, runs: 0, wins: 0 }, b: { earned: 0, spent: 10, runs: 0, wins: 0 } });
    expect(p.drops).toBe(0);
  });
});

describe('Narrenhof-Sicherung: Code und Verschlüsselung', () => {
  it('erzeugt und liest Codes', () => {
    const code = randomCode();
    expect(code).toHaveLength(CODE_LENGTH);
    expect(parseCode(formatCode(code).toLowerCase())).toBe(code);
    expect(parseCode(`https://spiele.lipponer.de/#/neu/color-sorter?sicherung=${code}`)).toBe(code);
    expect(parseCode('ABCD-EFGH-JKLM-NPQ0')).toBeNull();
    expect(parseCode('zu kurz')).toBeNull();
  });

  it('verschlüsselt so, dass nur der richtige Code öffnet', async () => {
    const keys = await keysFromCode('ABCDEFGHJKLMNPQR');
    expect(keys.id).toMatch(/^[0-9a-f]{32}$/);
    expect((await keysFromCode('ABCDEFGHJKLMNPQR')).id).toBe(keys.id);
    const data = await seal(keys, { v: 1, progress: { drops: 7 } });
    expect(data).not.toContain('drops');
    expect(await open(keys, data)).toEqual({ v: 1, progress: { drops: 7 } });
    await expect(open(await keysFromCode('ABCDEFGHJKLMNPQS'), data)).rejects.toThrow();
  });

  it('trennt Code und Passkey-Schloss', async () => {
    const secret = new TextEncoder().encode('ABCDEFGHJKLMNPQR');
    expect((await deriveKeys(secret, 'passkey')).id).not.toBe((await deriveKeys(secret, 'code')).id);
  });
});
