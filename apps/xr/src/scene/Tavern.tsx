/**
 * Die Taverne (#339): Holzboden, Balken, Steinwände, Kamin und Kerzen auf einem runden Tisch.
 * Alles aus einfachen Körpern und gemalten Texturen – keine Fremdmodelle, also nichts zu lizenzieren.
 * Stil nach docs/grafik/STILBIBEL.md: warmes Kerzenlicht, Holzbraun, Gold; ohne Alkohol.
 */
import { useFrame } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { useMemo, useRef } from 'react';
import { RepeatWrapping, type Mesh, type PointLight } from 'three';
import { woodTexture } from './text';

/** Mitte der Tischplatte (Meter). Der eigene Platz liegt Richtung +z, zum Betrachter hin. */
export const TABLE_CENTER: [number, number, number] = [0, 0.74, -0.55];
export const TABLE_RADIUS = 0.62;

function Candle({ position, phase }: { position: [number, number, number]; phase: number }) {
  const light = useRef<PointLight>(null);
  const flame = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 7 + phase;
    // Flackern aus zwei Sinuswellen: lebendig, aber ohne Zufall.
    const flicker = 0.85 + Math.sin(t) * 0.08 + Math.sin(t * 2.7) * 0.05;
    if (light.current) light.current.intensity = 1.6 * flicker;
    if (flame.current) flame.current.scale.y = flicker;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.012, 24]} />
        <meshStandardMaterial color="#b8892f" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.018, 0.02, 0.12, 16]} />
        <meshStandardMaterial color="#f3e7c9" roughness={0.8} />
      </mesh>
      <mesh ref={flame} position={[0, 0.145, 0]}>
        <coneGeometry args={[0.008, 0.03, 12]} />
        <meshBasicMaterial color="#ffcf6b" />
      </mesh>
      <pointLight ref={light} position={[0, 0.17, 0]} color="#ffb35c" intensity={1.6} distance={2.5} decay={2} />
    </group>
  );
}

function Fireplace() {
  const light = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 3;
    if (light.current) light.current.intensity = 6 + Math.sin(t) * 1.2 + Math.sin(t * 2.3) * 0.8;
  });
  return (
    <group position={[-2.6, 0, -2.2]} rotation={[0, Math.PI / 4, 0]}>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[1.6, 1.8, 0.5]} />
        <meshStandardMaterial color="#6d6458" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.45, 0.2]}>
        <boxGeometry args={[0.9, 0.7, 0.2]} />
        <meshBasicMaterial color="#2a120a" />
      </mesh>
      <mesh position={[0, 0.3, 0.26]}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshBasicMaterial color="#ff8a2a" transparent opacity={0.85} />
      </mesh>
      <pointLight ref={light} position={[0, 0.5, 0.7]} color="#ff8a3d" intensity={6} distance={7} decay={2} />
    </group>
  );
}

function Chair({ angle, highlight }: { angle: number; highlight: boolean }) {
  const r = TABLE_RADIUS + 0.38;
  const x = TABLE_CENTER[0] + Math.sin(angle) * r;
  const z = TABLE_CENTER[2] + Math.cos(angle) * r;
  const color = highlight ? '#7a5230' : '#4a3020';
  return (
    <group position={[x, 0, z]} rotation={[0, angle, 0]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.44, 0.05, 0.42]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.75, 0.19]}>
        <boxGeometry args={[0.44, 0.6, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {[-0.18, 0.18].flatMap((dx) =>
        [-0.17, 0.17].map((dz) => (
          <mesh key={`${dx}${dz}`} position={[dx, 0.22, dz]}>
            <boxGeometry args={[0.04, 0.45, 0.04]} />
            <meshStandardMaterial color={color} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function Tavern({ chairs }: { chairs: { angle: number; mine: boolean }[] }) {
  const floor = useMemo(() => {
    const t = woodTexture().clone();
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(6, 6);
    t.needsUpdate = true;
    return t;
  }, []);
  const top = woodTexture();
  // Mixed Reality (#369): Nur Tischplatte und Kerzen, die echte Umgebung bleibt über Passthrough sichtbar.
  const mixed = useXR((state) => state.mode) === 'immersive-ar';
  return (
    <group>
      <ambientLight color="#ffd9a8" intensity={0.25} />
      <hemisphereLight args={['#ffcf99', '#2a1a10', 0.35]} />
      {!mixed && (
        <>
      {/* Boden, Wände, Decke mit Balken */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial map={floor} color="#8a6a4a" roughness={0.9} />
      </mesh>
      {[
        { p: [0, 1.6, -4] as const, r: 0 },
        { p: [-4, 1.6, 0] as const, r: Math.PI / 2 },
        { p: [4, 1.6, 0] as const, r: -Math.PI / 2 },
        { p: [0, 1.6, 4] as const, r: Math.PI },
      ].map(({ p, r }, i) => (
        <mesh key={i} position={[p[0], p[1], p[2]]} rotation={[0, r, 0]}>
          <planeGeometry args={[8, 3.2]} />
          <meshStandardMaterial color="#4b3a2c" roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#2a1c12" />
      </mesh>
      {[-2, 0, 2].map((x) => (
        <mesh key={x} position={[x, 3.05, 0]}>
          <boxGeometry args={[0.25, 0.25, 8]} />
          <meshStandardMaterial color="#3f2a18" />
        </mesh>
      ))}
      <Fireplace />
        </>
      )}
      {/* Runder Holztisch mit Mittelfuß */}
      <group position={[TABLE_CENTER[0], 0, TABLE_CENTER[2]]}>
        <mesh position={[0, TABLE_CENTER[1] - 0.025, 0]} receiveShadow>
          <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.05, 64]} />
          <meshStandardMaterial map={top} color="#a07850" roughness={0.6} />
        </mesh>
        {!mixed && (
          <>
            <mesh position={[0, 0.36, 0]}>
              <cylinderGeometry args={[0.07, 0.1, 0.7, 16]} />
              <meshStandardMaterial color="#3f2a18" />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.32, 0.36, 0.04, 32]} />
              <meshStandardMaterial color="#3f2a18" />
            </mesh>
          </>
        )}
      </group>
      <Candle position={[TABLE_CENTER[0] - 0.42, TABLE_CENTER[1], TABLE_CENTER[2] - 0.3]} phase={0} />
      <Candle position={[TABLE_CENTER[0] + 0.42, TABLE_CENTER[1], TABLE_CENTER[2] - 0.3]} phase={2.1} />
      {/* Laterne über dem Tisch, Licht von oben links wie in der Stilbibel */}
      <pointLight position={[-0.6, 2.2, -0.3]} color="#ffc27a" intensity={3} distance={6} decay={2} />
      {!mixed && chairs.map((c, i) => (
        <Chair key={i} angle={c.angle} highlight={c.mine} />
      ))}
    </group>
  );
}
