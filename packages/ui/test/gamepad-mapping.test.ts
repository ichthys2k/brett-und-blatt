import { describe, expect, it } from 'vitest';
import {
  applyDeadzone,
  createRepeatTracker,
  keyboardEventToIntent,
  readGamepadRawState,
  type GamepadSnapshot,
} from '../src/input/gamepadMapping';

function makePad(overrides: Partial<GamepadSnapshot> = {}): GamepadSnapshot {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  return {
    index: 0,
    mapping: 'standard',
    buttons,
    axes: [0, 0, 0, 0],
    ...overrides,
  };
}

describe('gamepadMapping', () => {
  it('wendet Deadzone sauber an', () => {
    expect(applyDeadzone(0.1, 0.25)).toBe(0);
    expect(applyDeadzone(-0.24, 0.25)).toBe(0);
    expect(applyDeadzone(1, 0.25)).toBeCloseTo(1);
    expect(applyDeadzone(-1, 0.25)).toBeCloseTo(-1);
    expect(applyDeadzone(0.625, 0.25)).toBeCloseTo(0.5);
  });

  it('erkennt Standard-Buttons und D-Pad', () => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    buttons[0] = { pressed: true, value: 1 }; // A
    buttons[2] = { pressed: true, value: 1 }; // X
    buttons[4] = { pressed: true, value: 1 }; // LB
    buttons[12] = { pressed: true, value: 1 }; // D-Pad Up
    const state = readGamepadRawState(makePad({ buttons }));
    expect(state.activeIntents.has('confirm')).toBe(true);
    expect(state.activeIntents.has('inspect')).toBe(true);
    expect(state.activeIntents.has('zonePrev')).toBe(true);
    expect(state.activeIntents.has('up')).toBe(true);
    expect(state.anyPressed).toBe(true);
  });

  it('erkennt linken und rechten Stick oberhalb der Deadzone', () => {
    const state = readGamepadRawState(makePad({ axes: [0.8, 0, 0, 0.9] }), 0.25);
    expect(state.activeIntents.has('right')).toBe(true);
    expect(state.activeIntents.has('scrollDown')).toBe(true);
  });

  it('wiederholt Richtungen nach Verzögerung, Aktionsbuttons aber nur einmal', () => {
    const tracker = createRepeatTracker(400, 100);
    const held = new Set<'right' | 'confirm'>(['right', 'confirm']);

    expect(tracker.step(held, 0)).toEqual(['right', 'confirm']);
    expect(tracker.step(held, 200)).toEqual([]);
    expect(tracker.step(held, 400)).toEqual(['right']);
    expect(tracker.step(held, 450)).toEqual([]);
    expect(tracker.step(held, 500)).toEqual(['right']);

    // Nach Loslassen wieder frisch
    expect(tracker.step(new Set(), 550)).toEqual([]);
    expect(tracker.step(new Set(['confirm']), 600)).toEqual(['confirm']);
  });

  it('übersetzt Tastaturereignisse und schützt Textfelder', () => {
    expect(keyboardEventToIntent({ key: 'ArrowLeft' })).toBe('left');
    expect(keyboardEventToIntent({ key: 'i' })).toBe('inspect');
    expect(keyboardEventToIntent({ key: 'Escape' })).toBe('cancel');

    // Im Textfeld bleiben Pfeiltasten und Buchstaben beim Input
    expect(keyboardEventToIntent({ key: 'ArrowLeft' }, { inTextInput: true })).toBeNull();
    expect(keyboardEventToIntent({ key: 'i' }, { inTextInput: true })).toBeNull();
    expect(keyboardEventToIntent({ key: 'Escape' }, { inTextInput: true })).toBe('cancel');
  });
});
