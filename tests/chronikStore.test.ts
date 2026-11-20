import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ein Speicher wie localStorage, damit Chronik und Pässe echt laufen.
const data = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  },
});
vi.mock('../apps/web/src/lib/playerPass', () => ({ passSyncSoon: () => undefined }));

const { rememberReplay, loadAblage, ABLAGE_KEY } = await import('../apps/web/src/lib/chronikStore');
const { passBook } = await import('../apps/web/src/lib/passes');

const replay = { config: { gameId: 'dame', seed: 's', seats: [] }, log: [] } as never;

describe('Zugliste für das Anheften (#561, #558)', () => {
  beforeEach(() => data.clear());

  it('Hot-Seat: auch der nicht aktive Pass bekommt die Zugliste in seine Ablage', () => {
    const ben = passBook.touch({ name: 'Ben', avatar: '🐻', hasCode: false })!;
    const anna = passBook.createNew({ name: 'Ben', avatar: '🐻', hasCode: false })!;
    passBook.switchTo(ben, { name: 'Ben', avatar: '🐻', hasCode: false });
    expect(passBook.activeId()).toBe(ben);
    rememberReplay('h1', replay, [null, ben, anna]);
    expect(Object.keys(loadAblage())).toEqual(['h1']);
    const annas = JSON.parse(data.get(`brett-und-blatt:pass:${anna}:${ABLAGE_KEY}`)!);
    expect(Object.keys(annas)).toEqual(['h1']);
  });

  it('ein Gast merkt sich keine Zugliste', () => {
    passBook.createNew({ name: '', avatar: '', hasCode: false }, { guest: true });
    rememberReplay('g1', replay);
    expect(data.get(ABLAGE_KEY)).toBeUndefined();
  });
});
