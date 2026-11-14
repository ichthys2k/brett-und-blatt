import { describe, expect, it } from 'vitest';
import {
  base64urlDecode,
  base64urlEncode,
  createPushSender,
  encryptPushPayload,
  vapidAuthorization,
  PUSH_PAYLOAD_MAX_BYTES,
  type PushSubscriptionData,
} from '../src';

// Beispiel aus RFC 8291, Abschnitt 5 (und Anhang A)
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  authSecret: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

async function newKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { publicKey: base64urlEncode(raw), privateKey: jwk.d as string, verifyKey: pair.publicKey };
}

async function newSubscription(endpoint: string): Promise<{ sub: PushSubscriptionData; privateKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { sub: { endpoint, keys: { p256dh: base64urlEncode(raw), auth: base64urlEncode(auth) } }, privateKey: pair.privateKey };
}

describe('Web Push: Verschlüsselung (RFC 8291)', () => {
  it('ergibt genau den Chiffretext des RFC-Beispiels', async () => {
    const body = await encryptPushPayload(
      { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: RFC.uaPublic, auth: RFC.authSecret } },
      RFC.plaintext,
      {
        senderKey: { publicKey: base64urlDecode(RFC.asPublic), privateKey: base64urlDecode(RFC.asPrivate) },
        salt: base64urlDecode(RFC.salt),
      },
    );
    expect(base64urlEncode(body)).toBe(RFC.body);
  });

  it('verwendet ohne Vorgabe frische Schlüssel und Salts', async () => {
    const { sub } = await newSubscription('https://fcm.googleapis.com/x');
    const a = await encryptPushPayload(sub, 'x');
    const b = await encryptPushPayload(sub, 'x');
    expect(base64urlEncode(a)).not.toBe(base64urlEncode(b));
    expect(a[20]).toBe(65);
    expect(new DataView(a.buffer).getUint32(16, false)).toBe(4096);
  });

  it('lässt sich mit dem Schlüssel des Empfängers wieder entschlüsseln', async () => {
    const { sub, privateKey } = await newSubscription('https://fcm.googleapis.com/x');
    const message = JSON.stringify({ k: 'yourTurn', u: '#/raum/🐻🐻🐻🐻' });
    const body = await encryptPushPayload(sub, message);
    // Gegenseite nach RFC 8291, Abschnitt 3.4
    const salt = body.slice(0, 16);
    const asPublic = body.slice(21, 21 + body[20]);
    const cipher = body.slice(21 + body[20]);
    const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, privateKey, 256);
    const enc = new TextEncoder();
    const uaPublic = base64urlDecode(sub.keys.p256dh);
    const hk = async (ikm: ArrayBuffer | Uint8Array<ArrayBuffer>, s: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, n: number) =>
      new Uint8Array(
        await crypto.subtle.deriveBits(
          { name: 'HKDF', hash: 'SHA-256', salt: s, info },
          await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']),
          n * 8,
        ),
      );
    const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic]);
    const ikm = await hk(secret, base64urlDecode(sub.keys.auth), info, 32);
    const cek = await hk(ikm, salt, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hk(ikm, salt, enc.encode('Content-Encoding: nonce\0'), 12);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cipher),
    );
    expect(plain.at(-1)).toBe(2);
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe(message);
  });

  it('lehnt zu große Inhalte ab', async () => {
    const { sub } = await newSubscription('https://fcm.googleapis.com/x');
    await expect(encryptPushPayload(sub, 'a'.repeat(PUSH_PAYLOAD_MAX_BYTES))).resolves.toBeInstanceOf(Uint8Array);
    await expect(encryptPushPayload(sub, 'a'.repeat(PUSH_PAYLOAD_MAX_BYTES + 1))).rejects.toThrow();
  });
});

describe('Web Push: VAPID (RFC 8292)', () => {
  it('liefert ein JWT, das sich mit dem öffentlichen Schlüssel prüfen lässt', async () => {
    const keys = await newKeys();
    const header = await vapidAuthorization(
      'https://fcm.googleapis.com/fcm/send/abc?x=1',
      { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'https://spiele.lipponer.de' },
      1_700_000_000_000,
    );
    const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header);
    expect(match).not.toBeNull();
    const [, h, c, s, k] = match!;
    expect(k).toBe(keys.publicKey);
    expect(JSON.parse(new TextDecoder().decode(base64urlDecode(h)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(new TextDecoder().decode(base64urlDecode(c)))).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: 1_700_000_000 + 12 * 3600,
      sub: 'https://spiele.lipponer.de',
    });
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      keys.verifyKey,
      base64urlDecode(s),
      new TextEncoder().encode(`${h}.${c}`),
    );
    expect(ok).toBe(true);
  });
});

describe('Web Push: Versand', () => {
  async function setup(status: number | 'netz') {
    const keys = await newKeys();
    const { sub } = await newSubscription('https://updates.push.services.mozilla.com/wpush/v2/abc');
    const calls: { url: string; init: RequestInit }[] = [];
    const sender = createPushSender({
      ...keys,
      subject: 'https://spiele.lipponer.de',
      now: () => 0,
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (status === 'netz') throw new TypeError('Netzfehler');
        return new Response(null, { status });
      }) as typeof fetch,
    });
    return { sender, sub, calls };
  }

  it('bildet die Antwortcodes ab', async () => {
    const expected: [number | 'netz', string][] = [
      [201, 'ok'],
      [200, 'ok'],
      [404, 'gone'],
      [410, 'gone'],
      [429, 'retry'],
      [503, 'retry'],
      ['netz', 'retry'],
      [400, 'failed'],
      [401, 'failed'],
      [413, 'failed'],
    ];
    for (const [status, result] of expected) {
      const { sender, sub } = await setup(status);
      expect(await sender.send(sub, '{}', { ttl: 60 }), String(status)).toBe(result);
    }
  });

  it('setzt die Kopfzeilen und sendet den verschlüsselten Körper', async () => {
    const { sender, sub, calls } = await setup(201);
    await sender.send(sub, '{"k":"yourTurn"}', { ttl: 3600, topic: 'm-abc_1' });
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toBe(sub.endpoint);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Encoding']).toBe('aes128gcm');
    expect(headers.TTL).toBe('3600');
    expect(headers.Topic).toBe('m-abc_1');
    expect(headers.Authorization).toMatch(/^vapid t=.+, k=.+$/);
    expect((init.body as Uint8Array).length).toBeGreaterThan(86);
  });

  it('lässt ungültige Topics weg und meldet kaputte Abos als Fehler', async () => {
    const { sender, sub, calls } = await setup(201);
    await sender.send(sub, '{}', { ttl: 1, topic: 'zu viele Zeichen!!!' });
    expect((calls[0].init.headers as Record<string, string>).Topic).toBeUndefined();
    const broken = { ...sub, keys: { p256dh: 'AAAA', auth: 'AAAA' } };
    expect(await sender.send(broken, '{}', { ttl: 1 })).toBe('failed');
    expect(calls).toHaveLength(1);
  });
});
