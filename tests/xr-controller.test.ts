// @ts-expect-error – three liefert für die Quelldatei keine Typen; sie ist der einzige Weg an den WebXRManager.
import { WebXRManager } from '../apps/xr/node_modules/three/src/renderers/webxr/WebXRManager.js';
import { describe, expect, it } from 'vitest';
import { CONTROLLER_SLOTS, ensureControllers } from '../apps/xr/src/controllers';

// Sitzung ohne Brille: three hängt seine Zuhörer schon vor dem ersten `await` in setSession ein;
// weiter als bis dahin brauchen wir nicht (der Rest der Einrichtung scheitert am Nachbau und wird verworfen).
function startSession(xr: WebXRManager) {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const session = {
    inputSources: [] as unknown[],
    addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] ??= []).push(fn),
    removeEventListener: () => {},
  };
  void xr.setSession(session as never).catch(() => {});
  return (added: unknown[]) => listeners.inputsourceschange?.forEach((fn) => fn({ added, removed: [] }));
}

function newManager() {
  const gl = { getContextAttributes: () => ({ xrCompatible: true }) };
  const renderer = { getRenderTarget: () => null };
  return new WebXRManager(renderer as never, gl as never);
}

function connectedSources(xr: WebXRManager, slots: number) {
  const seen: unknown[] = [];
  for (let i = 0; i < slots; i++) xr.getController(i).addEventListener('connected', (e: unknown) => seen.push((e as { data: unknown }).data));
  return seen;
}

describe('Controller-Gruppen ab dem ersten Bild (#586)', () => {
  const left = { handedness: 'left', targetRaySpace: {}, gripSpace: {}, gamepad: null };
  const right = { handedness: 'right', targetRaySpace: {}, gripSpace: {}, gamepad: null };

  it('Fehlerbild: Gruppen, die erst nach dem Ereignis angelegt werden, bekommen keine Eingabequelle', () => {
    const xr = newManager();
    const fire = startSession(xr);
    fire([left, right]);
    const seen = connectedSources(xr, 2);
    expect(seen).toHaveLength(0);
  });

  it('vorab angelegte Gruppen bekommen beide Eingabequellen zugewiesen', () => {
    const xr = newManager();
    expect(ensureControllers(xr)).toBe(CONTROLLER_SLOTS);
    const seen = connectedSources(xr, 2);
    const fire = startSession(xr);
    fire([left, right]);
    expect(seen).toEqual([left, right]);
  });

  it('ist idempotent: dieselben Gruppen bei jedem Aufruf', () => {
    const xr = newManager();
    ensureControllers(xr);
    const first = xr.getController(1);
    ensureControllers(xr);
    expect(xr.getController(1)).toBe(first);
  });
});
