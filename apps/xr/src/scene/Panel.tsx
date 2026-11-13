/**
 * Das 2D-Fenster über dem Tisch (#339): Raum und Plätze in der Lobby, in der Partie die Züge
 * als Liste mit den Zugtexten des Servers – damit läuft jedes Spiel, auch ohne 3D-Figuren.
 */
import { REACTIONS, type ClientMessage, type GameMessage, type RoomMessage } from '@brett-und-blatt/online';
import { useState } from 'react';
import { gameName, isBoardGame } from '../catalog';
import { TABLE_CENTER } from './Tavern';
import { WOOD_DARK } from './text';
import { Button3D, Sign } from './ui3d';

const PAGE = 6;
// Neben einem 3D-Brett schräg links hinter dem Tisch, dem eigenen Platz zugewandt; ohne Brett
// (Lobby und Spiele ohne 3D-Figuren) mittig über dem Tisch.
const SIDE_POS: [number, number, number] = [TABLE_CENTER[0] - 0.68, 1.22, TABLE_CENTER[2] - 0.62];
const SIDE_ROT: [number, number, number] = [0, Math.atan2(0.68, 0.62 - TABLE_CENTER[2]), 0];
const CENTER_POS: [number, number, number] = [TABLE_CENTER[0], 1.2, TABLE_CENTER[2] - 0.25];
const CENTER_ROT: [number, number, number] = [0, 0, 0];

interface PanelProps {
  room: RoomMessage | null;
  game: GameMessage | null;
  you: string | null;
  send: (m: ClientMessage) => void;
  /** Indizes der Züge, die das 3D-Brett schon anbietet. */
  boardMoves: Set<number>;
  onMove: (index: number) => void;
}

export function Panel({ room, game, you, send, boardMoves, onMove }: PanelProps) {
  const [page, setPage] = useState(0);
  const beside = Boolean(game && isBoardGame(game.gameId));
  const PANEL_POS = beside ? SIDE_POS : CENTER_POS;
  const PANEL_ROT = beside ? SIDE_ROT : CENTER_ROT;
  if (!room) return <Sign lines={['Verbinde …']} position={CENTER_POS} rotation={CENTER_ROT} width={0.5} height={0.08} />;
  const host = room.hostId === you;
  const lines: string[] = [];
  const buttons: { label: string; press: () => void; active?: boolean }[] = [];

  if (room.phase === 'lobby' || !game) {
    lines.push(`Raum ${room.code} · ${gameName(room.lobby.gameId)}`);
    room.lobby.seats.forEach((seat, i) => {
      const member = seat.kind === 'human' ? room.members.find((m) => m.id === seat.memberId) : null;
      lines.push(`Platz ${i + 1}: ${seat.kind === 'bot' ? '🤖 Bot' : member ? `${member.avatar} ${member.name}${member.id === you ? ' (du)' : ''}` : 'frei'}`);
    });
    const mine = room.lobby.seats.findIndex((s) => s.kind === 'human' && s.memberId === you);
    const free = room.lobby.seats.findIndex((s) => s.kind === 'human' && !s.memberId);
    if (mine < 0 && free >= 0) buttons.push({ label: `Auf Platz ${free + 1} setzen`, press: () => send({ type: 'takeSeat', index: free }) });
    if (host && room.lobby.gameId) buttons.push({ label: 'Partie beginnen', press: () => send({ type: 'start' }), active: true });
    if (!host) lines.push('Die Raumleitung beginnt die Partie.');
  } else {
    const me = game.yourSeat;
    if (game.result) {
      const r = game.result;
      lines.push(r.kind === 'win' ? (r.winners.includes(me ?? -1) ? 'Gewonnen! 🎉' : `Es gewinnt ${r.winners.map((w) => game.seats[w]?.name ?? `Platz ${w + 1}`).join(' und ')}`) : r.kind === 'draw' ? 'Unentschieden' : 'Niemand gewinnt');
      buttons.push({ label: 'Nochmal', press: () => send({ type: 'afterVote', choice: 'again' }), active: true });
      if (host) buttons.push({ label: 'Zur Lobby', press: () => send({ type: 'toLobby' }) });
    } else {
      lines.push(`${gameName(game.gameId)} · ${game.current.includes(me ?? -1) ? 'Du bist am Zug' : `Am Zug: ${game.current.map((s) => game.seats[s]?.name ?? s + 1).join(', ')}`}`);
      const listed = game.legalMoves.map((_, i) => i).filter((i) => !boardMoves.has(i));
      if (listed.length === 0 && isBoardGame(game.gameId) && game.legalMoves.length > 0) lines.push('Zeig auf ein leuchtendes Ziel auf dem Brett.');
      const pages = Math.max(1, Math.ceil(listed.length / PAGE));
      const current = Math.min(page, pages - 1);
      for (const i of listed.slice(current * PAGE, current * PAGE + PAGE)) {
        buttons.push({ label: game.moveLabels?.[i] ?? JSON.stringify(game.legalMoves[i]).slice(0, 40), press: () => onMove(i) });
      }
      if (pages > 1) {
        buttons.push({ label: `◀ Seite ${current + 1}/${pages}`, press: () => setPage((current - 1 + pages) % pages) });
        buttons.push({ label: 'Weiter ▶', press: () => setPage((current + 1) % pages) });
      }
    }
  }

  const width = 0.62;
  const lineH = 0.045;
  const height = lines.length * lineH + 0.04;
  return (
    <group position={PANEL_POS} rotation={PANEL_ROT}>
      <Sign lines={lines} position={[0, 0, 0]} width={width} height={height} background={WOOD_DARK} />
      {buttons.map((b, i) => (
        <Button3D key={`${b.label}-${i}`} label={b.label} position={[0, -height / 2 - 0.035 - i * 0.052, 0]} width={width - 0.04} height={0.045} onPress={b.press} active={b.active} />
      ))}
    </group>
  );
}

/** Emoji-Reaktionen an der eigenen Tischkante. */
export function ReactionBar({ send }: { send: (m: ClientMessage) => void }) {
  const choices = REACTIONS.slice(0, 6);
  return (
    <group position={[TABLE_CENTER[0], TABLE_CENTER[1] + 0.05, TABLE_CENTER[2] + 0.5]} rotation={[-Math.PI / 3, 0, 0]}>
      {choices.map((emoji, i) => (
        <Button3D key={emoji} label={emoji} position={[(i - (choices.length - 1) / 2) * 0.055, 0, 0]} width={0.048} height={0.048} onPress={() => send({ type: 'react', emoji })} />
      ))}
    </group>
  );
}
