/**
 * Greifen und Ablegen (#382): Figur mit Strahl, Hand oder Maus greifen, über das Brett führen,
 * nahe einem erlaubten Ziel rastet sie ein, Loslassen schickt genau den Zug, den Antippen
 * geschickt hätte. Antippen bleibt unverändert möglich. Ohne Spielregeln: Die Ziele kommen aus
 * `legalMoves`. Die Zuordnung (`nearestTarget`, `movesFor`) ist rein und getestet.
 */
import { useRef, useState, type ReactNode } from 'react';
import type { Group } from 'three';
import { pulse } from '../haptics';

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
}

/** Hält die gegriffene Figur und liefert die unsichtbare Fläche, die Bewegung und Loslassen auffängt. */
export function useGrab<I extends string | number>(options: GrabOptions<I>): { held: Held<I> | null; begin: (id: I, x: number, z: number) => void; layer: ReactNode } {
  const [held, setHeld] = useState<Held<I> | null>(null);
  const current = useRef<Held<I> | null>(null);
  current.current = held;
  const latest = useRef(options);
  latest.current = options;
  const frame = useRef<Group>(null);

  const begin = (id: I, x: number, z: number) => {
    pulse('select');
    setHeld({ id, x, z, snap: null });
  };
  const track = (x: number, z: number) => {
    const h = current.current;
    if (!h) return;
    const snap = nearestTarget([x, z], latest.current.targets(h.id), latest.current.radius);
    if (snap && snap.id !== h.snap?.id) pulse('move');
    setHeld({ id: h.id, x: snap?.x ?? x, z: snap?.z ?? z, snap });
  };
  const release = (drop: boolean) => {
    const h = current.current;
    if (!h) return;
    current.current = null;
    setHeld(null);
    if (drop) latest.current.onDrop(h.id, h.snap?.id ?? null);
  };

  const layer = held ? (
    <group ref={frame}>
      <mesh
        position={[0, 0.09, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={(e) => {
          e.stopPropagation();
          const local = frame.current?.worldToLocal(e.point.clone());
          if (local) track(local.x, local.z);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          release(true);
        }}
        onPointerOut={() => release(false)}
      >
        <planeGeometry args={[latest.current.size * 1.5, latest.current.size * 1.5]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  ) : null;
  return { held, begin, layer };
}
