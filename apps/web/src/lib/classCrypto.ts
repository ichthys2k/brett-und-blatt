/*
 * Lernstand für die Leitung (#101, L7): Die Mitglieder verschlüsseln ihren Lernstand im Browser so, dass nur eine Leitung ihn öffnen kann.
 * Jede Leitung hat ein Schlüsselpaar (ECDH P-256); ihr öffentlicher Schlüssel liegt in der Klasse, der private bleibt in ihrem Pass.
 * Ein Mitglied komprimiert den Stand, verschlüsselt ihn mit einem Zufallsschlüssel (AES-GCM) und verpackt diesen Schlüssel für jede
 * Leitung einzeln (ECDH mit einem Einmalschlüssel, HKDF, AES-GCM). Der Server sieht nur den Datensalat.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
const INFO = enc.encode('brett-und-blatt/klasse/lernstand');
const MAX_LEADS = 4;

const b64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (text: string): Uint8Array<ArrayBuffer> => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  return new Uint8Array(Array.from(atob(padded), (c) => c.charCodeAt(0)));
};

async function pack(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unpack(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function wrapKey(shared: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: INFO }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export interface LeadKeyPair {
  /** Öffentlicher Schlüssel, 65 Byte roh als Base64url (87 Zeichen). */
  pub: string;
  priv: JsonWebKey;
  at: number;
}

export async function generateLeadKeys(now = Date.now()): Promise<LeadKeyPair> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { pub: b64(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))), priv: await crypto.subtle.exportKey('jwk', pair.privateKey), at: now };
}

/** Verschlüsselt einen Stand für die angegebenen Leitungen; Ergebnis ist Base64url-Text für den Server. */
export async function sealProgress(payload: unknown, leads: readonly { id: string; key: string }[]): Promise<string> {
  const targets = leads.slice(0, MAX_LEADS);
  if (targets.length === 0) throw new Error('keine Leitung');
  const content = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const contentKey = await crypto.subtle.importKey('raw', content, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, contentKey, (await pack(enc.encode(JSON.stringify(payload)))) as BufferSource));
  const to: Record<string, { e: string; i: string; w: string }> = {};
  for (const lead of targets) {
    const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const leadPub = await crypto.subtle.importKey('raw', unb64(lead.key), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: leadPub }, ephemeral.privateKey, 256);
    const wrapIv = crypto.getRandomValues(new Uint8Array(12));
    const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wrapIv }, await wrapKey(shared), content));
    to[lead.id] = { e: b64(new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey))), i: b64(wrapIv), w: b64(wrapped) };
  }
  return b64(enc.encode(JSON.stringify({ v: 1, i: b64(iv), c: b64(cipher), to })));
}

/** Öffnet einen Stand mit dem privaten Schlüssel der Leitung `leadId`; null bei falschem Schlüssel oder kaputten Daten. */
export async function openProgress(blob: string, leadId: string, priv: JsonWebKey): Promise<unknown | null> {
  try {
    const parsed = JSON.parse(dec.decode(unb64(blob))) as { v?: number; i?: string; c?: string; to?: Record<string, { e: string; i: string; w: string }> };
    const mine = parsed.to?.[leadId];
    if (parsed.v !== 1 || !mine || !parsed.i || !parsed.c) return null;
    const privateKey = await crypto.subtle.importKey('jwk', priv, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const ephemeral = await crypto.subtle.importKey('raw', unb64(mine.e), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: ephemeral }, privateKey, 256);
    const content = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(mine.i) }, await wrapKey(shared), unb64(mine.w));
    const contentKey = await crypto.subtle.importKey('raw', content, 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(parsed.i) }, contentKey, unb64(parsed.c));
    return JSON.parse(dec.decode(await unpack(new Uint8Array(plain))));
  } catch {
    return null;
  }
}
