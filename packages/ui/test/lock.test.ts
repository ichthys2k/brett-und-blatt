import { changeLock, createLock, mayRemoveLock, openLock, resetLock, saveLock, type LockRecord } from '../../online/src/lock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changePassLock,
  createPassLock,
  hasPassLock,
  lockId,
  lockMessage,
  openPassLock,
  parseSecret,
  recoveryProof,
  removePassLock,
  resetPassLock,
  savePassLock,
  stretchSecret,
  type PlayerPass,
} from '../src/sync';

const PEPPER = 'test-pfeffer';
const ROUNDS = 1000; // Tests: wenige Runden, die Rechnung ist dieselbe

// Nachgebauter Server mit der echten Schloss-Logik.
const locks = new Map<string, LockRecord>();
let now = 1_000_000;
vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
  const [, id, action] = /\/schloss\/([0-9a-f]{32})(?:\/(\w+))?$/.exec(url)!;
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
  if (!init?.method) return json({ exists: !!locks.get(id!)?.data });
  const body = JSON.parse(init.body as string);
  const stored = locks.get(id!) ?? null;
  if (action === 'anlegen') {
    if (stored) return json({ status: 409 }, 409);
    const made = await createLock(body, PEPPER, now);
    if (made.status !== 200) return json(made, made.status);
    locks.set(id!, made.record);
    return json({ status: 200, share: made.share });
  }
  if (!stored) return json({ status: 404 }, 404);
  const fn = { oeffnen: openLock, speichern: saveLock, aendern: changeLock, zuruecksetzen: resetLock, loeschen: mayRemoveLock }[action!]!;
  const out = await fn(stored, body, PEPPER, now);
  if (action === 'loeschen' && out.result.status === 200) locks.delete(id!);
  else if (out.record) locks.set(id!, out.record);
  return json(out.result, out.result.status);
});

const server = () => 'http://server';
const CODE = '🦊🐻🐸🐙';
const pass: PlayerPass = { token: 't'.repeat(32), name: 'Ada', avatar: '🦊', code: CODE, passKey: 'k'.repeat(43) };
const secrets = (pin: string) => stretchSecret(CODE, pin, ROUNDS);

describe('PIN und Passwort (#138)', () => {
  beforeEach(() => {
    locks.clear();
    now = 1_000_000;
  });

  it('liest PIN (6 Ziffern oder 6 Bilder) und Passwort (ab 8 Zeichen)', () => {
    expect(parseSecret('123456')).toEqual({ kind: 'pin', value: '123456' });
    expect(parseSecret('123 456')).toEqual({ kind: 'pin', value: '123456' });
    expect(parseSecret('🐶🐱🦊🐻🐸🐧')).toEqual({ kind: 'pin', value: '🐶🐱🦊🐻🐸🐧' });
    expect(parseSecret('hunter22')?.kind).toBe('password');
    expect(parseSecret('12345')).toBeNull();
    expect(parseSecret('1234567')).toBeNull(); // sieben Ziffern sind weder PIN noch Passwort (zu kurz)
    expect(parseSecret('kurz')).toBeNull();
    expect(parseSecret('x'.repeat(200))).toBeNull();
  });

  it('gleiche Eingaben ergeben gleiche Werte, andere Eingaben andere', async () => {
    const a = await secrets('123456');
    expect(await secrets('123456')).toEqual(a);
    expect((await secrets('654321')).auth).not.toBe(a.auth);
    expect((await stretchSecret('🐶🐶🐶🐶', '123456', ROUNDS)).auth).not.toBe(a.auth);
    expect(a.auth).not.toBe(a.wrap);
    expect(await lockId(CODE)).toMatch(/^[0-9a-f]{32}$/);
    expect(await recoveryProof('ABCD2345EFGH6789')).toHaveLength(43);
  });

  it('legt ein Schloss an und öffnet es mit der PIN samt Passschlüssel', async () => {
    const s = await secrets('123456');
    expect(await hasPassLock(server, CODE)).toBe(false);
    await createPassLock(server, CODE, s, 'ABCD2345EFGH6789', pass);
    expect(await hasPassLock(server, CODE)).toBe(true);
    const opened = await openPassLock(server, CODE, s);
    expect(opened.pass).toMatchObject({ name: 'Ada', passKey: pass.passKey, code: CODE });
    // Base64-Geheimtext kann zufällig „Ada“ enthalten; Klartext wäre als JSON-Feld mit Anführungszeichen erkennbar.
    const stored = JSON.stringify([...locks.values()]);
    expect(stored).not.toContain('"Ada"');
    expect(stored).not.toContain('\\"Ada\\"');
    expect(stored).not.toContain('passKey');
  });

  it('eine falsche PIN scheitert, zählt und nennt die übrigen Versuche', async () => {
    await createPassLock(server, CODE, await secrets('123456'), 'ABCD2345EFGH6789', pass);
    await expect(openPassLock(server, CODE, await secrets('000000'))).rejects.toThrow(/Noch 9 Versuche/);
    await expect(openPassLock(server, CODE, await secrets('111111'))).rejects.toThrow(/Noch 8 Versuche/);
    expect((await openPassLock(server, CODE, await secrets('123456'))).pass.name).toBe('Ada');
  });

  it('nach fünf Fehlern wartet das Schloss, nach zehn ist es gesperrt', async () => {
    await createPassLock(server, CODE, await secrets('123456'), 'ABCD2345EFGH6789', pass);
    const wrong = await secrets('000000');
    for (let i = 0; i < 5; i++) await openPassLock(server, CODE, wrong).catch(() => undefined);
    await expect(openPassLock(server, CODE, await secrets('123456'))).rejects.toThrow(/Bitte in einer Minute/);
    for (let i = 0; i < 5; i++) {
      now += 4_000_000;
      await openPassLock(server, CODE, wrong).catch(() => undefined);
    }
    now += 4_000_000;
    await expect(openPassLock(server, CODE, await secrets('123456'))).rejects.toThrow(/gesperrt/);
  });

  it('die Notfallkarte entsperrt und setzt eine neue PIN', async () => {
    const card = 'ABCD2345EFGH6789';
    await createPassLock(server, CODE, await secrets('123456'), card, pass);
    const wrong = await secrets('000000');
    for (let i = 0; i < 10; i++) {
      now += 4_000_000;
      await openPassLock(server, CODE, wrong).catch(() => undefined);
    }
    await expect(resetPassLock(server, CODE, 'ZZZZ2345EFGH6789', await secrets('999999'), pass)).rejects.toThrow();
    await resetPassLock(server, CODE, card, await secrets('999999'), { ...pass, name: 'Neu' });
    expect((await openPassLock(server, CODE, await secrets('999999'))).pass.name).toBe('Neu');
    await expect(openPassLock(server, CODE, await secrets('123456'))).rejects.toThrow();
  });

  it('ändert die PIN und speichert Änderungen am Ausweis', async () => {
    const old = await secrets('123456');
    await createPassLock(server, CODE, old, 'ABCD2345EFGH6789', pass);
    const next = await secrets('hunter22');
    await changePassLock(server, CODE, old, next, pass);
    await expect(openPassLock(server, CODE, old)).rejects.toThrow();
    await savePassLock(server, CODE, next, { ...pass, name: 'Bea' });
    expect((await openPassLock(server, CODE, next)).pass.name).toBe('Bea');
  });

  it('entfernt das Schloss mit der PIN oder der Notfallkarte', async () => {
    const s = await secrets('123456');
    await createPassLock(server, CODE, s, 'ABCD2345EFGH6789', pass);
    await removePassLock(server, CODE, { auth: s.auth });
    expect(await hasPassLock(server, CODE)).toBe(false);
    await createPassLock(server, CODE, s, 'ABCD2345EFGH6789', pass);
    await removePassLock(server, CODE, { syncCode: 'ABCD2345EFGH6789' });
    expect(await hasPassLock(server, CODE)).toBe(false);
  });

  it('übersetzt Serverantworten in verständliche Meldungen', () => {
    expect(lockMessage(503, {})).toMatch(/noch nicht eingerichtet/);
    expect(lockMessage(429, {})).toMatch(/Anschluss/);
    expect(lockMessage(401, { left: 1 })).toMatch(/Noch 1 Versuch,/);
  });
});
