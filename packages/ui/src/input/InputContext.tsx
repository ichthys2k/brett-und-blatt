import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createRepeatTracker,
  keyboardEventToIntent,
  readGamepadRawState,
  type ControlMode,
  type InputIntent,
  type InputSourceMode,
} from './gamepadMapping';

export type HotSeatControllerMode = 'pass' | 'multi';

export interface InputSettings {
  mode: ControlMode;
  deadzone: number;
  scanIntervalMs: number;
  haptics: boolean;
  prompts: boolean;
  hotSeatMode: HotSeatControllerMode;
}

export const DEFAULT_INPUT_SETTINGS: InputSettings = {
  mode: 'standard',
  deadzone: 0.25,
  scanIntervalMs: 1200,
  haptics: true,
  prompts: true,
  hotSeatMode: 'pass',
};

export interface DirectGamepadSample {
  padIndex: number;
  leftStick: { x: number; y: number };
  rightStick: { x: number; y: number };
  activeIntents: ReadonlySet<InputIntent>;
}

/** Rückgabe `true` signalisiert, dass der Intent bereits behandelt wurde (kein Fallback). */
export type InputIntentHandler = (intent: InputIntent, source: InputSourceMode) => boolean | void;
export type DirectGamepadHandler = (sample: DirectGamepadSample) => void;

export interface RegisteredZone {
  id: string;
  order: number;
  label?: string;
  trap?: boolean;
  element: HTMLElement;
  lastFocusedId: string | null;
}

interface InputContextValue {
  settings: InputSettings;
  inputSource: InputSourceMode;
  connectedGamepads: number;
  cursorActive: boolean;
  setCursorActive: (active: boolean) => void;
  announcement: string;
  announce: (text: string) => void;
  activeSeatIndex: number | null;
  setActiveSeatIndex: (seat: number | null) => void;
  subscribeIntent: (handler: InputIntentHandler, priority?: number) => () => void;
  subscribeDirect: (handler: DirectGamepadHandler) => () => void;
  registerZone: (zone: RegisteredZone) => () => void;
  getZones: () => RegisteredZone[];
  setZoneLastFocused: (zoneId: string, elementId: string | null) => void;
}

const InputContext = createContext<InputContextValue | null>(null);

export interface InputProviderProps {
  children: ReactNode;
  settings?: InputSettings;
  /** Im Hot-Seat mit mehreren Controllern: Index des aktuell aktiven menschlichen Platzes. */
  activeSeatIndex?: number | null;
}

function isTextInputElement(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return type !== 'button' && type !== 'checkbox' && type !== 'radio' && type !== 'submit' && type !== 'reset';
  }
  return el.isContentEditable;
}

export function InputProvider({
  children,
  settings = DEFAULT_INPUT_SETTINGS,
  activeSeatIndex: initialActiveSeat = null,
}: InputProviderProps) {
  const [inputSource, setInputSource] = useState<InputSourceMode>('pointer');
  const [connectedGamepads, setConnectedGamepads] = useState<number>(0);
  const [cursorActive, setCursorActive] = useState<boolean>(false);
  const [announcement, setAnnouncement] = useState<string>('');
  const [activeSeatIndex, setActiveSeatIndex] = useState<number | null>(initialActiveSeat);

  useEffect(() => {
    setActiveSeatIndex(initialActiveSeat);
  }, [initialActiveSeat]);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const activeSeatRef = useRef(activeSeatIndex);
  activeSeatRef.current = activeSeatIndex;
  const cursorActiveRef = useRef(cursorActive);
  cursorActiveRef.current = cursorActive;

  const intentListenersRef = useRef<Array<{ handler: InputIntentHandler; priority: number }>>([]);
  const directListenersRef = useRef<Set<DirectGamepadHandler>>(new Set());
  const zonesRef = useRef<Map<string, RegisteredZone>>(new Map());

  const emitIntent = useCallback((intent: InputIntent, source: InputSourceMode) => {
    if (intent === 'toggleCursor') {
      setCursorActive((prev) => !prev);
      return;
    }
    // Sortierung: höhere Priorität zuerst
    const sorted = [...intentListenersRef.current].sort((a, b) => b.priority - a.priority);
    for (const entry of sorted) {
      const handled = entry.handler(intent, source);
      if (handled === true) return;
    }
  }, []);

  const announce = useCallback((text: string) => {
    setAnnouncement('');
    requestAnimationFrame(() => setAnnouncement(text));
  }, []);

  // Globale Attribute am Wurzelelement setzen (für CSS-Fokus und Prompts)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.inputMode = inputSource;
    document.documentElement.dataset.controlMode = settings.mode;
  }, [inputSource, settings.mode]);

  // Zeiger- und Tastatur-Events beobachten
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPointer = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('.bub-prompt-bar')) {
        return;
      }
      setInputSource('pointer');
      if (cursorActiveRef.current) setCursorActive(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === 'Escape') {
        setInputSource('keyboard');
      }
      const inText = isTextInputElement(document.activeElement);
      const intent = keyboardEventToIntent(e, { inTextInput: inText });
      if (!intent) return;
      if (intent !== 'confirm' && intent !== 'cancel') {
        e.preventDefault();
      }
      emitIntent(intent, 'keyboard');
    };

    window.addEventListener('pointerdown', onPointer, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [emitIntent]);

  // Gamepad-Verbindung & Polling (nur aktiv, wenn mindestens 1 Gamepad verbunden ist)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return;
    }

    const countConnected = (): number => {
      const pads = navigator.getGamepads();
      let count = 0;
      for (const p of pads) {
        if (p && p.connected) count += 1;
      }
      return count;
    };

    const refreshCount = () => setConnectedGamepads(countConnected());
    refreshCount();

    window.addEventListener('gamepadconnected', refreshCount);
    window.addEventListener('gamepaddisconnected', refreshCount);
    return () => {
      window.removeEventListener('gamepadconnected', refreshCount);
      window.removeEventListener('gamepaddisconnected', refreshCount);
    };
  }, []);

  useEffect(() => {
    if (connectedGamepads === 0 || typeof navigator.getGamepads !== 'function') return;

    let rafId = 0;
    const trackers = new Map<number, ReturnType<typeof createRepeatTracker>>();

    const tick = (now: number) => {
      const pads = navigator.getGamepads();
      const curSettings = settingsRef.current;
      const seatFilter =
        curSettings.hotSeatMode === 'multi' && activeSeatRef.current !== null ? activeSeatRef.current : null;

      for (const pad of pads) {
        if (!pad || !pad.connected) continue;
        if (seatFilter !== null && pad.index !== seatFilter) continue;

        const raw = readGamepadRawState(pad, curSettings.deadzone);
        if (raw.anyPressed) {
          setInputSource('gamepad');
        }

        // Direkte Listener für Echtzeitspiele (C8)
        if (directListenersRef.current.size > 0) {
          const sample: DirectGamepadSample = {
            padIndex: pad.index,
            leftStick: raw.leftStick,
            rightStick: raw.rightStick,
            activeIntents: raw.activeIntents,
          };
          for (const listener of directListenersRef.current) {
            listener(sample);
          }
        }

        // Wenn Soft-Cursor aktiv ist, nur toggleCursor / cancel durchlassen
        let tracker = trackers.get(pad.index);
        if (!tracker) {
          tracker = createRepeatTracker(400, 110);
          trackers.set(pad.index, tracker);
        }
        const fired = tracker.step(raw.activeIntents, now);
        for (const intent of fired) {
          if (cursorActiveRef.current && intent !== 'toggleCursor' && intent !== 'cancel') continue;
          emitIntent(intent, 'gamepad');
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [connectedGamepads, emitIntent]);

  const subscribeIntent = useCallback((handler: InputIntentHandler, priority = 0) => {
    const entry = { handler, priority };
    intentListenersRef.current.push(entry);
    return () => {
      intentListenersRef.current = intentListenersRef.current.filter((e) => e !== entry);
    };
  }, []);

  const subscribeDirect = useCallback((handler: DirectGamepadHandler) => {
    directListenersRef.current.add(handler);
    return () => {
      directListenersRef.current.delete(handler);
    };
  }, []);

  const registerZone = useCallback((zone: RegisteredZone) => {
    zonesRef.current.set(zone.id, zone);
    return () => {
      zonesRef.current.delete(zone.id);
    };
  }, []);

  const getZones = useCallback(() => {
    return [...zonesRef.current.values()].sort((a, b) => a.order - b.order);
  }, []);

  const setZoneLastFocused = useCallback((zoneId: string, elementId: string | null) => {
    const z = zonesRef.current.get(zoneId);
    if (z) z.lastFocusedId = elementId;
  }, []);

  const value = useMemo<InputContextValue>(
    () => ({
      settings,
      inputSource,
      connectedGamepads,
      cursorActive,
      setCursorActive,
      announcement,
      announce,
      activeSeatIndex,
      setActiveSeatIndex,
      subscribeIntent,
      subscribeDirect,
      registerZone,
      getZones,
      setZoneLastFocused,
    }),
    [
      settings,
      inputSource,
      connectedGamepads,
      cursorActive,
      announcement,
      announce,
      activeSeatIndex,
      subscribeIntent,
      subscribeDirect,
      registerZone,
      getZones,
      setZoneLastFocused,
    ],
  );

  return (
    <InputContext.Provider value={value}>
      {children}
      <div className="bub-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </InputContext.Provider>
  );
}

export function useInputContext(): InputContextValue | null {
  return useContext(InputContext);
}

export function useInputSource(): { inputSource: InputSourceMode; connectedGamepads: number } {
  const ctx = useContext(InputContext);
  return {
    inputSource: ctx?.inputSource ?? 'pointer',
    connectedGamepads: ctx?.connectedGamepads ?? 0,
  };
}

export function useInputIntent(handler: InputIntentHandler, priority = 0): void {
  const ctx = useContext(InputContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribeIntent((intent, source) => handlerRef.current(intent, source), priority);
  }, [ctx, priority]);
}

export function useDirectGamepad(handler: DirectGamepadHandler): void {
  const ctx = useContext(InputContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribeDirect((sample) => handlerRef.current(sample));
  }, [ctx]);
}
