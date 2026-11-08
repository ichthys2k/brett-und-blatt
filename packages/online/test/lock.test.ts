import { describe, expect, it } from 'vitest';
import {
  LOCK_MAX_FAILS,
  changeLock,
  createLock,
  mayRemoveLock,
  openLock,
  resetLock,
  saveLock,
  waitAfterFails,
  type LockRecord,
} from '../src';

const PEPPER = 'test-pfeffer';
const secret = (c: string) => c.repeat(43).slice(0, 43);
const [AUTH, OTHER, RECOVERY, NEW_AUTH] = [secret('a'), secret('b'), secret('r'), secret('n')];
const DATA = 'QUJD'; // Base64

async function fresh(): Promise<{ record: LockRecord; share: string }> {
  const made = await createLock({ auth: AUTH, recovery: RECOVERY }, PEPPER, 1000);
  if (made.status !== 200) throw new Error('anlegen');
  const saved = await saveLock(made.record, { auth: AUTH, data: DATA, rev: 0 }, PEPPER, 1000);
  if (saved.result.status !== 200 || !saved.record) throw new Error('speichern');
  return { record: saved.record, share: made.share };
}

describe('Schloss des Ausweises (#138)', () => {
  it('ohne Pfeffer geht nichts (der Server meldet 503, nichts wird gespeichert)', async () => {
    expect((await createLock({ auth: AUTH, recovery: RECOVERY }, undefined, 0)).status).toBe(503);
    const { record } = await fresh();
    expect((await openLock(record, { auth: AUTH }, undefined, 0)).result.status).toBe(503);
  });

  it('speichert weder PIN-Beweis noch Notfallwert im Klartext', async () => {
    const { record } = await fresh();
    const dump = JSON.stringify(record);
    expect(dump).not.toContain(AUTH);
    expect(dump).not.toContain(RECOVERY);
  });

  it('öffnet mit dem richtigen Beweis und gibt den Serveranteil heraus', async () => {
    const { record, share } = await fresh();
    const out = await openLock(record, { auth: AUTH }, PEPPER, 2000);
    expect(out.result).toMatchObject({ status: 200, share, data: DATA, rev: 1 });
  });

  it('lehnt einen falschen Beweis ab, zählt und nennt die übrigen Versuche', async () => {
    let { record } = await fresh();
    const out = await openLock(record, { auth: OTHER }, PEPPER, 2000);
    expect(out.result).toEqual({ status: 401, fails: 1, left: LOCK_MAX_FAILS - 1 });
    record = out.record!;
    expect(record.fails).toBe(1);
    // ein richtiger Versuch setzt den Zähler zurück
    expect((await openLock(record, { auth: AUTH }, PEPPER, 2001)).record!.fails).toBe(0);
  });

  it('ab dem fünften Fehler wächst die Wartezeit, ab dem zehnten ist gesperrt', async () => {
    expect([4, 5, 6, 7, 8, 9, 10].map(waitAfterFails)).toEqual([0, 60_000, 300_000, 900_000, 3_600_000, 3_600_000, Infinity]);
    let { record } = await fresh();
    let now = 10_000;
    for (let i = 0; i < 5; i++) record = (await openLock(record, { auth: OTHER }, PEPPER, now++)).record!;
    // jetzt wartet das Schloss – selbst der richtige Beweis wird abgewiesen
    const waiting = await openLock(record, { auth: AUTH }, PEPPER, now);
    expect(waiting.result).toMatchObject({ status: 423, locked: false });
    expect(waiting.result.status === 423 && waiting.result.waitMs).toBeGreaterThan(50_000);
    // nach der Wartezeit geht es wieder
    now += 61_000;
    expect((await openLock(record, { auth: AUTH }, PEPPER, now)).result.status).toBe(200);
    // bis zum zehnten Fehler weiterraten
    for (let i = 0; i < 5; i++) {
      now += 3_700_000;
      record = (await openLock(record, { auth: OTHER }, PEPPER, now)).record!;
    }
    expect(record.fails).toBe(LOCK_MAX_FAILS);
    now += 10 * 3_700_000;
    const locked = await openLock(record, { auth: AUTH }, PEPPER, now);
    expect(locked.result).toMatchObject({ status: 423, locked: true });
  });

  it('schreibt nur mit richtigem Beweis und passender Nummer', async () => {
    const { record } = await fresh();
    expect((await saveLock(record, { auth: OTHER, data: DATA, rev: 1 }, PEPPER, 5)).result.status).toBe(401);
    expect((await saveLock(record, { auth: AUTH, data: DATA, rev: 0 }, PEPPER, 5)).result.status).toBe(409);
    expect((await saveLock(record, { auth: AUTH, data: 'kein base64!', rev: 1 }, PEPPER, 5)).result.status).toBe(400);
    const ok = await saveLock(record, { auth: AUTH, data: 'REVG', rev: 1 }, PEPPER, 5);
    expect(ok.result).toEqual({ status: 200, rev: 2 });
    expect(ok.record!.data).toBe('REVG');
  });

  it('PIN ändern: das Alte muss stimmen, danach gilt nur das Neue', async () => {
    const { record, share } = await fresh();
    expect((await changeLock(record, { auth: OTHER, newAuth: NEW_AUTH, data: 'REVG' }, PEPPER, 5)).result.status).toBe(401);
    const changed = await changeLock(record, { auth: AUTH, newAuth: NEW_AUTH, data: 'REVG' }, PEPPER, 5);
    expect(changed.result.status).toBe(200);
    expect((await openLock(changed.record!, { auth: AUTH }, PEPPER, 6)).result.status).toBe(401);
    expect((await openLock(changed.record!, { auth: NEW_AUTH }, PEPPER, 7)).result).toMatchObject({ status: 200, share, data: 'REVG' });
  });

  it('Notfallkarte setzt zurück, auch ein gesperrtes Schloss', async () => {
    let { record } = await fresh();
    record = { ...record, fails: LOCK_MAX_FAILS };
    expect((await openLock(record, { auth: AUTH }, PEPPER, 5)).result).toMatchObject({ status: 423, locked: true });
    expect((await resetLock(record, { recovery: OTHER, newAuth: NEW_AUTH, data: DATA }, PEPPER, 5)).result.status).toBe(401);
    const reset = await resetLock(record, { recovery: RECOVERY, newAuth: NEW_AUTH, data: 'REVG' }, PEPPER, 5);
    expect(reset.result).toMatchObject({ status: 200 });
    expect(reset.record).toMatchObject({ fails: 0, until: 0 });
    expect((await openLock(reset.record!, { auth: NEW_AUTH }, PEPPER, 6)).result.status).toBe(200);
  });

  it('löschen darf nur, wer PIN oder Notfallkarte kennt', async () => {
    const { record } = await fresh();
    expect((await mayRemoveLock(record, { auth: OTHER }, PEPPER, 5)).result.status).toBe(401);
    expect((await mayRemoveLock(record, { auth: AUTH }, PEPPER, 5)).result.status).toBe(200);
    expect((await mayRemoveLock(record, { recovery: RECOVERY }, PEPPER, 5)).result.status).toBe(200);
  });

  it('ein anderer Pfeffer öffnet nichts', async () => {
    const { record } = await fresh();
    expect((await openLock(record, { auth: AUTH }, 'anderer-pfeffer', 5)).result.status).toBe(401);
  });

  it('Eingaben werden streng geprüft', async () => {
    expect((await createLock({ auth: 'zu kurz', recovery: RECOVERY }, PEPPER, 0)).status).toBe(400);
    expect((await createLock(null, PEPPER, 0)).status).toBe(400);
  });
});
