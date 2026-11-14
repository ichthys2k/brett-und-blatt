/**
 * Hinweise aufs Gerät (Web Push, #242) – Browser-Seite. Der Service Worker steht in `public/push-sw.js`.
 *
 * Ohne öffentlichen VAPID-Schlüssel im Build (`VITE_VAPID_PUBLIC_KEY`) bleibt alles unsichtbar. Berechtigung
 * und Abo gibt es nur auf ausdrücklichen Knopfdruck, nie beim Seitenaufruf.
 */

/** Öffentlicher VAPID-Schlüssel (base64url, 65 Byte); fehlt er, ist die Funktion aus. */
export const PUSH_PUBLIC_KEY: string | null = import.meta.env.VITE_VAPID_PUBLIC_KEY || null;

const STORAGE_KEY = 'brett-und-blatt:push';

/** Was der Browser kann – austauschbar für Tests. */
export interface PushEnv {
  publicKey: string | null;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission | 'unsupported';
  userAgent: string;
  maxTouchPoints: number;
  platform: string;
  standalone: boolean;
}

export function browserEnv(): PushEnv {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { publicKey: PUSH_PUBLIC_KEY, hasServiceWorker: false, hasPushManager: false, hasNotification: false, permission: 'unsupported', userAgent: '', maxTouchPoints: 0, platform: '', standalone: false };
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  let standalone = nav.standalone === true;
  try {
    standalone ||= window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    // Alte Browser ohne matchMedia.
  }
  return {
    publicKey: PUSH_PUBLIC_KEY,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    platform: nav.platform ?? '',
    standalone,
  };
}

/** iPhone, iPad (auch als „Mac“ getarnt) und iPod. */
export function isIos(env: PushEnv): boolean {
  return /iPad|iPhone|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1);
}

/**
 * Was die Oberfläche zeigen soll:
 * - `hidden`: nichts (kein Schlüssel im Build oder der Browser kann es nicht)
 * - `needsInstall`: iPhone/iPad im Safari-Tab – Hinweise gehen nur für die zum Home-Bildschirm hinzugefügte App
 * - `blocked`: der Browser hat Hinweise für diese Seite gesperrt
 * - `ready`: Schalter anbieten
 */
export type PushAvailability = 'hidden' | 'needsInstall' | 'blocked' | 'ready';

export function pushAvailability(env: PushEnv = browserEnv()): PushAvailability {
  if (!env.publicKey) return 'hidden';
  if (isIos(env) && !env.standalone) return 'needsInstall';
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'hidden';
  if (env.permission === 'denied') return 'blocked';
  return 'ready';
}

/** Der Schlüssel für `subscribe`: base64url → Bytes. */
export function urlBase64ToUint8Array(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------
// Wunsch je Gerät

/** Hat dieses Gerät Hinweise eingeschaltet? Nur eine Merkhilfe; maßgeblich ist das Abo im Browser. */
export function loadPushWish(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function savePushWish(on: boolean, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): void {
  try {
    if (on) storage?.setItem(STORAGE_KEY, 'on');
    else storage?.removeItem(STORAGE_KEY);
  } catch {
    // Speicher gesperrt: der Schalter gilt dann nur, solange die Seite offen ist.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Abo

/** Die Nachricht an den Server (Raum und Turnier verstehen dieselbe). */
export interface PushSubscribeMessage {
  type: 'pushSubscribe';
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
}

/** Macht aus dem Abo des Browsers die Nachricht; `null`, wenn etwas fehlt. */
export function subscribeMessage(subscription: PushSubscription | { toJSON(): PushSubscriptionJSON }): PushSubscribeMessage | null {
  const json = subscription.toJSON();
  const { endpoint, keys } = json;
  if (!endpoint || !keys?.p256dh || !keys.auth) return null;
  return { type: 'pushSubscribe', subscription: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } } };
}

export type EnableResult = { ok: true; message: PushSubscribeMessage } | { ok: false; reason: 'unavailable' | 'denied' | 'error' };

/**
 * Schaltet Hinweise ein. **Nur aus einem Knopfdruck aufrufen** (iOS verlangt eine Nutzeraktion).
 * Fragt die Berechtigung an, abonniert und gibt die Nachricht für den Server zurück; senden muss der Aufrufer
 * über die Verbindung, die er gerade hat (Turnier oder Raum).
 */
export async function enablePush(env: PushEnv = browserEnv()): Promise<EnableResult> {
  if (pushAvailability(env) !== 'ready' || !env.publicKey) return { ok: false, reason: 'unavailable' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(env.publicKey) }));
    const message = subscribeMessage(subscription);
    if (!message) return { ok: false, reason: 'error' };
    savePushWish(true);
    return { ok: true, message };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Schaltet Hinweise aus: Abo im Browser beenden. Den Widerruf beim Server (`pushUnsubscribe`) sendet der Aufrufer. */
export async function disablePush(): Promise<void> {
  savePushWish(false);
  try {
    const registration = await navigator.serviceWorker?.ready;
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  } catch {
    // Schon weg oder nicht erreichbar: für den Server genügt der Widerruf.
  }
}

/**
 * Nach dem (Wieder-)Verbinden: Wenn dieses Gerät Hinweise wünscht, das Abo neu melden – Endpunkte können wechseln,
 * und der Server vergisst Abos mit dem Turnier oder Raum. Ohne Wunsch, Berechtigung oder Abo: `null`.
 */
export async function currentSubscribeMessage(env: PushEnv = browserEnv()): Promise<PushSubscribeMessage | null> {
  if (!loadPushWish() || pushAvailability(env) !== 'ready' || env.permission !== 'granted' || !env.publicKey) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(env.publicKey) }));
    return subscribeMessage(subscription);
  } catch {
    return null;
  }
}

/** Ruft `handler`, wenn der Service Worker meldet, dass das Abo erneuert wurde (dann `currentSubscribeMessage` senden). */
export function onPushSubscriptionChange(handler: () => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
  const listener = (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === 'pushsubscriptionchange') handler();
  };
  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}
