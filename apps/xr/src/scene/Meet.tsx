/**
 * VR-Treffpunkt (#351): eigene Kopf- und Handposition senden, andere Brillen als Figur zeigen.
 * - VR-Spieler: Kopf mit Avatar-Gesicht, Hände und ein Schild mit Avatar und Name vor der Brust.
 * - Handy- und Web-Spieler: bleiben Schild am Stuhl (scene/Seats.tsx), ohne Figur.
 * Jede Brille sendet im eigenen Tischsystem (eigener Platz vorn); hier wird um die Tischmitte
 * auf den Platz der anderen Person gedreht.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Quaternion, Vector3, type Group, type Mesh } from 'three';
import type { PeerMesh, Pose7, RemotePose } from '../peers';
import { presence, type Held } from '../presence';
import { tableGrab } from '../table-grab';
import type { SeatInfo } from './Seats';
import { scaleAboutTable } from './Placement';
import { TABLE_CENTER } from './Tavern';
import { Sign } from './ui3d';

const SEND_EVERY_MS = 100;
const HEARTBEAT_MS = 1000;
const FALLBACK_EVERY_MS = 1000;
/** Ohne neues Paket so lange: Figur ausblenden, das Schild am Stuhl übernimmt wieder. */
export const POSE_STALE_MS = 3000;

const round = (n: number) => Math.round(n * 1000) / 1000;

function pose7(position: Vector3, quaternion: Quaternion): Pose7 {
  return [position.x, position.y, position.z, quaternion.x, quaternion.y, quaternion.z, quaternion.w].map(round);
}

function moved(a: Pose7 | null, b: Pose7 | null): boolean {
  if (!a || !b) return a !== b;
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!) > 0.005 || a.slice(3).some((v, i) => Math.abs(v - b[3 + i]!) > 0.01);
}

/** Schickt die eigene Pose: über offene Kanäle bis zehnmal je Sekunde, im Rückfall einmal je Sekunde nur den Kopf über den Raum. */
export function PoseSender({ mesh, xrMembers, sendRoomPose, origin, scale = 1 }: { mesh: PeerMesh; xrMembers: string[]; sendRoomPose: (head: Pose7) => void; origin: [number, number, number]; scale?: number }) {
  const { camera, gl } = useThree();
  const last = useRef<{ at: number; fallbackAt: number; head: Pose7 | null; left: Pose7 | null; right: Pose7 | null; held: Held | null; point: string; fingers: string }>({ at: 0, fallbackAt: 0, head: null, left: null, right: null, held: null, point: '', fingers: '' });
  const tmpP = useRef(new Vector3());
  const tmpQ = useRef(new Quaternion());
  useFrame(() => {
    const now = performance.now();
    const state = last.current;
    if (now - state.at < SEND_EVERY_MS) return;
    camera.getWorldPosition(tmpP.current);
    // Ist der Tisch verkleinert (#370), liegt der Kopf im Tischsystem entsprechend weiter weg.
    if (scale !== 1) tmpP.current.set(...scaleAboutTable([tmpP.current.x, tmpP.current.y, tmpP.current.z], scale));
    camera.getWorldQuaternion(tmpQ.current);
    const head = pose7(tmpP.current, tmpQ.current);
    let left: Pose7 | null = null;
    let right: Pose7 | null = null;
    const point: [boolean, boolean] = [false, false];
    const session = gl.xr.getSession();
    if (session) {
      // Zeigestrahl der Controller bzw. der Hände; liegt im Raum der Brille, also um den eigenen Standpunkt verschoben.
      session.inputSources.forEach((source, i) => {
        const controller = gl.xr.getController(i);
        if (!controller.visible) return;
        const p = controller.position.clone().add(new Vector3(...origin));
        if (scale !== 1) p.set(...scaleAboutTable([p.x, p.y, p.z], scale));
        const value = pose7(p, controller.quaternion);
        if (source.handedness === 'left') left = value;
        else right = value;
        // Zeigestrahl (#385): nur, solange die Griff-Taste gehalten wird.
        const pointing = Boolean(source.gamepad?.buttons[1]?.pressed) && !tableGrab.active;
        if (source.handedness === 'left') point[0] = pointing;
        else point[1] = pointing;
      });
    }
    // Gegriffenes Objekt (#385): nur Ort und Art, im Tischsystem des Senders.
    let held: Held | null = null;
    if (presence.held) {
      const [hx, hy, hz] = scale !== 1 ? scaleAboutTable([presence.held[0], presence.held[1], presence.held[2]], scale) : [presence.held[0], presence.held[1], presence.held[2]];
      held = [hx!, hy!, hz!, presence.held[3]];
    }
    const pointKey = `${point[0]}${point[1]}`;
    const fingers = { left: presence.fingers.left, right: presence.fingers.right };
    const fingerKey = `${fingers.left?.join('') ?? ''}|${fingers.right?.join('') ?? ''}`;
    const heldMoved = (held === null) !== (state.held === null) || (held !== null && state.held !== null && (Math.hypot(held[0] - state.held[0], held[1] - state.held[1], held[2] - state.held[2]) > 0.005 || held[3] !== state.held[3]));
    const changed = moved(head, state.head) || moved(left, state.left) || moved(right, state.right) || heldMoved || pointKey !== state.point || fingerKey !== state.fingers;
    if (!changed && now - state.at < HEARTBEAT_MS) return;
    mesh.broadcast(head, left, right, held, point, fingers);
    if (now - state.fallbackAt >= FALLBACK_EVERY_MS && mesh.needsFallback()) {
      sendRoomPose(head);
      state.fallbackAt = now;
    }
    Object.assign(state, { at: now, head, left, right, held, point: pointKey, fingers: fingerKey });
  });
  return null;
}

/** Dreht eine Pose aus dem Tischsystem der anderen Person in das eigene. */
function transform(pose: Pose7, angle: number, outP: Vector3, outQ: Quaternion): void {
  const [cx, , cz] = TABLE_CENTER;
  const x = pose[0]! - cx;
  const z = pose[2]! - cz;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  outP.set(cx + x * cos + z * sin, pose[1]!, cz - x * sin + z * cos);
  outQ.setFromAxisAngle(new Vector3(0, 1, 0), angle).multiply(new Quaternion(pose[3], pose[4], pose[5], pose[6]));
}

function Figure({ pose, angle, info }: { pose: () => RemotePose | undefined; angle: number; info: SeatInfo | undefined }) {
  const head = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const chest = useRef<Group>(null);
  const left = useRef<Mesh>(null);
  const right = useRef<Mesh>(null);
  // Finger (#385): je Hand fünf Gruppen, die nach den übertragenen Beugewerten einknicken.
  const fingerRefs = useRef<(Group | null)[][]>([[], []]);
  const target = useRef({ p: new Vector3(), q: new Quaternion(), l: new Vector3(), r: new Vector3() });
  const heldRef = useRef<Group>(null);
  const heldBall = useRef<Mesh>(null);
  const heldCard = useRef<Mesh>(null);
  const beams = [useRef<Mesh>(null), useRef<Mesh>(null)];
  useFrame((_, delta) => {
    const current = pose();
    if (!current || !head.current) return;
    const t = target.current;
    transform(current.head, angle, t.p, t.q);
    const k = Math.min(1, delta * 12);
    head.current.position.lerp(t.p, k);
    head.current.quaternion.slerp(t.q, k);
    // Körper und Brustschild folgen dem Kopf, bleiben aber aufrecht und schauen nur in Blickrichtung.
    const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(2 * (t.q.w * t.q.y + t.q.x * t.q.z), 1 - 2 * (t.q.y * t.q.y + t.q.x * t.q.x)));
    if (body.current) {
      body.current.position.set(head.current.position.x, head.current.position.y - 0.4, head.current.position.z);
      body.current.quaternion.slerp(yaw, k);
    }
    if (chest.current) {
      const forward = new Vector3(0, 0, -0.2).applyQuaternion(yaw);
      chest.current.position.set(head.current.position.x + forward.x, head.current.position.y - 0.32, head.current.position.z + forward.z);
      chest.current.quaternion.slerp(yaw.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI)), k);
    }
    // Gehaltenes (#385): Kugel für Figuren, Kartenrückseite für Karten; nie ein Wert.
    const heldNow = current.held ?? null;
    if (heldRef.current) {
      heldRef.current.visible = Boolean(heldNow);
      if (heldNow) {
        transform([heldNow[0], heldNow[1], heldNow[2], 0, 0, 0, 1], angle, heldRef.current.position, new Quaternion());
        if (heldBall.current) heldBall.current.visible = heldNow[3] === 0;
        if (heldCard.current) heldCard.current.visible = heldNow[3] === 1;
      }
    }
    // Zeigestrahl (#385): dünner Strahl aus der Hand nach vorn.
    [current.left, current.right].forEach((hand, side) => {
      const beam = beams[side]!.current;
      if (!beam) return;
      const on = Boolean(hand) && Boolean(side === 0 ? current.pointLeft : current.pointRight);
      beam.visible = on;
      if (!hand || !on) return;
      const q = new Quaternion();
      const p = new Vector3();
      transform(hand, angle, p, q);
      beam.position.copy(p).add(new Vector3(0, 0, -0.5).applyQuaternion(q));
      beam.quaternion.copy(q).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2));
    });
    for (const [ref, value, v] of [
      [left, current.left, t.l],
      [right, current.right, t.r],
    ] as const) {
      if (!ref.current) continue;
      ref.current.visible = Boolean(value);
      if (value) {
        const handQ = new Quaternion();
        transform(value, angle, v, handQ);
        ref.current.position.lerp(v, k);
        ref.current.quaternion.slerp(handQ, k);
        const side = ref === left ? 0 : 1;
        const curls = side === 0 ? current.fingerLeft : current.fingerRight;
        fingerRefs.current[side]!.forEach((finger, i) => {
          if (!finger) return;
          finger.visible = Boolean(curls);
          if (curls) finger.rotation.x = -(curls[i] ?? 0) * (Math.PI / 2 / 9);
        });
      }
    }
  });
  const status = info ? [info.speaking ? '🔊' : '', info.winner ? '🏆' : info.turn ? '⏳ am Zug' : '', info.clock ?? ''].filter(Boolean).join('  ') : '';
  return (
    <group>
      <group ref={head}>
        <mesh>
          <sphereGeometry args={[0.1, 24, 16]} />
          <meshStandardMaterial color="#c9a27a" roughness={0.7} />
        </mesh>
        {/* Gesicht: das Avatar-Emoji vorn am Kopf (Blickrichtung −z) */}
        <group position={[0, 0, -0.101]} rotation={[0, Math.PI, 0]}>
          <Sign lines={[info?.avatar ?? '🙂']} position={[0, 0, 0]} width={0.14} height={0.14} background={null} />
        </group>
      </group>
      <mesh ref={body}>
        <cylinderGeometry args={[0.1, 0.17, 0.5, 20]} />
        <meshStandardMaterial color="#4a2a1e" roughness={0.9} />
      </mesh>
      <group ref={chest}>
        <Sign lines={[`${info?.avatar ?? ''} ${info?.name ?? ''}`.trim(), status]} position={[0, 0, 0]} width={0.3} height={0.11} />
      </group>
      <group ref={heldRef} visible={false}>
        <mesh ref={heldBall}>
          <sphereGeometry args={[0.016, 16, 12]} />
          <meshStandardMaterial color="#e6b450" emissive="#e6b450" emissiveIntensity={0.3} />
        </mesh>
        <mesh ref={heldCard} visible={false} rotation={[-0.55, 0, 0]}>
          <boxGeometry args={[0.058, 0.002, 0.09]} />
          <meshStandardMaterial color="#7a2a1e" />
        </mesh>
      </group>
      {beams.map((ref, i) => (
        <mesh key={`beam${i}`} ref={ref} visible={false}>
          <cylinderGeometry args={[0.002, 0.002, 1, 6]} />
          <meshBasicMaterial color="#ffd27a" transparent opacity={0.7} toneMapped={false} />
        </mesh>
      ))}
      {[left, right].map((ref, i) => (
        <mesh key={i} ref={ref} visible={false}>
          <sphereGeometry args={[0.035, 16, 12]} />
          <meshStandardMaterial color="#c9a27a" roughness={0.7} />
          {[-0.03, -0.015, 0, 0.015, 0.03].map((x, f) => (
            <group
              key={f}
              ref={(g) => {
                fingerRefs.current[i]![f] = g;
              }}
              position={[f === 0 ? (i === 0 ? 0.035 : -0.035) : x * 0.8, 0, -0.03]}
              visible={false}
            >
              <mesh position={[0, 0, -0.0225]}>
                <boxGeometry args={[0.008, 0.008, f === 0 ? 0.03 : 0.045]} />
                <meshStandardMaterial color="#c9a27a" roughness={0.7} />
              </mesh>
            </group>
          ))}
        </mesh>
      ))}
    </group>
  );
}

/** Alle anderen Brillen mit frischer Pose als Figur. */
export function Figures({ mesh, members, seatOf, mySeatBase, count, infos }: { mesh: PeerMesh; members: string[]; seatOf: (memberId: string) => number | null; mySeatBase: number; count: number; infos: SeatInfo[] }) {
  // Die Bewegung läuft in useFrame; welche Figuren es gibt, entscheidet die Szene (frische Posen).
  return (
    <group>
      {members.map((id) => {
        const base = seatOf(id) ?? 0;
        const angle = count > 0 ? (((base - mySeatBase + count) % count) * 2 * Math.PI) / count : 0;
        return <Figure key={id} pose={() => mesh.poses.get(id)} angle={angle} info={infos.find((s) => s.memberId === id)} />;
      })}
    </group>
  );
}
