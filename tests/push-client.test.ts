import { describe, expect, it } from 'vitest';
import { isIos, loadPushWish, pushAvailability, savePushWish, subscribeMessage, urlBase64ToUint8Array, type PushEnv } from '../apps/web/src/lib/push';

/** Hinweise aufs Gerät, Browser-Seite und Service-Worker-Skript (#242, Schritt 6). */

const KEY = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
const base: PushEnv = { publicKey: KEY, hasServiceWorker: true, hasPushManager: true, hasNotification: true, permission: 'default', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120', maxTouchPoints: 0, platform: 'Linux x86_64', standalone: false };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';

describe('Hinweise aufs Gerät: Verfügbarkeit', () => {
  it('ohne Schlüssel im Build bleibt alles unsichtbar', () => {
    expect(pushAvailability({ ...base, publicKey: null })).toBe('hidden');
    expect(pushAvailability({ ...base, publicKey: null, userAgent: IPHONE })).toBe('hidden');
  });

  it('bietet den Schalter an, wo der Browser es kann', () => {
    expect(pushAvailability(base)).toBe('ready');
    expect(pushAvailability({ ...base, permission: 'granted' })).toBe('ready');
  });

  it('zeigt „gesperrt“, wenn der Browser Hinweise verbietet', () => {
    expect(pushAvailability({ ...base, permission: 'denied' })).toBe('blocked');
  });

  it('versteckt es, wenn Service Worker, Push oder Benachrichtigungen fehlen', () => {
    expect(pushAvailability({ ...base, hasServiceWorker: false })).toBe('hidden');
    expect(pushAvailability({ ...base, hasPushManager: false })).toBe('hidden');
    expect(pushAvailability({ ...base, hasNotification: false })).toBe('hidden');
  });

  it('auf dem iPhone im Safari-Tab: erst zum Home-Bildschirm hinzufügen', () => {
    const phone = { ...base, userAgent: IPHONE, hasPushManager: false };
    expect(isIos(phone)).toBe(true);
    expect(pushAvailability(phone)).toBe('needsInstall');
    expect(pushAvailability({ ...phone, standalone: true, hasPushManager: true })).toBe('ready');
    // iPad im Desktop-Modus meldet sich als Mac, hat aber Touch
    const ipad = { ...base, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5, hasPushManager: false };
    expect(isIos(ipad)).toBe(true);
    expect(pushAvailability(ipad)).toBe('needsInstall');
    expect(isIos({ ...base, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel' })).toBe(false);
  });
});

describe('Hinweise aufs Gerät: Hilfen', () => {
  it('wandelt den Schlüssel von base64url in Bytes', () => {
    const bytes = urlBase64ToUint8Array(KEY);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
    expect(urlBase64ToUint8Array('AQID')).toEqual(new Uint8Array([1, 2, 3]));
    expect(urlBase64ToUint8Array('-_8')).toEqual(new Uint8Array([251, 255]));
  });

  it('merkt sich den Wunsch je Gerät und übersteht gesperrten Speicher', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    expect(loadPushWish(storage)).toBe(false);
    savePushWish(true, storage);
    expect(loadPushWish(storage)).toBe(true);
    savePushWish(false, storage);
    expect(loadPushWish(storage)).toBe(false);
    const broken = { getItem: () => { throw new Error('gesperrt'); }, setItem: () => { throw new Error('gesperrt'); }, removeItem: () => { throw new Error('gesperrt'); } };
    expect(loadPushWish(broken)).toBe(false);
    expect(() => savePushWish(true, broken)).not.toThrow();
    expect(loadPushWish(null)).toBe(false);
  });

  it('macht aus dem Abo die Nachricht für den Server und lehnt Unvollständiges ab', () => {
    const full = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/x', expirationTime: null, keys: { p256dh: 'a', auth: 'b' } }) };
    expect(subscribeMessage(full)).toEqual({ type: 'pushSubscribe', subscription: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'a', auth: 'b' } } });
    expect(subscribeMessage({ toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/x' }) })).toBeNull();
    expect(subscribeMessage({ toJSON: () => ({ keys: { p256dh: 'a', auth: 'b' } }) })).toBeNull();
  });
});

// Ohne Node-Typen: das eingebaute Modul über `process` holen (wie in tests/repo.test.ts).
const fs = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): { readFileSync(path: URL, encoding: 'utf8'): string } } }).process.getBuiltinModule('node:fs');

/** Das echte Skript `push-sw.js` in einer nachgebauten Service-Worker-Umgebung. */
function loadServiceWorker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const focused: string[] = [];
  const navigated: string[] = [];
  let windows: { url: string }[] = [];
  const self = {
    registration: {
      scope: 'https://spiele.lipponer.de/',
      showNotification: (title: string, options: Record<string, unknown>) => (shown.push({ title, options }), Promise.resolve()),
      pushManager: { subscribe: () => Promise.resolve({}) },
    },
    clients: {
      matchAll: () =>
        Promise.resolve(
          windows.map((w) => ({
            url: w.url,
            focus: () => (focused.push(w.url), Promise.resolve({ url: w.url, navigate: (to: string) => (navigated.push(to), Promise.resolve()) })),
          })),
        ),
      openWindow: (url: string) => (opened.push(url), Promise.resolve()),
    },
    addEventListener: (type: string, handler: (event: unknown) => void) => void (handlers[type] = handler),
  };
  new Function('self', fs.readFileSync(new URL('../apps/web/public/push-sw.js', import.meta.url), 'utf8'))(self);
  const waited: Promise<unknown>[] = [];
  const waitUntil = (p: Promise<unknown>) => void waited.push(p);
  return {
    handlers,
    shown,
    opened,
    focused,
    navigated,
    setWindows: (list: { url: string }[]) => (windows = list),
    async push(payload: unknown) {
      handlers.push!({ data: payload === undefined ? null : { json: () => (typeof payload === 'string' && payload === 'KAPUTT' ? JSON.parse('{') : payload) }, waitUntil });
      await Promise.all(waited.splice(0));
    },
    async click(url: string | undefined) {
      const closed = { value: false };
      handlers.notificationclick!({ notification: { close: () => (closed.value = true), data: url === undefined ? undefined : { url } }, waitUntil });
      await Promise.all(waited.splice(0));
      return closed.value;
    },
  };
}

describe('Service-Worker-Skript push-sw.js', () => {
  it('hört auf push, notificationclick und pushsubscriptionchange', () => {
    const sw = loadServiceWorker();
    expect(Object.keys(sw.handlers).sort()).toEqual(['notificationclick', 'push', 'pushsubscriptionchange']);
  });

  it('zeigt je Art den deutschen Text, ohne Namen', async () => {
    const sw = loadServiceWorker();
    const expected: Record<string, string> = {
      matchCalled: 'Deine Turnierpartie ist bereit.',
      deadline: 'Die Frist deiner Partie läuft bald ab.',
      tournamentStarted: 'Das Turnier hat begonnen.',
      tournamentFinished: 'Das Turnier ist beendet.',
      yourTurn: 'Du bist am Zug.',
      boardYes: 'Jemand hat auf deinem Zettel „Bin dabei“ gesagt.',
      boardProposal: 'Ein Vorschlag am Schwarzen Brett wartet auf deine Zusage.',
      boardRoom: 'Dein Raum steht – komm herein!',
    };
    for (const [k, body] of Object.entries(expected)) {
      sw.shown.length = 0;
      await sw.push({ k, u: '#/turnier/ABCD2345' });
      expect(sw.shown).toHaveLength(1);
      expect(sw.shown[0]!.title).toBe('Brett & Blatt');
      expect(sw.shown[0]!.options.body).toBe(body);
      expect(sw.shown[0]!.options.tag).toBe(`${k}#/turnier/ABCD2345`);
      expect(sw.shown[0]!.options.icon).toBe('https://spiele.lipponer.de/icons/icon-192.png');
      expect(sw.shown[0]!.options.data).toEqual({ url: '#/turnier/ABCD2345' });
    }
  });

  it('zeigt bei kaputtem oder fremdem Inhalt trotzdem etwas Neutrales und nimmt kein fremdes Ziel an', async () => {
    const sw = loadServiceWorker();
    await sw.push('KAPUTT');
    await sw.push(undefined);
    await sw.push({ k: 'werbung', u: 'https://evil.example/' });
    await sw.push({ k: 'yourTurn', u: '#/raum/../../etc' });
    await sw.push({ k: '__proto__', u: '#/raum/🐻🐻🐻🐻' });
    expect(sw.shown).toHaveLength(5);
    expect(sw.shown.map((s) => s.options.body)).toEqual(['Es gibt etwas Neues.', 'Es gibt etwas Neues.', 'Es gibt etwas Neues.', 'Du bist am Zug.', 'Es gibt etwas Neues.']);
    expect(sw.shown.map((s) => (s.options.data as { url: string }).url)).toEqual(['', '', '', '', '#/raum/🐻🐻🐻🐻']);
  });

  it('Antippen: öffnet die App am Ziel, oder führt ein offenes Fenster dorthin', async () => {
    const sw = loadServiceWorker();
    expect(await sw.click('#/raum/ABCD')).toBe(true);
    expect(sw.opened).toEqual(['https://spiele.lipponer.de/#/raum/ABCD']);
    sw.opened.length = 0;
    sw.setWindows([{ url: 'https://spiele.lipponer.de/#/' }]);
    await sw.click('#/turnier/ABCD2345');
    expect(sw.opened).toEqual([]);
    expect(sw.focused).toEqual(['https://spiele.lipponer.de/#/']);
    expect(sw.navigated).toEqual(['https://spiele.lipponer.de/#/turnier/ABCD2345']);
    // Fenster einer fremden Seite zählt nicht
    sw.setWindows([{ url: 'https://example.org/' }]);
    await sw.click('#/turnier/ABCD2345');
    expect(sw.opened).toEqual(['https://spiele.lipponer.de/#/turnier/ABCD2345']);
  });

  it('ohne Ziel öffnet es nur die App', async () => {
    const sw = loadServiceWorker();
    await sw.click(undefined);
    expect(sw.opened).toEqual(['https://spiele.lipponer.de/']);
  });
});
