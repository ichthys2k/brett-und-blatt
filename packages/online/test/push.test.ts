import { describe, expect, it } from 'vitest';
import {
  PUSH_BOOK_MAX,
  PUSH_LIMIT_MS,
  PushBook,
  PushLimiter,
  isPushKind,
  parsePushSubscription,
  pushPayload,
} from '../src';

/** base64url aus `n` Byte (feste Füllung). */
function b64(n: number): string {
  const bytes = new Uint8Array(n).fill(7);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const KEYS = { p256dh: b64(65), auth: b64(16) };
const sub = (endpoint: string, keys = KEYS) => ({ endpoint, keys });
const FCM = 'https://fcm.googleapis.com/fcm/send/abc123';

describe('Web Push: Abo-Prüfung (#242)', () => {
  it('nimmt Abos der bekannten Push-Dienste an', () => {
    for (const endpoint of [
      FCM,
      'https://updates.push.services.mozilla.com/wpush/v2/xyz',
      'https://eu.push.services.mozilla.com/x',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
      'https://web.push.apple.com/QWERTY',
      'https://api.sandbox.push.apple.com/3/device/x',
    ]) {
      expect(parsePushSubscription(sub(endpoint)), endpoint).not.toBeNull();
    }
  });

  it('lehnt fremde Hosts, http und Tricks ab (SSRF)', () => {
    for (const endpoint of [
      'http://fcm.googleapis.com/x',
      'https://evil.example/x',
      'https://fcm.googleapis.com.evil.example/x',
      'https://evilfcm.googleapis.com/x',
      'https://push.apple.com/x',
      'https://notify.windows.com/x',
      'https://fcm.googleapis.com@evil.example/x',
      'https://user:pw@fcm.googleapis.com/x',
      'https://fcm.googleapis.com:8443/x',
      'https://fcm.googleapis.com/x#frag',
      'https://127.0.0.1/x',
      'https://localhost/x',
      'ftp://fcm.googleapis.com/x',
      'kein url',
      '',
    ]) {
      expect(parsePushSubscription(sub(endpoint)), endpoint).toBeNull();
    }
  });

  it('lehnt zu lange Adressen ab', () => {
    expect(parsePushSubscription(sub(`${FCM}/${'a'.repeat(600)}`))).toBeNull();
  });

  it('lehnt falsche Schlüssel und Formen ab', () => {
    expect(parsePushSubscription(sub(FCM, { p256dh: b64(64), auth: KEYS.auth }))).toBeNull();
    expect(parsePushSubscription(sub(FCM, { p256dh: KEYS.p256dh, auth: b64(15) }))).toBeNull();
    expect(parsePushSubscription(sub(FCM, { p256dh: 'ä'.repeat(87), auth: KEYS.auth }))).toBeNull();
    expect(parsePushSubscription(sub(FCM, { p256dh: `${KEYS.p256dh}=`, auth: KEYS.auth }))).toBeNull();
    expect(parsePushSubscription(null)).toBeNull();
    expect(parsePushSubscription('x')).toBeNull();
    expect(parsePushSubscription({ endpoint: FCM })).toBeNull();
    expect(parsePushSubscription({ endpoint: 5, keys: KEYS })).toBeNull();
  });

  it('gibt nur die bekannten Felder weiter', () => {
    const parsed = parsePushSubscription({ ...sub(FCM), expirationTime: null, extra: 'x' });
    expect(parsed).toEqual(sub(FCM));
  });

  it('lässt Loopback nur mit der Testserver-Ausnahme zu', () => {
    const local = 'http://127.0.0.1:9999/push/1';
    expect(parsePushSubscription(sub(local))).toBeNull();
    expect(parsePushSubscription(sub(local), { allowLocal: true })).not.toBeNull();
    expect(parsePushSubscription(sub('http://localhost:9/x'), { allowLocal: true })).not.toBeNull();
    // auch mit Ausnahme keine fremden Hosts über http
    expect(parsePushSubscription(sub('http://evil.example/x'), { allowLocal: true })).toBeNull();
  });
});

describe('Web Push: Abo-Buch (#242)', () => {
  const a = sub(FCM);
  const b = sub('https://web.push.apple.com/b');

  it('hält höchstens ein Abo je Kennung und überschreibt', () => {
    const book = new PushBook();
    expect(book.set('t1', a, 1)).toBe(true);
    expect(book.set('t1', b, 2)).toBe(true);
    expect(book.size).toBe(1);
    expect(book.get('t1')).toEqual(b);
    expect(book.get('t2')).toBeNull();
  });

  it('begrenzt die Zahl der Abos, ersetzt aber vorhandene auch im vollen Buch', () => {
    const book = new PushBook();
    for (let i = 0; i < PUSH_BOOK_MAX; i += 1) expect(book.set(`t${i}`, a, i)).toBe(true);
    expect(book.set('neu', a, 1)).toBe(false);
    expect(book.set('t0', b, 5)).toBe(true);
    expect(book.size).toBe(PUSH_BOOK_MAX);
  });

  it('entfernt nach Kennung und nach Endpunkt', () => {
    const book = new PushBook();
    book.set('t1', a, 1);
    book.set('t2', a, 1);
    book.set('t3', b, 1);
    expect(book.remove('t3')).toBe(true);
    expect(book.remove('t3')).toBe(false);
    expect(book.removeByEndpoint(FCM)).toBe(2);
    expect(book.size).toBe(0);
  });

  it('räumt alte Abos auf', () => {
    const book = new PushBook();
    book.set('alt', a, 0);
    book.set('neu', b, 900);
    expect(book.prune(500, 1000)).toBe(1);
    expect(book.has('alt')).toBe(false);
    expect(book.has('neu')).toBe(true);
  });

  it('übersteht den Rundlauf durch den Speicher und verwirft Kaputtes', () => {
    const book = new PushBook();
    book.set('t1', a, 10);
    book.set('t2', b, 20);
    const json = JSON.parse(JSON.stringify(book.toJSON()));
    json.push({ token: 'x', sub: { endpoint: 'https://evil.example/x', keys: KEYS }, at: 1 });
    json.push({ token: '', sub: a, at: 1 }, 'müll', null);
    const restored = PushBook.fromJSON(json);
    expect(restored.toJSON()).toEqual(book.toJSON());
    expect(PushBook.fromJSON('kaputt').size).toBe(0);
  });
});

describe('Web Push: Spam-Schutz (#242)', () => {
  it('lässt je Kennung und Art nur eine Meldung je 30 Minuten zu', () => {
    const limiter = new PushLimiter();
    expect(limiter.allow('t1', 'matchCalled', 0)).toBe(true);
    expect(limiter.allow('t1', 'matchCalled', 1000)).toBe(false);
    expect(limiter.allow('t1', 'deadline', 1000)).toBe(true);
    expect(limiter.allow('t2', 'matchCalled', 1000)).toBe(true);
    expect(limiter.allow('t1', 'matchCalled', PUSH_LIMIT_MS - 1)).toBe(false);
    expect(limiter.allow('t1', 'matchCalled', PUSH_LIMIT_MS)).toBe(true);
  });

  it('ein abgelehnter Versuch verlängert die Sperre nicht', () => {
    const limiter = new PushLimiter();
    limiter.allow('t1', 'yourTurn', 0);
    limiter.allow('t1', 'yourTurn', PUSH_LIMIT_MS - 1);
    expect(limiter.allow('t1', 'yourTurn', PUSH_LIMIT_MS)).toBe(true);
  });

  it('übersteht den Rundlauf durch den Speicher', () => {
    const limiter = new PushLimiter();
    limiter.allow('t1', 'yourTurn', 100);
    const restored = PushLimiter.fromJSON(JSON.parse(JSON.stringify(limiter.toJSON())));
    expect(restored.allow('t1', 'yourTurn', 200)).toBe(false);
    expect(restored.allow('t1', 'yourTurn', 100 + PUSH_LIMIT_MS)).toBe(true);
    expect(PushLimiter.fromJSON(42).allow('t', 'yourTurn', 0)).toBe(true);
  });
});

describe('Web Push: Inhalt (#242)', () => {
  it('trägt nur Art und Ziel', () => {
    expect(JSON.parse(pushPayload('matchCalled', '#/turnier/🐻🐻🐻🐻'))).toEqual({
      k: 'matchCalled',
      u: '#/turnier/🐻🐻🐻🐻',
    });
  });

  it('kennt die Meldungsarten', () => {
    expect(isPushKind('yourTurn')).toBe(true);
    expect(isPushKind('werbung')).toBe(false);
    expect(isPushKind(3)).toBe(false);
  });
});
