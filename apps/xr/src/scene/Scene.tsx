/**
 * Die 3D-Szene: Taverne, Plätze, Brett oder 2D-Fenster. Läuft im Browser mit Maus und in der
 * Brille mit Controllern oder Händen (Zeigen, Antippen, Greifen über @react-three/xr).
 */
import type { ClientMessage, GameMessage, RoomMessage } from '@brett-und-blatt/online';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { XR, XROrigin, useXR, type XRStore } from '@react-three/xr';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { isBoardGame } from '../catalog';
import type { Signal } from '../net';
import { ChessBoard, FourInARowBoard, TicTacToeBoard, boardMoveIndexes } from './boards';
import { CheckersBoard, GoBoard, GomokuBoard, MillBoard, ReversiBoard } from './boards2';
import { BattleshipBoard, ChineseCheckersBoard, FactorGridBoard, FourPlayerChessBoard, LudoBoard, UltimateTicTacToeBoard } from './boards3';
import { ColorShapeBoard, DominoBoard, GrafschaftBoard, WordGridBoard } from './boards4';
import { KniffelBoard, LowFlightBoard, MaexleBoard, PairsBoard, Tafel } from './boards5';
import { InputDesk } from './input';
import { hiddenMoveIndexes, inputPlan } from './input-spec';
import { CardTable, cardMoveIndexes, isCardGame } from './cards';
import { Panel, ReactionBar, type VoiceControls } from './Panel';
import { Seats, seatAngle, type SeatInfo } from './Seats';
import { TABLE_CENTER, Tavern } from './Tavern';
import { bindHapticSession, pulse } from '../haptics';
import { alignOffset, type Offset } from './view-align';
import { SCALE_STEP, TablePlacer, clampScale, placementOrigin, type Placement } from './Placement';
import { Figures, POSE_STALE_MS, PoseSender } from './Meet';
import type { PeerMesh } from '../peers';

interface SceneProps {
  store: XRStore;
  room: RoomMessage | null;
  game: GameMessage | null;
  you: string | null;
  signals: Signal[];
  send: (m: ClientMessage) => void;
  onMove: (index: number) => void;
  /** Ortszeit der letzten game-Nachricht, zum Weiterzählen der Uhren. */
  gameAt: number;
  /** VR-Treffpunkt (#351): Verbindungen zu den anderen Brillen und wer gerade mit Brille da ist. */
  mesh: PeerMesh | null;
  xrMembers: string[];
  /** Sprachchat (#352): Bedienung für das 2D-Fenster und wer gerade spricht. */
  voice: VoiceControls;
  speaking: string[];
  /** Letzte Fehlermeldung des Raums (abgelehnte Eingabe), löst einen Fehlerimpuls aus. */
  error?: string | null;
}

const VIEW_KEY = 'brett-und-blatt-xr-tisch';

/** Tischhöhe und Abstand je Gerät (Sitzen oder Stehen); verschiebt den eigenen Standpunkt. */
function useViewOffset() {
  const [offset, setOffset] = useState<{ y: number; z: number }>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null') as { y?: number; z?: number } | null;
      return { y: raw?.y ?? 0, z: raw?.z ?? 0 };
    } catch {
      return { y: 0, z: 0 };
    }
  });
  const change = (dy: number, dz: number) =>
    setOffset((o) => {
      const next = { y: Math.max(-0.5, Math.min(0.5, o.y + dy)), z: Math.max(-0.6, Math.min(0.6, o.z + dz)) };
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(next));
      } catch {
        // ohne Speicher gilt die Einstellung nur bis zum Neuladen
      }
      return next;
    });
  return {
    offset,
    adjust: { up: () => change(0.05, 0), down: () => change(-0.05, 0), closer: () => change(0, -0.05), farther: () => change(0, 0.05) },
  };
}

/** Restzeit als m:ss, weitergezählt seit der letzten Nachricht. */
function clockText(game: GameMessage, seat: number, gameAt: number, now: number): string {
  const reading = game.clocks[seat];
  if (!reading || reading.leftMs === null || reading.leftMs === undefined) return '';
  const left = Math.max(0, reading.running ? reading.leftMs - (now - gameAt) : reading.leftMs);
  const s = Math.ceil(left / 1000);
  return `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Frames, die nach dem Eintreten oder Neuausrichten gewartet werden, bis die Kopfhaltung stimmt. */
const ALIGN_SETTLE_FRAMES = 20;

/**
 * Misst in der Brille einmal die Kopfposition (nach dem Eintreten und nach jedem Neuausrichten)
 * und meldet die Verschiebung, mit der man mittig vor dem Tisch und über der Tischplatte sitzt (#365).
 */
function HeadAlign({ origin, onAlign }: { origin: [number, number, number]; onAlign: (offset: Offset) => void }) {
  const camera = useThree((s) => s.camera);
  const frames = useRef(0);
  const measured = useRef(false);
  const space = useRef<XRReferenceSpace | null>(null);
  const originRef = useRef(origin);
  originRef.current = origin;
  const head = useMemo(() => new Vector3(), []);
  useFrame((state) => {
    if (!state.gl.xr.isPresenting) {
      frames.current = 0;
      measured.current = false;
      space.current = null;
      return;
    }
    // Meta-Taste gedrückt halten: Der Bezugsraum meldet „reset“, dann neu messen.
    const current = state.gl.xr.getReferenceSpace();
    if (current && current !== space.current) {
      space.current = current;
      current.addEventListener('reset', () => {
        frames.current = 0;
        measured.current = false;
      });
    }
    if (measured.current) return;
    frames.current += 1;
    if (frames.current < ALIGN_SETTLE_FRAMES) return;
    camera.getWorldPosition(head);
    const o = originRef.current;
    onAlign(alignOffset({ x: head.x - o[0], y: head.y - o[1], z: head.z - o[2] }));
    measured.current = true;
  });
  return null;
}

/** Meldet dem Vibrationshelfer die laufende Sitzung (#380). */
function HapticsBridge() {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    bindHapticSession(() => gl.xr.getSession());
    return () => bindHapticSession(() => null);
  }, [gl]);
  return null;
}

/** Meldet, ob gerade eine Mixed-Reality-Sitzung läuft (der Zustand ist nur innerhalb von <XR> lesbar). */
function ModeProbe({ onMixed }: { onMixed: (mixed: boolean) => void }) {
  const mixed = useXR((state) => state.mode) === 'immersive-ar';
  useEffect(() => onMixed(mixed), [mixed, onMixed]);
  return null;
}

/** Hintergrund und Nebel der Taverne; in Mixed Reality (#369) keins von beiden, damit das Passthrough-Bild durchscheint. */
function Backdrop() {
  const mixed = useXR((state) => state.mode) === 'immersive-ar';
  if (mixed) return null;
  return (
    <>
      <color attach="background" args={['#1d1510']} />
      <fog attach="fog" args={['#1d1510', 4, 11]} />
    </>
  );
}

/** Ohne Brille: Blick vom eigenen Platz schräg auf den Tisch. */
function DesktopCamera() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.set(0, 1.32, 0.25);
    camera.lookAt(TABLE_CENTER[0], TABLE_CENTER[1] + 0.12, TABLE_CENTER[2] - 0.15);
  }, [camera]);
  return null;
}

function seatInfos(room: RoomMessage | null, game: GameMessage | null, you: string | null, gameAt: number, now: number): SeatInfo[] {
  if (game) {
    const count = game.seats.length;
    const winners = game.result?.kind === 'win' ? game.result.winners : [];
    return game.seats.map((seat, index) => {
      const member = room?.members.find((m) => m.id === seat.memberId);
      return {
        index,
        angle: seatAngle(index, game.yourSeat, count),
        mine: index === game.yourSeat,
        avatar: seat.kind === 'bot' ? '🤖' : (member?.avatar ?? seat.avatar ?? '🙂'),
        name: seat.name,
        memberId: seat.memberId,
        bot: seat.kind === 'bot' ? (seat.level ?? null) : null,
        turn: !game.result && game.current.includes(index),
        winner: winners.includes(index),
        clock: game.result ? '' : clockText(game, index, gameAt, now),
      };
    });
  }
  if (!room) return [];
  const seats = room.lobby.seats;
  const mine = seats.findIndex((s) => s.kind === 'human' && s.memberId === you);
  return seats.map((seat, index) => {
    const member = seat.kind === 'human' ? room.members.find((m) => m.id === seat.memberId) : undefined;
    return {
      index,
      angle: seatAngle(index, mine >= 0 ? mine : null, seats.length),
      mine: index === mine,
      avatar: seat.kind === 'bot' ? '🤖' : (member?.avatar ?? '🪑'),
      name: seat.kind === 'bot' ? 'Bot' : (member?.name ?? 'frei'),
      memberId: seat.kind === 'human' ? seat.memberId : null,
      bot: seat.kind === 'bot' ? seat.level : null,
      turn: false,
      winner: false,
    };
  });
}

export function Scene({ store, room, game, you, signals, send, onMove, gameAt, mesh, xrMembers, voice, speaking, error = null }: SceneProps) {
  const [now, setNow] = useState(() => Date.now());
  const ticking = Boolean(game && !game.result && game.clocks.some((c) => c?.running));
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);
  // Vibration (#380): „Du bist dran“ beim Wechsel an die Reihe, Fehlerimpuls bei abgelehnter Eingabe.
  const myTurn = Boolean(game && !game.result && game.yourSeat !== null && game.current.includes(game.yourSeat));
  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) pulse('turn');
    wasMyTurn.current = myTurn;
  }, [myTurn]);
  useEffect(() => {
    if (error) pulse('error');
  }, [error]);
  const { offset, adjust } = useViewOffset();
  const [align, setAlign] = useState<Offset>({ x: 0, y: 0, z: 0 });
  // Mixed Reality (#369, #370): Tisch auf einer echten Fläche (`placed`), verkleinert um `tableScale`.
  const [mixed, setMixed] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<Placement | null>(null);
  const [tableScale, setTableScale] = useState(1);
  const base = placed ?? align;
  const origin: [number, number, number] = [base.x, base.y - offset.y, base.z + offset.z];
  const scale = mixed ? tableScale : 1;
  const placement = mixed
    ? {
        placing,
        placed: placed !== null,
        percent: Math.round(tableScale * 100),
        start: () => setPlacing(true),
        cancel: () => setPlacing(false),
        release: () => setPlaced(null),
        bigger: () => setTableScale((k) => clampScale(k + SCALE_STEP)),
        smaller: () => setTableScale((k) => clampScale(k - SCALE_STEP)),
      }
    : undefined;
  const seats = seatInfos(room, game, you, gameAt, now).map((s) => (s.memberId && speaking.includes(s.memberId) ? { ...s, speaking: true } : s));

  // Figuren der anderen Brillen: nur mit frischer Pose; einmal je Sekunde neu entschieden.
  const [figures, setFigures] = useState<string[]>([]);
  useEffect(() => {
    if (!mesh) return setFigures([]);
    const pick = () => {
      const fresh = xrMembers.filter((id) => id !== you && Date.now() - (mesh.poses.get(id)?.at ?? 0) < POSE_STALE_MS);
      setFigures((before) => (before.join() === fresh.join() ? before : fresh));
    };
    pick();
    const id = window.setInterval(pick, 1000);
    return () => window.clearInterval(id);
  }, [mesh, xrMembers, you]);
  const seatOf = (memberId: string): number | null => {
    if (game) {
      const i = game.seats.findIndex((s) => s.memberId === memberId);
      return i >= 0 ? i : null;
    }
    const i = room?.lobby.seats.findIndex((s) => s.kind === 'human' && s.memberId === memberId) ?? -1;
    return i >= 0 ? i : null;
  };
  const seatCount = game ? game.seats.length : (room?.lobby.seats.length ?? 0);
  const myBase = you ? (seatOf(you) ?? 0) : 0;
  const boardMoves = useMemo(
    () => {
      if (!game) return new Set<number>();
      const handled = isBoardGame(game.gameId) ? boardMoveIndexes(game.gameId, game.legalMoves) : isCardGame(game.gameId) ? cardMoveIndexes(game.legalMoves) : new Set<number>();
      // Beispielzüge zu Spielen mit eigener Eingabe (#358) stehen nicht im Fenster.
      for (const i of hiddenMoveIndexes(game)) handled.add(i);
      return handled;
    },
    [game],
  );
  const playing = game && !game.result ? game : null;
  const moveByValue = (move: unknown) => {
    if (!game) return;
    const index = game.legalMoves.indexOf(move);
    if (index >= 0) {
      pulse('move');
      onMove(index);
    }
  };
  const shown = game ?? null;
  return (
    <Canvas camera={{ fov: 60, near: 0.02, far: 40 }} dpr={[1, 2]}>
      <XR store={store}>
        <Backdrop />
        <HapticsBridge />
        <ModeProbe onMixed={setMixed} />
        <TablePlacer
          active={placing && mixed}
          origin={origin}
          onPlace={(hit) => {
            setPlaced(placementOrigin(hit));
            setPlacing(false);
          }}
        />
        <XROrigin position={origin} />
        <HeadAlign origin={origin} onAlign={setAlign} />
        <DesktopCamera />
        <group position={TABLE_CENTER} scale={scale}>
        <group position={[-TABLE_CENTER[0], -TABLE_CENTER[1], -TABLE_CENTER[2]]}>
        <Tavern chairs={seats.filter((s) => !s.mine).map((s) => ({ angle: s.angle, mine: false }))} />
        <Seats seats={seats} signals={signals} memberAvatar={(id) => room?.members.find((m) => m.id === id)?.avatar ?? null} figures={figures} />
        {mesh && <PoseSender mesh={mesh} xrMembers={xrMembers} sendRoomPose={(head) => send({ type: 'pose', head })} origin={origin} scale={scale} />}
        {mesh && <Figures mesh={mesh} members={figures} seatOf={seatOf} mySeatBase={myBase} count={seatCount} infos={seats} />}
        {shown?.gameId === 'tic-tac-toe' && <TicTacToeBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'four-in-a-row' && <FourInARowBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'chess' && <ChessBoard key={`${shown.round}`} game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'checkers' && <CheckersBoard key={`${shown.round}`} game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'mill' && <MillBoard key={`${shown.round}-${shown.version}`} game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'reversi' && <ReversiBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'gomoku' && <GomokuBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'go' && <GoBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'ultimate-tic-tac-toe' && <UltimateTicTacToeBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'factor-grid' && <FactorGridBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'battleship' && <BattleshipBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'four-player-chess' && <FourPlayerChessBoard key={`${shown.round}-${shown.version}`} game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'chinese-checkers' && <ChineseCheckersBoard key={`${shown.round}-${shown.version}`} game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'ludo' && <LudoBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'dominoes' && <DominoBoard key={`${shown.round}-${shown.version}`} game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'scrabble' && <WordGridBoard key={`${shown.round}-${shown.version}`} game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'color-and-shape' && <ColorShapeBoard key={`${shown.round}-${shown.version}`} game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'kniffel' && <KniffelBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'maexle' && <MaexleBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'pairs' && <PairsBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'low-flight' && <LowFlightBoard key={`${shown.round}-${shown.version}`} game={shown} onMove={moveByValue} />}
        {shown && !isBoardGame(shown.gameId) && !isCardGame(shown.gameId) && !(playing && inputPlan(playing)) && <Tafel game={shown} />}
        {playing && <InputDesk game={playing} onMove={(move) => {
          pulse('move');
          send({ type: 'move', version: playing.version, move });
        }} />}
        {shown?.gameId === 'grafschaft' && <GrafschaftBoard key={`${shown.round}-${shown.version}`} game={shown} onMove={moveByValue} />}
        {shown && isCardGame(shown.gameId) && <CardTable key={`${shown.round}-${shown.version}`} game={shown} onMove={moveByValue} />}
        </group>
        </group>
        <Panel room={room} game={game} you={you} send={send} boardMoves={playing ? boardMoves : new Set()} onMove={(index) => {
          pulse('move');
          onMove(index);
        }} adjust={adjust} placement={placement} voice={voice} />
        {room && <ReactionBar send={send} />}
      </XR>
    </Canvas>
  );
}
