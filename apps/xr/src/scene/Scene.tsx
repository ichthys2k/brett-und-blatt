/**
 * Die 3D-Szene: Taverne, Plätze, Brett oder 2D-Fenster. Läuft im Browser mit Maus und in der
 * Brille mit Controllern oder Händen (Zeigen, Antippen, Greifen über @react-three/xr).
 */
import type { ClientMessage, GameMessage, RoomMessage } from '@brett-und-blatt/online';
import { Canvas, useThree } from '@react-three/fiber';
import { XR, XROrigin, type XRStore } from '@react-three/xr';
import { useEffect, useMemo, useState } from 'react';
import { isBoardGame } from '../catalog';
import type { Signal } from '../net';
import { ChessBoard, FourInARowBoard, TicTacToeBoard, boardMoveIndexes } from './boards';
import { CheckersBoard, GoBoard, GomokuBoard, MillBoard, ReversiBoard } from './boards2';
import { BattleshipBoard, ChineseCheckersBoard, FactorGridBoard, FourPlayerChessBoard, LudoBoard, UltimateTicTacToeBoard } from './boards3';
import { ColorShapeBoard, DominoBoard, GrafschaftBoard, WordGridBoard } from './boards4';
import { KniffelBoard, LowFlightBoard, MaexleBoard, PairsBoard, Tafel } from './boards5';
import { CardTable, cardMoveIndexes, isCardGame } from './cards';
import { Panel, ReactionBar, type VoiceControls } from './Panel';
import { Seats, seatAngle, type SeatInfo } from './Seats';
import { TABLE_CENTER, Tavern } from './Tavern';
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

export function Scene({ store, room, game, you, signals, send, onMove, gameAt, mesh, xrMembers, voice, speaking }: SceneProps) {
  const [now, setNow] = useState(() => Date.now());
  const ticking = Boolean(game && !game.result && game.clocks.some((c) => c?.running));
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);
  const { offset, adjust } = useViewOffset();
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
    () => (game && isBoardGame(game.gameId) ? boardMoveIndexes(game.gameId, game.legalMoves) : game && isCardGame(game.gameId) ? cardMoveIndexes(game.legalMoves) : new Set<number>()),
    [game],
  );
  const playing = game && !game.result ? game : null;
  const moveByValue = (move: unknown) => {
    if (!game) return;
    const index = game.legalMoves.indexOf(move);
    if (index >= 0) onMove(index);
  };
  const shown = game ?? null;
  return (
    <Canvas camera={{ fov: 60, near: 0.02, far: 40 }} dpr={[1, 2]}>
      <color attach="background" args={['#1d1510']} />
      <fog attach="fog" args={['#1d1510', 4, 11]} />
      <XR store={store}>
        <XROrigin position={[0, -offset.y, offset.z]} />
        <DesktopCamera />
        <Tavern chairs={seats.filter((s) => !s.mine).map((s) => ({ angle: s.angle, mine: false }))} />
        <Seats seats={seats} signals={signals} memberAvatar={(id) => room?.members.find((m) => m.id === id)?.avatar ?? null} figures={figures} />
        {mesh && <PoseSender mesh={mesh} xrMembers={xrMembers} sendRoomPose={(head) => send({ type: 'pose', head })} origin={[0, -offset.y, offset.z]} />}
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
        {shown && !isBoardGame(shown.gameId) && !isCardGame(shown.gameId) && <Tafel game={shown} />}
        {shown?.gameId === 'grafschaft' && <GrafschaftBoard key={`${shown.round}-${shown.version}`} game={shown} onMove={moveByValue} />}
        {shown && isCardGame(shown.gameId) && <CardTable key={`${shown.round}-${shown.version}`} game={shown} onMove={moveByValue} />}
        <Panel room={room} game={game} you={you} send={send} boardMoves={playing ? boardMoves : new Set()} onMove={onMove} adjust={adjust} voice={voice} />
        {room && <ReactionBar send={send} />}
      </XR>
    </Canvas>
  );
}
