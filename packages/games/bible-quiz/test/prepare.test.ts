import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KATALOG_DATEI, KATALOG_PFAD, prepare } from '../src';
import { hasQuestionCatalog, questionCatalog, setQuestionCatalog } from '../src/questions';

const fragen = [
  {
    id: 1,
    category: 'Personen' as const,
    difficulty: 1 as const,
    emojis: '👑🎵',
    options: ['David', 'Saul', 'Salomo', 'Josia'] as const,
    info: 'David spielte für Saul.',
  },
];

const antwort = (data: unknown, ok = true): Promise<Response> =>
  Promise.resolve({ ok, status: ok ? 200 : 500, json: async () => data } as Response);

// Der Katalog wird für alle Tests einmal gesetzt (tests/katalog.ts) – hier erst leer anfangen.
beforeEach(() => setQuestionCatalog([]));

afterEach(() => {
  vi.unstubAllGlobals();
  setQuestionCatalog([]);
});

describe('Bibel-Quiz – Katalog laden', () => {
  it('holt die Fragen vom Spieleserver, wenn er antwortet', async () => {
    const fetchMock = vi.fn(async (_url: string) => antwort({ version: 'abc', questions: fragen }));
    vi.stubGlobal('fetch', fetchMock);

    await prepare({ serverUrl: 'https://server.example/', baseUrl: '/app/' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(`https://server.example${KATALOG_PFAD}`);
    expect(questionCatalog()).toHaveLength(1);
    expect(hasQuestionCatalog()).toBe(true);
  });

  it('greift auf die mitgelieferte Datei zurück, wenn der Server nicht antwortet', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('server.example') ? Promise.reject(new Error('offline')) : antwort(fragen),
    );
    vi.stubGlobal('fetch', fetchMock);

    await prepare({ serverUrl: 'https://server.example', baseUrl: '/app/' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `https://server.example${KATALOG_PFAD}`,
      `/app/${KATALOG_DATEI}`,
    ]);
    expect(questionCatalog()).toHaveLength(1);
  });

  it('nimmt die Datei auch, wenn der Server mit Fehler antwortet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url.includes('server.example') ? antwort({}, false) : antwort(fragen))),
    );

    await prepare({ serverUrl: 'https://server.example', baseUrl: '/app/' });
    expect(questionCatalog()).toHaveLength(1);
  });

  it('lädt ohne Serveradresse direkt die mitgelieferte Datei', async () => {
    const fetchMock = vi.fn(async (_url: string) => antwort(fragen));
    vi.stubGlobal('fetch', fetchMock);

    await prepare({ serverUrl: null, baseUrl: '/' });

    expect(fetchMock.mock.calls[0]![0]).toBe(`/${KATALOG_DATEI}`);
  });

  it('meldet klar, wenn keine Quelle erreichbar ist', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));

    await expect(prepare({ serverUrl: 'https://server.example', baseUrl: '/app/' })).rejects.toThrow(
      /Fragenkatalog/,
    );
  });

  it('fragt nichts nach, wenn der Katalog schon gesetzt ist (z. B. auf dem Server)', async () => {
    setQuestionCatalog(fragen);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await prepare({ serverUrl: 'https://server.example', baseUrl: '/app/' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('verlangt vor dem Start einen geladenen Katalog', async () => {
    // Frischer Modulstand: nichts gesetzt, wie in einer Umgebung, die `prepare` ausgelassen hat.
    vi.resetModules();
    const rules = await import('../src/rules');
    expect(() => rules.setup(1, {}, 'ohne-katalog')).toThrow(/Fragenkatalog/);
  });
});
