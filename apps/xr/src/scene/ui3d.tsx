/**
 * Bedienelemente im Raum: Schaltflächen und Schilder als Flächen mit gemalter Schrift.
 * Zeigen (Strahl des Controllers), Antippen mit dem Finger und Klicken mit der Maus lösen
 * dieselben Pointer-Ereignisse aus (@react-three/xr).
 */
import type { ThreeEvent } from '@react-three/fiber';
import { useState } from 'react';
import { GOLD, GREEN, INK, WOOD, WOOD_DARK, labelTexture } from './text';

export interface Button3DProps {
  label: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  onPress?: () => void;
  disabled?: boolean;
  active?: boolean;
}

export function Button3D({ label, position, rotation, width = 0.3, height = 0.06, onPress, disabled, active }: Button3DProps) {
  const [hover, setHover] = useState(false);
  const pixelsW = 512;
  const pixelsH = Math.max(64, Math.round((pixelsW * height) / width));
  const texture = labelTexture([label], {
    width: pixelsW,
    height: pixelsH,
    background: disabled ? '#3a2e24' : active ? GREEN : hover ? WOOD : WOOD_DARK,
    color: disabled ? '#9a8a74' : INK,
    border: hover && !disabled ? INK : GOLD,
    font: Math.round(pixelsH * 0.5),
  });
  const press = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!disabled) onPress?.();
  };
  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={hover && !disabled ? 1.04 : 1}
      onClick={press}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

/** Ein Schild mit mehreren Zeilen, ohne Bedienung. */
export function Sign({ lines, position, rotation, width = 0.4, height = 0.12, background }: { lines: string[]; position: [number, number, number]; rotation?: [number, number, number]; width?: number; height?: number; background?: string | null }) {
  const pixelsW = 512;
  const pixelsH = Math.round((pixelsW * height) / width);
  const texture = labelTexture(lines, { width: pixelsW, height: pixelsH, font: Math.round((pixelsH / Math.max(lines.length, 1)) * 0.62), background: background === undefined ? WOOD_DARK : background });
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}
