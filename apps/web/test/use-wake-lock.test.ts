import { describe, expect, it, vi } from 'vitest';
import { startWakeLock, type WakeLockDocument, type WakeLockLike, type WakeLockNavigator } from '../src/lib/useWakeLock';

function fakeDocument(initialState: 'visible' | 'hidden' = 'visible') {
  let visibilityState = initialState;
  const listeners = new Set<() => void>();
  const doc: WakeLockDocument = {
    get visibilityState() {
      return visibilityState;
    },
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
  };
  return {
    doc,
    setVisibility(next: 'visible' | 'hidden') {
      visibilityState = next;
      listeners.forEach((fn) => fn());
    },
  };
}

function fakeSentinel(): WakeLockLike & { triggerRelease: () => void } {
  let released = false;
  const listeners = new Set<() => void>();
  return {
    get released() {
      return released;
    },
    release: vi.fn(async () => {
      released = true;
    }),
    addEventListener: (_type, fn) => listeners.add(fn),
    triggerRelease() {
      released = true;
      listeners.forEach((fn) => fn());
    },
  };
}

describe('Screen Wake Lock (useWakeLock / startWakeLock)', () => {
  it('fordert eine Sperre an und gibt sie beim Aufräumen frei', async () => {
    const { doc } = fakeDocument('visible');
    const sentinel = fakeSentinel();
    const request = vi.fn(async () => sentinel);
    const stop = startWakeLock(doc, { wakeLock: { request } });

    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');

    stop();
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('fordert bei Tab-Rückkehr neu an, wenn der Browser die Sperre gelöst hat', async () => {
    const { doc, setVisibility } = fakeDocument('visible');
    const first = fakeSentinel();
    const second = fakeSentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const stop = startWakeLock(doc, { wakeLock: { request } });
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);

    // Browser wechselt in den Hintergrund und löst den Wake Lock.
    setVisibility('hidden');
    first.triggerRelease();

    // Rückkehr in den Tab fordert neu an.
    setVisibility('visible');
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);

    stop();
    expect(second.release).toHaveBeenCalledTimes(1);
  });

  it('gibt eine verspätet aufgelöste Sperre nach Cleanup sofort wieder frei', async () => {
    const { doc } = fakeDocument('visible');
    const sentinel = fakeSentinel();
    let resolveLock!: (lock: WakeLockLike) => void;
    const request = vi.fn(
      () =>
        new Promise<WakeLockLike>((resolve) => {
          resolveLock = resolve;
        }),
    );

    const stop = startWakeLock(doc, { wakeLock: { request } });
    stop();

    resolveLock(sentinel);
    await Promise.resolve();
    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('ignoriert fehlende API und abgelehnte Anfragen still', async () => {
    const { doc } = fakeDocument('visible');
    const stopNoApi = startWakeLock(doc, {} as WakeLockNavigator);
    expect(() => stopNoApi()).not.toThrow();

    const request = vi.fn(async () => {
      throw new Error('NotAllowedError');
    });
    const stopRejected = startWakeLock(doc, { wakeLock: { request } });
    await Promise.resolve();
    expect(() => stopRejected()).not.toThrow();
  });
});
