import { describe, expect, it } from 'vitest';
import { ORG_REQUESTS_KEEP_MS, ORG_REQUESTS_OPEN_MAX, decideRequest, emptyDesk, openRequests, pruneDesk, requestsOf, setApproved, submitRequest } from '../src/org-requests';

const NOW = 5_000_000;
const A = 'kennung-antrag-000001';
const B = 'kennung-antrag-000002';
const ask = (desk = emptyDesk(), token = A, extra: Record<string, unknown> = {}) => submitRequest(desk, { token, name: 'Bea', avatar: '🦊', orgName: 'SV Beispiel', kind: 'verein', purpose: 'Unser Kickerabend im Verein', ...extra }, NOW);

describe('Anträge auf Organisationen (#228)', () => {
  it('Antrag stellen prüft Name, Art und Zweck', () => {
    const desk = emptyDesk();
    expect(ask(desk)).toMatchObject({ ok: true });
    for (const bad of [{ orgName: '' }, { kind: 'firma' }, { purpose: '' }, { name: '' }]) expect(ask(emptyDesk(), A, bad)).toHaveProperty('error');
    expect(submitRequest(emptyDesk(), { token: 'kurz', name: 'Bea', orgName: 'X', kind: 'verein', purpose: 'Zweck' }, NOW)).toHaveProperty('error');
  });

  it('je Pass nur ein offener Antrag, nach Entscheidung wieder möglich', () => {
    const desk = emptyDesk();
    const first = ask(desk) as { id: string };
    expect(ask(desk)).toHaveProperty('error');
    expect(ask(desk, B)).toMatchObject({ ok: true });
    expect(decideRequest(desk, first.id, false, 'Bitte genauer beschreiben', NOW)).toMatchObject({ ok: true });
    expect(ask(desk)).toMatchObject({ ok: true });
  });

  it('Ablehnen: Anmerkung kommt beim Antragsteller an, Betreiber sieht keine Kennung', () => {
    const desk = emptyDesk();
    const { id } = ask(desk) as { id: string };
    expect(JSON.stringify(openRequests(desk))).not.toContain(A);
    decideRequest(desk, id, false, 'Zu allgemein', NOW + 1);
    expect(requestsOf(desk, A)[0]).toMatchObject({ status: 'rejected', note: 'Zu allgemein' });
    expect(openRequests(desk)).toEqual([]);
    expect(decideRequest(desk, id, true, '', NOW + 2)).toHaveProperty('error');
    expect(requestsOf(desk, B)).toEqual([]);
  });

  it('Freigabe: der Aufrufer legt die Organisation an und trägt den Code ein', () => {
    const desk = emptyDesk();
    const { id } = ask(desk) as { id: string };
    const decided = decideRequest(desk, id, true, '', NOW) as { request: { token: string } };
    expect(decided.request.token).toBe(A);
    expect(requestsOf(desk, A)[0]!.status).toBe('open');
    setApproved(desk, id, '🦊🦊🦊🦊🦊🦊', NOW + 1);
    expect(requestsOf(desk, A)[0]).toMatchObject({ status: 'approved', code: '🦊🦊🦊🦊🦊🦊' });
  });

  it('Grenzen: Entschiedenes verschwindet nach 30 Tagen, zu viele offene Anträge werden abgewiesen', () => {
    const desk = emptyDesk();
    const { id } = ask(desk) as { id: string };
    decideRequest(desk, id, false, '', NOW);
    pruneDesk(desk, NOW + ORG_REQUESTS_KEEP_MS + 1);
    expect(desk.requests).toEqual([]);
    for (let i = 0; i < ORG_REQUESTS_OPEN_MAX; i++) expect(ask(desk, `kennung-antrag-${String(i).padStart(6, '0')}`)).toMatchObject({ ok: true });
    expect(ask(desk, 'kennung-antrag-zuviel')).toHaveProperty('error');
  });
});
