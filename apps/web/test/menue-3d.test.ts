// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

/** Die bewegte 3D-Taverne im Hauptmenü ist wählbar und standardmäßig aus (Einstellung je Gerät). */
const KEY = 'brett-und-blatt:menue-3d';

async function lade(store: Record<string, string>) {
  vi.resetModules();
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) },
  });
  vi.stubGlobal('document', { documentElement: { dataset: {} }, querySelectorAll: () => [] });
  vi.stubGlobal('Image', class {});
  return import('../src/lib/look');
}

afterEach(() => vi.unstubAllGlobals());

describe('3D-Taverne im Hauptmenü', () => {
  it('ist ohne gespeicherte Wahl aus', async () => {
    const look = await lade({});
    expect(look.menu3dEnabled()).toBe(false);
  });

  it('wird nur durch den Wert „an“ eingeschaltet', async () => {
    expect((await lade({ [KEY]: 'an' })).menu3dEnabled()).toBe(true);
    expect((await lade({ [KEY]: 'aus' })).menu3dEnabled()).toBe(false);
    expect((await lade({ [KEY]: 'true' })).menu3dEnabled()).toBe(false);
  });

  it('speichert die Wahl und gibt sie wieder zurück', async () => {
    const store: Record<string, string> = {};
    const look = await lade(store);
    look.setMenu3d(true);
    expect(store[KEY]).toBe('an');
    expect(look.menu3dEnabled()).toBe(true);
    look.setMenu3d(false);
    expect(store[KEY]).toBe('aus');
    expect(look.menu3dEnabled()).toBe(false);
  });
});
