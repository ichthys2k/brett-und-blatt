import { describe, expect, it } from 'vitest';
import { buildIcs, calendarEvents, icsEscape, icsFold, icsTime, type CalendarLabels, type CalendarSource } from '../apps/web/src/lib/calendar';

const START = Date.UTC(2026, 10, 14, 9, 30);
const labels: CalendarLabels = {
  player: (id) => (id ? `Spieler ${id}` : 'offen'),
  title: (id) => `Partie ${id}`,
  field: (n) => `Tisch ${n + 1}`,
  deadline: 'Frist',
};
const view: CalendarSource = {
  code: 'ABC',
  settings: { name: 'Vereinsmeisterschaft' },
  you: 'p1',
  schedule: { matchMinutes: 20 },
  stages: [{ deadline: 0 }, { deadline: START + 86_400_000 }],
  matches: [
    { id: 'm1', stage: 0, status: 'open', slots: [{ player: 'p1' }, { player: 'p2' }], plannedAt: START, field: 0 },
    { id: 'm2', stage: 0, status: 'open', slots: [{ player: 'p3' }, { player: 'p4' }], plannedAt: START + 1_500_000 },
    { id: 'm3', stage: 0, status: 'done', slots: [{ player: 'p1' }, { player: 'p3' }], plannedAt: START },
    { id: 'm4', stage: 1, status: 'open', slots: [{ player: 'p1' }, { player: null }] },
    { id: 'm5', stage: 0, status: 'open', slots: [{ player: 'p5' }, { player: 'p6' }] },
  ],
};

describe('Kalenderdatei (#243)', () => {
  it('formatiert UTC-Zeiten', () => expect(icsTime(START)).toBe('20261114T093000Z'));

  it('maskiert Sonderzeichen', () => expect(icsEscape('a,b;c\\d\ne')).toBe('a\\,b\;c\\\\d\\ne'));

  it('faltet lange Zeilen bei 75 Oktetten und zerreißt keine Mehrbyte-Zeichen', () => {
    const folded = icsFold('SUMMARY:' + 'ä'.repeat(80));
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe('SUMMARY:' + 'ä'.repeat(80));
  });

  it('„Ganzer Zeitplan“: alle offenen Partien mit Zeit, sortiert, ohne beendete', () => {
    const all = calendarEvents(view, labels, { mine: false });
    expect(all.map((e) => e.uid)).toEqual(['ABC-m1@spiele.lipponer.de', 'ABC-m2@spiele.lipponer.de', 'ABC-m4@spiele.lipponer.de']);
    expect(all[0]!.end - all[0]!.start).toBe(20 * 60_000);
    expect(all[0]!.location).toBe('Tisch 1');
  });

  it('„Meine Partien“: nur die mit eigener Kennung; Phasenfrist, wenn keine Uhrzeit feststeht', () => {
    const mine = calendarEvents(view, labels, { mine: true });
    expect(mine.map((e) => e.uid)).toEqual(['ABC-m1@spiele.lipponer.de', 'ABC-m4@spiele.lipponer.de']);
    expect(mine[1]!.summary).toContain('(Frist)');
    expect(mine[1]!.summary).toContain('offen');
  });

  it('„Meine Partien“ ist als Zuschauer leer', () => {
    expect(calendarEvents({ ...view, you: null }, labels, { mine: true })).toEqual([]);
  });

  it('baut gültige Datei mit CRLF, stabiler UID und Kopfzeilen', () => {
    const events = calendarEvents(view, labels, { mine: false, url: 'https://spiele.lipponer.de/#/turnier/ABC' });
    const ics = buildIcs(events, { name: 'Vereinsmeisterschaft', now: START });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain('UID:ABC-m1@spiele.lipponer.de');
    expect(ics).toContain('DTSTART:20261114T093000Z');
    expect(ics).not.toMatch(/[^\r]\n/);
    expect(buildIcs(events, { name: 'x', now: START + 5 })).toContain('UID:ABC-m1@spiele.lipponer.de');
  });
});
