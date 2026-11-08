import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { isTableRoute } from './tableRoute';

/*
 * Aktualisierung der installierten Web-App (#175). Der Service Worker speichert die App für die Nutzung ohne
 * Internet – dadurch läuft sie sonst auf dem alten Stand weiter, bis jemand sie schließt. Darum:
 *  - regelmäßig und beim Zurückkehren in die App nach einer neuen Version fragen,
 *  - eine bereitstehende Version außerhalb einer Partie sofort anwenden, in einer Partie erst auf Knopfdruck
 *    (Hinweisleiste) oder sobald die Person den Tisch verlässt.
 */
export const APP_VERSION = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
export const APP_DATE = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : '';

/** So oft fragt eine offene App nach einer neuen Version. */
export const UPDATE_CHECK_MS = 30 * 60 * 1000;

let ready = false;
let registration: ServiceWorkerRegistration | undefined;
let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined;
const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (ready === next) return;
  ready = next;
  for (const listener of listeners) listener();
}

/** Lädt neu und nimmt dabei eine wartende Version mit (Hinweis „bitte neu laden“ bei veraltetem Client). */
export function reloadForUpdate(): void {
  if (ready) applyUpdateNow();
  else window.location.reload();
}

/** Wendet eine bereitstehende Version an (lädt die Seite neu). */
export function applyUpdateNow(): void {
  void applyUpdate?.(true);
}

/** Fragt jetzt nach einer neuen Version. `true`, wenn eine bereitsteht. */
export async function checkForUpdate(): Promise<boolean> {
  try {
    await registration?.update();
  } catch {
    // offline – dann eben später
  }
  return ready;
}

/** Löscht den Zwischenspeicher der App und lädt sie neu – Notlösung, wenn sie sich nicht aktualisiert. */
export async function resetApp(): Promise<void> {
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(registrations.map((r) => r.unregister()));
    const names = (await window.caches?.keys()) ?? [];
    await Promise.all(names.map((name) => window.caches.delete(name)));
  } catch {
    // trotzdem neu laden
  }
  window.location.reload();
}

export function useUpdateReady(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => ready,
  );
}

/** Einmal beim Start der App aufrufen. */
export function startAppUpdates(): void {
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      set(true);
      // Nicht in einer Partie: dann sofort aktualisieren.
      if (!isTableRoute(window.location.hash)) applyUpdateNow();
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
      if (reg) window.setInterval(() => void checkForUpdate(), UPDATE_CHECK_MS);
    },
  });
  // Wer die App wieder öffnet oder online geht, bekommt gleich die neue Version.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void checkForUpdate();
  });
  window.addEventListener('online', () => void checkForUpdate());
  // Verlässt jemand den Tisch, wird eine wartende Version angewendet.
  window.addEventListener('hashchange', () => {
    if (ready && !isTableRoute(window.location.hash)) applyUpdateNow();
  });
}
