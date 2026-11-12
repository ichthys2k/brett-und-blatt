import { describe, expect, it } from 'vitest';
import { parseClientMessage, parseTournamentMessage } from '../src';

function b64(n: number): string {
  return btoa(String.fromCharCode(...new Uint8Array(n).fill(9))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: b64(65), auth: b64(16) } };

describe.each([
  ['Raum', parseClientMessage],
  ['Turnier', parseTournamentMessage],
] as const)('Web Push im Protokoll: %s (#242)', (_name, parse) => {
  it('liest ein gültiges Abo', () => {
    const msg = parse(JSON.stringify({ type: 'pushSubscribe', subscription: { ...subscription, expirationTime: null, extra: 1 } }));
    expect(msg).toEqual({ type: 'pushSubscribe', subscription });
  });

  it('lehnt fremde Hosts, kaputte Schlüssel und fehlende Angaben ab', () => {
    const bad = [
      { endpoint: 'https://evil.example/x', keys: subscription.keys },
      { endpoint: 'http://fcm.googleapis.com/x', keys: subscription.keys },
      { endpoint: subscription.endpoint, keys: { p256dh: b64(10), auth: b64(16) } },
      { endpoint: subscription.endpoint },
      'text',
      null,
    ];
    for (const sub of bad) expect(parse(JSON.stringify({ type: 'pushSubscribe', subscription: sub })), JSON.stringify(sub)).toBeNull();
    expect(parse(JSON.stringify({ type: 'pushSubscribe' }))).toBeNull();
  });

  it('erlaubt Loopback nur mit der Testserver-Ausnahme', () => {
    const local = { endpoint: 'http://127.0.0.1:9000/push', keys: subscription.keys };
    const raw = JSON.stringify({ type: 'pushSubscribe', subscription: local });
    expect(parse(raw)).toBeNull();
    expect(parse(raw, { allowLocal: true })).toEqual({ type: 'pushSubscribe', subscription: local });
  });

  it('liest den Widerruf', () => {
    expect(parse(JSON.stringify({ type: 'pushUnsubscribe' }))).toEqual({ type: 'pushUnsubscribe' });
  });
});
