import { beforeEach, describe, expect, it } from 'vitest';

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
(globalThis as unknown as { window: unknown }).window = { localStorage: localStorageMock };
(globalThis as unknown as { localStorage: unknown }).localStorage = localStorageMock;

const load = () => import('../apps/web/src/lib/orgNotice');
const mine = (id: string, status: 'open' | 'approved' | 'rejected') => ({ id, orgName: 'SV', kind: 'verein' as const, at: 1, status });

beforeEach(() => store.clear());

describe('Hinweis zu Anträgen auf Organisationen (#228)', () => {
  it('ohne Antrag fragt das Gerät nicht nach', async () => {
    const { hasAppliedForOrg, markOrgApplied } = await load();
    expect(hasAppliedForOrg()).toBe(false);
    markOrgApplied('abc');
    expect(hasAppliedForOrg()).toBe(true);
  });

  it('jede Entscheidung erscheint einmal, offene Anträge nie', async () => {
    const { unseenOrgDecisions, markOrgSeen } = await load();
    const requests = [mine('a', 'open'), mine('b', 'approved'), mine('c', 'rejected')];
    expect(unseenOrgDecisions(requests).map((r) => r.id)).toEqual(['b', 'c']);
    markOrgSeen(['b']);
    expect(unseenOrgDecisions(requests).map((r) => r.id)).toEqual(['c']);
    markOrgSeen(['c']);
    expect(unseenOrgDecisions(requests)).toEqual([]);
  });
});
