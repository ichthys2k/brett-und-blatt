import { describe, expect, it } from 'vitest';
import { Tournament, parseTournamentMessage, parseTournamentSettings, type TournamentSettings } from '../src';

/** Spieleabend mit Wunschdisziplinen (W-058 Stufe 3 Teil 2, #129). */

const token = (i: number) => `kennung-spieler-${String(i).padStart(4, '0')}`;
const LEADER = 'kennung-der-leitung-01';

const games: Record<string, { info: never; options: [] }> = Object.fromEntries(
  [
    ['chess', 'Schach', 2],
    ['connect-four', 'Vier in einer Reihe', 2],
    ['reversi', 'Reversi', 2],
    ['uno', 'Eins!', 10],
  ].map(([id, name, max]) => [id, { info: { id, name, players: { min: 2, max } } as never, options: [] }]),
);
const find = (id: string) => games[id];

function setup(players: number, extra: Partial<TournamentSettings> = {}) {
  const clock = { now: 1_000_000 };
  const settings: TournamentSettings = { name: 'Spieleabend', gameId: 'chess', format: 'league', time: 'fast', days: 1, minutes: 15, thirdPlace: false, disciplines: ['chess', 'connect-four', 'reversi'], ...extra };
  const t = Tournament.create('ABCD2345', 'seed-1', settings, { token: LEADER, name: 'Leitung' }, { now: () => clock.now, randomClaim: () => 'NEUCODE1' });
  for (let i = 0; i < players; i++) expect(t.join(token(i), `Spieler${i}`, '🦊')).toBeNull();
  return { t, clock };
}

describe('Spieleabend', () => {
  it('Einstellungen: nur im Bundesliga-Modus, 2 bis 8 verschiedene Spiele', () => {
    const base = { name: 'Abend', format: 'league', time: 'fast', minutes: 15 };
    expect(parseTournamentSettings({ ...base, disciplines: ['chess', 'reversi'], wishes: true }, find)).toMatchObject({ gameId: 'chess', disciplines: ['chess', 'reversi'], wishes: true });
    expect(parseTournamentSettings({ ...base, disciplines: ['chess'] }, find)).toBeNull();
    expect(parseTournamentSettings({ ...base, disciplines: ['chess', 'chess'] }, find)).toBeNull();
    expect(parseTournamentSettings({ ...base, disciplines: ['chess', 'gibtsnicht'] }, find)).toBeNull();
    expect(parseTournamentSettings({ ...base, format: 'swiss', disciplines: ['chess', 'reversi'] }, find)).toBeNull();
    // Vor Ort: freie Namen.
    expect(parseTournamentSettings({ name: 'Abend', mode: 'local', format: 'league', disciplines: ['Dart', 'Kicker', 'Billard'] }, find)).toMatchObject({ sport: 'Spieleabend', disciplines: ['Dart', 'Kicker', 'Billard'] });
    expect(parseTournamentMessage(JSON.stringify({ type: 'wish', disciplines: ['chess'] }))).toEqual({ type: 'wish', disciplines: ['chess'] });
  });

  it('je Spieltag ein anderes Spiel, Räume mit dem Spiel des Spieltags', () => {
    const { t } = setup(4);
    expect(t.start(LEADER)).toBeNull();
    const view = t.view(LEADER);
    expect(view.disciplines.map((d) => d.id)).toEqual(['chess', 'connect-four', 'reversi']);
    // Vier Spieler: drei Spieltage, jeder eine Disziplin.
    expect(view.stages).toHaveLength(3);
    for (let stage = 0; stage < 3; stage++) {
      expect(t.startRound(LEADER)).toBeNull();
      const requests = t.pendingRooms();
      expect(requests).toHaveLength(2);
      expect(requests.every((r) => r.gameId === view.disciplines[stage]!.id)).toBe(true);
      for (const r of requests) {
        t.roomCreated(r.match, `raum-${r.match}`);
        t.report(r.match, `raum-${r.match}`, { kind: 'played', winner: 0 });
      }
    }
    const done = t.view(LEADER);
    expect(done.phase).toBe('finished');
    expect(done.disciplineTables.map((d) => d.id)).toEqual(['chess', 'connect-four', 'reversi']);
    // Je Disziplin hat jeder genau eine Partie gespielt.
    for (const { table } of done.disciplineTables) expect(table.every((row) => row.played === 1)).toBe(true);
    expect(done.table.every((row) => row.played === 3)).toBe(true);
  });

  it('Wünsche: nur gewünschte Disziplinen, meistgewünschte zuerst', () => {
    const { t } = setup(5, { wishes: true });
    expect(t.wish(token(0), ['reversi', 'chess'])).toBeNull();
    expect(t.wish(token(1), ['reversi'])).toBeNull();
    expect(t.wish(token(2), ['gibtsnicht'])).toBe('Diese Disziplin gibt es hier nicht.');
    expect(t.wish('kennung-fremder-geraet-1', ['chess'])).toBe('Schreib dich zuerst ein.');
    expect(t.view(token(0)).yourWishes).toEqual(['reversi', 'chess']);
    expect(t.view(token(3)).disciplines).toEqual([
      { id: 'chess', wishes: 1 },
      { id: 'connect-four', wishes: 0 },
      { id: 'reversi', wishes: 2 },
    ]);
    // Wer geht, nimmt seine Wünsche mit.
    t.leave(token(1));
    expect(t.view(token(3)).disciplines.find((d) => d.id === 'reversi')!.wishes).toBe(1);
    t.wish(token(2), ['reversi']);
    t.start(LEADER);
    expect(t.view(LEADER).disciplines.map((d) => d.id)).toEqual(['reversi', 'chess']);
    expect(t.wish(token(0), ['chess'])).toBe('Die Einschreibung ist beendet.');
  });

  it('ohne Wünsche gilt die Reihenfolge der Leitung; ohne Wunschfunktion keine Wünsche', () => {
    const { t } = setup(4);
    expect(t.wish(token(0), ['chess'])).toBe('In diesem Turnier gibt es keine Wünsche.');
  });
});
