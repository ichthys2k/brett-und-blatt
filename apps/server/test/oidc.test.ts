import { describe, expect, it } from 'vitest';
import { errorCode, exchangeCode, verifyIdToken } from '../src/oidc';

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64json = (value: unknown) => b64(enc.encode(JSON.stringify(value)));

async function makeKey(kid: string) {
  const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  return { pair, jwk: { ...jwk, kid } };
}

async function sign(pair: CryptoKeyPair, kid: string, claims: unknown, alg = 'RS256'): Promise<string> {
  const head = `${b64json({ alg, kid })}.${b64json(claims)}`;
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, enc.encode(head)));
  return `${head}.${b64(sig)}`;
}

function fakeFetch(keys: unknown[], idToken?: string): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('certs') || url.includes('keys')) return new Response(JSON.stringify({ keys }), { status: 200 });
    return new Response(JSON.stringify(idToken ? { id_token: idToken } : { error: 'invalid_grant' }), { status: idToken ? 200 : 400 });
  }) as typeof fetch;
}

describe('ID-Token (#154)', () => {
  const now = 1_800_000_000_000;
  const claims = { iss: 'https://accounts.google.com', aud: 'client', exp: now / 1000 + 2 * 86_400, nonce: 'n', sub: 'u1' };

  it('prüft die Signatur; fremde Schlüssel und andere Verfahren scheitern', async () => {
    const { pair, jwk } = await makeKey('k1');
    const other = await makeKey('k1');
    const token = await sign(pair, 'k1', claims);
    expect(await verifyIdToken('google', token, fakeFetch([jwk]), now)).toMatchObject({ sub: 'u1' });
    await expect(verifyIdToken('google', await sign(other.pair, 'k1', claims), fakeFetch([jwk]), now + 7_200_000)).rejects.toThrow('signature');
    await expect(verifyIdToken('google', await sign(pair, 'k1', claims, 'none'), fakeFetch([jwk]), now + 14_400_000)).rejects.toThrow('alg');
    await expect(verifyIdToken('google', token.slice(0, -4) + 'AAAA', fakeFetch([jwk]), now + 21_600_000)).rejects.toThrow();
  });

  it('Code gegen Token tauschen und die Kennung liefern; ein falsches Token oder ein fehlgeschlagener Tausch ergeben einen Grund', async () => {
    const { pair, jwk } = await makeKey('k2');
    const params = { provider: 'google' as const, clientId: 'client', clientSecret: 's', redirectUri: 'https://w/konto/google/rueckruf', code: 'c', verifier: 'v', nonce: 'n' };
    const good = await sign(pair, 'k2', claims);
    expect(await exchangeCode(params, fakeFetch([jwk], good), now + 28_800_000)).toEqual({ ok: true, accountKey: 'u1' });
    expect(await exchangeCode(params, fakeFetch([jwk]), now)).toEqual({ ok: false, reason: 'token', detail: 'invalid_grant' });
    expect(await exchangeCode({ ...params, nonce: 'anderer' }, fakeFetch([jwk], good), now + 36_000_000)).toEqual({ ok: false, reason: 'nonce' });
    const forged = await sign((await makeKey('k2')).pair, 'k2', claims);
    expect(await exchangeCode(params, fakeFetch([jwk], forged), now + 43_200_000)).toEqual({ ok: false, reason: 'verify' });
  });
});

describe('Fehlercode des Anbieters', () => {
  it('nur kurze Codes, keine freien Texte', () => {
    expect(errorCode({ error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret provided. Trace ID: 1234' })).toBe('invalid_client AADSTS7000215');
    expect(errorCode({ error: 'x'.repeat(100), error_description: 'ohne Nummer' })).toBeUndefined();
    expect(errorCode({})).toBeUndefined();
  });
});
