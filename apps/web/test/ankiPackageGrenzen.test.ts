import { APKG_MAX_BYTES, ApkgError } from '@brett-und-blatt/engine';
import { zipSync } from 'fflate';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { importApkg } from '../src/lib/ankiPackage';

// In Node gibt es keine Vite-URL für die WASM-Datei: stattdessen der echte Dateipfad.
vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({ default: createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm') }));

/** Schutzgrenzen beim Anki-Import (#581): Größenlimit, „Zip-Bombe“ und fehlende Sammlung. */
async function fehler(bytes: Uint8Array): Promise<ApkgError> {
  try {
    await importApkg(bytes);
  } catch (error) {
    expect(error).toBeInstanceOf(ApkgError);
    return error as ApkgError;
  }
  throw new Error('Es wurde kein Fehler geworfen.');
}

describe('Anki-Import: Grenzen', () => {
  it('lehnt Pakete über der 50-MB-Grenze ab, bevor ausgepackt wird', async () => {
    const e = await fehler(new Uint8Array(APKG_MAX_BYTES + 1));
    expect(e.code).toBe('tooBig');
    expect(e.message).toBe('Das Paket ist größer als 50 MB.');
  });

  it('lehnt eine Zip-Bombe (entpackt viel zu groß) ab', async () => {
    // 260 MB Nullen packen sich auf wenige hundert KB – weit unter dem Paketlimit, aber über der Entpack-Grenze.
    const bombe = zipSync({ 'collection.anki2': new Uint8Array(260 * 1024 * 1024) }, { level: 1 });
    expect(bombe.length).toBeLessThan(APKG_MAX_BYTES);
    const e = await fehler(bombe);
    expect(e.code).toBe('tooBig');
    expect(e.message).toBe('Das Paket ist entpackt viel zu groß.');
  }, 60_000);

  it('meldet eine fehlende Sammlung', async () => {
    const e = await fehler(zipSync({ media: new TextEncoder().encode('{}') }));
    expect(e.code).toBe('missing');
    expect(e.message).toContain('Im Paket fehlt die Sammlung');
  });
});
