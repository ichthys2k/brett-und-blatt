/**
 * Karten in VR (#350): eigener Fächer vor einem, Ablage und Stich in der Tischmitte, verdeckte
 * Stapel vor den Mitspielern. Keine Spielregeln – je Spiel liest ein kleiner Übersetzer nur aus
 * der Sicht, welche Karten wo liegen. Was gespielt werden darf, sagt allein `legalMoves`;
 * geschickt wird immer ein Eintrag daraus.
 */
import type { GameMessage } from '@brett-und-blatt/online';
import { useState } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { seatAngle } from './Seats';
import { TABLE_CENTER, TABLE_RADIUS } from './Tavern';
import { GOLD } from './text';
import { Button3D } from './ui3d';
import { cardsOfMove, readCardView, type Face } from './card-views';

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

function Card({ face, position, rotation, highlight, selected, onPress, scale = 1 }: { face: Face | null; position: [number, number, number]; rotation?: [number, number, number]; highlight?: boolean; selected?: boolean; onPress?: () => void; scale?: number }) {
  const [hover, setHover] = useState(false);
  return (
    <group position={position} rotation={rotation} scale={scale * (hover && onPress ? 1.08 : 1)}>
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

function FaceDownStack({ count, position, rotation }: { count: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  const shown = Math.min(count, 8);
  return (
    <group position={position} rotation={rotation}>
      {Array.from({ length: shown }, (_, i) => (
        <Card key={i} face={null} position={[(i - (shown - 1) / 2) * 0.012, 0.0006 * i, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.8} />
      ))}
    </group>
  );
}

export function CardTable({ game, onMove }: { game: GameMessage; onMove: (move: unknown) => void }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const view = readCardView(game);
  if (!view) return null;
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
  return (
    <group>
      {view.hand.map((card, i) => {
        const offset = i - (n - 1) / 2;
        const isPlayable = playable.has(card.id);
        return (
          <Card
            key={card.id}
            face={card.face}
            position={[offset * spread, y + 0.11 + (isPlayable ? 0.012 : 0) - Math.abs(offset) * 0.002, fanZ - Math.abs(offset) * 0.004 + i * 0.0005]}
            rotation={[-0.55, 0, -offset * 0.03]}
            highlight={isPlayable}
            selected={picked.includes(card.id) || choice === card.id}
            onPress={isPlayable ? () => press(card.id) : undefined}
          />
        );
      })}
      {view.piles.map((face, k) => (face ? <Card key={`pile-${k}`} face={face} position={[pileX(k), y + 0.001, TABLE_CENTER[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={1.2} /> : null))}
      {view.rows.map((row, r) => (
        <group key={`row-${r}`} position={[TABLE_CENTER[0], y + 0.001, TABLE_CENTER[2] - 0.05 + (r - (view.rows.length - 1) / 2) * 0.1]}>
          {row.map((face, k) => (
            <Card key={k} face={face} position={[(k - (row.length - 1) / 2) * 0.072, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={view.rows.length > 2 ? 0.85 : 1} />
          ))}
        </group>
      ))}
      {stockShown > 0 && (
        <group position={[TABLE_CENTER[0] - (view.rows.length ? 0.32 : 0.08) - (view.piles.length > 1 ? 0.08 : 0), y, TABLE_CENTER[2]]}>
          {Array.from({ length: stockShown }, (_, k) => (
            <Card key={k} face={null} position={[0, 0.001 + k * 0.0015, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={1.2} highlight={Boolean(drawMove) && k === stockShown - 1} onPress={drawMove ? () => onMove(drawMove.move) : undefined} />
          ))}
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
          />
        ));
      })}
      {view.others.map((o) => {
        const angle = seatAngle(o.seat, game.yourSeat, count);
        const r = TABLE_RADIUS - 0.14;
        const position: [number, number, number] = [TABLE_CENTER[0] + Math.sin(angle) * r, y, TABLE_CENTER[2] + Math.cos(angle) * r];
        if (o.seat === view.drawFrom) {
          // Schwarzer Peter: jede verdeckte Karte einzeln zum Ziehen antippen.
          return (
            <group key={o.seat} position={position} rotation={[0, angle, 0]}>
              {Array.from({ length: o.count }, (_, i) => {
                const move = drawAt(i);
                return <Card key={i} face={null} position={[(i - (o.count - 1) / 2) * 0.05, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.8} highlight={Boolean(move)} onPress={move ? () => onMove(move.move) : undefined} />;
              })}
            </group>
          );
        }
        return (
          <group key={o.seat}>
            {o.count > 0 && <FaceDownStack count={o.count} position={position} rotation={[0, angle, 0]} />}
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
