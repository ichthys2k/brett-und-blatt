/**
 * Mitspieler am Tisch: je Platz ein Stuhl mit Schild (Avatar-Emoji und Name) und darüber die
 * Emoji-Reaktionen und Schnellnachrichten, die gerade ankommen.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { LEVEL_TEXT, PHRASE_TEXT } from '../catalog';
import type { Signal } from '../net';
import { TABLE_CENTER, TABLE_RADIUS } from './Tavern';
import { Sign } from './ui3d';

export interface SeatInfo {
  index: number;
  angle: number;
  mine: boolean;
  avatar: string;
  name: string;
  memberId: string | null;
  bot: string | null;
  turn: boolean;
  winner: boolean;
  /** Restzeit, z. B. „⏱ 0:42“; leer ohne Uhr. */
  clock?: string;
  /** Spricht gerade im Sprachchat (#352). */
  speaking?: boolean;
}

/** Winkel eines Platzes: der eigene vorn (zum Betrachter), die anderen reihum. */
export function seatAngle(index: number, mySeat: number | null, count: number): number {
  const base = mySeat ?? 0;
  return (((index - base + count) % count) * 2 * Math.PI) / count;
}

function seatPoint(angle: number, radius: number, y: number): [number, number, number] {
  return [TABLE_CENTER[0] + Math.sin(angle) * radius, y, TABLE_CENTER[2] + Math.cos(angle) * radius];
}

/** Um wie viel das Schild dem Spieler am Zug zugewandt wird (0 = zur Tischmitte, 1 = ganz zu ihm). */
export const TURN_BLEND = 0.45;

/** Blickrichtung (Drehung um die Hochachse) eines Stuhlschilds: zur Tischmitte, sanft zum Spieler am Zug gedreht. */
export function signYaw(angle: number, activeAngle: number | null, radius: number): number {
  const base = angle + Math.PI;
  if (activeAngle === null || activeAngle === angle) return base;
  const from = [Math.sin(angle) * radius, Math.cos(angle) * radius];
  const to = [Math.sin(activeAngle) * radius, Math.cos(activeAngle) * radius];
  const wanted = Math.atan2(to[0]! - from[0]!, to[1]! - from[1]!);
  let delta = wanted - base;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return base + TURN_BLEND * delta;
}

/** Schild am Stuhl, das sich sanft zum Spieler am Zug dreht (#385). */
function TurningSign({ position, yaw, lines, width, height }: { position: [number, number, number]; yaw: number; lines: string[]; width: number; height: number }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    let diff = yaw - g.rotation.y;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    g.rotation.y += diff * Math.min(1, delta * 4);
  });
  return (
    <group ref={group} position={position} rotation={[0, yaw, 0]}>
      <Sign lines={lines} position={[0, 0, 0]} width={width} height={height} />
    </group>
  );
}

function Floating({ text, born, position, rotation }: { text: string; born: number; position: [number, number, number]; rotation: [number, number, number] }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const age = (Date.now() - born) / 1000;
    if (!group.current) return;
    group.current.position.y = position[1] + age * 0.06;
    group.current.visible = age < 3.5;
  });
  return (
    <group ref={group} position={position} rotation={rotation}>
      <Sign lines={[text]} position={[0, 0, 0]} width={text.length > 3 ? 0.32 : 0.12} height={0.12} background={text.length > 3 ? '#2a1f17' : null} />
    </group>
  );
}

export function Seats({ seats, signals, memberAvatar, figures = [] }: { seats: SeatInfo[]; signals: Signal[]; memberAvatar: (memberId: string) => string | null; figures?: string[] }) {
  const activeAngle = seats.find((s) => s.turn)?.angle ?? null;
  return (
    <group>
      {seats.map((seat) => {
        // Der eigene Platz ist man selbst; sein Schild liegt flach vor einem auf dem Tisch.
        const signPos: [number, number, number] = seat.mine ? [TABLE_CENTER[0] - 0.33, TABLE_CENTER[1] + 0.03, TABLE_CENTER[2] + 0.36] : seatPoint(seat.angle, TABLE_RADIUS + 0.38, 1.28);
        const rotation: [number, number, number] = seat.mine ? [-Math.PI / 2.4, 0, 0] : [0, seat.angle + Math.PI, 0];
        const status = [seat.speaking ? '🔊' : '', seat.winner ? '🏆 gewinnt' : seat.turn ? '⏳ am Zug' : seat.bot ? `Bot ${LEVEL_TEXT[seat.bot] ?? ''}` : '', seat.clock ?? ''].filter(Boolean).join('  ');
        const own = signals.filter((s) => s.from === seat.memberId);
        return (
          <group key={seat.index}>
            {/* VR-Spieler mit Figur tragen ihr Schild selbst (scene/Meet.tsx); Handy-Spieler bleiben Schild am Stuhl. */}
            {!(seat.memberId && !seat.mine && figures.includes(seat.memberId)) && (
              seat.mine ? (
                <Sign lines={[`${seat.avatar} ${seat.name}`, status]} position={signPos} rotation={rotation} width={0.26} height={0.08} />
              ) : (
                <TurningSign position={signPos} yaw={signYaw(seat.angle, activeAngle, TABLE_RADIUS + 0.38)} lines={[`${seat.avatar} ${seat.name}`, status]} width={0.36} height={0.13} />
              )
            )}
            {own.map((signal) => (
              <Floating
                  key={signal.id}
                  rotation={seat.mine ? [0, 0, 0] : rotation}
                  text={signal.kind === 'react' ? signal.value : `${memberAvatar(signal.from) ?? ''} ${PHRASE_TEXT[signal.value] ?? signal.value}`}
                  born={signal.at}
                  position={seat.mine ? [signPos[0], signPos[1] + 0.2, signPos[2]] : [signPos[0], signPos[1] + 0.14, signPos[2]]}
                />
            ))}
          </group>
        );
      })}
    </group>
  );
}
