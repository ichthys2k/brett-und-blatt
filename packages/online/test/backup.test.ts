import { describe, expect, it } from 'vitest';
import { BACKUP_ID_PATTERN, BACKUP_MAX_BYTES, applyBackupPut } from '../src';

describe('Sicherungen (W-018)', () => {
  it('legt eine neue Sicherung mit rev 0 an und zählt weiter', () => {
    const first = applyBackupPut(null, { data: 'QUJD', rev: 0 }, 1000);
    expect(first).toEqual({ status: 200, stored: { data: 'QUJD', rev: 1, at: 1000 } });
    if (first.status !== 200) return;
    const second = applyBackupPut(first.stored, { data: 'REVG', rev: 1 }, 2000);
    expect(second).toMatchObject({ status: 200, stored: { rev: 2 } });
  });

  it('meldet 409 mit dem aktuellen Stand, wenn ein anderes Gerät dazwischen schrieb', () => {
    const current = { data: 'QUJD', rev: 3, at: 0 };
    expect(applyBackupPut(current, { data: 'REVG', rev: 2 }, 1)).toEqual({ status: 409, current });
    expect(applyBackupPut(null, { data: 'REVG', rev: 1 }, 1)).toEqual({ status: 409, current: null });
  });

  it('lehnt kaputte oder zu große Blöcke ab', () => {
    expect(applyBackupPut(null, null, 0).status).toBe(400);
    expect(applyBackupPut(null, { data: '', rev: 0 }, 0).status).toBe(400);
    expect(applyBackupPut(null, { data: '<script>', rev: 0 }, 0).status).toBe(400);
    expect(applyBackupPut(null, { data: 'A'.repeat(BACKUP_MAX_BYTES + 1), rev: 0 }, 0).status).toBe(400);
    expect(applyBackupPut(null, { data: 'QUJD', rev: -1 }, 0).status).toBe(400);
    expect(applyBackupPut(null, { data: 'QUJD', rev: 0.5 }, 0).status).toBe(400);
  });

  it('Kennungen sind 32 Hex-Zeichen', () => {
    expect(BACKUP_ID_PATTERN.test('0123456789abcdef0123456789abcdef')).toBe(true);
    expect(BACKUP_ID_PATTERN.test('../../etwas')).toBe(false);
    expect(BACKUP_ID_PATTERN.test('0123456789ABCDEF0123456789ABCDEF')).toBe(false);
  });
});
