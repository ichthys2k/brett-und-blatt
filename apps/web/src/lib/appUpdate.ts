import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { isNewerBuild, parseBuildInfo } from './buildVersion';
import { isTableRoute } from './tableRoute';

/*
 * Aktualisierung der installierten Web-App (#175). Der Service Worker speichert die App für die Nutzung ohne
 * Internet – dadurch läuft sie sonst auf dem alten Stand weiter, bis jemand sie schließt. Darum:
 *  - regelmäßig und beim Zurückkehren in die App nach einer neuen Version fragen,
 *  - eine bereitstehende Version außerhalb einer Partie sofort anwenden, in einer Partie erst auf Knopfdruck
 *    (Hinweisleiste) oder sobald die Person den Tisch verlässt.
 */
export const APP_VERSION = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
export const APP_TIME = typeof __BUILD_TIME__ === 'number' ? __BUILD_TIME__ : 0;
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

/**
 * Steht wirklich ein jüngerer Build bereit? Fragt `version.json` am Zwischenspeicher vorbei. Ohne Antwort (offline,
 * Datei fehlt) gilt die bereitstehende Version als neu, damit nie eine echte Aktualisierung verloren geht.
 */
async function newerBuildAvailable(): Promise<boolean> {
  if (APP_TIME === 0) return true;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return true;
    const remote = parseBuildInfo(await response.json());
    return remote ? isNewerBuild(remote, { id: APP_VERSION, time: APP_TIME }) : true;
  } catch {
    return true;
  }
}

let verifying = false;

/** Prüft eine bereitstehende Version und meldet sie erst, wenn sie wirklich jünger ist. */
async function announceWaiting(): Promise<void> {
  if (verifying || ready) return;
  verifying = true;
  try {
    if (!(await newerBuildAvailable())) return;
    set(true);
    // Nicht in einer Partie: dann sofort aktualisieren.
    if (!isTableRoute(window.location.hash)) applyUpdateNow();
  } finally {
    verifying = false;
  }
}

/** Fragt jetzt nach einer neuen Version. `true`, wenn eine bereitsteht. */
export async function checkForUpdate(): Promise<boolean> {
  try {
    await registration?.update();
    // Ein Worker, der früher als nicht jünger galt, wird erneut geprüft (der Zwischenspeicher kann inzwischen nachgezogen haben).
    if (!ready && registration?.waiting) await announceWaiting();
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
      void announceWaiting();
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
