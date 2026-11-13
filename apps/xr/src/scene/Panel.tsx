/**
 * Das 2D-Fenster über dem Tisch (#339, #349). Alles, was man ohne Absetzen der Brille braucht:
 * - Lobby: Spiel wählen, Platzzahl, Bots, Platz nehmen, Partie beginnen (Raumleitung);
 * - Partie: Züge, die kein 3D-Brett anbietet, als Liste mit Zugtexten, dazu Aufgeben, Remis,
 *   Zurücknehmen und Schnellnachrichten;
 * - Ende: Nochmal oder zurück in die Lobby;
 * - immer: Tisch höher/tiefer, näher/weiter.
 */
import { PHRASES, REACTIONS, type ClientMessage, type GameMessage, type LobbySeat, type RoomMessage } from '@brett-und-blatt/online';
import { useEffect, useState } from 'react';
import { GAME_CHOICES, LEVEL_TEXT, PHRASE_TEXT, gameName, isBoardGame } from '../catalog';
import { TABLE_CENTER } from './Tavern';
import { WOOD_DARK } from './text';
import { Button3D, Sign } from './ui3d';
import { isCardGame } from './cards';
import { getVolume, onVolumeChange, setVolume } from '../sound';

const PAGE = 6;
// Neben einem 3D-Brett schräg links hinter dem Tisch, dem eigenen Platz zugewandt; ohne Brett
// (Lobby und Spiele ohne 3D-Figuren) mittig über dem Tisch.
const SIDE_POS: [number, number, number] = [TABLE_CENTER[0] - 0.68, 1.22, TABLE_CENTER[2] - 0.62];
const SIDE_ROT: [number, number, number] = [0, Math.atan2(0.68, 0.62 - TABLE_CENTER[2]), 0];
const CENTER_POS: [number, number, number] = [TABLE_CENTER[0], 1.25, TABLE_CENTER[2] - 0.3];
const CENTER_ROT: [number, number, number] = [0, 0, 0];
const WIDTH = 0.62;
const ROW = 0.05;

type BotLevel = Extract<LobbySeat, { kind: 'bot' }>['level'];

/** Bot-Stufen in der Reihenfolge, in der ein Platz beim Antippen durchgeschaltet wird. */
const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];
/** Spiele, bei denen man Remis anbieten kann (Angebot steht nicht in legalMoves). */
const DRAW_GAMES = new Set(['chess', 'checkers']);

/** Sprachchat (#352) für das 2D-Fenster. */
export interface VoiceControls {
  joined: boolean;
  muted: boolean;
  off: 'public' | 'reported' | null;
  error: string | null;
  join: () => void;
  leave: () => void;
  mute: (muted: boolean) => void;
  report: () => void;
}

export interface ViewAdjust {
  up: () => void;
  down: () => void;
  closer: () => void;
  farther: () => void;
}

interface PanelProps {
  room: RoomMessage | null;
  game: GameMessage | null;
  you: string | null;
  send: (m: ClientMessage) => void;
  /** Indizes der Züge, die das 3D-Brett schon anbietet. */
  boardMoves: Set<number>;
  onMove: (index: number) => void;
  adjust: ViewAdjust;
  voice: VoiceControls;
}

interface Btn {
  label: string;
  press: () => void;
  active?: boolean;
  disabled?: boolean;
}

type Mode = 'main' | 'phrases' | 'view' | 'voice';

export function Panel({ room, game, you, send, boardMoves, onMove, adjust, voice }: PanelProps) {
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<Mode>('main');
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmReport, setConfirmReport] = useState(false);
  const [, redraw] = useState(0);
  useEffect(() => onVolumeChange(() => redraw((n) => n + 1)), []);
  const beside = Boolean(game && !game.result && isBoardGame(game.gameId));
  const position = beside ? SIDE_POS : CENTER_POS;
  const rotation = beside ? SIDE_ROT : CENTER_ROT;
  if (!room) return <Sign lines={['Verbinde …']} position={CENTER_POS} rotation={CENTER_ROT} width={0.5} height={0.08} />;

  const host = room.hostId === you;
  const lines: string[] = [];
  const rows: Btn[][] = [];
  const back: Btn = { label: '◀ Zurück', press: () => setMode('main') };

  if (mode === 'phrases') {
    lines.push('Schnellnachricht an den Tisch');
    for (let i = 0; i < PHRASES.length; i += 2) {
      rows.push(PHRASES.slice(i, i + 2).map((p) => ({ label: PHRASE_TEXT[p] ?? p, press: () => (send({ type: 'say', phrase: p }), setMode('main')) })));
    }
    rows.push([back]);
  } else if (mode === 'voice') {
    lines.push('Sprachchat');
    if (voice.off) lines.push(voice.off === 'public' ? 'Nur in privaten Räumen.' : 'Für diese Runde abgeschaltet.');
    else if (!voice.joined) {
      if (voice.error) lines.push(voice.error);
      rows.push([{ label: '🎙 Mitsprechen', press: voice.join, active: true }]);
    } else {
      rows.push([
        { label: voice.muted ? '🎙 Mikro an' : '🔇 Stumm', press: () => voice.mute(!voice.muted), active: voice.muted },
        { label: 'Aussteigen', press: voice.leave },
      ]);
      rows.push([
        confirmReport
          ? { label: 'Wirklich für alle abschalten?', press: () => (voice.report(), setConfirmReport(false)), active: true }
          : { label: '⚠ Melden', press: () => setConfirmReport(true) },
      ]);
    }
    rows.push([back]);
  } else if (mode === 'view') {
    lines.push('Tisch einstellen');
    rows.push([
      { label: 'Tisch höher ▲', press: adjust.up },
      { label: 'Tisch tiefer ▼', press: adjust.down },
    ]);
    rows.push([
      { label: 'Tisch näher', press: adjust.closer },
      { label: 'Tisch weiter weg', press: adjust.farther },
    ]);
    const volume = getVolume();
    rows.push([
      { label: '🔈 leiser', press: () => setVolume(volume - 0.1) },
      { label: volume > 0 ? `Ton ${Math.round(volume * 100)} %` : 'Ton aus', press: () => setVolume(volume > 0 ? 0 : 0.7), active: volume > 0 },
      { label: '🔊 lauter', press: () => setVolume(volume + 0.1) },
    ]);
    lines.push('Neu ausrichten: Meta-Taste gedrückt halten.');
    rows.push([back]);
  } else if (room.phase === 'lobby' || !game) {
    const lobby = room.lobby;
    lines.push(`Raum ${room.code}`);
    if (host) {
      const index = Math.max(0, GAME_CHOICES.findIndex((g) => g.id === lobby.gameId));
      const step = (d: number) => send({ type: 'setGame', gameId: GAME_CHOICES[(index + d + GAME_CHOICES.length) % GAME_CHOICES.length]!.id });
      rows.push([
        { label: '◀', press: () => step(-1) },
        { label: lobby.gameId ? gameName(lobby.gameId) : 'Spiel wählen', press: () => step(lobby.gameId ? 1 : 0), active: true },
        { label: '▶', press: () => step(1) },
      ]);
      rows.push([
        { label: '− Platz', press: () => send({ type: 'setSeatCount', count: lobby.seats.length - 1 }) },
        { label: `${lobby.seats.length} Plätze`, press: () => {}, disabled: true },
        { label: '+ Platz', press: () => send({ type: 'setSeatCount', count: lobby.seats.length + 1 }) },
      ]);
    } else lines.push(`Spiel: ${gameName(lobby.gameId)}`);
    const mine = lobby.seats.findIndex((s) => s.kind === 'human' && s.memberId === you);
    lobby.seats.forEach((seat, i) => {
      const member = seat.kind === 'human' ? room.members.find((m) => m.id === seat.memberId) : undefined;
      const text = seat.kind === 'bot' ? `🤖 Bot ${LEVEL_TEXT[seat.level]}` : member ? `${member.avatar} ${member.name}${member.id === you ? ' (du)' : ''}` : 'frei';
      const row: Btn[] = [{ label: `${i + 1}: ${text}`, press: () => {}, disabled: true }];
      if (seat.kind === 'human' && !seat.memberId && mine < 0) row.push({ label: 'Hinsetzen', press: () => send({ type: 'takeSeat', index: i }), active: true });
      if (host && (seat.kind === 'bot' || !seat.memberId)) {
        // Frei → leicht → mittel → schwer → frei
        const next = seat.kind === 'bot' ? LEVELS[LEVELS.indexOf(seat.level) + 1] : 'easy';
        row.push({ label: seat.kind === 'bot' ? (next ? `Bot ${LEVEL_TEXT[next]}` : 'Freigeben') : 'Bot', press: () => send({ type: 'setSeat', index: i, seat: next ? { bot: next } : 'open' }) });
      }
      if (seat.kind === 'human' && seat.memberId === you) row.push({ label: 'Aufstehen', press: () => send({ type: 'leaveSeat' }) });
      rows.push(row);
    });
    if (host) rows.push([{ label: 'Partie beginnen', press: () => send({ type: 'start' }), active: true, disabled: !lobby.gameId }]);
    else lines.push('Die Raumleitung beginnt die Partie.');
    rows.push([
      { label: '💬 Nachricht', press: () => setMode('phrases') },
      { label: voice.joined ? (voice.muted ? '🔇 Sprache' : '🎙 Sprache') : '🎙 Sprache', press: () => setMode('voice'), active: voice.joined && !voice.muted },
      { label: '↕ Tisch', press: () => setMode('view') },
    ]);
  } else if (game.result) {
    const r = game.result;
    const me = game.yourSeat ?? -1;
    lines.push(r.kind === 'win' ? (r.winners.includes(me) ? 'Gewonnen! 🎉' : `Es gewinnt ${r.winners.map((w) => game.seats[w]?.name ?? `Platz ${w + 1}`).join(' und ')}`) : r.kind === 'draw' ? 'Unentschieden' : 'Niemand gewinnt');
    rows.push([{ label: 'Nochmal', press: () => send({ type: 'afterVote', choice: 'again' }), active: true }, ...(host ? [{ label: 'Zur Lobby', press: () => send({ type: 'toLobby' }) }] : [])]);
    rows.push([
      { label: '💬 Nachricht', press: () => setMode('phrases') },
      { label: voice.joined ? (voice.muted ? '🔇 Sprache' : '🎙 Sprache') : '🎙 Sprache', press: () => setMode('voice'), active: voice.joined && !voice.muted },
      { label: '↕ Tisch', press: () => setMode('view') },
    ]);
  } else {
    const me = game.yourSeat;
    const myTurn = me !== null && game.current.includes(me);
    lines.push(`${gameName(game.gameId)} · ${myTurn ? 'Du bist am Zug' : `Am Zug: ${game.current.map((s) => game.seats[s]?.name ?? s + 1).join(', ')}`}`);
    // Bitte ums Zurücknehmen: abstimmen, wenn man gefragt ist.
    const tb = game.takeBack;
    if (tb?.status === 'pending' && me !== null) {
      if (tb.waiting.includes(me)) {
        lines.push(`${game.seats[tb.seat]?.name ?? 'Jemand'} möchte zurücknehmen.`);
        rows.push([
          { label: 'Erlauben', press: () => send({ type: 'answerTakeBack', accept: true }), active: true },
          { label: 'Ablehnen', press: () => send({ type: 'answerTakeBack', accept: false }) },
        ]);
      } else if (tb.seat === me) lines.push('Warte auf die Zustimmung der anderen …');
    }
    const listed = game.legalMoves.map((_, i) => i).filter((i) => !boardMoves.has(i));
    if (listed.length === 0 && isBoardGame(game.gameId) && myTurn) lines.push('Zeig auf ein leuchtendes Ziel auf dem Brett.');
    if (isCardGame(game.gameId) && myTurn && listed.length < game.legalMoves.length) lines.push('Leuchtende Karten und Stapel kannst du antippen.');
    const pages = Math.max(1, Math.ceil(listed.length / PAGE));
    const current = Math.min(page, pages - 1);
    for (const i of listed.slice(current * PAGE, current * PAGE + PAGE)) {
      rows.push([{ label: game.moveLabels?.[i] ?? JSON.stringify(game.legalMoves[i]).slice(0, 40), press: () => onMove(i) }]);
    }
    if (pages > 1) {
      rows.push([
        { label: `◀ Seite ${current + 1}/${pages}`, press: () => setPage((current - 1 + pages) % pages) },
        { label: 'Weiter ▶', press: () => setPage((current + 1) % pages) },
      ]);
    }
    const controls: Btn[] = [];
    if (game.canResign) {
      controls.push(confirmResign ? { label: 'Wirklich aufgeben?', press: () => (send({ type: 'resign' }), setConfirmResign(false)), active: true } : { label: 'Aufgeben', press: () => setConfirmResign(true) });
    }
    if (DRAW_GAMES.has(game.gameId) && myTurn) controls.push({ label: 'Remis anbieten', press: () => send({ type: 'move', version: game.version, move: { type: 'offerDraw' } }) });
    if (game.canTakeBack) controls.push({ label: 'Zurücknehmen?', press: () => send({ type: 'takeBack' }) });
    if (controls.length) rows.push(controls);
    rows.push([
      { label: '💬 Nachricht', press: () => setMode('phrases') },
      { label: voice.joined ? (voice.muted ? '🔇 Sprache' : '🎙 Sprache') : '🎙 Sprache', press: () => setMode('voice'), active: voice.joined && !voice.muted },
      { label: '↕ Tisch', press: () => setMode('view') },
    ]);
  }

  const lineH = 0.045;
  const height = lines.length * lineH + 0.04;
  return (
    <group position={position} rotation={rotation}>
      <Sign lines={lines} position={[0, 0, 0]} width={WIDTH} height={height} background={WOOD_DARK} />
      {rows.map((row, r) => {
        const gap = 0.01;
        const w = (WIDTH - 0.04 - gap * (row.length - 1)) / row.length;
        return row.map((b, k) => (
          <Button3D
            key={`${r}-${k}-${b.label}`}
            label={b.label}
            position={[-(WIDTH - 0.04) / 2 + w / 2 + k * (w + gap), -height / 2 - 0.035 - r * ROW, 0]}
            width={w}
            height={0.042}
            onPress={b.press}
            active={b.active}
            disabled={b.disabled}
          />
        ));
      })}
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
