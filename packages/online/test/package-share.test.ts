import { describe, expect, it } from 'vitest';
import { PACKAGE_MAX_BYTES, PACKAGE_TTL_MS, authorizePackage, isPackageExpired, packageRecord, validPackageSize } from '../src';

const secret = (c: string) => c.repeat(43).slice(0, 43);
const [OWNER, OTHER] = [secret('o'), secret('x')];

describe('Geteilte Anki-Pakete (#101, L7)', () => {
  it('legt an, ersetzt nur mit dem Schreibgeheimnis und speichert es nie im Klartext', async () => {
    expect(await authorizePackage(null, OWNER)).toBe(200);
    const first = await packageRecord(null, OWNER, 1000, 100);
    expect(JSON.stringify(first)).not.toContain(OWNER);
    expect(first).toMatchObject({ size: 1000, at: 100 });
    expect(await authorizePackage(first, OTHER)).toBe(401);
    expect(await authorizePackage(first, OWNER)).toBe(200);
    const second = await packageRecord(first, OWNER, 2000, 200);
    expect(second).toMatchObject({ size: 2000, at: 200, hash: first.hash });
  });
  it('lehnt unbrauchbare Geheimnisse ab', async () => {
    for (const bad of [undefined, null, '', 'kurz', 42, 'ä'.repeat(43)]) expect(await authorizePackage(null, bad)).toBe(400);
  });
  it('die Frist ist ein Jahr nach dem letzten Zugriff', async () => {
    const record = await packageRecord(null, OWNER, 100, 1000);
    expect(isPackageExpired(record, 1000 + PACKAGE_TTL_MS - 1)).toBe(false);
    expect(isPackageExpired(record, 1000 + PACKAGE_TTL_MS)).toBe(true);
  });
  it('Größen: nicht leer, höchstens 52 MB', () => {
    expect(validPackageSize(0)).toBe(false);
    expect(validPackageSize(28)).toBe(false);
    expect(validPackageSize(29)).toBe(true);
    expect(validPackageSize(PACKAGE_MAX_BYTES)).toBe(true);
    expect(validPackageSize(PACKAGE_MAX_BYTES + 1)).toBe(false);
    expect(validPackageSize(Number.NaN)).toBe(false);
  });
});
