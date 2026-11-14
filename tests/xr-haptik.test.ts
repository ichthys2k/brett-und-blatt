import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PATTERNS, bindHapticSession, pulse, setVibration, vibrationEnabled } from '../apps/xr/src/haptics';

function sessionWith(pulseFn: (v: number, d: number) => unknown): XRSession {
  return { inputSources: [{ gamepad: { hapticActuators: [{ pulse: pulseFn }] } }, { gamepad: null }] } as unknown as XRSession;
}

describe('Vibration (#380)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVibration(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    bindHapticSession(() => null);
  });

  it('hat für jede Art ein Muster', () => {
    for (const kind of ['hover', 'select', 'move', 'turn', 'error'] as const) expect(PATTERNS[kind].length).toBeGreaterThan(0);
  });

  it('löst nichts aus, wenn keine Sitzung oder kein Aktor da ist', () => {
    expect(pulse('move')).toBe(false);
    bindHapticSession(() => ({ inputSources: [{ gamepad: null }] }) as unknown as XRSession);
    expect(pulse('move')).toBe(false);
  });

  it('vibriert den Controller und spielt Muster mit Pausen', () => {
    const calls: number[][] = [];
    bindHapticSession(() => sessionWith((v, d) => calls.push([v, d])));
    expect(pulse('turn')).toBe(true);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(200);
    expect(calls).toHaveLength(2);
  });

  it('lässt sich abschalten', () => {
    const calls: number[][] = [];
    bindHapticSession(() => sessionWith((v, d) => calls.push([v, d])));
    setVibration(false);
    expect(vibrationEnabled()).toBe(false);
    expect(pulse('move')).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('verschluckt Fehler des Geräts', () => {
    bindHapticSession(() =>
      sessionWith(() => {
        throw new Error('kaputt');
      }),
    );
    expect(() => pulse('move')).not.toThrow();
  });
});
