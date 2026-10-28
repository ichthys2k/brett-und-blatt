import type { BotLevel, ClockReading, Forfeit, GameEvent, Options, Result, SeatId, TimePresetId } from '@brett-und-blatt/engine';

/**
 * Das Nachrichtenformat zwischen Browser und Server (JSON über WebSocket).
 * Steigt bei Änderungen, die alte Browser nicht mehr verstehen würden.
 */
export const PROTOCOL_VERSION = 1;

/** Größte erlaubte Nachricht vom Browser in Zeichen – schützt den Server vor Datenmüll. */
export const MAX_MESSAGE_LENGTH = 16_000;

/** Höchstens so viele Plätze am Tisch, auch wenn ein Spiel mehr erlaubt (Bingo: bis 30). */
export const MAX_SEATS = 30;

/** Ein Platz in der Lobby: offen für einen Menschen, von einem Mitglied besetzt oder ein Bot. */
export type LobbySeat = { kind: 'human'; memberId: string | null } | { kind: 'bot'; level: BotLevel };

export interface LobbySettings {
  gameId: string | null;
  options: Options;
  time: TimePresetId;
  seats: LobbySeat[];
  isPublic: boolean;
}

/** Kompakte Übersicht für offene Spiele auf dem Startbildschirm. */
export interface OpenRoomListing {
  code: string;
  gameId: string;
  gameName: string;
  gameEmoji: string;
  hostName: string;
  hostAvatar: string;
  totalSeats: number;
  filledSeats: number;
  createdAt: number;
  updatedAt: number;
}

/** Ein Mitglied des Raums, wie es alle sehen. Die geheime Kennung steht nie darin. */
export interface MemberInfo {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
}

export type RoomPhase = 'lobby' | 'playing' | 'finished';

/** Ein Platz der laufenden Partie, wie ihn alle sehen. */
export interface PublicSeat {
  kind: 'human' | 'bot';
  name: string;
  level?: BotLevel;
  memberId: string | null;
}

/** Vorgefertigte Schnellnachrichten – freien Text gibt es nicht. */
export const PHRASES = ['hello', 'goodGame', 'wellPlayed', 'oops', 'thanks', 'oneMoment', 'again'] as const;
export type Phrase = (typeof PHRASES)[number];

/** Erlaubte Emoji-Reaktionen. */
export const REACTIONS = ['👍', '👏', '😂', '😮', '🤔', '😏', '🤨', '😱', '🎉', '❤️'] as const;
export type Reaction = (typeof REACTIONS)[number];

/** Erlaubte Avatare (Emoji) – 200 sorgfältig kuratierte Emojis in 9 thematischen Kategorien. */
export const AVATARS = [
  // 🐾 Säugetiere & Landtiere (38)
  '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐵', '🐶', '🐱', '🐭', '🐹', '🐰', '🐺', '🐗', '🐴', '🦓', '🦌', '🐮',
  '🐷', '🐑', '🐐', '🐪', '🦒', '🐘', '🦏', '🦛', '🦘', '🦥', '🦦', '🦨', '🦡', '🦔', '🦇', '🐿️', '🦫', '🦙',
  '🐆', '🦬',

  // 🦅 Vögel & Gefieder (14)
  '🦉', '🐧', '🦅', '🦆', '🦢', '🦜', '🦩', '🦚', '🦃', '🐓', '🐣', '🐦', '🕊️', '🦤',

  // 🐙 Meeres- & Amphibientiere (17)
  '🐙', '🐬', '🐢', '🐸', '🐳', '🐋', '🦈', '🦭', '🐊', '🐠', '🐟', '🐡', '🦞', '🦀', '🦐', '🦑', '🪼',

  // 🐝 Insekten & Krabbeltiere (10)
  '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦗', '🕷️', '🦂', '🪲',

  // 🧙 Fantasie, Magie & Urzeit (21)
  '🦄', '🦖', '🦕', '🐉', '🐲', '👾', '🤖', '👻', '👽', '🧟', '🧛', '🧙', '🧝', '🧞', '🧚', '🧜', '🦸', '🦹', '🥷', '🗿', '🔮',

  // 😎 Gesichter, Rollen & Charaktere (21)
  '😎', '🤠', '🥳', '🧐', '🤔', '🤓', '🤩', '😇', '🤡', '👑', '🧢', '🎩', '🕵️', '🧑‍🚀', '🧑‍🌾', '🧑‍🍳', '🧑‍🎨', '🧑‍🔬', '🧑‍🎤', '🧑‍🚒', '🤹',

  // 🍕 Essen & Leckereien (27)
  '🍎', '🍓', '🍒', '🥑', '🍌', '🍉', '🍇', '🍍', '🍑', '🍋', '🥕', '🌽', '🍄', '🧀', '🥐', '🍕', '🍔', '🌮', '🍣', '🍦', '🍩', '🍪', '🧁', '🥨', '🍿', '🥞', '🍫',

  // 🎲 Spiele, Sport & Musik (27)
  '🎲', '🎯', '🎮', '🕹️', '♟️', '🎳', '🏆', '🪁', '⚽', '🏀', '🎾', '🏐', '🏈', '🏓', '🏸', '🥊', '🛹', '🛼', '🎿', '🧗', '🏄', '🚴', '🎨', '🎸', '🥁', '🎷', '🎺',

  // 🚀 Abenteuer, Natur & Kosmos (25)
  '⭐', '🌟', '🌙', '☀️', '🌈', '⚡', '❄️', '🔥', '🌊', '🪐', '🚀', '🛸', '⛵', '⚓', '🏕️', '🏝️', '🌲', '🌵', '🌻', '🍀', '🍁', '💎', '🧭', '🎈', '🪄',
] as const;

export type Avatar = (typeof AVATARS)[number];

export type AvatarCategoryId =
  | 'mammals'
  | 'birds'
  | 'sea'
  | 'bugs'
  | 'fantasy'
  | 'faces'
  | 'food'
  | 'games'
  | 'nature';

export interface AvatarCategory {
  id: AvatarCategoryId;
  icon: string;
  emojis: readonly Avatar[];
}

export const AVATAR_CATEGORIES: readonly AvatarCategory[] = [
  {
    id: 'mammals',
    icon: '🐾',
    emojis: [
      '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐵', '🐶', '🐱', '🐭', '🐹', '🐰', '🐺', '🐗', '🐴', '🦓', '🦌', '🐮',
      '🐷', '🐑', '🐐', '🐪', '🦒', '🐘', '🦏', '🦛', '🦘', '🦥', '🦦', '🦨', '🦡', '🦔', '🦇', '🐿️', '🦫', '🦙',
      '🐆', '🦬',
    ],
  },
  {
    id: 'birds',
    icon: '🦅',
    emojis: ['🦉', '🐧', '🦅', '🦆', '🦢', '🦜', '🦩', '🦚', '🦃', '🐓', '🐣', '🐦', '🕊️', '🦤'],
  },
  {
    id: 'sea',
    icon: '🐙',
    emojis: ['🐙', '🐬', '🐢', '🐸', '🐳', '🐋', '🦈', '🦭', '🐊', '🐠', '🐟', '🐡', '🦞', '🦀', '🦐', '🦑', '🪼'],
  },
  {
    id: 'bugs',
    icon: '🐝',
    emojis: ['🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦗', '🕷️', '🦂', '🪲'],
  },
  {
    id: 'fantasy',
    icon: '🧙',
    emojis: ['🦄', '🦖', '🦕', '🐉', '🐲', '👾', '🤖', '👻', '👽', '🧟', '🧛', '🧙', '🧝', '🧞', '🧚', '🧜', '🦸', '🦹', '🥷', '🗿', '🔮'],
  },
  {
    id: 'faces',
    icon: '😎',
    emojis: ['😎', '🤠', '🥳', '🧐', '🤔', '🤓', '🤩', '😇', '🤡', '👑', '🧢', '🎩', '🕵️', '🧑‍🚀', '🧑‍🌾', '🧑‍🍳', '🧑‍🎨', '🧑‍🔬', '🧑‍🎤', '🧑‍🚒', '🤹'],
  },
  {
    id: 'food',
    icon: '🍕',
    emojis: ['🍎', '🍓', '🍒', '🥑', '🍌', '🍉', '🍇', '🍍', '🍑', '🍋', '🥕', '🌽', '🍄', '🧀', '🥐', '🍕', '🍔', '🌮', '🍣', '🍦', '🍩', '🍪', '🧁', '🥨', '🍿', '🥞', '🍫'],
  },
  {
    id: 'games',
    icon: '🎲',
    emojis: ['🎲', '🎯', '🎮', '🕹️', '♟️', '🎳', '🏆', '🪁', '⚽', '🏀', '🎾', '🏐', '🏈', '🏓', '🏸', '🥊', '🛹', '🛼', '🎿', '🧗', '🏄', '🚴', '🎨', '🎸', '🥁', '🎷', '🎺'],
  },
  {
    id: 'nature',
    icon: '🚀',
    emojis: ['⭐', '🌟', '🌙', '☀️', '🌈', '⚡', '❄️', '🔥', '🌊', '🪐', '🚀', '🛸', '⛵', '⚓', '🏕️', '🏝️', '🌲', '🌵', '🌻', '🍀', '🍁', '💎', '🧭', '🎈', '🪄'],
  },
];

// ---------------------------------------------------------------------------
// Browser → Server

export type ClientMessage =
  /** Erste Nachricht jeder Verbindung. `token` ist die geheime, zufällige Kennung des Geräts für den Wiedereinstieg. */
  | { type: 'hello'; protocol: number; token: string; name: string; avatar: string }
  | { type: 'setName'; name: string; avatar: string }
  // Lobby (nur die Raumleitung, außer takeSeat/leaveSeat)
  | { type: 'setGame'; gameId: string }
  | { type: 'setOption'; id: string; value: string }
  | { type: 'setTime'; time: TimePresetId }
  | { type: 'setSeatCount'; count: number }
  | { type: 'setSeat'; index: number; seat: 'open' | { bot: BotLevel } }
  | { type: 'setPublic'; isPublic: boolean }
  | { type: 'takeSeat'; index: number }
  | { type: 'leaveSeat' }
  | { type: 'fillSeats' }
  | { type: 'kick'; memberId: string }
  | { type: 'start'; rotate?: boolean }
  /** Nach dem Ende: zurück in die Lobby (nur die Raumleitung). */
  | { type: 'toLobby' }
  // Partie
  | { type: 'move'; version: number; move: unknown }
  | { type: 'resign' }
  | { type: 'returnSeat' }
  // Flüchtige Signale
  | { type: 'react'; emoji: string }
  | { type: 'say'; phrase: string }
  | { type: 'leave' }
  | { type: 'ping' };

// ---------------------------------------------------------------------------
// Server → Browser

export interface RoomMessage {
  type: 'room';
  code: string;
  phase: RoomPhase;
  hostId: string | null;
  members: MemberInfo[];
  lobby: LobbySettings;
}

export interface GameMessage {
  type: 'game';
  gameId: string;
  /** Laufende Nummer der Partie im Raum – eine Revanche ist eine neue Partie. */
  round: number;
  /** Zählt jede Änderung; Züge nennen die Version, die der Browser gesehen hat. */
  version: number;
  seats: PublicSeat[];
  options: Options;
  time: TimePresetId;
  /** Der eigene Platz – null für Zuschauer. */
  yourSeat: SeatId | null;
  view: unknown;
  /** Nur die Züge, die der eigene Platz gerade machen darf. */
  legalMoves: unknown[];
  /** Darf der eigene Platz aufgeben? (Nicht mehr, wenn er schon ausgeschieden ist.) */
  canResign: boolean;
  current: SeatId[];
  away: SeatId[];
  thinking: SeatId[];
  result: Result | null;
  forfeit: Forfeit | null;
  /** Uhrenstände zum Zeitpunkt `serverNow`; der Browser zählt selbst weiter. */
  clocks: ClockReading[];
  serverNow: number;
  /** Was seit der letzten Nachricht passiert ist – schon für diesen Platz gefiltert. */
  events: GameEvent[];
}

export type ServerMessage =
  | { type: 'welcome'; protocol: number; you: string; serverNow: number }
  | RoomMessage
  | GameMessage
  | { type: 'signal'; from: string; kind: 'react' | 'say'; value: string }
  | { type: 'error'; code: ErrorCode; message: string }
  | { type: 'kicked' }
  | { type: 'pong'; serverNow: number };

export type ErrorCode = 'badMessage' | 'protocol' | 'notAllowed' | 'roomFull' | 'badName' | 'notReady' | 'staleMove' | 'illegalMove' | 'tooLate';

// ---------------------------------------------------------------------------
// Prüfen eingehender Nachrichten: Alles vom Browser ist erst einmal unbekannt.

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;
const isInt = (v: unknown, min = 0, max = 1_000_000): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isLevel = (v: unknown): v is BotLevel => v === 'easy' || v === 'medium' || v === 'hard';
const isTime = (v: unknown): v is TimePresetId => v === 'relaxed' || v === 'normal' || v === 'fast';

/** Liest eine Nachricht vom Browser. Ungültiges ergibt null. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_LENGTH) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data.type !== 'string') return null;
  const m = data;
  switch (m.type) {
    case 'hello':
      return isInt(m.protocol) && isString(m.token, 100) && m.token.length >= 16 && isString(m.name) && isString(m.avatar, 20)
        ? { type: 'hello', protocol: m.protocol, token: m.token, name: m.name, avatar: m.avatar }
        : null;
    case 'setName':
      return isString(m.name) && isString(m.avatar, 20) ? { type: 'setName', name: m.name, avatar: m.avatar } : null;
    case 'setGame':
      return isString(m.gameId, 60) ? { type: 'setGame', gameId: m.gameId } : null;
    case 'setOption':
      return isString(m.id, 60) && isString(m.value, 60) ? { type: 'setOption', id: m.id, value: m.value } : null;
    case 'setTime':
      return isTime(m.time) ? { type: 'setTime', time: m.time } : null;
    case 'setSeatCount':
      return isInt(m.count, 1, MAX_SEATS) ? { type: 'setSeatCount', count: m.count } : null;
    case 'setSeat': {
      if (!isInt(m.index, 0, MAX_SEATS - 1)) return null;
      if (m.seat === 'open') return { type: 'setSeat', index: m.index, seat: 'open' };
      return isRecord(m.seat) && isLevel(m.seat.bot) ? { type: 'setSeat', index: m.index, seat: { bot: m.seat.bot } } : null;
    }
    case 'setPublic':
      return typeof m.isPublic === 'boolean' ? { type: 'setPublic', isPublic: m.isPublic } : null;
    case 'takeSeat':
      return isInt(m.index, 0, MAX_SEATS - 1) ? { type: 'takeSeat', index: m.index } : null;
    case 'kick':
      return isString(m.memberId, 20) ? { type: 'kick', memberId: m.memberId } : null;
    case 'move':
      return isInt(m.version) && 'move' in m ? { type: 'move', version: m.version, move: m.move } : null;
    case 'react':
      return isString(m.emoji, 20) ? { type: 'react', emoji: m.emoji } : null;
    case 'say':
      return isString(m.phrase, 40) ? { type: 'say', phrase: m.phrase } : null;
    case 'start':
      return { type: 'start', ...(typeof m.rotate === 'boolean' ? { rotate: m.rotate } : {}) };
    case 'leaveSeat':
    case 'fillSeats':
    case 'toLobby':
    case 'resign':
    case 'returnSeat':
    case 'leave':
    case 'ping':
      return { type: m.type };
    default:
      return null;
  }
}
