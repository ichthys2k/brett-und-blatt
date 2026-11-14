/**
 * Menü am Handgelenk (#388): erscheint an der Haltehand, wenn man auf deren Innenseite schaut.
 * Dieselben Aktionen wie im Fenster über dem Tisch, keine neuen: Nachricht, Sprache, Tisch und
 * Aufgeben (mit Rückfrage). Nachricht, Sprache und Tisch öffnen die Seite im Fenster.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { Vector3, type Group } from 'three';
import type { ClientMessage } from '@brett-und-blatt/online';
import { facesHead, holdingHand, sendPanelCommand, setCollapsed } from '../ui-state';
import { Button3D, Sign } from './ui3d';

export function WristMenu({ origin, canResign, send }: { origin: [number, number, number]; canResign: boolean; send: (m: ClientMessage) => void }) {
  const { gl, camera } = useThree();
  const group = useRef<Group>(null);
  const tmp = useRef({ head: new Vector3(), up: new Vector3(), hand: new Vector3() });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const id = window.setTimeout(() => setConfirm(false), 4000);
    return () => window.clearTimeout(id);
  }, [confirm]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = false;
    const session = gl.xr.getSession();
    if (!session) return;
    session.inputSources.forEach((source, i) => {
      if (source.handedness !== holdingHand()) return;
      const controller = gl.xr.getController(i);
      if (!controller.visible) return;
      const t = tmp.current;
      t.hand.copy(controller.position).add(new Vector3(...origin));
      t.up.set(0, 1, 0).applyQuaternion(controller.quaternion);
      camera.getWorldPosition(t.head);
      if (!facesHead([t.hand.x, t.hand.y, t.hand.z], [t.up.x, t.up.y, t.up.z], [t.head.x, t.head.y, t.head.z])) return;
      g.position.copy(t.hand).addScaledVector(t.up, 0.1);
      g.lookAt(t.head);
      g.visible = true;
    });
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
