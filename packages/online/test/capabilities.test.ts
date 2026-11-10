import { describe, expect, it } from 'vitest';
import { can, roomCapabilities, tournamentCapabilities } from '../src/capabilities';

describe('Moderations-Fähigkeiten', () => {
  it('die Raumleitung darf alles, wer nicht Raumleitung ist, nichts', () => {
    expect(roomCapabilities(true)).toEqual(['kick', 'rename', 'unseat', 'lockNames', 'restart']);
    expect(roomCapabilities(false)).toEqual([]);
  });

  it('can fragt eine Fähigkeit ab', () => {
    expect(can(roomCapabilities(true), 'kick')).toBe(true);
    expect(can(roomCapabilities(false), 'kick')).toBe(false);
    expect(can(['rename'], 'rename')).toBe(true);
    expect(can(['rename'], 'kick')).toBe(false);
  });

  it('Turnier: Leitung verwaltet, Helfer trägt nur vor Ort ein, nur die Hauptleitung löscht', () => {
    const base = { isLeader: false, helperRole: null, mayDelete: false, local: true } as const;
    expect(tournamentCapabilities(base)).toEqual([]);
    const main = tournamentCapabilities({ ...base, isLeader: true, mayDelete: true });
    expect(main).toEqual(['entrants', 'tools', 'enterResult', 'checkin', 'print', 'deleteTournament']);
    const co = tournamentCapabilities({ ...base, isLeader: true, helperRole: 'coleader' });
    expect(can(co, 'tools')).toBe(true);
    expect(can(co, 'deleteTournament')).toBe(false);
    const helper = tournamentCapabilities({ ...base, helperRole: 'helper' });
    expect(helper).toEqual(['enterResult', 'checkin', 'print']);
    // Online trägt kein Helfer Ergebnisse ein (die Teilnehmer melden selbst).
    expect(can(tournamentCapabilities({ ...base, helperRole: 'helper', local: false }), 'enterResult')).toBe(false);
  });
});
