import { parsePushSubscription, type ParsePushOptions, type PushSubscriptionData } from './push';
import type { BotLevel, ClockReading, CustomCardCatalog, Forfeit, GameEvent, Options, ReplayData, Result, SeatId, TimePresetId } from '@brett-und-blatt/engine';

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
export type LobbySeat = ({ kind: 'human'; memberId: string | null } | { kind: 'bot'; level: BotLevel }) & {
  /** Nur bei Teamspielen (`GameInfo.teams`): Team dieses Platzes, 0, 1, … */
  team?: number;
};

export interface LobbySettings {
  gameId: string | null;
  options: Options;
  time: TimePresetId;
  seats: LobbySeat[];
  isPublic: boolean;
  /** Nur die Raumleitung darf Namen und Bilder ändern (fehlt in älteren Räumen: aus). */
  namesLocked?: boolean;
  /** Dürfen Spieler online einen Zug zurücknehmen, wenn alle zustimmen (`GameInfo.takeBack`)? Fehlt: an. */
  takeBack?: boolean;
  /**
   * Dürfen Zuschauer anfragen, ab der nächsten Runde mitzuspielen (#299)? Die Raumleitung entscheidet.
   * Fehlt: an in öffentlichen, aus in privaten Räumen.
   */
  acceptRequests?: boolean;
}

/** Wie lange eine abgelehnte Anfrage gesperrt bleibt, bevor dieselbe Person wieder fragen darf. */
export const JOIN_DENIED_MS = 2 * 60 * 1000;
/** Höchstens so viele Anfragen und Vorgemerkte zugleich (Anfragende plus Warteliste). */
export const MAX_JOIN_QUEUE = 30;

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
  /** Ausschreibung eines Turniers (Einschreibung läuft): `code` ist der Turniercode, `gameName` der Turniername. */
  tournament?: boolean;
  /** Die Partie läuft schon: Zuschauer können anfragen, ob sie ab der nächsten Runde mitspielen dürfen (#299). */
  running?: boolean;
  /** Prüfsumme eines aktiven Anki-Kartensets (falls Raum benutzerdefinierte Karten nutzt) */
  cardCatalogChecksum?: string;
}

/** Ein Mitglied des Raums, wie es alle sehen. Die geheime Kennung steht nie darin. */
export interface MemberInfo {
  id: string;
  name: string;
  avatar: string;
  /** Wappen des Spielerpasses (Beschreibung, siehe `player-crest.ts` in der Engine); nur wenn die Person es zeigen will. */
  crest?: string;
  connected: boolean;
  /** Name und Bild hat die Raumleitung festgelegt – das Mitglied kann sie nicht mehr ändern. */
  nameFixed?: boolean;
  /** Anfrage ums Mitspielen ab der nächsten Runde (#299): `asking` wartet auf die Raumleitung, `queued` ist angenommen. */
  join?: 'asking' | 'queued';
}

export type RoomPhase = 'lobby' | 'playing' | 'finished';

/** Ein Platz der laufenden Partie, wie ihn alle sehen. */
export interface PublicSeat {
  kind: 'human' | 'bot';
  name: string;
  avatar?: string;
  level?: BotLevel;
  memberId: string | null;
}

/** Vorgefertigte Schnellnachrichten – freien Text gibt es nicht. */
export const PHRASES = ['hello', 'goodGame', 'wellPlayed', 'oops', 'thanks', 'oneMoment', 'again', 'wow', 'grr'] as const;
export type Phrase = (typeof PHRASES)[number];

/** Erlaubte Emoji-Reaktionen. */
export const REACTIONS = ['👍', '👏', '😂', '😮', '🤔', '😏', '🤨', '😱', '🎉', '❤️'] as const;
export type Reaction = (typeof REACTIONS)[number];

/*
 * Avatare und ihre Klänge stehen in avatars.ts; hier nur der Weg nach außen,
 * damit Importe aus dem Online-Paket unverändert bleiben.
 */
export { AVATARS, AVATAR_SOUNDS } from './avatars';
export type { Avatar, AvatarSound } from './avatars';

// ---------------------------------------------------------------------------
// Browser → Server

export type ClientMessage =
  /** Erste Nachricht jeder Verbindung. `token` ist die geheime, zufällige Kennung des Geräts für den Wiedereinstieg. */
  | { type: 'hello'; protocol: number; token: string; name: string; avatar: string; crest?: string }
  /**
   * Erste Nachricht eines Tisch-Bildschirms (Fernseher, Beamer, Tablet auf dem Tisch, #100): Er ist kein Mitglied,
   * hat keinen Platz und keinen Namen, bekommt nur die Zuschauersicht und darf nichts außer Lebenszeichen senden.
   */
  | { type: 'display'; protocol: number }
  | { type: 'setName'; name: string; avatar: string; crest?: string }
  // Lobby (nur die Raumleitung, außer takeSeat/leaveSeat)
  | { type: 'setGame'; gameId: string }
  | { type: 'setOption'; id: string; value: string }
  | { type: 'setCustomCardCatalog'; catalog: CustomCardCatalog | null }
  | { type: 'setTime'; time: TimePresetId }
  | { type: 'setSeatCount'; count: number }
  | { type: 'setSeat'; index: number; seat: 'open' | { bot: BotLevel } }
  | { type: 'setPublic'; isPublic: boolean }
  | { type: 'takeSeat'; index: number }
  | { type: 'leaveSeat' }
  | { type: 'fillSeats' }
  /** Teamspiele: Team eines Platzes wechseln (Raumleitung jeden, Mitglieder den eigenen). */
  | { type: 'setTeam'; index: number; team: number }
  /** Teamspiele (Raumleitung): besetzte Plätze zufällig und gleichmäßig auf die Teams verteilen. */
  | { type: 'shuffleTeams' }
  | { type: 'kick'; memberId: string }
  /** Raumleitung: Mitglied vom Platz nehmen (Lobby und laufende Partie); es bleibt als Zuschauer im Raum. */
  | { type: 'unseat'; index: number }
  /** Raumleitung: Namen und Bild eines Mitglieds festlegen. */
  | { type: 'renameMember'; memberId: string; name: string; avatar: string }
  /** Raumleitung: Dürfen Mitglieder ihren Namen selbst ändern? */
  | { type: 'setNamesLocked'; locked: boolean }
  /** Raumleitung: Zurücknehmen mit Zustimmung erlauben (Lobby). */
  | { type: 'setTakeBack'; allowed: boolean }
  | { type: 'start'; rotate?: boolean }
  /** Nach dem Ende: zurück in die Lobby (nur die Raumleitung). */
  | { type: 'toLobby' }
  // Partie
  | { type: 'move'; version: number; move: unknown }
  | { type: 'resign' }
  | { type: 'returnSeat' }
  /** Bitte, den eigenen letzten Zug zurückzunehmen; die anderen Menschen stimmen ab. */
  | { type: 'takeBack' }
  | { type: 'answerTakeBack'; accept: boolean }
  // Rundenende (#298): Nochmal oder anderes Spiel; Aussteigen ist `leave`.
  | { type: 'afterVote'; choice: AfterChoice }
  /** Ein Spiel für die Abstimmung vorschlagen (zählt zugleich als Stimme für „anderes Spiel“). */
  | { type: 'afterPropose'; gameId: string }
  /** Für einen Kandidaten stimmen (`random` = zufälliges Spiel); zählt zugleich als Stimme für „anderes Spiel“. */
  | { type: 'afterPick'; gameId: string }
  // Mitspielen ab der nächsten Runde (#299)
  /** Zuschauer: fragt an, ob er ab der nächsten Runde mitspielen darf. */
  | { type: 'askToJoin' }
  | { type: 'cancelAskToJoin' }
  /** Raumleitung: eine Anfrage annehmen oder ablehnen. */
  | { type: 'answerJoin'; memberId: string; ok: boolean }
  /** Raumleitung: alle offenen Anfragen annehmen. */
  | { type: 'acceptAllJoins' }
  /** Raumleitung: Anfragen zulassen oder nicht. */
  | { type: 'setAcceptRequests'; allowed: boolean }
  // Flüchtige Signale
  | { type: 'react'; emoji: string }
  | { type: 'say'; phrase: string }
  | { type: 'leave' }
  /** Hinweise aufs Gerät (Web Push, #242): Abo des Browsers melden oder widerrufen; nur für Fernpartien wirksam. */
  | { type: 'pushSubscribe'; subscription: PushSubscriptionData }
  | { type: 'pushUnsubscribe' }
  | { type: 'ping' };

// ---------------------------------------------------------------------------
// Server → Browser

/** Was die Gruppe nach einer Partie wählen kann (Aussteigen ist kein Votum, sondern `leave`). */
export type AfterChoice = 'again' | 'other';
/** Kandidat „Zufälliges Spiel“ in der Abstimmung. */
export const AFTER_RANDOM = 'random';
/** Höchstens so viele vorgeschlagene Spiele stehen zur Wahl (ohne „Zufällig“). */
export const AFTER_MAX_CANDIDATES = 4;

/**
 * Die Abstimmung am Rundenende (#298) aus Sicht einer Verbindung. Wer was gewählt hat, sehen nur die Zähler;
 * `you` ist die eigene Stimme. Fehlt die Nachricht (`null`), läuft keine Abstimmung.
 */
export interface AfterGameInfo {
  /** Zur Partie (`GameMessage.round`), die gerade zu Ende ist. */
  round: number;
  /** Bis wann abgestimmt werden kann (Serverzeit). */
  deadline: number;
  serverNow: number;
  /** Wie viele Menschen stimmen berechtigt ab und wie viele schon abgestimmt haben. */
  voters: number;
  voted: number;
  again: number;
  other: number;
  /** Vorgeschlagene Spiele mit Stimmen; `random` steht immer am Ende. */
  candidates: { gameId: string; votes: number }[];
  /** Eigene Stimme; fehlt bei Zuschauern und wer noch nichts gewählt hat. */
  you?: { choice?: AfterChoice; pick?: string; proposed?: string };
  /** Darf diese Verbindung abstimmen (Mensch mit Platz in der Partie)? */
  canVote: boolean;
}

export interface RoomMessage {
  type: 'room';
  code: string;
  phase: RoomPhase;
  hostId: string | null;
  members: MemberInfo[];
  lobby: LobbySettings;
  /** Wie viele Tisch-Bildschirme verbunden sind; fehlt, wenn keiner da ist. */
  displays?: number;
  /** Läuft der Raum als Fernpartie? Nur dann bietet die Oberfläche Hinweise aufs Gerät an (#242); fehlt sonst. */
  correspondence?: true;
  /** Nur bei Turnierpartien: zu welchem Turnier der Raum gehört. */
  match?: { tournament: string; label: string; noShow: boolean; series?: { bestOf: number; score: [number, number]; next: number | null; done: boolean } };
}

/**
 * Eine Bitte ums Zurücknehmen, wie sie alle sehen: offen (`pending`) oder ihr Ausgang, bis
 * zum nächsten Zug. Während sie offen ist, ruht die Partie (keine Züge, Uhren stehen).
 */
export interface TakeBackInfo {
  /** Wer zurücknehmen möchte. */
  seat: SeatId;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  /** Wie viele Züge die Rücknahme umfasst (der eigene und alle danach). */
  moves: number;
  /** Wer schon zugestimmt hat und auf wen noch gewartet wird (Menschen ohne die bittende Person). */
  accepted: SeatId[];
  waiting: SeatId[];
  /** Bis wann abgestimmt werden kann (Serverzeit, nur bei `pending`). */
  deadline: number | null;
  /** Wer abgelehnt hat (bei `declined`). */
  by?: SeatId;
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
  /** Darf der eigene Platz gerade bitten, seinen letzten Zug zurückzunehmen? Fehlt bei älteren Servern. */
  canTakeBack?: boolean;
  /** Offene Bitte ums Zurücknehmen oder ihr Ausgang (bis zum nächsten Zug). */
  takeBack?: TakeBackInfo | null;
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
  /**
   * Seed und Zugliste zum Nachspielen (#99) – nur nach Partieende (der Seed verriete sonst alles Verdeckte)
   * und nur bei überschaubarer Länge. Fehlt bei älteren Servern.
   */
  replay?: ReplayData | null;
}

export type ServerMessage =
  | { type: 'welcome'; protocol: number; you: string; serverNow: number }
  | RoomMessage
  | GameMessage
  | { type: 'signal'; from: string; kind: 'react' | 'say'; value: string }
  /** Abstimmung am Rundenende; `null`, wenn keine (mehr) läuft. */
  | { type: 'afterGame'; after: AfterGameInfo | null }
  /** Die Raumleitung hat die Anfrage abgelehnt (nur an die fragende Person). */
  | { type: 'joinDenied' }
  | { type: 'error'; code: ErrorCode; message: string }
  | { type: 'kicked' }
  /** Antwort auf `pushSubscribe`/`pushUnsubscribe` und nach `hello`: gilt für das Gerät des Empfängers, geht nur an ihn. */
  | { type: 'pushState'; enabled: boolean }
  | { type: 'pong'; serverNow: number };

/** Statt einer Mitgliedsnummer im `welcome` eines Tisch-Bildschirms. */
export const DISPLAY_MEMBER = '@display';

export type ErrorCode = 'badMessage' | 'protocol' | 'notAllowed' | 'roomFull' | 'badName' | 'notReady' | 'staleMove' | 'illegalMove' | 'tooLate';

// ---------------------------------------------------------------------------
// Prüfen eingehender Nachrichten: Alles vom Browser ist erst einmal unbekannt.

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;
const isInt = (v: unknown, min = 0, max = 1_000_000): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isLevel = (v: unknown): v is BotLevel => v === 'easy' || v === 'medium' || v === 'hard';
const isTime = (v: unknown): v is TimePresetId => v === 'relaxed' || v === 'normal' || v === 'fast';

/**
 * Liest eine Nachricht vom Browser. Ungültiges ergibt null.
 * `push.allowLocal` erlaubt Loopback-Abos nur im Testserver (siehe `parsePushSubscription`).
 */
export function parseClientMessage(raw: string, push: ParsePushOptions = {}): ClientMessage | null {
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
        ? { type: 'hello', protocol: m.protocol, token: m.token, name: m.name, avatar: m.avatar, ...(typeof m.crest === 'string' && m.crest.length <= 120 ? { crest: m.crest } : {}) }
        : null;
    case 'display':
      return isInt(m.protocol) ? { type: 'display', protocol: m.protocol } : null;
    case 'setName':
      return isString(m.name) && isString(m.avatar, 20) ? { type: 'setName', name: m.name, avatar: m.avatar, ...(typeof m.crest === 'string' && m.crest.length <= 120 ? { crest: m.crest } : {}) } : null;
    case 'setGame':
      return isString(m.gameId, 60) ? { type: 'setGame', gameId: m.gameId } : null;
    case 'setOption':
      return isString(m.id, 60) && isString(m.value, 60) ? { type: 'setOption', id: m.id, value: m.value } : null;
    case 'setCustomCardCatalog':
      if (m.catalog === null) return { type: 'setCustomCardCatalog', catalog: null };
      if (!isRecord(m.catalog) || typeof m.catalog.checksum !== 'string' || !Array.isArray(m.catalog.cards)) return null;
      return { type: 'setCustomCardCatalog', catalog: m.catalog as unknown as CustomCardCatalog };
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
    case 'setTeam':
      return isInt(m.index, 0, MAX_SEATS - 1) && isInt(m.team, 0, 9) ? { type: 'setTeam', index: m.index, team: m.team } : null;
    case 'kick':
      return isString(m.memberId, 20) ? { type: 'kick', memberId: m.memberId } : null;
    case 'unseat':
      return isInt(m.index, 0, MAX_SEATS - 1) ? { type: 'unseat', index: m.index } : null;
    case 'renameMember':
      return isString(m.memberId, 20) && isString(m.name) && isString(m.avatar, 20) ? { type: 'renameMember', memberId: m.memberId, name: m.name, avatar: m.avatar } : null;
    case 'setNamesLocked':
      return typeof m.locked === 'boolean' ? { type: 'setNamesLocked', locked: m.locked } : null;
    case 'setTakeBack':
      return typeof m.allowed === 'boolean' ? { type: 'setTakeBack', allowed: m.allowed } : null;
    case 'answerTakeBack':
      return typeof m.accept === 'boolean' ? { type: 'answerTakeBack', accept: m.accept } : null;
    case 'afterVote':
      return m.choice === 'again' || m.choice === 'other' ? { type: 'afterVote', choice: m.choice } : null;
    case 'afterPropose':
      return isString(m.gameId, 60) && m.gameId !== AFTER_RANDOM ? { type: 'afterPropose', gameId: m.gameId } : null;
    case 'afterPick':
      return isString(m.gameId, 60) ? { type: 'afterPick', gameId: m.gameId } : null;
    case 'answerJoin':
      return isString(m.memberId, 20) && typeof m.ok === 'boolean' ? { type: 'answerJoin', memberId: m.memberId, ok: m.ok } : null;
    case 'setAcceptRequests':
      return typeof m.allowed === 'boolean' ? { type: 'setAcceptRequests', allowed: m.allowed } : null;
    case 'askToJoin':
    case 'cancelAskToJoin':
    case 'acceptAllJoins':
      return { type: m.type };
    case 'move':
      return isInt(m.version) && 'move' in m ? { type: 'move', version: m.version, move: m.move } : null;
    case 'react':
      return isString(m.emoji, 20) ? { type: 'react', emoji: m.emoji } : null;
    case 'say':
      return isString(m.phrase, 40) ? { type: 'say', phrase: m.phrase } : null;
    case 'start':
      return { type: 'start', ...(typeof m.rotate === 'boolean' ? { rotate: m.rotate } : {}) };
    case 'pushSubscribe': {
      const subscription = parsePushSubscription(m.subscription, push);
      return subscription ? { type: 'pushSubscribe', subscription } : null;
    }
    case 'leaveSeat':
    case 'fillSeats':
    case 'shuffleTeams':
    case 'toLobby':
    case 'resign':
    case 'returnSeat':
    case 'takeBack':
    case 'leave':
    case 'pushUnsubscribe':
    case 'ping':
      return { type: m.type };
    default:
      return null;
  }
}
