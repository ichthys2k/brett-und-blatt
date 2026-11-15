import { useEffect } from 'react';

export interface WakeLockLike {
  readonly released?: boolean;
  release(): Promise<void>;
  addEventListener?: (type: 'release', listener: () => void, options?: { once?: boolean }) => void;
}

export interface WakeLockNavigator {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockLike>;
  };
}

export interface WakeLockDocument {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/**
 * Fordert eine Screen-Wake-Lock-Sperre an und hält sie bei Tab-Wechseln aktiv,
 * bis die zurückgegebene Aufräumfunktion aufgerufen wird.
 */
export function startWakeLock(
  doc: WakeLockDocument = document,
  nav: WakeLockNavigator = navigator as unknown as WakeLockNavigator,
): () => void {
  const api = nav.wakeLock;
  if (!api?.request) return () => {};

  let cancelled = false;
  let sentinel: WakeLockLike | null = null;

  const acquire = () => {
    if (cancelled || doc.visibilityState !== 'visible') return;
    if (sentinel && !sentinel.released) return;
    api
      .request('screen')
      .then((lock) => {
        if (cancelled) {
          void lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        lock.addEventListener?.(
          'release',
          () => {
            if (sentinel === lock) sentinel = null;
          },
          { once: true },
        );
      })
      .catch(() => {});
  };

  acquire();

  const onVisibilityChange = () => {
    if (doc.visibilityState === 'visible') acquire();
  };
  doc.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    cancelled = true;
    doc.removeEventListener('visibilitychange', onVisibilityChange);
    const current = sentinel;
    sentinel = null;
    if (current && !current.released) void current.release().catch(() => {});
  };
}

/**
 * Hält den Bildschirm auf Mobilgeräten (und unterstützten Desktop-Browsern) wach,
 * solange `active` wahr ist.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return startWakeLock();
  }, [active]);
}
