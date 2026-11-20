/**
 * Bewegung der Oberfläche (M4): macht aus den Ereignissen des letzten Zugs (`push`, `walk`, `harvest`,
 * `sprout`) kurze, rein optische Zustände – das hinausfallende und das eingeschobene Teil, den
 * hüpfenden Hasen, Ernte- und Nachwachs-Effekt. Nichts davon ändert den Spielstand oder blockiert
 * eine Eingabe; ein neuer Zug bricht laufende Bewegungen sofort ab. Bei `prefers-reduced-motion`
 * entstehen gar keine Zustände, alles springt.
 */
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import { pushGeometry, type MoleState, type Pos, type Side, type Tile } from '../rules';

export const SLIDE_MS = 240;
export const WALK_MAX_MS = 700;
export const WALK_STEP_MAX_MS = 170;
export const FX_MS = 750;

export interface PushFx {
  key: number;
  /** Das hinausgefallene Teil (jetzt Freiteil) und wohin es rutscht. */
  out: Tile;
  exit: Pos;
  dr: number;
  dc: number;
  /** Id des eingeschobenen Teils; es gleitet aus dem Randstreifen herein. */
  entered: number;
  /** Die Vorschau zeigte den Schub schon: nur noch ausblenden, nicht noch einmal gleiten. */
  fromPreview: boolean;
  side: Side;
  index: number;
}

export interface WalkFx {
  key: number;
  seat: SeatId;
  path: Pos[];
  step: number;
  stepMs: number;
  /** Teile, deren Rübe bis zur Ankunft noch (bzw. noch nicht) zu sehen ist. */
  harvest: number | null;
  sprout: number | null;
}

export interface DoneFx {
  key: number;
  harvest: number | null;
  sprout: number | null;
  seat: SeatId | null;
}

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Die Wegpunkte eines `walk`-Ereignisses (Rückfall: Start und Ziel). */
function pathOf(event: GameEvent): Pos[] {
  const path = event.path as Pos[] | null | undefined;
  if (Array.isArray(path) && path.length > 0) return path;
  return [event.from as Pos, event.to as Pos];
}

export function useMoveFx(view: MoleState, events: GameEvent[], previewShown: MutableRefObject<boolean>) {
  const [push, setPush] = useState<PushFx | null>(null);
  const [walk, setWalk] = useState<WalkFx | null>(null);
  const [done, setDone] = useState<DoneFx | null>(null);
  // Ereignisse, die schon beim Einhängen anliegen (Wiedereinstieg), werden nicht nachgespielt.
  const seen = useRef(events);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const counter = useRef(0);

  const clearTimers = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  useEffect(() => clearTimers, []);

  useLayoutEffect(() => {
    if (events === seen.current) return;
    seen.current = events;
    clearTimers();
    setPush(null);
    setWalk(null);
    setDone(null);
    if (reducedMotion()) {
      previewShown.current = false;
      return;
    }
    const key = ++counter.current;

    const pushEvent = events.find((e) => e.type === 'push');
    if (pushEvent) {
      const side = pushEvent.side as Side;
      const index = pushEvent.index as number;
      const { exit, dr, dc } = pushGeometry(view.size, side, index);
      if (view.spare.id === pushEvent.out) {
        setPush({ key, out: view.spare, exit, dr, dc, entered: pushEvent.entered as number, fromPreview: previewShown.current, side, index });
        later(() => setPush(null), SLIDE_MS + 60);
      }
      previewShown.current = false;
      return;
    }

    const walkEvent = events.find((e) => e.type === 'walk');
    if (!walkEvent) return;
    const path = pathOf(walkEvent);
    const seat = walkEvent.seat as SeatId;
    const harvest = (events.find((e) => e.type === 'harvest')?.tile as number | undefined) ?? null;
    const sprout = (events.find((e) => e.type === 'sprout')?.tile as number | undefined) ?? null;
    const steps = path.length - 1;
    const finish = () => {
      setWalk(null);
      if (harvest !== null || sprout !== null) {
        setDone({ key, harvest, sprout, seat: harvest !== null ? seat : null });
        later(() => setDone(null), FX_MS);
      }
    };
    if (steps <= 0) {
      finish();
      return;
    }
    const stepMs = Math.min(WALK_STEP_MAX_MS, Math.floor(WALK_MAX_MS / steps));
    setWalk({ key, seat, path, step: 0, stepMs, harvest, sprout });
    for (let i = 1; i <= steps; i++) later(() => setWalk((w) => (w && w.key === key ? { ...w, step: i } : w)), (i - 1) * stepMs + 20);
    later(finish, steps * stepMs + 20 + stepMs);
  }, [events]);

  return { push, walk, done };
}
