import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccountLock, openAccountLock, saveAccountLock, type AccountRecord } from '../../online/src/account';
import { accountSecrets, beginAccountLogin, linkAccount, loadAccountProviders, openAccountPass, resolveAccountTicket, unlinkAccount, accountStatus, type AccountSession, type PlayerPass } from '../src/sync';

const PEPPER = 'test-pfeffer';
const ROUNDS = 1000;
const pass: PlayerPass = { token: 't'.repeat(32), name: 'Ada', avatar: '🦊', code: '🦊🐻🐸🐙', passKey: 'k'.repeat(43) };
const session: AccountSession = { ticket: 'T'.repeat(32), binding: 'b'.repeat(43), lockId: 'a'.repeat(32), provider: 'google' };

// Nachgebauter Server mit der echten Logik des Konto-Schlosses; das Ticket gilt hier als geprüft.
const locks = new Map<string, AccountRecord>();
let calls: string[] = [];
vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
  calls.push(`${init?.method ?? 'GET'} ${url}`);
  if (url.endsWith('/konto')) return json({ providers: ['google'] });
  if (url.endsWith('/konto/google/start')) return json({ url: 'https://accounts.google.com/auth?x=1' });
  if (url.endsWith('/konto/ticket')) return json({ lockId: session.lockId, provider: 'google' });
  const [, id, action] = /\/konto-schloss\/([0-9a-f]{32})\/(\w+)$/.exec(url)!;
  const body = JSON.parse(init!.body as string);
  const stored = locks.get(id!) ?? null;
  if (action === 'status') return json({ status: 200, exists: !!stored && stored.data !== '', pin: stored?.authMac != null });
  if (action === 'anlegen') {
    const made = await createAccountLock(body, PEPPER, 1);
    if (made.status !== 200) return json(made, made.status);
    locks.set(id!, made.record);
    return json({ status: 200, share: made.share });
  }
  if (action === 'loeschen') {
    locks.delete(id!);
    return json({ status: 200 });
  }
  if (!stored) return json({ status: 404 }, 404);
  const out = action === 'oeffnen' ? await openAccountLock(stored, body, PEPPER, 2) : await saveAccountLock(stored, body, PEPPER, 2);
  if (out.record) locks.set(id!, out.record);
  return json(out.result, out.result.status);
});
const server = () => 'https://server.test';

beforeEach(() => {
  locks.clear();
  calls = [];
});

describe('Anmeldung mit Konto im Browser (#154)', () => {
  it('fragt die eingerichteten Anbieter ab und beginnt die Anmeldung mit dem Hash, nie mit dem Geheimnis', async () => {
    expect(await loadAccountProviders(server)).toEqual(['google']);
    expect(await loadAccountProviders(() => null)).toEqual([]);
    const begun = await beginAccountLogin(server, 'google');
    expect(begun.url).toContain('accounts.google.com');
    expect(begun.binding).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const resolved = await resolveAccountTicket(server, 'T'.repeat(32), begun.binding);
    expect(resolved).toMatchObject({ lockId: session.lockId, provider: 'google' });
  });

  it('nur Konto: Verknüpfen, dann öffnet das Konto den Pass auf einem neuen Gerät', async () => {
    expect(await accountStatus(server, session)).toEqual({ exists: false, pin: false });
    await linkAccount(server, session, pass);
    expect(await accountStatus(server, session)).toEqual({ exists: true, pin: false });
    expect(await openAccountPass(server, session)).toMatchObject({ name: 'Ada', avatar: '🦊', passKey: pass.passKey, token: pass.token });
    // Im Speicher des Servers steht nichts im Klartext.
    expect(JSON.stringify([...locks.values()])).not.toContain('"Ada"');
  });

  it('Konto + PIN: ohne die richtige PIN lässt sich der Pass nicht öffnen', async () => {
    const secrets = await accountSecrets(session, '123456', ROUNDS);
    await linkAccount(server, session, pass, secrets);
    expect(await accountStatus(server, session)).toEqual({ exists: true, pin: true });
    expect(await openAccountPass(server, session, secrets)).toMatchObject({ name: 'Ada', passKey: pass.passKey });
    await expect(openAccountPass(server, session, await accountSecrets(session, '654321', ROUNDS))).rejects.toThrow(/Falsch\. Noch 9 Versuche/);
    await expect(openAccountPass(server, session)).rejects.toThrow();
  });

  it('die PIN gehört zum Konto: dieselbe PIN bei einem anderen Konto ergibt andere Werte', async () => {
    const a = await accountSecrets(session, '123456', ROUNDS);
    const b = await accountSecrets({ ...session, lockId: 'b'.repeat(32) }, '123456', ROUNDS);
    expect(a.auth).not.toBe(b.auth);
    expect(a.wrap).not.toBe(b.wrap);
  });

  it('Lösen entfernt das Schloss', async () => {
    await linkAccount(server, session, pass);
    await unlinkAccount(server, session);
    expect(locks.size).toBe(0);
    await expect(openAccountPass(server, session)).rejects.toThrow(/keine Verknüpfung/);
  });

  it('erneutes Verknüpfen ersetzt die alte Verknüpfung (neuer Serveranteil, alter Inhalt unlesbar)', async () => {
    await linkAccount(server, session, pass);
    await linkAccount(server, session, { ...pass, name: 'Bea' });
    expect((await openAccountPass(server, session)).name).toBe('Bea');
  });
});
