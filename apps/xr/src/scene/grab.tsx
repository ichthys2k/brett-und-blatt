/**
 * Greifen und Ablegen (#382): Figur mit Strahl, Hand oder Maus greifen, über das Brett führen,
 * nahe einem erlaubten Ziel rastet sie ein, Loslassen schickt genau den Zug, den Antippen
 * geschickt hätte. Antippen bleibt unverändert möglich. Ohne Spielregeln: Die Ziele kommen aus
 * `legalMoves`. Die Zuordnung (`nearestTarget`, `movesFor`) ist rein und getestet.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Group } from 'three';
import { pulse } from '../haptics';
import { presence } from '../presence';
import { handRadius, isOwnerEnd, pickReleaseSnap, pushSample, smoothPoint, stickySnap, type PoseSample } from '../hand-assist';
import { onPressEnd } from '../press-tracking';

/** Das Zeigerereignis, das das Greifen auslöst; nur `pointerId` wird gebraucht (Zuordnung des Zeigers). */
export interface GrabEvent {
  pointerId?: number;
}

/** Glättung der Führung mit der Hand (0–1, kleiner = ruhiger) und Rückblick beim Loslassen. */
const HAND_SMOOTHING = 0.4;
const HAND_RELEASE_LOOKBACK_MS = 120;
/** Wartezeit nach dem Ende des Drückens, damit ein regulär eintreffendes `pointerup` Vorrang hat. */
const PRESS_END_GRACE_MS = 120;

type PointerInfo = { pointerId?: number; pointerState?: { type?: string } };
const isHandPointer = (e: PointerInfo): boolean => e.pointerState?.type === 'hand';
const isXrPointer = (e: PointerInfo): boolean => e.pointerState?.type === 'hand' || e.pointerState?.type === 'controller';

export interface GrabTarget {
  id: string | number;
  x: number;
  z: number;
}

/** Nächstes Ziel im Umkreis `radius` um den Punkt, sonst `null` (Loslassen im Leeren). */
export function nearestTarget(point: [number, number], targets: GrabTarget[], radius: number): GrabTarget | null {
  let best: GrabTarget | null = null;
  let bestDistance = radius;
  for (const target of targets) {
    const distance = Math.hypot(target.x - point[0], target.z - point[1]);
    if (distance <= bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

/** Alle Züge, die genau von `from` nach `to` führen („gegriffene Figur + Ziel → Zug“). */
export function movesFor<M>(moves: M[], fromOf: (move: M) => string | number | undefined, toOf: (move: M) => string | number | undefined, from: string | number, to: string | number): M[] {
  return moves.filter((move) => fromOf(move) === from && toOf(move) === to);
}

export interface Held<I> {
  id: I;
  x: number;
  z: number;
  /** Ziel, auf dem die Figur gerade einrastet. */
  snap: GrabTarget | null;
}

interface GrabOptions<I> {
  /** Erlaubte Ziele mit Lage, wenn `from` gegriffen ist. */
  targets: (from: I) => GrabTarget[];
  /** Einrast-Umkreis. */
  radius: number;
  /** Beim Loslassen; `to` ist `null`, wenn kein Ziel in der Nähe war. */
  onDrop: (from: I, to: string | number | null) => void;
  /** Kantenlänge des Bretts, bestimmt die Größe der Auffangfläche. */
  size: number;
  /** `wall`: senkrechtes Brett (Vier in einer Reihe), Auffangfläche vor dem Gestell, z der Figur ist dort die Höhe. */
  plane?: 'floor' | 'wall';
  /** Nur die Lage entlang x zählt (Spalten über einem senkrechten Brett). */
  alongX?: boolean;
  /** Mitte der Auffangfläche beim senkrechten Brett (Höhe des Gestells). */
  wallCenterY?: number;
  /** Waagerechte Auffangfläche: Höhe und Mitte (Standard: knapp über dem Brett, Mitte 0/0). */
  floorY?: number;
  floorCenter?: [number, number];
  /** Was Mitspieler sehen (#385): `card` = nur eine Kartenrückseite, sonst eine offene Figur. */
  heldKind?: 'card' | 'piece';
  /** Bei jeder Bewegung der gegriffenen Figur (z. B. zum Erkennen des Schüttelns). */
  onTrack?: (x: number, z: number) => void;
}

/**
 * Hält die gegriffene Figur und liefert die unsichtbare Fläche, die Bewegung und Loslassen auffängt.
 * Robust für die Hand (#382): nur der Zeiger, der das Greifen begann, führt die Figur (der andere
 * Hand-Strahl stört nicht); die Fläche ist groß genug, dass der Strahl sie nicht verlässt; mit der
 * Hand größerer Einrast-Umkreis, Einrasten mit Trägheit und geglättete Führung; beim Loslassen zählt
 * die Lage kurz vor dem Öffnen der Finger; und das Ende des Drückens löst das Loslassen auch dann aus,
 * wenn das Zeiger-Paket kein `pointerup` schickt.
 */
export function useGrab<I extends string | number>(options: GrabOptions<I>): { held: Held<I> | null; begin: (id: I, x: number, z: number, event?: GrabEvent) => void; layer: ReactNode } {
  const [held, setHeld] = useState<Held<I> | null>(null);
  const current = useRef<Held<I> | null>(null);
  current.current = held;
  const latest = useRef(options);
  latest.current = options;
  const frame = useRef<Group>(null);
  const owner = useRef<number | null>(null);
  const hand = useRef(false);
  const snapId = useRef<string | number | null>(null);
  const smooth = useRef<[number, number] | null>(null);
  const history = useRef<PoseSample[]>([]);
  const beganAt = useRef(0);

  const begin = (id: I, x: number, z: number, event?: GrabEvent) => {
    pulse('select');
    owner.current = event?.pointerId ?? null;
    hand.current = false;
    snapId.current = null;
    smooth.current = null;
    history.current = [];
    beganAt.current = performance.now();
    setHeld({ id, x, z, snap: null });
  };
  const track = (rawX: number, rawZ: number, isHand: boolean) => {
    const h = current.current;
    if (!h) return;
    hand.current = isHand;
    latest.current.onTrack?.(rawX, rawZ);
    let x = rawX;
    let z = rawZ;
    if (isHand) {
      [x, z] = smoothPoint(smooth.current, [rawX, rawZ], HAND_SMOOTHING);
      smooth.current = [x, z];
    } else smooth.current = null;
    const all = latest.current.targets(h.id);
    const alongX = latest.current.alongX;
    const pool = alongX ? all.map((t) => ({ ...t, z: 0 })) : all;
    const point: [number, number] = [x, alongX ? 0 : z];
    const radius = handRadius(latest.current.radius, isHand);
    const snap = isHand ? stickySnap(point, pool, radius, snapId.current) : nearestTarget(point, pool, radius);
    if (snap && snap.id !== snapId.current) pulse('move');
    snapId.current = snap?.id ?? null;
    history.current = pushSample(history.current, { t: performance.now(), snap: snapId.current });
    setHeld({ id: h.id, x: snap?.x ?? x, z: alongX ? z : (snap?.z ?? z), snap });
  };
  useEffect(() => () => void (presence.held = null), []);
  const release = (drop: boolean) => {
    const h = current.current;
    presence.held = null;
    if (!h) return;
    current.current = null;
    setHeld(null);
    owner.current = null;
    if (!drop) return;
    // Mit der Hand springt der Strahl beim Öffnen der Finger: es zählt die Lage kurz davor.
    const to = hand.current ? pickReleaseSnap(history.current, performance.now(), HAND_RELEASE_LOOKBACK_MS) : (h.snap?.id ?? null);
    latest.current.onDrop(h.id, to);
  };
  // Rückfall: Das Ende des Drückens kommt immer an, auch wenn der Zeiger beim Loslassen nichts trifft.
  const holding = held !== null;
  useEffect(() => {
    if (!holding) return;
    let timer = 0;
    const off = onPressEnd((startedAt) => {
      if (!isOwnerEnd(startedAt, beganAt.current)) return;
      timer = window.setTimeout(() => {
        if (current.current) release(true);
      }, PRESS_END_GRACE_MS);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding]);

  /** Nimmt nur Ereignisse des Zeigers an, der das Greifen begann (der erste, falls keiner bekannt ist). */
  const accepts = (e: PointerInfo): boolean => {
    if (owner.current === null) {
      owner.current = e.pointerId ?? null;
      return true;
    }
    return e.pointerId === owner.current;
  };

  const wall = latest.current.plane === 'wall';
  // Große Fläche: Der Strahl der Hand soll sie auch bei ungenauem Zielen nicht verlassen.
  const span = Math.max(latest.current.size * 1.5, 4);
  const layer = held ? (
    <group ref={frame}>
      <mesh
        position={wall ? [0, latest.current.wallCenterY ?? 0, 0.03] : [latest.current.floorCenter?.[0] ?? 0, latest.current.floorY ?? 0.09, latest.current.floorCenter?.[1] ?? 0]}
        rotation={wall ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}
        onPointerMove={(e) => {
          if (!accepts(e)) return;
          e.stopPropagation();
          const local = frame.current?.worldToLocal(e.point.clone());
          if (local) track(local.x, wall ? local.y : local.z, isHandPointer(e));
          presence.held = [e.point.x, e.point.y + 0.02, e.point.z, latest.current.heldKind === 'card' ? 1 : 0];
        }}
        onPointerUp={(e) => {
          if (!accepts(e)) return;
          e.stopPropagation();
          release(true);
        }}
        onPointerOut={(e) => {
          // Mit Hand oder Controller bricht ein verlassener Strahl das Greifen nicht ab; die Figur bleibt
          // an der letzten Stelle, bis losgelassen wird. Nur die Maus verlässt die Fläche wirklich.
          if (isXrPointer(e) || !accepts(e)) return;
          release(false);
        }}
      >
        <planeGeometry args={[span, span]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  ) : null;
  return { held, begin, layer };
}

/** Schale mit Spielsteinen am eigenen Platz: daraus nimmt man den Stein, den man setzen will (Setzspiele). */
export function Bowl({ x, z, onGrab, children }: { x: number; z: number; onGrab: (e: GrabEvent) => void; children?: ReactNode }) {
  return (
    <group
      position={[x, 0, z]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onGrab(e);
      }}
    >
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.04, 0.03, 0.012, 28]} />
        <meshStandardMaterial color="#a8825a" roughness={0.8} />
      </mesh>
      {children}
    </group>
  );
}
