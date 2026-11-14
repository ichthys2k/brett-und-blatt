/**
 * Räumlicher Klang (#381): meldet den Kopf als Hörer, ordnet Spielklängen einen Ort zu und lässt
 * die Stimmen der Mitspieler aus Richtung ihres Platzes kommen. Nur in der Brille; im Browser
 * bleibt der Klang wie bisher ohne Ort.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import type { VoiceChat } from '@brett-und-blatt/rtc';
import { setListener, setPlacer } from '../sound';
import { eventSpot, seatHead, toWorld, type Spot } from '../sound-spot';
import type { SeatInfo } from './Seats';

export function SpatialAudio({ seats, scale, voice }: { seats: SeatInfo[]; scale: number; voice: VoiceChat | null }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const live = useRef({ seats, scale });
  live.current = { seats, scale };
  const tmp = useRef({ p: new Vector3(), f: new Vector3(), u: new Vector3(), in: false });

  useEffect(() => {
    setPlacer((event) => {
      if (!gl.xr.isPresenting) return null;
      const { seats: all, scale: k } = live.current;
      return toWorld(eventSpot(event, (seat) => all.find((s) => s.index === seat)?.angle ?? null), k);
    });
    return () => setPlacer(null);
  }, [gl]);

  useFrame(() => {
    const t = tmp.current;
    const presenting = gl.xr.isPresenting;
    if (presenting !== t.in) {
      t.in = presenting;
      voice?.setSpatial(presenting);
    }
    if (!presenting) return;
    camera.getWorldPosition(t.p);
    camera.getWorldDirection(t.f);
    t.u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const head: Spot = [t.p.x, t.p.y, t.p.z];
    const forward: Spot = [t.f.x, t.f.y, t.f.z];
    const up: Spot = [t.u.x, t.u.y, t.u.z];
    setListener(head, forward, up);
    voice?.listen(head, forward, up);
    for (const seat of live.current.seats) {
      if (seat.memberId && !seat.mine) voice?.place(seat.memberId, toWorld(seatHead(seat.angle), live.current.scale));
    }
  });
  return null;
}
