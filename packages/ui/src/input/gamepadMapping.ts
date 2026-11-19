/** Semantische Eingabe-Absichten für Controller, Tastatur und Switch-Access. */
export type InputIntent =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'cancel'
  | 'inspect'
  | 'secondary'
  | 'zonePrev'
  | 'zoneNext'
  | 'menu'
  | 'scrollUp'
  | 'scrollDown'
  | 'toggleCursor';

/** Zuletzt genutzte Eingabequelle (steuert Fokus-Ring und Button-Prompts). */
export type InputSourceMode = 'pointer' | 'keyboard' | 'gamepad';

/** Barrierefreie und Standard-Bedienmodi. */
export type ControlMode = 'standard' | 'legalMoves' | 'scanAuto' | 'scanStep';

/** Minimales Gamepad-Abbild für testbare, browserfreie Mapping-Logik. */
export interface GamepadSnapshot {
  index: number;
  id?: string;
  mapping?: string;
  buttons: readonly { pressed: boolean; value?: number }[];
  axes: readonly number[];
}

export interface RawGamepadState {
  activeIntents: Set<InputIntent>;
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  anyPressed: boolean;
}

/** Intents, die bei gedrückter Taste/Richtung automatisch wiederholen dürfen. */
const REPEATABLE_INTENTS: ReadonlySet<InputIntent> = new Set([
  'up',
  'down',
  'left',
  'right',
  'scrollUp',
  'scrollDown',
]);

/** Standard-Gamepad-Button-Indizes nach W3C Gamepad API ("standard" mapping). */
const BTN = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const;

/** Wendet eine radiale/achsenspezifische Deadzone auf eine Analog-Achse an. */
export function applyDeadzone(value: number, deadzone = 0.25): number {
  if (!Number.isFinite(value)) return 0;
  const abs = Math.abs(value);
  if (abs < deadzone) return 0;
  const scaled = (abs - deadzone) / (1 - deadzone);
  return Math.sign(value) * Math.min(1, scaled);
}

/** Liest einen Gamepad-Snapshot mit Deadzone in semantische Intents um. */
export function readGamepadRawState(pad: GamepadSnapshot, deadzone = 0.25): RawGamepadState {
  const activeIntents = new Set<InputIntent>();
  const isPressed = (idx: number): boolean => Boolean(pad.buttons[idx]?.pressed);
  const anyButton = pad.buttons.some((b) => b.pressed || (b.value ?? 0) > 0.5);

  const lx = applyDeadzone(pad.axes[0] ?? 0, deadzone);
  const ly = applyDeadzone(pad.axes[1] ?? 0, deadzone);
  const rx = applyDeadzone(pad.axes[2] ?? 0, deadzone);
  const ry = applyDeadzone(pad.axes[3] ?? 0, deadzone);

  if (isPressed(BTN.DPAD_UP) || ly < -0.35) activeIntents.add('up');
  if (isPressed(BTN.DPAD_DOWN) || ly > 0.35) activeIntents.add('down');
  if (isPressed(BTN.DPAD_LEFT) || lx < -0.35) activeIntents.add('left');
  if (isPressed(BTN.DPAD_RIGHT) || lx > 0.35) activeIntents.add('right');

  if (isPressed(BTN.A)) activeIntents.add('confirm');
  if (isPressed(BTN.B)) activeIntents.add('cancel');
  if (isPressed(BTN.X)) activeIntents.add('inspect');
  if (isPressed(BTN.Y)) activeIntents.add('secondary');
  if (isPressed(BTN.LB)) activeIntents.add('zonePrev');
  if (isPressed(BTN.RB)) activeIntents.add('zoneNext');
  if (isPressed(BTN.START)) activeIntents.add('menu');

  // Rechter Stick oder Trigger fürs Scrollen
  if (ry < -0.35 || (pad.buttons[BTN.LT]?.value ?? 0) > 0.5) activeIntents.add('scrollUp');
  if (ry > 0.35 || (pad.buttons[BTN.RT]?.value ?? 0) > 0.5) activeIntents.add('scrollDown');

  // Soft-Cursor umschalten über L3 oder Select
  if (isPressed(BTN.L3) || isPressed(BTN.SELECT)) activeIntents.add('toggleCursor');

  const anyStick = lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0;

  return {
    activeIntents,
    leftStick: { x: lx, y: ly },
    rightStick: { x: rx, y: ry },
    anyPressed: anyButton || anyStick,
  };
}

export interface RepeatTracker {
  step(pressedIntents: ReadonlySet<InputIntent>, nowMs: number): InputIntent[];
  reset(): void;
}

/**
 * Erzeugt eine reine Wiederholungs-Zustandsmaschine für gehaltene Richtungen/Buttons.
 * Aktionsbuttons feuern nur bei Flanke; Richtungen wiederholen nach initialDelayMs alle repeatIntervalMs.
 */
export function createRepeatTracker(initialDelayMs = 400, repeatIntervalMs = 110): RepeatTracker {
  const heldSince = new Map<InputIntent, number>();
  const lastFired = new Map<InputIntent, number>();

  return {
    step(pressedIntents, nowMs) {
      const fired: InputIntent[] = [];

      // Losgelassene Intents bereinigen
      for (const intent of heldSince.keys()) {
        if (!pressedIntents.has(intent)) {
          heldSince.delete(intent);
          lastFired.delete(intent);
        }
      }

      for (const intent of pressedIntents) {
        const start = heldSince.get(intent);
        if (start === undefined) {
          heldSince.set(intent, nowMs);
          lastFired.set(intent, nowMs);
          fired.push(intent);
          continue;
        }
        if (!REPEATABLE_INTENTS.has(intent)) continue;
        const prevFire = lastFired.get(intent) ?? start;
        if (nowMs - start >= initialDelayMs && nowMs - prevFire >= repeatIntervalMs) {
          lastFired.set(intent, nowMs);
          fired.push(intent);
        }
      }

      return fired;
    },
    reset() {
      heldSince.clear();
      lastFired.clear();
    },
  };
}

/** Übersetzt ein Tastaturereignis in einen InputIntent (sofern kein Textfeld aktiv ist). */
export function keyboardEventToIntent(
  e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean },
  options?: { inTextInput?: boolean },
): InputIntent | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const inText = options?.inTextInput ?? false;

  if (e.key === 'Escape') return 'cancel';
  if (inText) return null;

  switch (e.key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    case 'Enter':
      return 'confirm';
    case 'i':
    case 'I':
      return 'inspect';
    case '[':
    case 'PageUp':
      return 'zonePrev';
    case ']':
    case 'PageDown':
      return 'zoneNext';
    default:
      return null;
  }
}
