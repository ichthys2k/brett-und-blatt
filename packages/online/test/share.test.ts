import { describe, expect, it } from 'vitest';
import { SHARE_MAX_BYTES, SHARE_TTL_MS, isExpired, mayRemoveShare, putShare } from '../src';

const secret = (c: string) => c.repeat(43).slice(0, 43);
const [OWNER, OTHER] = [secret('o'), secret('x')];

describe('Geteilte Schnappschüsse (#149)', () => {
  it('legt an, ersetzt nur mit dem Schreibgeheimnis und speichert es nie im Klartext', async () => {
    const first = await putShare(null, { secret: OWNER, data: 'QUJD' }, 100);
    if (first.status !== 200) throw new Error('anlegen');
    expect(JSON.stringify(first.record)).not.toContain(OWNER);
    expect(first.record).toMatchObject({ data: 'QUJD', at: 100 });

    expect((await putShare(first.record, { secret: OTHER, data: 'REVG' }, 200)).status).toBe(401);
    const second = await putShare(first.record, { secret: OWNER, data: 'REVG' }, 200);
    expect(second.status === 200 && second.record).toMatchObject({ data: 'REVG', at: 200, hash: first.record.hash });
  });

  it('prüft die Eingaben streng', async () => {
    expect((await putShare(null, null, 0)).status).toBe(400);
    expect((await putShare(null, { secret: 'kurz', data: 'QUJD' }, 0)).status).toBe(400);
    expect((await putShare(null, { secret: OWNER, data: '' }, 0)).status).toBe(400);
    expect((await putShare(null, { secret: OWNER, data: 'kein base64!' }, 0)).status).toBe(400);
    expect((await putShare(null, { secret: OWNER, data: 'A'.repeat(SHARE_MAX_BYTES + 1) }, 0)).status).toBe(400);
    expect((await putShare(null, { secret: OWNER, data: 'A'.repeat(SHARE_MAX_BYTES) }, 0)).status).toBe(200);
  });

  it('löschen darf nur, wer das Geheimnis kennt', async () => {
    const made = await putShare(null, { secret: OWNER, data: 'QUJD' }, 0);
    if (made.status !== 200) throw new Error('anlegen');
    expect(await mayRemoveShare(made.record, { secret: OTHER })).toBe(false);
    expect(await mayRemoveShare(made.record, {})).toBe(false);
    expect(await mayRemoveShare(made.record, { secret: OWNER })).toBe(true);
  });

  it('nach einem Jahr ohne Zugriff ist er abgelaufen', async () => {
    const made = await putShare(null, { secret: OWNER, data: 'QUJD' }, 1000);
    if (made.status !== 200) throw new Error('anlegen');
    expect(isExpired(made.record, 1000 + SHARE_TTL_MS - 1)).toBe(false);
    expect(isExpired(made.record, 1000 + SHARE_TTL_MS)).toBe(true);
  });
});
