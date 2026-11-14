/**
 * Karten in VR (#350): eigener Fächer vor einem, Ablage und Stich in der Tischmitte, verdeckte
 * Stapel vor den Mitspielern. Keine Spielregeln – je Spiel liest ein kleiner Übersetzer nur aus
 * der Sicht, welche Karten wo liegen. Was gespielt werden darf, sagt allein `legalMoves`;
 * geschickt wird immer ein Eintrag daraus.
 */
import type { GameMessage } from '@brett-und-blatt/online';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { useGrab } from './grab';
import { fanAttached, fanMode, fanYaw, handAnchor, onFanModeChange } from '../hand-fan';
import { CanvasTexture, SRGBColorSpace, type Group } from 'three';
import { seatAngle } from './Seats';
import { TABLE_CENTER, TABLE_RADIUS } from './Tavern';
import { GOLD } from './text';
import { Button3D } from './ui3d';
import { NO_FLIGHTS, cardsOfMove, diffFlights, readCardView, type CardView, type Face, type Flights, type Origin } from './card-views';
import { pulse } from '../haptics';

export { cardMoveIndexes, isCardGame } from './card-views';


// ---------------------------------------------------------------------------
// Darstellung

const W = 0.064;
const H = 0.096;
const faceCache = new Map<string, CanvasTexture>();

function faceTexture(face: Face | null): CanvasTexture {
  const key = face ? JSON.stringify(face) : 'rücken';
  const hit = faceCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  const round = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  if (!face) {
    // Rückseite: Weinrot mit goldenem Rahmen und Rautenmuster
    ctx.fillStyle = '#7a1f1a';
    round(0, 0, 256, 384, 22);
    ctx.fill();
    ctx.strokeStyle = '#e6b450';
    ctx.lineWidth = 8;
    round(14, 14, 228, 356, 16);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(230, 180, 80, 0.35)';
    ctx.lineWidth = 3;
    for (let i = -400; i < 400; i += 28) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 384, 384);
      ctx.moveTo(i + 384, 0);
      ctx.lineTo(i, 384);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = face.background;
    round(0, 0, 256, 384, 22);
    ctx.fill();
    ctx.strokeStyle = '#3f2a18';
    ctx.lineWidth = 4;
    round(3, 3, 250, 378, 20);
    ctx.stroke();
    ctx.fillStyle = face.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '700 54px system-ui, "Noto Color Emoji", sans-serif';
    ctx.fillText(face.corner, 18, 16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 120;
    ctx.font = `700 ${size}px system-ui, "Noto Color Emoji", sans-serif`;
    while (ctx.measureText(face.center).width > 220 && size > 40) {
      size -= 6;
      ctx.font = `700 ${size}px system-ui, "Noto Color Emoji", sans-serif`;
    }
    ctx.fillText(face.center, 128, 210);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  if (faceCache.size > 200) faceCache.clear();
  faceCache.set(key, texture);
  return texture;
}

/** Dauer eines Kartenflugs in Sekunden und Höhe des Bogens. */
const FLY_SECONDS = 0.4;
const FLY_ARC = 0.1;

type Euler3 = [number, number, number, ('XYZ' | 'YXZ')?];

export function Card({ face, position, rotation, highlight, selected, onPress, scale = 1, flyFrom, flyDelay = 0 }: { face: Face | null; position: [number, number, number]; rotation?: Euler3; highlight?: boolean; selected?: boolean; onPress?: () => void; scale?: number; flyFrom?: [number, number, number]; flyDelay?: number }) {
  const [hover, setHover] = useState(false);
  // Kartenflug (#366): Nur beim Entstehen der Karte; danach gelten wieder die Eigenschaften.
  const [landed, setLanded] = useState(!flyFrom);
  const group = useRef<Group>(null);
  const startedAt = useRef<number | null>(null);
  useFrame((state) => {
    const g = group.current;
    if (!flyFrom || landed || !g) return;
    if (startedAt.current === null) startedAt.current = state.clock.elapsedTime + flyDelay;
    const t = (state.clock.elapsedTime - startedAt.current) / FLY_SECONDS;
    if (t >= 1) {
      setLanded(true);
      return;
    }
    const k = t <= 0 ? 0 : 1 - (1 - t) * (1 - t);
    g.position.set(flyFrom[0] + (position[0] - flyFrom[0]) * k, flyFrom[1] + (position[1] - flyFrom[1]) * k + Math.sin(Math.PI * k) * FLY_ARC, flyFrom[2] + (position[2] - flyFrom[2]) * k);
    const r = rotation ?? [0, 0, 0];
    g.rotation.set(r[0] + 0.9 * (1 - k), r[1], r[2], r[3] ?? 'XYZ');
  });
  return (
    <group ref={group} position={landed ? position : flyFrom} rotation={rotation} scale={scale * (hover && onPress ? 1.08 : 1)}>
      <mesh
        onClick={
          onPress
            ? (e) => {
                e.stopPropagation();
                onPress();
              }
            : undefined
        }
        onPointerOver={(e) => {
          if (!onPress) return;
          e.stopPropagation();
          setHover(true);
        pulse('hover');
        }}
        onPointerOut={() => setHover(false)}
      >
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={faceTexture(face)} transparent toneMapped={false} />
      </mesh>
      {(highlight || selected) && (
        <mesh position={[0, 0, -0.0008]}>
          <planeGeometry args={[W + 0.008, H + 0.008]} />
          <meshBasicMaterial color={selected ? '#2f5d3a' : GOLD} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** Merkt sich die letzte Sicht und liefert, woher die neuen Karten dieser Version kamen (#366). */
let flightMemory: { gameId: string; round: number; version: number; view: CardView; flights: Flights } | null = null;

function flightsFor(game: GameMessage, view: CardView): Flights {
  const before = flightMemory;
  if (before && before.gameId === game.gameId && before.round === game.round && before.version === game.version) return before.flights;
  const newRound = !before || before.gameId !== game.gameId || before.round !== game.round;
  const deal = newRound && game.version <= 2;
  const flights = newRound ? (deal ? diffFlights(null, view, { mySeat: game.yourSeat, deal: true }) : NO_FLIGHTS) : diffFlights(before!.view, view, { mySeat: game.yourSeat, deal: false });
  flightMemory = { gameId: game.gameId, round: game.round, version: game.version, view, flights };
  return flights;
}

/** Hand eines Gegners (#366): aufrechter Fächer an seinem Platz, die Rücken zur Tischmitte. */
function OpponentHand({ seat, angle, count, newCount, stock, y, onPress, highlight }: { seat: number; angle: number; count: number; newCount: number; stock: [number, number, number]; y: number; onPress?: (index: number) => (() => void) | undefined; highlight?: (index: number) => boolean }) {
  const shown = Math.min(count, 14);
  const spread = Math.min(0.045, 0.34 / Math.max(shown, 1));
  const r = TABLE_RADIUS - 0.06;
  const base: [number, number] = [TABLE_CENTER[0] + Math.sin(angle) * r, TABLE_CENTER[2] + Math.cos(angle) * r];
  return (
    <group>
      {Array.from({ length: shown }, (_, i) => {
        const offset = i - (shown - 1) / 2;
        const position: [number, number, number] = [base[0] + Math.cos(angle) * offset * spread, y + 0.1 - Math.abs(offset) * 0.002, base[1] - Math.sin(angle) * offset * spread];
        const fresh = i >= shown - newCount;
        return (
          <Card
            key={`${seat}-${i}`}
            face={null}
            position={position}
            rotation={[-0.3, angle + Math.PI, offset * 0.04, 'YXZ']}
            scale={0.8}
            highlight={highlight?.(i)}
            onPress={onPress?.(i)}
            flyFrom={fresh ? stock : undefined}
            flyDelay={fresh ? (i - (shown - newCount)) * 0.08 : 0}
          />
        );
      })}
    </group>
  );
}

export function CardTable({ game, onMove }: { game: GameMessage; onMove: (move: unknown) => void }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  // Fächer an der Haltehand (#384): folgt der linken Hand, solange sie über dem Tisch angehoben ist.
  const fan = useRef<Group>(null);
  const [onHand, setOnHand] = useState(false);
  const [, redrawMode] = useState(0);
  useEffect(() => onFanModeChange(() => redrawMode((n) => n + 1)), []);
  useFrame(() => {
    const attached = fanAttached(fanMode(), handAnchor.active, handAnchor.y, TABLE_CENTER[1]);
    setOnHand((before) => (before === attached ? before : attached));
    if (!fan.current) return;
    if (attached) {
      fan.current.position.set(handAnchor.x, handAnchor.y + 0.1, handAnchor.z);
      fan.current.rotation.y = fanYaw([handAnchor.x, handAnchor.z], [handAnchor.headX, handAnchor.headZ]);
      fan.current.scale.setScalar(0.8);
    } else {
      fan.current.position.set(0, TABLE_CENTER[1] + 0.003 + 0.11, TABLE_CENTER[2] + TABLE_RADIUS - 0.2);
      fan.current.rotation.y = 0;
      fan.current.scale.setScalar(1);
    }
  });
  const view = readCardView(game);
  if (!view) return null;
  const flights = flightsFor(game, view);
  const y = TABLE_CENTER[1] + 0.003;
  const count = game.seats.length;
  const moves = game.legalMoves.map((move, i) => ({ move, label: game.moveLabels?.[i] ?? '', cards: cardsOfMove(move) }));
  const playable = new Set(moves.flatMap((m) => m.cards));
  const maxPick = Math.max(0, ...moves.map((m) => m.cards.length));
  const drawMove = view.drawFrom === undefined ? moves.find((m) => (m.move as { type?: string }).type === 'draw') : undefined;
  const drawAt = (index: number) => moves.find((m) => (m.move as { type?: string; index?: number }).type === 'draw' && (m.move as { index?: number }).index === index);

  // Eine Karte, die nur in Einzelzügen vorkommt, wird direkt gespielt (bei mehreren Zielen mit Wahl).
  // Kommt sie auch in Zügen mit mehreren Karten vor (Präsident, Skat drücken), sammelt Antippen.
  const press = (id: string) => {
    const candidates = moves.filter((m) => m.cards.includes(id));
    if (picked.length === 0 && candidates.every((m) => m.cards.length === 1)) {
      if (candidates.length === 1) onMove(candidates[0]!.move);
      else if (candidates.length > 1) setChoice(id);
      return;
    }
    setChoice(null);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-maxPick)));
  };
  const sameSet = (cards: string[]) => cards.length === picked.length && cards.every((c) => picked.includes(c));
  const pickedMoves = picked.length > 0 ? moves.filter((m) => sameSet(m.cards)) : [];
  const choices = choice ? moves.filter((m) => m.cards.length === 1 && m.cards[0] === choice) : [];

  // Fächer: auf einem Bogen an der eigenen Tischkante, leicht aufgestellt.
  const n = view.hand.length;
  const spread = Math.min(0.055, 0.5 / Math.max(n, 1));
  const fanZ = TABLE_CENTER[2] + TABLE_RADIUS - 0.2;
  const pileX = (k: number) => TABLE_CENTER[0] + 0.05 + (k - (view.piles.length - 1) / 2) * 0.1;
  // Ist der Stapel leer, darf aber gezogen werden (die Ablage wird gemischt), liegt trotzdem eine Karte da.
  const stockShown = Math.max(drawMove ? 1 : 0, Math.min(6, Math.ceil(view.stock / 5)));
  const stockPos: [number, number, number] = [TABLE_CENTER[0] - (view.rows.length ? 0.32 : 0.08) - (view.piles.length > 1 ? 0.08 : 0), y + 0.01, TABLE_CENTER[2]];
  const handPos = (index: number, total: number): [number, number, number] => {
    const off = index - (total - 1) / 2;
    return [off * Math.min(0.055, 0.5 / Math.max(total, 1)), y + 0.11, fanZ - Math.abs(off) * 0.004];
  };
  /** Weltposition, von der eine Karte losfliegt (#366). */
  const startOf = (origin: Origin | null | undefined): [number, number, number] | undefined => {
    if (!origin) return undefined;
    if (origin.kind === 'stock') return stockPos;
    if (origin.kind === 'hand') return handPos(origin.index, origin.count);
    if (origin.seat === game.yourSeat) return handPos(0, 1);
    const a = seatAngle(origin.seat, game.yourSeat, count);
    const r = TABLE_RADIUS - 0.06;
    return [TABLE_CENTER[0] + Math.sin(a) * r, y + 0.1, TABLE_CENTER[2] + Math.cos(a) * r];
  };
  // Greifen (#384): Karte aus dem Fächer (oder oberste vom Stapel) nehmen und in die Tischmitte legen.
  const grab = useGrab<string>({
    size: 1.4,
    heldKind: 'card',
    floorY: y + 0.14,
    floorCenter: [TABLE_CENTER[0], TABLE_CENTER[2]],
    radius: 0.3,
    targets: () => [{ id: 'mitte', x: TABLE_CENTER[0], z: TABLE_CENTER[2] }],
    onDrop: (id, to) => {
      if (to === null) return;
      if (id === 'stock') {
        if (drawMove) onMove(drawMove.move);
      } else press(id);
    },
  });
  const heldFace = grab.held ? (grab.held.id === 'stock' ? null : (view.hand.find((c) => c.id === grab.held!.id)?.face ?? null)) : null;
  let dealt = 0;
  return (
    <group>
      {grab.held && <Card face={heldFace} position={[grab.held.x, y + 0.16, grab.held.z]} rotation={[-Math.PI / 2.6, 0, 0]} scale={1.15} highlight />}
      {grab.layer}
      <group ref={fan}>
      <group position={[0, -(y + 0.11), -fanZ]}>
      {view.hand.map((card, i) => {
        const offset = i - (n - 1) / 2;
        const isPlayable = playable.has(card.id);
        if (grab.held?.id === card.id) return null;
        return (
          <group
            key={card.id}
            onPointerDown={(e) => {
              if (!isPlayable) return;
              e.stopPropagation();
              grab.begin(card.id, offset * spread, fanZ);
            }}
          >
          <Card
            face={card.face}
            position={[offset * spread, y + 0.11 + (isPlayable ? 0.012 : 0) - Math.abs(offset) * 0.002, fanZ - Math.abs(offset) * 0.004 + i * 0.0005]}
            rotation={[-0.55, 0, -offset * 0.03]}
            highlight={isPlayable}
            selected={picked.includes(card.id) || choice === card.id}
            onPress={isPlayable ? () => press(card.id) : undefined}
            flyFrom={onHand ? undefined : startOf(flights.handDraws[card.id])}
            flyDelay={flights.handDraws[card.id] ? dealt++ * 0.08 : 0}
          />
          </group>
        );
      })}
      </group>
      </group>
      {view.piles.map((face, k) => (face ? <Card key={`pile-${k}`} face={face} position={[pileX(k), y + 0.001, TABLE_CENTER[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={1.2} flyFrom={startOf(flights.piles[k])} /> : null))}
      {view.rows.map((row, r) => (
        <group key={`row-${r}`} position={[TABLE_CENTER[0], y + 0.001, TABLE_CENTER[2] - 0.05 + (r - (view.rows.length - 1) / 2) * 0.1]}>
          {row.map((face, k) => (
            <Card key={k} face={face} position={[(k - (row.length - 1) / 2) * 0.072, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={view.rows.length > 2 ? 0.85 : 1} />
          ))}
        </group>
      ))}
      {stockShown > 0 && (
        <group
          onPointerDown={(e) => {
            if (!drawMove) return;
            e.stopPropagation();
            grab.begin('stock', stockPos[0], stockPos[2]);
          }}
        >
        <group position={[TABLE_CENTER[0] - (view.rows.length ? 0.32 : 0.08) - (view.piles.length > 1 ? 0.08 : 0), y, TABLE_CENTER[2]]}>
          {Array.from({ length: stockShown }, (_, k) => (
            <Card key={k} face={null} position={[0, 0.001 + k * 0.0015, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={1.2} highlight={Boolean(drawMove) && k === stockShown - 1} onPress={drawMove ? () => onMove(drawMove.move) : undefined} />
          ))}
        </group>
        </group>
      )}
      {view.trick.map((t, k) => {
        const angle = seatAngle(t.seat, game.yourSeat, count);
        return t.faces.map((face, j) => (
          <Card
            key={`${t.seat}-${k}-${j}`}
            face={face}
            position={[TABLE_CENTER[0] + Math.sin(angle) * 0.09 + Math.cos(angle) * (j - (t.faces.length - 1) / 2) * 0.03, y + 0.001 + (k + j) * 0.001, TABLE_CENTER[2] + Math.cos(angle) * 0.09 - Math.sin(angle) * (j - (t.faces.length - 1) / 2) * 0.03]}
            rotation={[-Math.PI / 2, 0, angle]}
            scale={1.1}
            flyFrom={startOf(flights.trick[k])}
          />
        ));
      })}
      {view.others.map((o) => {
        const angle = seatAngle(o.seat, game.yourSeat, count);
        const r = TABLE_RADIUS - 0.14;
        const position: [number, number, number] = [TABLE_CENTER[0] + Math.sin(angle) * r, y, TABLE_CENTER[2] + Math.cos(angle) * r];
        // Handkarten der anderen: aufrechter Fächer an ihrem Platz (#366); bei Schwarzer Peter einzeln zum Ziehen antippbar.
        const drawing = o.seat === view.drawFrom;
        return (
          <group key={o.seat}>
            {o.count > 0 && (
              <OpponentHand
                seat={o.seat}
                angle={angle}
                count={o.count}
                newCount={flights.otherDraws[o.seat] ?? 0}
                stock={stockPos}
                y={y}
                highlight={drawing ? (i) => Boolean(drawAt(i)) : undefined}
                onPress={drawing ? (i) => (drawAt(i) ? () => onMove(drawAt(i)!.move) : undefined) : undefined}
              />
            )}
            {(o.open ?? []).map((face, j) => (
              <Card key={j} face={face} position={[position[0] + Math.cos(angle) * (j - ((o.open?.length ?? 1) - 1) / 2) * 0.07, y + 0.002, position[2] - Math.sin(angle) * (j - ((o.open?.length ?? 1) - 1) / 2) * 0.07]} rotation={[-Math.PI / 2, 0, angle]} />
            ))}
          </group>
        );
      })}
      {view.note && <Button3D label={view.note} position={[TABLE_CENTER[0] + 0.05, y + 0.08, TABLE_CENTER[2] - 0.12]} width={0.32} height={0.045} disabled />}
      {choices.length > 0 && (
        <group position={[TABLE_CENTER[0], y + 0.25, fanZ - 0.08]} rotation={[-0.4, 0, 0]}>
          {choices.map((m, k) => (
            <Button3D
              key={m.label || k}
              label={m.label}
              position={[0, -k * 0.045, 0]}
              width={0.42}
              height={0.04}
              onPress={() => {
                onMove(m.move);
                setChoice(null);
              }}
            />
          ))}
          <Button3D label="Abbrechen" position={[0, -choices.length * 0.045, 0]} width={0.2} height={0.035} onPress={() => setChoice(null)} />
        </group>
      )}
      {picked.length > 0 && (
        <group position={[TABLE_CENTER[0], y + 0.25, fanZ - 0.06]} rotation={[-0.4, 0, 0]}>
          {pickedMoves.length === 0 && <Button3D label={`${picked.length} Karte${picked.length === 1 ? '' : 'n'} gewählt – weitere antippen`} position={[0, 0, 0]} width={0.42} height={0.04} disabled />}
          {pickedMoves.map((m, k) => (
            <Button3D
              key={m.label || k}
              label={m.label || 'Diese Karten'}
              position={[0, -k * 0.045, 0]}
              width={0.42}
              height={0.04}
              active
              onPress={() => {
                onMove(m.move);
                setPicked([]);
              }}
            />
          ))}
          <Button3D label="Auswahl aufheben" position={[0, -Math.max(1, pickedMoves.length) * 0.045, 0]} width={0.24} height={0.035} onPress={() => setPicked([])} />
        </group>
      )}
    </group>
  );
}
