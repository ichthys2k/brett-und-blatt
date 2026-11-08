import { describe, expect, it } from 'vitest';
import { ATTEMPT_LIMIT, ATTEMPT_WINDOW_MS, isBlocked, recordMiss, type AttemptState } from '../src/attempts';

describe('Fehlversuche begrenzen', () => {
  it('sperrt erst nach dem Limit', () => {
    let state: AttemptState | null = null;
    for (let i = 0; i < ATTEMPT_LIMIT - 1; i++) state = recordMiss(state, 1000);
    expect(isBlocked(state, 1000)).toBe(false);
    state = recordMiss(state, 1000);
    expect(isBlocked(state, 1000)).toBe(true);
  });

  it('hebt die Sperre nach dem Zeitfenster auf und zählt neu', () => {
    let state: AttemptState | null = null;
    for (let i = 0; i < ATTEMPT_LIMIT; i++) state = recordMiss(state, 0);
    expect(isBlocked(state, ATTEMPT_WINDOW_MS - 1)).toBe(true);
    expect(isBlocked(state, ATTEMPT_WINDOW_MS)).toBe(false);
    expect(recordMiss(state, ATTEMPT_WINDOW_MS)).toEqual({ since: ATTEMPT_WINDOW_MS, misses: 1 });
  });

  it('kennt unbekannte Absender als nicht gesperrt', () => {
    expect(isBlocked(null, 0)).toBe(false);
  });
});
