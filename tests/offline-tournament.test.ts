import { Tournament, applyTournamentMessage, type TournamentClientMessage, type TournamentSettings } from '../packages/online/src';
import { beforeEach, describe, expect, it } from 'vitest';

/** Leitung ohne Netz (W-058 Stufe 6, #190): Browser-Speicher nachgebaut, damit die Logik ohne Browser läuft. */
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
(globalThis as unknown as { window: unknown }).window = { localStorage: localStorageMock, setTimeout, clearTimeout };
(globalThis as unknown as { localStorage: unknown }).localStorage = localStorageMock;

const profile = { name: 'Leitung', avatar: '🏆' };
const base: TournamentSettings = { name: 'Abend', gameId: '', format: 'knockout', time: 'normal', days: 1, thirdPlace: false, mode: 'local', sport: 'Tischkicker', result: 'winner' };

async function offline() {
  return import('../apps/web/src/lib/offlineTournament');
}

beforeEach(() => store.clear());

describe('Turnier ohne Netz', () => {
  it('Kennung unterscheidet sich von Servercodes', async () => {
    const { isOfflineCode } = await offline();
    expect(isOfflineCode('LOKAL-A1B2C3')).toBe(true);
    expect(isOfflineCode('ABCD2345')).toBe(false);
    expect(isOfflineCode('LOKAL-abc')).toBe(false);
  });

  it('anlegen, bedienen, Neuladen: der Stand bleibt erhalten', async () => {
    const { createOfflineTournament, applyOfflineMessage, offlineView, listOfflineRecords } = await offline();
    const code = createOfflineTournament(base, profile, 2)!;
    expect(code).toMatch(/^LOKAL-/);
    expect(applyOfflineMessage(code, profile, { type: 'addEntrants', names: ['Anna', 'Ben', 'Cara', 'Dora'] }).ok).toBe(true);
    expect(applyOfflineMessage(code, profile, { type: 'start' }).ok).toBe(true);
    // „Neuladen“: Die Sicht kommt allein aus dem Speicher.
    const view = offlineView(code)!;
    expect(view.phase).toBe('running');
    expect(view.isLeader).toBe(true);
    expect(view.fields).toBe(2);
    expect(listOfflineRecords()).toHaveLength(1);
    expect(listOfflineRecords()[0]!.log).toHaveLength(2);
  });

  it('Eingaben werden wie auf dem Server geprüft und abgelehnt, ohne den Stand zu ändern', async () => {
    const { createOfflineTournament, applyOfflineMessage, loadOfflineRecord } = await offline();
    const code = createOfflineTournament(base, profile)!;
    const early = applyOfflineMessage(code, profile, { type: 'start' });
    expect(early.ok).toBe(false);
    expect(loadOfflineRecord(code)!.log).toHaveLength(0);
    expect(applyOfflineMessage('LOKAL-000000', profile, { type: 'start' })).toMatchObject({ ok: false });
  });

  it('Löschen entfernt das Turnier vom Gerät', async () => {
    const { createOfflineTournament, applyOfflineMessage, loadOfflineRecord } = await offline();
    const code = createOfflineTournament(base, profile)!;
    expect(applyOfflineMessage(code, profile, { type: 'delete' })).toMatchObject({ ok: true, deleted: true });
    expect(loadOfflineRecord(code)).toBeNull();
  });

  it('Übertragung: dieselben Nachrichten mit demselben Startwert ergeben auf dem Server denselben Stand', async () => {
    const { createOfflineTournament, applyOfflineMessage, loadOfflineRecord } = await offline();
    const code = createOfflineTournament({ ...base, format: 'world', groupCount: 2 }, profile, 1)!;
    const names = Array.from({ length: 8 }, (_, i) => `Spieler${i + 1}`);
    applyOfflineMessage(code, profile, { type: 'addEntrants', names });
    applyOfflineMessage(code, profile, { type: 'start' });
    // Ein paar Ergebnisse eintragen.
    for (let round = 0; round < 3; round++) {
      const record = loadOfflineRecord(code)!;
      const tournament = Tournament.restore(record.snapshot, { now: () => Date.now(), randomClaim: () => 'X' });
      const open = tournament.view('').matches.filter((m) => (m.status === 'open' || m.status === 'running') && m.slots[0].player && m.slots[1].player).slice(0, 2);
      for (const m of open) applyOfflineMessage(code, profile, { type: 'enterResult', match: m.id, winner: 0 });
    }
    const record = loadOfflineRecord(code)!;
    expect(record.log.length).toBeGreaterThan(3);

    // „Server“: neu anlegen mit demselben Startwert, Nachrichten der Reihe nach wiederholen.
    const token = (JSON.parse(store.get('brett-und-blatt:geraet') ?? 'null') as string | null) ?? record.snapshot.leaderToken;
    const server = Tournament.create('ABCD2345', record.seed, record.settings, { token, name: profile.name }, { now: () => Date.now(), randomClaim: () => 'X' }, record.fields);
    for (const message of record.log as Exclude<TournamentClientMessage, { type: 'hello' }>[]) {
      const result = applyTournamentMessage(server, { token, name: profile.name, avatar: profile.avatar }, message);
      expect(result.kind).toBe('ok');
    }
    const [a, b] = [record.snapshot, server.snapshot()];
    expect(b.matches.map((m) => [m.id, m.slots.map((s) => s.player), m.outcome?.winner])).toEqual(a.matches.map((m) => [m.id, m.slots.map((s) => s.player), m.outcome?.winner]));
    expect(b.groups).toEqual(a.groups);
    expect(b.phase).toBe(a.phase);
  });
});

describe('Serie ohne Netz (#205)', () => {
  it('merkt sich den Zuordnungscode, zeigt die Serie und nimmt nur gültige Codes', async () => {
    const { createOfflineTournament, applyOfflineMessage, loadOfflineRecord } = await offline();
    const code = createOfflineTournament(base, profile, 0)!;
    const bad = applyOfflineMessage(code, profile, { type: 'attachSeries', link: 'quatsch' });
    expect(bad).toMatchObject({ ok: false });
    const good = applyOfflineMessage(code, profile, { type: 'attachSeries', link: 'serue234-key22222' });
    expect(good.ok && 'view' in good && good.view.series).toBe('SERUE234');
    expect(loadOfflineRecord(code)?.seriesLink).toBe('SERUE234-KEY22222');
    // Die Serie gehört nicht ins Protokoll, das der Abgleich wiederholt.
    expect(loadOfflineRecord(code)?.log.some((m) => m.type === 'attachSeries')).toBe(false);
    const gone = applyOfflineMessage(code, profile, { type: 'detachSeries' });
    expect(gone.ok && 'view' in gone && gone.view.series).toBeNull();
    expect(loadOfflineRecord(code)?.seriesLink).toBeUndefined();
  });

  it('die Leitung übergeben geht ohne Netz nicht', async () => {
    const { createOfflineTournament, applyOfflineMessage } = await offline();
    const code = createOfflineTournament(base, profile, 0)!;
    expect(applyOfflineMessage(code, profile, { type: 'leaderCode' })).toMatchObject({ ok: false, error: expect.stringMatching(/Ohne Netz/) });
  });
});
