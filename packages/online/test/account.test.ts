import { describe, expect, it } from 'vitest';
import {
  TICKET_TTL_MS,
  accountLockId,
  buildAuthorizeUrl,
  checkIdTokenClaims,
  createAccountLock,
  openAccountLock,
  randomToken,
  saveAccountLock,
  sha256Url,
  ticketValid,
} from '../src';

const NOW = 1_000_000_000_000;
const TID = '9188040d-6c67-4c5b-b112-36a304b66dad';
const base = { clientId: 'client-1', nonce: 'n-1', now: NOW };
const google = { iss: 'https://accounts.google.com', aud: 'client-1', exp: NOW / 1000 + 600, nonce: 'n-1', sub: '1234567890' };
const microsoft = { iss: `https://login.microsoftonline.com/${TID}/v2.0`, aud: 'client-1', exp: NOW / 1000 + 600, nonce: 'n-1', sub: 'abc', tid: TID };

describe('ID-Token prüfen (#154)', () => {
  it('Google: sub ist die Kennung; Aussteller, Zielgruppe, Ablauf und Nonce werden geprüft', () => {
    expect(checkIdTokenClaims('google', google, base)).toEqual({ ok: true, accountKey: '1234567890' });
    expect(checkIdTokenClaims('google', { ...google, iss: 'accounts.google.com' }, base).ok).toBe(true);
    expect(checkIdTokenClaims('google', { ...google, iss: 'https://evil.example' }, base)).toEqual({ ok: false, reason: 'iss' });
    expect(checkIdTokenClaims('google', { ...google, aud: 'anderer' }, base)).toEqual({ ok: false, reason: 'aud' });
    expect(checkIdTokenClaims('google', { ...google, aud: ['x', 'client-1'] }, base).ok).toBe(true);
    expect(checkIdTokenClaims('google', { ...google, exp: NOW / 1000 - 1 }, base)).toEqual({ ok: false, reason: 'exp' });
    expect(checkIdTokenClaims('google', { ...google, nonce: 'falsch' }, base)).toEqual({ ok: false, reason: 'nonce' });
    expect(checkIdTokenClaims('google', { ...google, sub: '' }, base)).toEqual({ ok: false, reason: 'sub' });
    expect(checkIdTokenClaims('google', null, base).ok).toBe(false);
  });

  it('Microsoft: Kennung aus tid und sub, der Aussteller muss zur tid passen', () => {
    expect(checkIdTokenClaims('microsoft', microsoft, base)).toEqual({ ok: true, accountKey: `${TID}:abc` });
    // Ein Token aus einem anderen Mandanten darf nicht mit fremdem Aussteller durchgehen.
    expect(checkIdTokenClaims('microsoft', { ...microsoft, iss: 'https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/v2.0' }, base)).toEqual({ ok: false, reason: 'iss' });
    expect(checkIdTokenClaims('microsoft', { ...microsoft, tid: 'kaputt' }, base)).toEqual({ ok: false, reason: 'iss' });
    expect(checkIdTokenClaims('microsoft', { ...microsoft, tid: undefined }, base).ok).toBe(false);
    // Ein Google-Token zählt bei Microsoft nicht.
    expect(checkIdTokenClaims('microsoft', google, base).ok).toBe(false);
  });
});

describe('Anmeldeadresse und Kennung', () => {
  it('nur der Bereich openid, PKCE mit S256, state und nonce', async () => {
    const challenge = await sha256Url('verifier');
    const url = new URL(buildAuthorizeUrl({ provider: 'google', clientId: 'c', redirectUri: 'https://w.example/konto/google/rueckruf', state: 's', nonce: 'n', challenge }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe('openid');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge')).toBe(challenge);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe('s');
    expect(url.searchParams.get('nonce')).toBe('n');
    expect(new URL(buildAuthorizeUrl({ provider: 'microsoft', clientId: 'c', redirectUri: 'x', state: 's', nonce: 'n', challenge })).pathname).toBe('/common/oauth2/v2.0/authorize');
  });

  it('die Schloss-Kennung hängt von Pfeffer, Anbieter und Konto ab und verrät das Konto nicht', async () => {
    const a = await accountLockId('pfeffer', 'google', '123');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await accountLockId('pfeffer', 'google', '123')).toBe(a);
    expect(await accountLockId('pfeffer', 'microsoft', '123')).not.toBe(a);
    expect(await accountLockId('pfeffer', 'google', '124')).not.toBe(a);
    expect(await accountLockId('anderer', 'google', '123')).not.toBe(a);
    expect(a).not.toContain('123');
    expect(randomToken(24)).toHaveLength(32);
  });
});

describe('Ticket', () => {
  it('gilt nur für dasselbe Schloss, denselben Browser und nur kurz', async () => {
    const secret = randomToken(32);
    const ticket = { provider: 'google' as const, lockId: 'a'.repeat(32), binding: await sha256Url(secret), at: NOW };
    expect(await ticketValid(ticket, 'a'.repeat(32), secret, NOW + 1000)).toBe(true);
    expect(await ticketValid(ticket, 'b'.repeat(32), secret, NOW + 1000)).toBe(false);
    expect(await ticketValid(ticket, 'a'.repeat(32), randomToken(32), NOW + 1000)).toBe(false);
    expect(await ticketValid(ticket, 'a'.repeat(32), secret, NOW + TICKET_TTL_MS + 1)).toBe(false);
    expect(await ticketValid(null, 'a'.repeat(32), secret, NOW)).toBe(false);
    expect(await ticketValid(ticket, 'a'.repeat(32), 'kurz', NOW)).toBe(false);
  });
});

describe('Konto-Schloss', () => {
  const data = btoa('geheimer inhalt');

  it('nur Konto: Anlegen gibt den Serveranteil, Öffnen gibt ihn wieder samt Inhalt', async () => {
    const made = await createAccountLock({}, 'pfeffer', NOW);
    if (made.status !== 200) throw new Error('anlegen');
    expect(made.share).toHaveLength(43);
    expect(made.record.authMac).toBeNull();
    const saved = await saveAccountLock(made.record, { data, rev: 0 }, 'pfeffer', NOW + 1);
    expect(saved.result).toEqual({ status: 200, rev: 1 });
    const opened = await openAccountLock(saved.record!, {}, 'pfeffer', NOW + 2);
    expect(opened.result).toEqual({ status: 200, share: made.share, data, rev: 1, pin: false });
    // Der Speicher enthält weder Klartext noch den Serveranteil im Klartext.
    expect(JSON.stringify(saved.record)).not.toContain(made.share);
  });

  it('veraltete Nummer wird abgelehnt', async () => {
    const made = await createAccountLock({}, 'pfeffer', NOW);
    if (made.status !== 200) throw new Error('anlegen');
    const saved = await saveAccountLock(made.record, { data, rev: 0 }, 'pfeffer', NOW);
    const again = await saveAccountLock(saved.record!, { data, rev: 0 }, 'pfeffer', NOW);
    expect(again.result.status).toBe(409);
  });

  it('Konto + PIN: ohne richtigen Beweis kommt nichts heraus; Fehler werden gezählt, zehn sperren', async () => {
    const auth = randomToken(32);
    const made = await createAccountLock({ auth }, 'pfeffer', NOW);
    if (made.status !== 200) throw new Error('anlegen');
    let record = (await saveAccountLock(made.record, { auth, data, rev: 0 }, 'pfeffer', NOW)).record!;
    expect((await openAccountLock(record, {}, 'pfeffer', NOW)).result.status).toBe(400);
    const ok = await openAccountLock(record, { auth }, 'pfeffer', NOW);
    expect(ok.result).toMatchObject({ status: 200, pin: true });
    let t = NOW;
    for (let i = 1; i <= 10; i++) {
      t += 2 * 60 * 60 * 1000;
      const bad = await openAccountLock(record, { auth: randomToken(32) }, 'pfeffer', t);
      expect(bad.result.status).toBe(401);
      record = bad.record!;
    }
    const locked = await openAccountLock(record, { auth }, 'pfeffer', t + 10 * 60 * 60 * 1000);
    expect(locked.result).toMatchObject({ status: 423, locked: true });
  });

  it('ohne Pfeffer geht nichts', async () => {
    expect((await createAccountLock({}, undefined, NOW)).status).toBe(503);
    expect((await createAccountLock({ auth: 'zu kurz' }, 'pfeffer', NOW)).status).toBe(400);
  });
});
