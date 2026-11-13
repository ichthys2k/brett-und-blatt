/**
 * Die 3D-Szene: Taverne, Plätze, Brett oder 2D-Fenster. Läuft im Browser mit Maus und in der
 * Brille mit Controllern oder Händen (Zeigen, Antippen, Greifen über @react-three/xr).
 */
import type { ClientMessage, GameMessage, RoomMessage } from '@brett-und-blatt/online';
import { Canvas, useThree } from '@react-three/fiber';
import { XR, XROrigin, type XRStore } from '@react-three/xr';
import { useEffect, useMemo } from 'react';
import { isBoardGame } from '../catalog';
import type { Signal } from '../net';
import { ChessBoard, FourInARowBoard, TicTacToeBoard, boardMoveIndexes } from './boards';
import { Panel, ReactionBar } from './Panel';
import { Seats, seatAngle, type SeatInfo } from './Seats';
import { TABLE_CENTER, Tavern } from './Tavern';

interface SceneProps {
  store: XRStore;
  room: RoomMessage | null;
  game: GameMessage | null;
  you: string | null;
  signals: Signal[];
  send: (m: ClientMessage) => void;
  onMove: (index: number) => void;
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

function seatInfos(room: RoomMessage | null, game: GameMessage | null, you: string | null): SeatInfo[] {
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

export function Scene({ store, room, game, you, signals, send, onMove }: SceneProps) {
  const seats = seatInfos(room, game, you);
  const boardMoves = useMemo(() => (game && isBoardGame(game.gameId) ? boardMoveIndexes(game.gameId, game.legalMoves) : new Set<number>()), [game]);
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
        <XROrigin position={[0, 0, 0]} />
        <DesktopCamera />
        <Tavern chairs={seats.filter((s) => !s.mine).map((s) => ({ angle: s.angle, mine: false }))} />
        <Seats seats={seats} signals={signals} memberAvatar={(id) => room?.members.find((m) => m.id === id)?.avatar ?? null} />
        {shown?.gameId === 'tic-tac-toe' && <TicTacToeBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'four-in-a-row' && <FourInARowBoard game={shown} onMove={moveByValue} />}
        {shown?.gameId === 'chess' && <ChessBoard key={`${shown.round}`} game={shown} onMove={moveByValue} />}
        <Panel room={room} game={game} you={you} send={send} boardMoves={playing ? boardMoves : new Set()} onMove={onMove} />
        {room && <ReactionBar send={send} />}
      </XR>
    </Canvas>
  );
}
