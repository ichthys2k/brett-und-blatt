/**
 * Menü am Handgelenk (#388): erscheint an der Haltehand nur mit einer eindeutigen Geste – Handfläche
 * zum Gesicht und kurz gehalten (`stepPalm`) –, schließt zügig, sobald man wegdreht, spätestens nach
 * acht Sekunden, und lässt sich abschalten. Dieselben Aktionen wie im Fenster über dem Tisch, keine neuen: Nachricht, Sprache, Tisch und
 * Aufgeben (mit Rückfrage). Nachricht, Sprache und Tisch öffnen die Seite im Fenster.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { Vector3, type Group } from 'three';
import type { ClientMessage } from '@brett-und-blatt/online';
import { facingDot, holdingHand, isWristMenuOn, palmNormal, sendPanelCommand, setCollapsed } from '../ui-state';
import { newPalmState, stepPalm } from '../hand-assist';
import { Button3D, Sign } from './ui3d';

export function WristMenu({ origin, canResign, send }: { origin: [number, number, number]; canResign: boolean; send: (m: ClientMessage) => void }) {
  const { gl, camera } = useThree();
  const group = useRef<Group>(null);
  const tmp = useRef({ head: new Vector3(), up: new Vector3(), hand: new Vector3() });
  const [confirm, setConfirm] = useState(false);
  const palm = useRef(newPalmState());
  useEffect(() => {
    if (!confirm) return;
    const id = window.setTimeout(() => setConfirm(false), 4000);
    return () => window.clearTimeout(id);
  }, [confirm]);
  useFrame((_, __, frame) => {
    const g = group.current;
    if (!g) return;
    g.visible = false;
    const session = gl.xr.getSession();
    if (!session || !isWristMenuOn()) {
      palm.current = newPalmState();
      return;
    }
    const t = tmp.current;
    let dot: number | null = null;
    session.inputSources.forEach((source, i) => {
      if (source.handedness !== holdingHand()) return;
      if (source.hand) {
        // Handtracking: Handgelenk und Handflächen-Normale aus den Gelenken.
        if (!frame) return;
        const space = gl.xr.getReferenceSpace();
        const at = (name: XRHandJoint): Vector3 | null => {
          const joint = source.hand!.get(name);
          const pose = joint && space ? frame.getJointPose?.(joint, space) : undefined;
          return pose ? new Vector3(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z) : null;
        };
        const wrist = at('wrist');
        const index = at('index-finger-metacarpal');
        const pinky = at('pinky-finger-metacarpal');
        if (!wrist || !index || !pinky) return;
        const normal = palmNormal([wrist.x, wrist.y, wrist.z], [index.x, index.y, index.z], [pinky.x, pinky.y, pinky.z], holdingHand());
        t.up.set(...normal).normalize();
        t.hand.copy(wrist).add(new Vector3(...origin));
      } else {
        const controller = gl.xr.getController(i);
        if (!controller.visible) return;
        t.hand.copy(controller.position).add(new Vector3(...origin));
        t.up.set(0, 1, 0).applyQuaternion(controller.quaternion);
      }
      camera.getWorldPosition(t.head);
      dot = facingDot([t.hand.x, t.hand.y, t.hand.z], [t.up.x, t.up.y, t.up.z], [t.head.x, t.head.y, t.head.z]);
    });
    if (!stepPalm(palm.current, dot, performance.now())) return;
    g.position.copy(t.hand).addScaledVector(t.up, 0.1);
    g.lookAt(t.head);
    g.visible = true;
  });
  const open = (command: 'phrases' | 'voice' | 'view') => {
    setCollapsed(false);
    sendPanelCommand(command);
  };
  return (
    <group ref={group} visible={false}>
      <Sign lines={['Menü']} position={[0, 0.05, 0]} width={0.18} height={0.03} overlay />
      <Button3D label="💬 Nachricht" position={[-0.05, 0.012, 0]} width={0.095} height={0.032} overlay onPress={() => open('phrases')} />
      <Button3D label="🎙 Sprache" position={[0.05, 0.012, 0]} width={0.095} height={0.032} overlay onPress={() => open('voice')} />
      <Button3D label="↕ Tisch" position={[-0.05, -0.026, 0]} width={0.095} height={0.032} overlay onPress={() => open('view')} />
      {canResign && (
        <Button3D
          label={confirm ? 'Wirklich?' : 'Aufgeben'}
          position={[0.05, -0.026, 0]}
          width={0.095}
          height={0.032}
          overlay
          active={confirm}
          onPress={() => {
            if (confirm) {
              send({ type: 'resign' });
              setConfirm(false);
            } else setConfirm(true);
          }}
        />
      )}
    </group>
  );
}
