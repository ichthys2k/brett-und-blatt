/**
 * Web Push (#242, Schritt 2): Verschlüsselung nach RFC 8291 (`aes128gcm`, RFC 8188) und VAPID (RFC 8292).
 * Nur Web Crypto und `fetch`, keine Fremdbibliothek; läuft in Cloudflare Workers, Node und Browsern.
 *
 * Geheimnisse: Der private VAPID-Schlüssel und die Abo-Daten (Endpunkt, Schlüssel) kommen nie in Logs.
 */
import type { PushSubscriptionData } from './push';

export type PushResult = 'ok' | 'gone' | 'retry' | 'failed';

export interface PushSendOptions {
  /** Lebensdauer beim Push-Dienst in Sekunden (z. B. 3600 für Aufrufe, 7200 für Fristen). */
  ttl: number;
  /** Ersetzt eine ältere, noch nicht zugestellte Meldung derselben Sache (höchstens 32 Zeichen base64url). */
  topic?: string;
}

/** Schnittstelle zum Versand; die Logik hängt nur daran, Tests setzen eine Attrappe ein. */
export interface PushSender {
  send(sub: PushSubscriptionData, payload: string, opts: PushSendOptions): Promise<PushResult>;
}

/** Größe der Datensätze (RFC 8188); Web Push verlangt mindestens 4096. */
const RECORD_SIZE = 4096;
/** 4096 − 16 (GCM-Tag) − 1 (Trennbyte). */
export const PUSH_PAYLOAD_MAX_BYTES = RECORD_SIZE - 17;
const VAPID_LIFETIME_S = 12 * 60 * 60;
const TOPIC = /^[A-Za-z0-9_-]{1,32}$/;

const encoder = new TextEncoder();

export function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecode(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** JWK eines P-256-Schlüssels aus dem öffentlichen Punkt (65 Byte) und, falls vorhanden, dem privaten Wert `d`. */
function p256Jwk(publicKey: Uint8Array, privateKey?: Uint8Array): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 4) throw new Error('Öffentlicher Schlüssel: 65 Byte, unkomprimiert erwartet');
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: base64urlEncode(publicKey.slice(1, 33)),
    y: base64urlEncode(publicKey.slice(33, 65)),
    ext: true,
  };
  if (privateKey) {
    if (privateKey.length !== 32) throw new Error('Privater Schlüssel: 32 Byte erwartet');
    jwk.d = base64urlEncode(privateKey);
  }
  return jwk;
}

/** Schlüssel des Absenders; ohne Angabe entsteht je Nachricht ein frischer Wegwerf-Schlüssel (so verlangt es RFC 8291). */
export interface SenderKey {
  /** 65 Byte, unkomprimiert. */
  publicKey: Uint8Array;
  /** 32 Byte (`d`). */
  privateKey: Uint8Array;
}

export interface EncryptOptions {
  /** Nur für Tests mit dem Vektor aus RFC 8291. */
  senderKey?: SenderKey;
  /** 16 Byte; nur für Tests. */
  salt?: Uint8Array;
}

/**
 * Verschlüsselt eine Nachricht für ein Abo und liefert den fertigen Körper der Anfrage
 * (Kopf nach RFC 8188 + ein Datensatz). Der Inhalt muss in einen Datensatz passen.
 */
export async function encryptPushPayload(
  sub: PushSubscriptionData,
  payload: string | Uint8Array,
  options: EncryptOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const data = typeof payload === 'string' ? encoder.encode(payload) : payload;
  if (data.length > PUSH_PAYLOAD_MAX_BYTES) throw new Error('Inhalt zu groß für einen Datensatz');
  const uaPublic = base64urlDecode(sub.keys.p256dh);
  const authSecret = base64urlDecode(sub.keys.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('Abo-Schlüssel haben die falsche Länge');

  const subtle = crypto.subtle;
  let asPublic: Uint8Array;
  let asPrivate: CryptoKey;
  if (options.senderKey) {
    asPublic = options.senderKey.publicKey;
    asPrivate = await subtle.importKey('jwk', p256Jwk(asPublic, options.senderKey.privateKey), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  } else {
    const generated: unknown = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const pair = generated as CryptoKeyPair;
    asPublic = new Uint8Array((await subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
    asPrivate = pair.privateKey;
  }
  const uaKey = await subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  // Die Cloudflare-Typen kennen `public` nur als `$public`; zur Laufzeit heißt das Feld `public`.
  const ecdhParams = { name: 'ECDH', public: uaKey } as unknown as Parameters<SubtleCrypto['deriveBits']>[0];
  const ecdhSecret = await subtle.deriveBits(ecdhParams, asPrivate, 256);

  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  if (salt.length !== 16) throw new Error('Salt: 16 Byte erwartet');

  const hkdf = async (ikm: ArrayBuffer | Uint8Array, hkdfSalt: Uint8Array, info: Uint8Array, bytes: number) => {
    const key = await subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
    const params = { name: 'HKDF', hash: 'SHA-256', salt: hkdfSalt, info } as unknown as Parameters<SubtleCrypto['deriveBits']>[0];
    return new Uint8Array(await subtle.deriveBits(params, key, bytes * 8));
  };

  // RFC 8291, 3.4: Schlüsselmaterial aus dem gemeinsamen Geheimnis und dem Auth-Geheimnis
  const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(ecdhSecret, authSecret, keyInfo, 32);
  // RFC 8188: Inhaltsschlüssel und Nonce aus Salt und IKM
  const cek = await hkdf(ikm, salt, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, encoder.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // letzter (und einziger) Datensatz: Inhalt + Trennbyte 0x02
  const plaintext = concat(data, new Uint8Array([2]));
  const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext));

  const header = new Uint8Array(16 + 4 + 1);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false);
  header[20] = asPublic.length;
  return concat(header, asPublic, cipher);
}

/** Erzeugt den VAPID-Kopf `Authorization` für den Ursprung des Endpunkts. */
export async function vapidAuthorization(
  endpoint: string,
  keys: { publicKey: string; privateKey: string; subject: string },
  nowMs: number,
): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = base64urlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64urlEncode(
    encoder.encode(JSON.stringify({ aud, exp: Math.floor(nowMs / 1000) + VAPID_LIFETIME_S, sub: keys.subject })),
  );
  const signingInput = `${header}.${claims}`;
  const jwk = p256Jwk(base64urlDecode(keys.publicKey), base64urlDecode(keys.privateKey));
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // Web Crypto liefert r‖s (IEEE P1363), genau das Format von JWT/ES256
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(signingInput)));
  return `vapid t=${signingInput}.${base64urlEncode(signature)}, k=${keys.publicKey}`;
}

export interface PushSenderConfig {
  /** Öffentlicher VAPID-Schlüssel, base64url, 65 Byte. */
  publicKey: string;
  /** Privater VAPID-Schlüssel, base64url, 32 Byte (nur als Secret). */
  privateKey: string;
  /** `https://…` oder `mailto:…`. */
  subject: string;
  fetch?: typeof fetch;
  now?: () => number;
}

/** Umsetzung von `PushSender` mit Web Crypto und `fetch`. Fehler werden nie mit der Endpunkt-Adresse geworfen. */
export function createPushSender(config: PushSenderConfig): PushSender {
  const doFetch = config.fetch ?? fetch;
  const now = config.now ?? Date.now;
  return {
    async send(sub, payload, opts) {
      let body: Uint8Array<ArrayBuffer>;
      let authorization: string;
      try {
        body = await encryptPushPayload(sub, payload);
        authorization = await vapidAuthorization(sub.endpoint, config, now());
      } catch {
        return 'failed';
      }
      const headers: Record<string, string> = {
        Authorization: authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(Math.max(0, Math.floor(opts.ttl))),
        Urgency: 'normal',
      };
      if (opts.topic && TOPIC.test(opts.topic)) headers.Topic = opts.topic;
      let status: number;
      try {
        const response = await doFetch(sub.endpoint, { method: 'POST', headers, body });
        status = response.status;
      } catch {
        return 'retry';
      }
      if (status >= 200 && status < 300) return 'ok';
      if (status === 404 || status === 410) return 'gone';
      if (status === 429 || status >= 500) return 'retry';
      return 'failed';
    },
  };
}
