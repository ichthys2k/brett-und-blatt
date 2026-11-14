/**
 * Mixed Reality (#370): Tisch auf eine echte Fläche legen. Während des Platzierens zielt ein
 * Hit-Test aus der Blickrichtung auf erkannte Flächen (Tisch, Boden); ein Ring zeigt den Treffer,
 * Abzug oder Antippen legt den Tisch dort ab. Das Ergebnis ist ein Punkt im Bezugsraum der Brille;
 * daraus ergibt sich die Verschiebung des Ursprungs (`placementOrigin`). Ohne Hit-Test (Quest
 * erlaubt es nicht, oder keine Fläche erkannt) bleibt der schwebende Tisch.
 */
import { useXRHitTest, useXRInputSourceEvent } from '@react-three/xr';
import { useRef, useState } from 'react';
import { Matrix4, Vector3 } from 'three';
import { TABLE_CENTER } from './Tavern';

export interface Placement {
  x: number;
  y: number;
  z: number;
}

/** Kleinste und größte Tischgröße im Mixed-Reality-Modus (Anteil des echten Maßes). */
export const SCALE_MIN = 0.3;
export const SCALE_MAX = 1;
export const SCALE_STEP = 0.1;

export function clampScale(value: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(value * 100) / 100));
}

/** Ursprung, bei dem der Punkt `hit` des Bezugsraums genau auf die Mitte der Tischplatte fällt. */
export function placementOrigin(hit: Placement): Placement {
  return { x: TABLE_CENTER[0] - hit.x, y: TABLE_CENTER[1] - hit.y, z: TABLE_CENTER[2] - hit.z };
}

/** Rechnet einen Punkt aus dem Tischsystem in das um die Tischmitte verkleinerte um (und zurück mit 1/k). */
export function scaleAboutTable(p: [number, number, number], k: number): [number, number, number] {
  return [TABLE_CENTER[0] + (p[0] - TABLE_CENTER[0]) / k, TABLE_CENTER[1] + (p[1] - TABLE_CENTER[1]) / k, TABLE_CENTER[2] + (p[2] - TABLE_CENTER[2]) / k];
}

export function TablePlacer({ active, origin, onPlace }: { active: boolean; origin: [number, number, number]; onPlace: (hit: Placement) => void }) {
  const [reticle, setReticle] = useState<[number, number, number] | null>(null);
  const last = useRef<Placement | null>(null);
  const matrix = useRef(new Matrix4());
  const point = useRef(new Vector3());
  const originRef = useRef(origin);
  originRef.current = origin;

  useXRHitTest(
    active
      ? (results, getWorldMatrix) => {
          const first = results[0];
          if (!first || !getWorldMatrix(matrix.current, first)) {
            last.current = null;
            setReticle(null);
            return;
          }
          point.current.setFromMatrixPosition(matrix.current);
          const o = originRef.current;
          // Der Treffer liegt in der Szene; im Bezugsraum der Brille ist es der Punkt ohne die Verschiebung des Ursprungs.
          last.current = { x: point.current.x - o[0], y: point.current.y - o[1], z: point.current.z - o[2] };
          setReticle([point.current.x, point.current.y, point.current.z]);
        }
      : undefined,
    'viewer',
    'plane',
  );

  useXRInputSourceEvent(
    'all',
    'select',
    () => {
      if (active && last.current) onPlace(last.current);
    },
    [active, onPlace],
  );

  if (!active || !reticle) return null;
  return (
    <mesh position={[reticle[0], reticle[1] + 0.002, reticle[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
      <ringGeometry args={[0.12, 0.15, 48]} />
      <meshBasicMaterial color="#e6b450" transparent opacity={0.9} depthTest={false} toneMapped={false} />
    </mesh>
  );
}
