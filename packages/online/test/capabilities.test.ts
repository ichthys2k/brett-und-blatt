import { describe, expect, it } from 'vitest';
import { CAPABILITIES, can, roomCapabilities } from '../src/capabilities';

describe('Moderations-Fähigkeiten', () => {
  it('die Raumleitung darf alles, wer nicht Raumleitung ist, nichts', () => {
    expect(roomCapabilities(true)).toEqual([...CAPABILITIES]);
    expect(roomCapabilities(false)).toEqual([]);
  });

  it('can fragt eine Fähigkeit ab', () => {
    expect(can(roomCapabilities(true), 'kick')).toBe(true);
    expect(can(roomCapabilities(false), 'kick')).toBe(false);
    expect(can(['rename'], 'rename')).toBe(true);
    expect(can(['rename'], 'kick')).toBe(false);
  });
});
