import { describe, expect, it } from 'vitest';
import { PACK_PAIRS_MIN, PACK_PLAY_MAX, decodePairsOption, encodePairsOption, mergeLibrary, packProblem, parsePackText, sameLibrary, sanitizeLibrary, sanitizePack, type UserPack } from '../src/packs';

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r-${String(i).padStart(6, '0')}`, a: `A${i}`, b: `B${i}` }));
const pack = (over: Partial<UserPack> = {}): UserPack => ({ id: 'p-12345678', name: 'Vokabeln', rows: rows(8), at: 1, ...over });

describe('Eigene Pakete (#101)', () => {
  it('liest Zeilen mit Tab oder Semikolon, überspringt Kaputtes', () => {
    const { rows: parsed, skipped } = parsePackText('house;Haus\ndog\tHund\n\n# Kommentar\nnur eins\n;leer\ncat ; Katze ');
    expect(parsed).toEqual([{ a: 'house', b: 'Haus' }, { a: 'dog', b: 'Hund' }, { a: 'cat', b: 'Katze' }]);
    expect(skipped).toBe(2);
  });
  it('prüft Pakete und behält feste Kennungen', () => {
    const clean = sanitizePack({ ...pack(), rows: [{ id: 'r-abcdef', a: 'x', b: 'y' }, { a: 'ohne', b: 'Kennung' }, { a: 'nur a' }] });
    expect(clean?.rows).toHaveLength(2);
    expect(clean?.rows[0]?.id).toBe('r-abcdef');
    expect(clean?.rows[1]?.id).toMatch(/^r-[0-9a-f]{6}$/);
    expect(sanitizePack({ id: 'kaputt', name: 'x', rows: [] })).toBeNull();
    expect(sanitizePack({ ...pack(), name: '   ' })).toBeNull();
  });
  it('verlangt Mindestzahl an Paaren', () => {
    expect(packProblem(pack({ rows: rows(PACK_PAIRS_MIN - 1) }))).toEqual(expect.any(String));
    expect(packProblem(pack({ rows: rows(PACK_PAIRS_MIN) }))).toBeNull();
  });
  it('führt zusammen: jüngere Änderung gewinnt, Löschvermerke zählen', () => {
    const merged = mergeLibrary([pack({ name: 'alt', at: 1 })], [pack({ name: 'neu', at: 5 }), pack({ id: 'p-aaaaaaaa', name: 'Zweites', at: 2 })]);
    expect(merged.find((p) => p.id === 'p-12345678')?.name).toBe('neu');
    const withDelete = mergeLibrary(merged, [{ id: 'p-12345678', name: '', rows: [], at: 9, deleted: true }], 10);
    expect(withDelete.find((p) => p.id === 'p-12345678')?.deleted).toBe(true);
    expect(sameLibrary(merged, [...merged].reverse())).toBe(true);
    expect(sanitizeLibrary([pack(), pack(), { id: 'x' }])).toHaveLength(1);
  });
  it('macht aus einem Paket den Wert der Option und liest ihn wieder', () => {
    const value = encodePairsOption(pack({ rows: rows(30) }), (n) => n - 1);
    const decoded = decodePairsOption(value);
    expect(decoded?.name).toBe('Vokabeln');
    expect(decoded?.pairs).toHaveLength(PACK_PLAY_MAX);
  });
  it('lehnt unbrauchbare Optionswerte ab', () => {
    expect(decodePairsOption('')).toBeNull();
    expect(decodePairsOption('{"n":"x","p":[["a","b"]]}')).toBeNull();
    expect(decodePairsOption('kein json')).toBeNull();
    expect(decodePairsOption('x'.repeat(7000))).toBeNull();
  });
});
