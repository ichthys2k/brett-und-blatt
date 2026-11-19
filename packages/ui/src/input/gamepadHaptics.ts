export type HapticPattern = 'turn' | 'confirm' | 'error' | 'tick';

interface EffectSpec {
  duration: number;
  strongMagnitude: number;
  weakMagnitude: number;
}

const PATTERNS: Record<HapticPattern, EffectSpec> = {
  tick: { duration: 18, strongMagnitude: 0, weakMagnitude: 0.18 },
  confirm: { duration: 40, strongMagnitude: 0.15, weakMagnitude: 0.35 },
  turn: { duration: 70, strongMagnitude: 0.25, weakMagnitude: 0.4 },
  error: { duration: 120, strongMagnitude: 0.55, weakMagnitude: 0.55 },
};

/**
 * Löst einen kurzen Vibrationsimpuls auf verbundenen Controllern aus (falls unterstützt).
 */
export function triggerGamepadHaptic(pattern: HapticPattern, enabled = true): void {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
  const spec = PATTERNS[pattern];
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (!pad) continue;
    const actuator = (
      pad as Gamepad & {
        vibrationActuator?: {
          playEffect?: (
            type: string,
            params: { startDelay: number; duration: number; strongMagnitude: number; weakMagnitude: number },
          ) => Promise<unknown>;
        };
      }
    ).vibrationActuator;
    if (actuator?.playEffect) {
      try {
        void actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: spec.duration,
          strongMagnitude: spec.strongMagnitude,
          weakMagnitude: spec.weakMagnitude,
        });
      } catch {
        // Manche Browser/Treiber werfen bei fehlender Unterstützung.
      }
    }
  }
}
