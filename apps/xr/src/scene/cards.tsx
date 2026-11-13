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

export const CARD_GAMES = ['mau-mau', 'uno', 'skat'] as const;

export function isCardGame(id: string | null | undefined): boolean {
  return (CARD_GAMES as readonly string[]).includes(id ?? '');
}

/** Wie eine Kartenseite aussieht. */
export interface Face {
  /** Großes Zeichen in der Mitte, z. B. „♥“, „7“ oder „+2“. */
  center: string;
  /** Ecke oben links, z. B. „A♥“. */
  corner: string;
  color: string;
  background: string;
}

interface HandCard {
  id: string;
  face: Face;
}

/** Was der Kartentisch aus der Sicht braucht. */
interface CardView {
  hand: HandCard[];
  /** Obere Karte der Ablage (Mau-Mau, Eins!). */
  pile: Face | null;
  /** Karten des laufenden Stichs mit dem Platz, der sie gespielt hat (Skat). */
  trick: { seat: number; face: Face }[];
  /** Nachziehstapel: Anzahl verdeckter Karten. */
  stock: number;
  /** Verdeckte Handkarten der anderen Plätze. */
  others: { seat: number; count: number }[];
  /** Hinweis neben der Ablage, z. B. die Wunschfarbe. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Französisches Blatt (Mau-Mau, Skat): Karten-ID „S11.1“ = Farbe, Rang, Kopie

const SUIT_SIGNS: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
const GERMAN_SUITS: Record<string, string> = { C: 'Eichel', D: 'Schellen', H: 'Herz', S: 'Grün' };
const RANKS: Record<number, string> = { 1: 'A', 11: 'B', 12: 'D', 13: 'K' };
const GERMAN_RANKS: Record<number, string> = { 1: 'Ass', 11: 'Unter', 12: 'Ober', 13: 'König' };

function suitColor(suit: string, deck: string): string {
  if (deck === 'french') return suit === 'H' || suit === 'D' ? '#b3261e' : '#1d1510';
  if (deck === 'simple') return { C: '#1f5fbf', D: '#c99a12', H: '#b3261e', S: '#2f7d32' }[suit] ?? '#1d1510';
  if (deck === 'german' || deck === 'bavarian') return { C: '#6b4728', D: '#c99a12', H: '#b3261e', S: '#2f7d32' }[suit] ?? '#1d1510';
  // Turnierblatt: Kreuz schwarz, Pik grün, Herz rot, Karo gelb
  return { C: '#1d1510', D: '#c99a12', H: '#b3261e', S: '#2f7d32' }[suit] ?? '#1d1510';
}

export function frenchFace(card: string, deck = 'four-color'): Face | null {
  if (!/^[CDHS]\d+\./.test(card)) return null;
  const suit = card[0]!;
  const rank = Number(card.slice(1, card.indexOf('.')));
  const color = suitColor(suit, deck);
  if (deck === 'german' || deck === 'bavarian') {
    const r = GERMAN_RANKS[rank] ?? String(rank);
    return { center: GERMAN_SUITS[suit] ?? suit, corner: r, color, background: '#fbf5e6' };
  }
  const r = RANKS[rank] ?? String(rank);
  return { center: `${r}${SUIT_SIGNS[suit]}`, corner: `${r}${SUIT_SIGNS[suit]}`, color, background: '#fbf5e6' };
}

// ---------------------------------------------------------------------------
// Eins!-Karten: Objekt mit Vorder- und Rückseite (Flip)

const UNO_COLORS: Record<string, string> = {
  red: '#c62828',
  yellow: '#e0b000',
  green: '#2e7d32',
  blue: '#1e5bb8',
  orange: '#e06a00',
  teal: '#0d8478',
  purple: '#7b2fa8',
  pink: '#c2347a',
  wild: '#1d1510',
};
const UNO_SIGNS: Record<string, string> = {
  skip: '⊘',
  reverse: '⇄',
  draw1: '+1',
  draw2: '+2',
  draw6: '+6',
  draw10: '+10',
  skipAll: '⊘⊘',
  wild: '★',
  wildDraw4: '★+4',
  wildDraw6: '★+6',
  wildDraw10: '★+10',
  wildReverseDraw4: '⇄+4',
  flip: '↻',
  flipDraw5: '↻+5',
  wildDrawColor: '★?',
  roulette: '🎲',
  wildSkip: '★⊘',
  wildSkipAll: '★⊘⊘',
  wildTargetDraw2: '★🎯2',
  wildSwap: '★⇆',
};

interface UnoCard {
  id: string;
  front: { color: string; type: string };
  back?: { color: string; type: string };
}

function unoFace(card: UnoCard, side: string): Face {
  const face = side === 'dark' && card.back ? card.back : card.front;
  const sign = UNO_SIGNS[face.type] ?? face.type;
  return { center: sign, corner: sign, color: '#fbf5e6', background: UNO_COLORS[face.color] ?? '#1d1510' };
}

// ---------------------------------------------------------------------------
// Übersetzer je Spiel

function readView(game: GameMessage): CardView | null {
  const me = game.yourSeat;
  const view = game.view as Record<string, unknown>;
  const seats = game.seats.map((_, i) => i);
  if (game.gameId === 'mau-mau') {
    const v = view as { hands: string[][]; discard: string[]; stock: string[]; activeSuit?: string; options?: { deckStyle?: string } };
    const deck = v.options?.deckStyle ?? 'four-color';
    const top = v.discard[v.discard.length - 1];
    return {
      hand: me === null ? [] : (v.hands[me] ?? []).map((id) => ({ id, face: frenchFace(id, deck)! })).filter((c) => c.face),
      pile: top ? frenchFace(top, deck) : null,
      trick: [],
      stock: v.stock.length,
      others: seats.filter((s) => s !== me).map((s) => ({ seat: s, count: v.hands[s]?.length ?? 0 })),
      note: v.activeSuit && top && v.activeSuit !== top[0] ? `Wunschfarbe ${SUIT_SIGNS[v.activeSuit] ?? v.activeSuit}` : undefined,
    };
  }
  if (game.gameId === 'uno') {
    const v = view as { hands: UnoCard[][]; discard: UnoCard[]; stock: unknown[]; activeSide: string; activeColor: string };
    const top = v.discard[v.discard.length - 1];
    return {
      hand: me === null ? [] : (v.hands[me] ?? []).map((c) => ({ id: c.id, face: unoFace(c, v.activeSide) })),
      pile: top ? unoFace(top, v.activeSide) : null,
      trick: [],
      stock: v.stock.length,
      others: seats.filter((s) => s !== me).map((s) => ({ seat: s, count: v.hands[s]?.length ?? 0 })),
      note: top && (top.front.color === 'wild' || (v.activeSide === 'dark' && top.back?.color === 'wild')) ? `Farbe: ${v.activeColor}` : undefined,
    };
  }
  if (game.gameId === 'skat') {
    const v = view as { hands: Record<number, string[]>; currentTrick: { player: number; card: string }[]; deckStyle?: string; activeSeats: number[] };
    const deck = v.deckStyle ?? 'four-color';
    return {
      hand: me === null ? [] : (v.hands[me] ?? []).map((id) => ({ id, face: frenchFace(id, deck)! })).filter((c) => c.face),
      pile: null,
      trick: (v.currentTrick ?? []).map((p) => ({ seat: p.player, face: frenchFace(p.card, deck)! })).filter((t) => t.face),
      stock: 0,
      others: (v.activeSeats ?? seats).filter((s) => s !== me).map((s) => ({ seat: s, count: v.hands[s]?.length ?? 0 })),
    };
  }
  return null;
}

/** Welche Karten ein Zug ausspielt (leer, wenn der Zug keine Handkarte nutzt). */
function cardsOfMove(move: unknown): string[] {
  const m = move as { type?: string; cardId?: string; card?: string; cards?: string[] };
  if ((m.type === 'play' || m.type === 'jumpIn') && typeof m.cardId === 'string') return [m.cardId];
  if (m.type === 'play' && typeof m.card === 'string') return [m.card];
  if (m.type === 'discard' && Array.isArray(m.cards)) return m.cards;
  return [];
}

/** Züge, die der Kartentisch selbst anbietet: Karten ausspielen, drücken, vom Stapel ziehen. */
export function cardMoveIndexes(moves: unknown[]): Set<number> {
  const handled = new Set<number>();
  moves.forEach((m, i) => {
    if (cardsOfMove(m).length > 0 || (m as { type?: string }).type === 'draw') handled.add(i);
  });
  return handled;
}

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
  const view = readView(game);
  if (!view) return null;
  const y = TABLE_CENTER[1] + 0.003;
  const count = game.seats.length;
  const moves = game.legalMoves.map((move, i) => ({ move, label: game.moveLabels?.[i] ?? '', cards: cardsOfMove(move) }));
  const single = moves.filter((m) => m.cards.length === 1);
  const multi = moves.filter((m) => m.cards.length > 1);
  const playable = new Set(moves.flatMap((m) => m.cards));
  const drawMove = moves.find((m) => (m.move as { type?: string }).type === 'draw');

  const press = (id: string) => {
    if (multi.length > 0 && single.length === 0) {
      // Mehrere Karten auf einmal (Skat drücken): antippen sammelt, der Knopf schickt.
      setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));
      return;
    }
    const options = single.filter((m) => m.cards[0] === id);
    if (options.length === 1) onMove(options[0]!.move);
    else if (options.length > 1) setChoice(id);
  };
  const pickedMove = multi.find((m) => m.cards.length === picked.length && m.cards.every((c) => picked.includes(c)));
  const choices = choice ? single.filter((m) => m.cards[0] === choice) : [];

  // Fächer: auf einem Bogen an der eigenen Tischkante, leicht aufgestellt.
  const n = view.hand.length;
  const spread = Math.min(0.055, 0.5 / Math.max(n, 1));
  const fanZ = TABLE_CENTER[2] + TABLE_RADIUS - 0.2;
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
      {view.pile && <Card face={view.pile} position={[TABLE_CENTER[0] + 0.05, y + 0.001, TABLE_CENTER[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={1.2} />}
      {view.stock > 0 && (
        <group position={[TABLE_CENTER[0] - 0.08, y, TABLE_CENTER[2]]}>
          {Array.from({ length: Math.min(6, Math.ceil(view.stock / 5)) }, (_, k) => (
            <Card key={k} face={null} position={[0, 0.001 + k * 0.0015, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={1.2} highlight={Boolean(drawMove) && k === Math.min(6, Math.ceil(view.stock / 5)) - 1} onPress={drawMove ? () => onMove(drawMove.move) : undefined} />
          ))}
        </group>
      )}
      {view.trick.map((t, k) => {
        const angle = seatAngle(t.seat, game.yourSeat, count);
        return <Card key={`${t.seat}-${k}`} face={t.face} position={[TABLE_CENTER[0] + Math.sin(angle) * 0.09, y + 0.001 + k * 0.001, TABLE_CENTER[2] + Math.cos(angle) * 0.09]} rotation={[-Math.PI / 2, 0, angle]} scale={1.1} />;
      })}
      {view.others.map((o) => {
        const angle = seatAngle(o.seat, game.yourSeat, count);
        const r = TABLE_RADIUS - 0.14;
        return <FaceDownStack key={o.seat} count={o.count} position={[TABLE_CENTER[0] + Math.sin(angle) * r, y, TABLE_CENTER[2] + Math.cos(angle) * r]} rotation={[0, angle, 0]} />;
      })}
      {view.note && <Button3D label={view.note} position={[TABLE_CENTER[0] + 0.05, y + 0.08, TABLE_CENTER[2] - 0.02]} width={0.2} height={0.035} disabled />}
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
      {multi.length > 0 && (
        <Button3D
          label={pickedMove ? (pickedMove.label || 'Diese Karten') : `Karten wählen (${picked.length}/2)`}
          position={[TABLE_CENTER[0], y + 0.24, fanZ - 0.05]}
          rotation={[-0.4, 0, 0]}
          width={0.36}
          height={0.04}
          disabled={!pickedMove}
          active={Boolean(pickedMove)}
          onPress={() => {
            if (pickedMove) onMove(pickedMove.move);
            setPicked([]);
          }}
        />
      )}
    </group>
  );
}
