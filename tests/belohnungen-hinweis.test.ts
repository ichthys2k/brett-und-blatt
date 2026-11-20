import { describe, expect, it } from 'vitest';
import { LEVELS } from '../apps/web/src/lib/stufen';
import { noticeFor, noticeText, parseSeen, type NoticeInput } from '../apps/web/src/lib/rewards';

/* Hinweis am Partieende und Sammelhinweis (#574): wann erscheint ein Hinweis, was wird als gesehen gemerkt? Reine Funktion. */

const base: NoticeInput = { seen: 1, current: 1, hidden: false, guest: false, moment: 'game' };
const ask = (over: Partial<NoticeInput>) => noticeFor({ ...base, ...over });

describe('Hinweis nach einer Partie', () => {
  it('Aufstieg: einzelner Hinweis und neue Stufe merken', () => {
    expect(ask({ seen: 1, current: 2 })).toEqual({ show: 'up', store: 2 });
  });
  it('kein Aufstieg: nichts, nichts speichern', () => {
    expect(ask({ seen: 2, current: 2 })).toEqual({ show: null, store: null });
  });
  it('Stufe sinkt nie, ein niedrigerer Wert löst nichts aus', () => {
    expect(ask({ seen: 3, current: 2 })).toEqual({ show: null, store: null });
  });
  it('mehrere Stufen auf einmal: ein einziger Hinweis', () => {
    expect(ask({ seen: 0, current: 3 })).toEqual({ show: 'up', store: 3 });
  });
});

describe('Sammelhinweis beim ersten Start (rückwirkender Aufstieg)', () => {
  it('noch nie gespeichert und schon Stufe: ein gesammelter Hinweis, Stufe gilt danach als gesehen', () => {
    expect(ask({ seen: null, current: 3, moment: 'start' })).toEqual({ show: 'collected', store: 3 });
  });
  it('danach (Stufe gespeichert) kommt beim nächsten Start nichts mehr', () => {
    expect(ask({ seen: 3, current: 3, moment: 'start' })).toEqual({ show: null, store: null });
  });
  it('neuer Pass ohne Stufe: still als 0 merken, kein Hinweis', () => {
    expect(ask({ seen: null, current: 0, moment: 'start' })).toEqual({ show: null, store: 0 });
  });
  it('endet die erste Partie vor dem ersten Start-Check, ist es kein rückwirkender Aufstieg', () => {
    expect(ask({ seen: null, current: 1, moment: 'game' })).toEqual({ show: null, store: 1 });
  });
  it('Aufstieg auf einem anderen Gerät: beim Start ein gesammelter Hinweis', () => {
    expect(ask({ seen: 1, current: 3, moment: 'start' })).toEqual({ show: 'collected', store: 3 });
  });
});

describe('Ausnahmen', () => {
  it('Gast bekommt nie einen Hinweis und speichert nichts', () => {
    expect(ask({ guest: true, seen: 0, current: 2 })).toEqual({ show: null, store: null });
    expect(ask({ guest: true, seen: null, current: 3, moment: 'start' })).toEqual({ show: null, store: null });
  });
  it('„Belohnungen nicht anzeigen“ unterdrückt den Hinweis, die Stufe gilt trotzdem als gesehen', () => {
    expect(ask({ hidden: true, seen: 1, current: 2 })).toEqual({ show: null, store: 2 });
    expect(ask({ hidden: true, seen: null, current: 3, moment: 'start' })).toEqual({ show: null, store: 3 });
  });
});

describe('Texte und gespeicherter Wert', () => {
  it('Titel stehen im Text', () => {
    expect(noticeText('up', LEVELS[1]!)).toBe('Neuer Titel: Stammgast');
    expect(noticeText('collected', LEVELS[3]!)).toContain('Meister');
  });
  it('gespeicherte Stufe wird streng gelesen', () => {
    expect(parseSeen(null)).toBeNull();
    expect(parseSeen('2')).toBe(2);
    expect(parseSeen('4')).toBe(4);
    expect(parseSeen('5')).toBeNull();
    expect(parseSeen('-1')).toBeNull();
    expect(parseSeen('x')).toBeNull();
    expect(parseSeen('12')).toBeNull();
  });
});
