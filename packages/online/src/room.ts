import {
  LocalSession,
  REPLAY_MAX_STEPS,
  type ReplayData,
  TEAM_OPTION_ID,
  teamsFor,
  shuffledTeams,
  resolveOptions,
  type AnyGameModule,
  type BotLevel,
  type BotRunner,
  type GameEvent,
  type Options,
  type Result,
  type SeatId,
  type SessionChange,
  type SessionConfig,
  type SessionSnapshot,
  timePresetsOf,
} from '@brett-und-blatt/engine';
import { cleanAvatar, cleanName, crestField, setCrest } from './names';
import type { RoomReport } from './tournament';
import { SERIES_PAUSE_MS, forfeitSeries, newSeries, recordSeriesGame, type SeriesState } from './tournament/best-of';
import {
  AFTER_MAX_CANDIDATES,
  AFTER_RANDOM,
  JOIN_DENIED_MS,
  MAX_JOIN_QUEUE,
  MAX_SEATS,
  PHRASES,
  DISPLAY_MEMBER,
  PROTOCOL_VERSION,
  REACTIONS,
  parseClientMessage,
  type AfterChoice,
  type AfterGameInfo,
  type ClientMessage,
  type ErrorCode,
  type GameMessage,
  type LobbySettings,
  type MemberInfo,
  type OpenRoomListing,
  type PublicSeat,
  type RoomMessage,
  type RoomPhase,
  type ServerMessage,
  type TakeBackInfo,
} from './protocol';

/** Höchstens so viele Mitglieder (Spieler und Zuschauer) pro Raum. */
export const MAX_MEMBERS = 40;
/** Wie viele Tisch-Bildschirme (Fernseher, Beamer, Tafel) ein Raum bedient. Sie zählen nicht als Mitglieder. */
export const MAX_DISPLAYS = 3;
/** Kulanz bei Zeitablauf für die Netzverzögerung. */
export const CLOCK_GRACE_MS = 1000;
/** So lange darf die Verbindung weg sein, bevor ein Bot den Platz übernimmt. */
export const AWAY_AFTER_DISCONNECT_MS = 20_000;
/** So lange wartet der Raum auf die Raumleitung, bevor ein anderes Mitglied sie übernimmt. */
export const HOST_HANDOVER_MS = 60_000;
/** Ein Raum ohne jede Aktivität wird nach dieser Zeit gelöscht. */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
/** Für Fernpartien über Tage (asynchrone Züge): 30 Tage Lebensdauer. */
export const CORRESPONDENCE_ROOM_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Mindestabstand zwischen zwei Signalen (Emoji, Schnellnachricht) eines Mitglieds. */
export const SIGNAL_INTERVAL_MS = 1000;
/** Zeitfenster für die Begrenzung von Signalen. */
export const SIGNAL_WINDOW_MS = 60_000;
/** Maximale Anzahl an Signalen innerhalb des Zeitfensters. */
export const SIGNAL_MAX_PER_WINDOW = 8;
/** Turnierpartie: So lange wartet der Raum darauf, dass beide Gegner erscheinen. */
export const MATCH_ARRIVAL_MS = 5 * 60 * 1000;
/** Turnierpartie: So lange darf die Verbindung weg sein, dann ist die Partie verloren (kein Bot). */
export const MATCH_AWAY_MS = 5 * 60 * 1000;

/** So lange können die anderen über eine Bitte ums Zurücknehmen abstimmen; danach gilt sie als abgelehnt. */
export const TAKE_BACK_MS = 30_000;
/** Nach einer Bitte ums Zurücknehmen darf derselbe Platz erst nach so vielen eigenen Zügen wieder bitten. */
export const TAKE_BACK_GAP = 3;

/** So lange können alle nach einer Partie über Nochmal oder ein anderes Spiel abstimmen (#298). */
export const AFTER_GAME_MS = 30_000;

/** Abstimmung am Rundenende: wer was gewählt hat, bleibt bis zur Entscheidung im Raum. */
interface AfterGameState {
  /** Partie (`Game.round`), nach der abgestimmt wird. */
  round: number;
  deadline: number;
  votes: Record<string, AfterChoice>;
  /** Ein vorgeschlagenes Spiel je Mitglied. */
  proposals: Record<string, string>;
  /** Gewählter Kandidat je Mitglied (Spiel-id oder `random`). */
  picks: Record<string, string>;
}

/** Zurücknehmen mit Zustimmung (`GameInfo.takeBack`): offene Bitte, letzter Ausgang und Sperren je Platz. */
interface TakeBackState {
  pending: { seat: SeatId; accepted: SeatId[]; deadline: number; moves: number } | null;
  /** Ausgang der letzten Bitte – bleibt bis zum nächsten Zug sichtbar. */
  last: { seat: SeatId; status: 'accepted' | 'declined' | 'expired'; moves: number; by?: SeatId } | null;
  /** Eigene Züge je Platz (zählt nur vorwärts) und ab welcher Zahl wieder gebeten werden darf. */
  ownMoves: number[];
  nextAllowed: number[];
}

/** Eine Partie im Auftrag eines Turniers: feste Plätze, keine Raumleitung. */
export interface MatchRoomConfig {
  tournament: string;
  match: string;
  gameId: string;
  time: LobbySettings['time'];
  options?: Options;
  /** Geheime Kennungen je Platz; zwei, bei Tischrunden mehr. */
  tokens: string[];
  label: string;
  /** Begegnung über bis zu so viele Partien („Best of N“, nur zu zweit). */
  bestOf?: number;
  /** Teamspiel: Team (0 oder 1) je Kennung. Der Raum gibt es dem Spiel als Option `teams` mit. */
  teams?: number[];
}

/** Was der Raum dem Turnier meldet. */
export interface MatchRoomReport {
  tournament: string;
  match: string;
  report: RoomReport;
}

export interface RoomDeps {
  now(): number;
  /** Das Regelwerk eines Spiels, das online angeboten wird – sonst undefined. */
  findGame(gameId: string): AnyGameModule | undefined;
  botRunner: BotRunner;
  /** Ein neuer, geheimer Startwert für eine Partie. */
  randomSeed(): string;
  /** Schickt eine Nachricht an eine Verbindung. */
  send(connectionId: string, message: ServerMessage): void;
  /** Schließt eine Verbindung (nach „Verlassen“, Entfernen oder falschem Protokoll). */
  close(connectionId: string): void;
  /** Wird nach jeder Änderung aufgerufen, die gespeichert werden sollte. */
  changed?(): void;
  /** Bedenkzeit der Bots je Stufe – auf dem Server eventuell knapper. */
  botBudgetMs?: Partial<Record<BotLevel, number>>;
  /** Alle online angebotenen Spiele – für „zufälliges Spiel“ am Rundenende. Fehlt: nur vorgeschlagene Spiele. */
  listGames?(): AnyGameModule[];
  /** Zufallszahl in [0, 1) für Lobby-Dinge wie „Teams mischen“ (Standard: Math.random). */
  random?(): number;
}

interface Member {
  id: string;
  /** Geheime Kennung des Geräts. Geht nie an andere Mitglieder. */
  token: string;
  name: string;
  avatar: string;
  /** Wappen in Normalform (geprüft über `cleanCrest`), falls die Person es im Raum zeigen will. */
  crest?: string;
  connections: Set<string>;
  /** Seit wann keine Verbindung mehr besteht (null: verbunden). */
  disconnectedAt: number | null;
  /** Hat der Raum den Platz wegen der fehlenden Verbindung einem Bot übergeben? */
  awayByDisconnect: boolean;
  /** Name und Bild hat die Raumleitung festgelegt; das Mitglied kann sie nicht mehr ändern. */
  nameFixed: boolean;
  /** Zeitstempel kürzlich gesendeter Signale zur Spam-Begrenzung. */
  recentSignals: number[];
  /** Anfrage ums Mitspielen ab der nächsten Runde (#299) und seit wann (Reihenfolge der Annahme). */
  join?: 'asking' | 'queued';
  joinAt?: number;
  /** Bis wann die Person nach einer Ablehnung nicht erneut fragen darf. */
  declinedUntil?: number;
}

interface Game {
  module: AnyGameModule;
  session: LocalSession;
  /** Welches Mitglied an welchem Platz sitzt (null bei Bots). */
  seatMembers: (string | null)[];
  seats: PublicSeat[];
  /** Welcher Lobby-Platz zu welchem Platz der Partie gehört (freie Lobby-Plätze fallen beim Start weg). */
  lobbyIndex?: number[];
  time: LobbySettings['time'];
  round: number;
  /** Damit die Versionsnummer nach einem Neustart des Servers weiterzählt statt bei 0 anzufangen. */
  versionOffset: number;
  /** Version nach dem letzten Zug je Platz (auch Bot- oder Zeitablauf-Zug für ihn); nicht gespeichert. */
  seatMoved?: number[];
  takeBack?: TakeBackState;
  unsubscribe: () => void;
}

/** Alles, was ein Raum zum Weiterleben braucht – reines JSON, zum Speichern auf dem Server. */
export interface RoomSnapshot {
  version: 1;
  code: string;
  hostId: string | null;
  phase: RoomPhase;
  lobby: LobbySettings;
  /** `disconnectedAt`: seit wann ohne Verbindung (null: beim Speichern verbunden). */
  members: { id: string; token: string; name: string; avatar: string; crest?: string; awayByDisconnect: boolean; disconnectedAt: number | null; nameFixed?: boolean; join?: 'asking' | 'queued'; joinAt?: number; declinedUntil?: number }[];
  kicked: string[];
  nextMember: number;
  lastVersion: number;
  rounds: number;
  createdAt?: number;
  lastActivity: number;
  after?: AfterGameState;
  game: { session: SessionSnapshot; seatMembers: (string | null)[]; seats: PublicSeat[]; lobbyIndex?: number[]; time: LobbySettings['time']; version: number; round: number; takeBack?: TakeBackState } | null;
  match?: { config: MatchRoomConfig; noShow: RoomReport | null; reported: boolean; series?: SeriesState };
}

/**
 * Ein Raum: Lobby, Partie, Mitglieder und ihre Verbindungen. Er weiß nichts über
 * WebSockets oder Cloudflare – ein dünner Adapter reicht Nachrichten herein und
 * stellt einen Wecker auf `nextWakeup()`.
 */
export class Room {
  private members = new Map<string, Member>();
  private tokens = new Map<string, string>();
  /** Verbindung → Mitglied (null, solange noch kein „hello“ kam). */
  private connections = new Map<string, string | null>();
  private kicked = new Set<string>();
  /** Verbindungen von Tisch-Bildschirmen (#100): keine Mitglieder, nur Zuschauersicht. */
  private displays = new Set<string>();
  private hostId: string | null = null;
  private phase: RoomPhase = 'lobby';
  private lobby: LobbySettings;
  private game: Game | null = null;
  /** Läuft nach der Partie gerade eine Abstimmung (#298)? */
  private after: AfterGameState | null = null;
  private nextMember = 1;
  private lastVersion = 0;
  /** Wie viele Partien in diesem Raum schon begonnen haben. */
  private rounds = 0;
  private createdAt: number;
  private lastActivity: number;
  /** Nur bei Turnierpartien. */
  private match: { config: MatchRoomConfig; noShow: RoomReport | null; reported: boolean; series?: SeriesState } | null = null;
  /** Mehrere Schritte der Spielleitung hintereinander (Zurücknehmen): erst am Ende eine Nachricht an alle. */
  private muted = false;

  constructor(
    readonly code: string,
    private deps: RoomDeps,
    isPublic = true,
  ) {
    this.lobby = { gameId: null, options: {}, time: 'relaxed', seats: [], isPublic };
    this.createdAt = deps.now();
    this.lastActivity = deps.now();
  }

  // -------------------------------------------------------------------------
  // Schnittstelle für den Adapter

  /** Macht aus einem frischen Raum eine Turnierpartie. false, wenn es das Spiel nicht gibt. */
  setupMatch(config: MatchRoomConfig): boolean {
    const module = this.deps.findGame(config.gameId);
    if (!module) return false;
    this.match = { config, noShow: null, reported: false, ...(config.bestOf && config.bestOf > 1 && config.tokens.length === 2 ? { series: newSeries(config.bestOf) } : {}) };
    this.lobby = { gameId: config.gameId, options: resolveOptions(module, config.teams ? { ...config.options, [TEAM_OPTION_ID]: config.teams.join(',') } : config.options), time: config.time, seats: config.tokens.map((_, i) => ({ kind: 'human' as const, memberId: null, ...(config.teams ? { team: config.teams[i] } : {}) })), isPublic: false };
    return true;
  }

  /** Das noch nicht zugestellte Ergebnis einer Turnierpartie. */
  matchReport(): MatchRoomReport | null {
    const match = this.match;
    if (!match || match.reported) return null;
    const result = this.game?.session.result;
    let report: RoomReport | null = match.noShow;
    if (match.series && !match.noShow) {
      // Best of N: erst melden, wenn die Begegnung entschieden ist. Seiten = Reihenfolge der Kennungen.
      if (match.series.winner === undefined) return null;
      report = match.series.forfeit ? { kind: 'noShow', winner: match.series.winner } : { kind: 'played', winner: match.series.winner, score: [...match.series.score] };
    } else if (result && match.config.teams) {
      report = { kind: 'played', winner: this.winningTeam(result) };
    } else if (result && match.config.tokens.length > 2) {
      report = { kind: 'placed', places: this.tablePlaces(result) };
    } else if (result) {
      const winners = result.kind === 'win' ? result.winners : [];
      report = { kind: 'played', winner: winners.length === 1 ? (winners[0] as 0 | 1) : null };
    }
    return report ? { tournament: match.config.tournament, match: match.config.match, report } : null;
  }

  /** Teamspiel: das Team, dem alle Sieger angehören; null bei Remis oder gemischten Siegern. */
  private winningTeam(result: Result): 0 | 1 | null {
    const teams = this.match!.config.teams!;
    const lobbyIndex = this.game?.lobbyIndex ?? teams.map((_, i) => i);
    if (result.kind !== 'win') return null;
    const sides = new Set(result.winners.map((seat) => teams[lobbyIndex[seat] ?? seat]));
    const only = sides.size === 1 ? [...sides][0] : undefined;
    return only === 0 || only === 1 ? only : null;
  }

  /**
   * Tischrunde: Platz je Lobby-Sitz. Sieger vorn, alle anderen dahinter; wer nicht mitspielte
   * (nicht gekommen), ganz hinten.
   */
  private tablePlaces(result: Result): number[] {
    const seats = this.match!.config.tokens.length;
    const lobbyIndex = this.game?.lobbyIndex ?? Array.from({ length: seats }, (_, i) => i);
    const rank = Array.from({ length: seats }, () => 2);
    lobbyIndex.forEach((lobbySeat, gameSeat) => {
      rank[lobbySeat] = result.kind === 'win' && !result.winners.includes(gameSeat) ? 1 : 0;
    });
    return rank.map((v) => rank.filter((other) => other < v).length);
  }

  /** Eine Partie der Serie ist aus: Stand fortschreiben, sonst nach einer Pause die nächste. */
  private seriesGameOver(): void {
    const series = this.match?.series;
    const result = this.game?.session.result;
    if (!series || !result || series.winner !== undefined) return;
    const winners = result.kind === 'win' ? result.winners : [];
    const side = winners.length === 1 ? this.sideOfGameSeat(winners[0]!) : null;
    if (!recordSeriesGame(series, side)) series.nextAt = this.deps.now() + SERIES_PAUSE_MS;
  }

  /** Seite (Reihenfolge der Kennungen) eines Partieplatzes; nach dem Farbwechsel nicht mehr gleich. */
  private sideOfGameSeat(gameSeat: number): 0 | 1 | null {
    const lobbySeat = this.lobby.seats[this.game?.lobbyIndex?.[gameSeat] ?? gameSeat];
    const member = lobbySeat?.kind === 'human' && lobbySeat.memberId ? this.members.get(lobbySeat.memberId) : undefined;
    const side = member ? this.match!.config.tokens.indexOf(member.token) : -1;
    return side === 0 || side === 1 ? side : null;
  }

  /** Stand der Serie in der Reihenfolge der Lobby-Plätze, so wie die Spieler ihn sehen. */
  private seriesScoreBySeat(series: SeriesState): [number, number] {
    const sides = [0, 1].map((seat) => {
      const lobbySeat = this.lobby.seats[seat];
      const member = lobbySeat?.kind === 'human' && lobbySeat.memberId ? this.members.get(lobbySeat.memberId) : undefined;
      return member ? this.match!.config.tokens.indexOf(member.token) : seat;
    });
    return [series.score[sides[0] === 1 ? 1 : 0], series.score[sides[0] === 1 ? 0 : 1]];
  }

  markMatchReported(): void {
    if (this.match) this.match.reported = true;
    this.deps.changed?.();
  }

  connect(connectionId: string): void {
    this.connections.set(connectionId, null);
    this.touch();
  }

  /** Nach einem Neustart des Servers: eine noch offene Verbindung wieder einem Mitglied zuordnen. */
  reattach(connectionId: string, memberId: string): void {
    if (memberId === DISPLAY_MEMBER) {
      this.connections.set(connectionId, null);
      this.displays.add(connectionId);
      return;
    }
    const member = this.members.get(memberId);
    if (!member) return;
    this.connections.set(connectionId, memberId);
    member.connections.add(connectionId);
    member.disconnectedAt = null;
  }

  disconnect(connectionId: string): void {
    if (this.displays.delete(connectionId)) {
      this.connections.delete(connectionId);
      this.broadcastRoom();
      this.deps.changed?.();
      return;
    }
    const memberId = this.connections.get(connectionId);
    this.connections.delete(connectionId);
    const member = memberId ? this.members.get(memberId) : undefined;
    if (!member) return;
    member.connections.delete(connectionId);
    if (member.connections.size === 0) {
      member.disconnectedAt = this.deps.now();
      this.broadcastRoom();
      this.deps.changed?.();
    }
  }

  receive(connectionId: string, raw: string): void {
    if (!this.connections.has(connectionId)) return;
    const isDisplay = this.displays.has(connectionId);
    // Lebenszeichen eines Tisch-Bildschirms halten den Raum nicht am Leben: Er läuft nach 24 h ohne Spielende ab.
    if (!isDisplay) this.touch();
    const message = parseClientMessage(raw);
    if (!message) return this.error(connectionId, 'badMessage', 'Unbekannte Nachricht.');
    if (message.type === 'ping') return this.deps.send(connectionId, { type: 'pong', serverNow: this.deps.now() });
    if (message.type === 'display') return this.attachDisplay(connectionId, message);
    if (isDisplay) return message.type === 'leave' ? this.deps.close(connectionId) : this.error(connectionId, 'notAllowed', 'Ein Tisch-Bildschirm kann nur zuschauen.');
    if (message.type === 'hello') return this.hello(connectionId, message);
    const member = this.memberOf(connectionId);
    if (!member) return this.error(connectionId, 'notReady', 'Erst anmelden.');
    this.handle(connectionId, member, message);
    this.deps.changed?.();
  }

  /** Prüft, ob der Raum als Fernpartie läuft (Bedenkzeit >= 12h oder Option correspondence). */
  isCorrespondence(): boolean {
    const mod = this.lobby.gameId ? this.deps.findGame(this.lobby.gameId) : undefined;
    const presets = mod ? (mod.timePresetsFor ? mod.timePresetsFor(this.lobby.options) : mod.timePresets) : undefined;
    const preset = presets ? presets[this.lobby.time] : undefined;
    const moveMs = preset && preset.kind === 'perMove' ? preset.moveMs : 0;
    return moveMs >= 12 * 60 * 60 * 1000 || this.lobby.options?.correspondence === 'yes';
  }

  /** Erledigt, was zeitlich fällig ist: Uhren, Bot-Ersatz für Abwesende, Wechsel der Raumleitung. */
  tick(): void {
    const now = this.deps.now();
    this.game?.session.tick();
    this.settleTakeBack();
    if (this.after && now >= this.after.deadline) this.settleAfter(true);
    if (this.match) {
      this.tickMatch(now);
      this.deps.changed?.();
      return;
    }
    const corr = this.isCorrespondence();
    for (const member of this.members.values()) {
      if (member.disconnectedAt === null || member.awayByDisconnect) continue;
      const seat = this.seatOf(member.id);
      // Bei Fernpartien übernimmt der Bot nicht nach 20s Disconnect, sondern erst bei regulärem Zeitablauf.
      if (!corr && seat !== null && this.phase === 'playing' && now - member.disconnectedAt >= AWAY_AFTER_DISCONNECT_MS) {
        member.awayByDisconnect = true;
        this.game?.session.markAway(seat);
      }
    }
    const host = this.hostId ? this.members.get(this.hostId) : undefined;
    if (host?.disconnectedAt != null && now - host.disconnectedAt >= HOST_HANDOVER_MS) {
      const successor = [...this.members.values()].find((m) => m.disconnectedAt === null);
      if (successor) {
        this.hostId = successor.id;
        this.broadcastRoom();
      }
    }
    this.deps.changed?.();
  }

  /** Wann `tick()` das nächste Mal fällig ist – für den Wecker des Adapters. */
  nextWakeup(): number | null {
    // Nur Zeitpunkte, an denen `tick()` wirklich etwas ändern kann. Ein Zeitpunkt in der
    // Vergangenheit, der nichts bewirkt, ließe den Adapter den Raum im Dauertakt wecken.
    const now = this.deps.now();
    const expires = this.expiresAt();
    // Abgelaufen, aber noch jemand verbunden: Der Raum bleibt, später erneut nachsehen.
    const times: number[] = [expires > now ? expires : now + HOST_HANDOVER_MS];
    const deadline = this.game?.session.nextDeadline();
    if (deadline != null) times.push(deadline);
    const takeBack = this.game?.takeBack?.pending;
    if (takeBack) times.push(takeBack.deadline);
    if (this.after) times.push(this.after.deadline);
    if (this.match) {
      if (this.phase === 'lobby' && !this.match.noShow) times.push(this.createdAt + MATCH_ARRIVAL_MS);
      if (this.match.series?.nextAt != null) times.push(this.match.series.nextAt);
      if (this.phase === 'playing') {
        for (const member of this.members.values()) {
          if (member.disconnectedAt !== null && this.seatOf(member.id) !== null) times.push(member.disconnectedAt + MATCH_AWAY_MS);
        }
      }
      return Math.min(...times);
    }
    const successor = [...this.members.values()].some((m) => m.disconnectedAt === null);
    const corr = this.isCorrespondence();
    for (const member of this.members.values()) {
      if (member.disconnectedAt === null) continue;
      if (!corr && !member.awayByDisconnect && this.phase === 'playing' && this.seatOf(member.id) !== null) {
        times.push(member.disconnectedAt + AWAY_AFTER_DISCONNECT_MS);
      }
      // Ohne verbundenes Mitglied gibt es niemanden, an den die Leitung gehen könnte.
      if (member.id === this.hostId && successor) times.push(member.disconnectedAt + HOST_HANDOVER_MS);
    }
    return Math.min(...times);
  }

  /** Ab wann der Raum gelöscht werden darf (bei Fernpartien 30 Tage statt 24 h). */
  expiresAt(): number {
    return this.lastActivity + (this.isCorrespondence() ? CORRESPONDENCE_ROOM_TTL_MS : ROOM_TTL_MS);
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  /**
   * Erzeugt ein kompaktes Listing für die Startseite, sofern der Raum öffentlich,
   * in der Lobby-Phase, mit gewähltem Spiel und mit freien Plätzen ist und
   * mindestens ein Mitglied verbunden ist. Sonst null.
   */
  publicListing(): OpenRoomListing | null {
    if (!this.lobby.isPublic) return null;
    if (!this.lobby.gameId) return null;
    const module = this.deps.findGame(this.lobby.gameId);
    if (!module) return null;
    const playingJoinable = this.phase === 'playing' && Boolean(module.info.joinMidGame) && Boolean(this.game && !this.game.session.result);
    // Läuft die Partie schon, aber Zuschauer dürfen anfragen (#299): „läuft – Anfrage möglich“.
    const running = this.phase !== 'lobby' && !playingJoinable && Boolean(this.game) && this.joinOffered();
    if (this.phase !== 'lobby' && !playingJoinable && !running) return null;
    const seats = (playingJoinable || running) && this.game ? this.game.seats : this.lobby.seats;
    const openSeats = seats.filter((s) => s.kind === 'human' && s.memberId === null).length;
    if (openSeats === 0 && !running) return null;
    const hasConnected = [...this.members.values()].some((m) => m.disconnectedAt === null);
    if (!hasConnected) return null;
    const host = this.hostId ? this.members.get(this.hostId) : undefined;
    const cardCatalogChecksum =
      typeof this.lobby.options?.cardCatalogChecksum === 'string'
        ? this.lobby.options.cardCatalogChecksum
        : undefined;
    return {
      code: this.code,
      gameId: this.lobby.gameId,
      gameName: module.info.name,
      gameEmoji: module.info.emoji,
      hostName: host?.name ?? 'Anonym',
      hostAvatar: host?.avatar ?? '🎲',
      totalSeats: seats.length,
      filledSeats: seats.length - openSeats,
      ...(running ? { running: true } : {}),
      createdAt: this.createdAt,
      updatedAt: this.lastActivity,
      ...(cardCatalogChecksum ? { cardCatalogChecksum } : {}),
    };
  }

  snapshot(): RoomSnapshot {
    const game = this.game;
    return {
      version: 1,
      code: this.code,
      hostId: this.hostId,
      phase: this.phase,
      lobby: structuredClone(this.lobby),
      members: [...this.members.values()].map(({ id, token, name, avatar, crest, awayByDisconnect, disconnectedAt, nameFixed, join, joinAt, declinedUntil }) => ({ id, token, name, avatar, ...(crest ? { crest } : {}), awayByDisconnect, disconnectedAt, ...(nameFixed ? { nameFixed } : {}), ...(join ? { join, ...(joinAt !== undefined ? { joinAt } : {}) } : {}), ...(declinedUntil !== undefined ? { declinedUntil } : {}) })),
      kicked: [...this.kicked],
      nextMember: this.nextMember,
      lastVersion: this.lastVersion,
      rounds: this.rounds,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      game: game
        ? { session: game.session.snapshot(), seatMembers: [...game.seatMembers], seats: game.seats, ...(game.lobbyIndex ? { lobbyIndex: game.lobbyIndex } : {}), time: game.time, version: this.gameVersion(), round: game.round, ...(game.takeBack ? { takeBack: structuredClone(game.takeBack) } : {}) }
        : null,
      ...(this.after ? { after: structuredClone(this.after) } : {}),
      ...(this.match ? { match: structuredClone(this.match) } : {}),
    };
  }

  /**
   * Stellt einen gespeicherten Raum wieder her, z. B. nachdem der Server ihn schlafen
   * gelegt hat. Die Partie wird aus Seed und Zugliste neu berechnet; Uhren und
   * Abwesenheit laufen nahtlos weiter.
   */
  static restore(snapshot: RoomSnapshot, deps: RoomDeps): Room {
    const isPublic = snapshot.lobby.isPublic ?? true;
    const room = new Room(snapshot.code, deps, isPublic);
    room.hostId = snapshot.hostId;
    room.phase = snapshot.phase;
    room.lobby = { ...snapshot.lobby, isPublic };
    room.kicked = new Set(snapshot.kicked);
    room.nextMember = snapshot.nextMember;
    room.lastVersion = snapshot.lastVersion;
    room.rounds = snapshot.rounds;
    room.createdAt = snapshot.createdAt ?? snapshot.lastActivity;
    room.lastActivity = snapshot.lastActivity;
    room.match = snapshot.match ?? null;
    const now = deps.now();
    for (const m of snapshot.members) {
      // Wer schon vorher weg war, behält seinen Zeitpunkt – sonst begänne die Frist bei jedem
      // Aufwachen des Servers von vorn. Wer verbunden war, gilt bis zur Wiederzuordnung als weg.
      room.members.set(m.id, { ...m, nameFixed: m.nameFixed ?? false, connections: new Set(), disconnectedAt: m.disconnectedAt ?? now, recentSignals: [] });
      room.tokens.set(m.token, m.id);
    }
    const saved = snapshot.game;
    const module = saved ? deps.findGame(saved.session.config.gameId) : undefined;
    if (saved && module) {
      const session = LocalSession.restore(module, saved.session, room.sessionDeps(), { resumeClocks: true });
      // Während einer Abstimmung ruht die Partie; die Uhren stehen schon im Schnappschuss.
      if (saved.takeBack?.pending) session.pause();
      const versionOffset = saved.version - session.version;
      room.attachGame({ module, session, seatMembers: saved.seatMembers, seats: saved.seats, ...(saved.lobbyIndex ? { lobbyIndex: saved.lobbyIndex } : {}), ...(saved.takeBack ? { takeBack: saved.takeBack } : {}), time: saved.time, round: saved.round, versionOffset, unsubscribe: () => {} });
    } else if (saved) {
      room.phase = 'lobby';
    }
    if (snapshot.after && room.phase === 'finished' && room.game?.round === snapshot.after.round) room.after = structuredClone(snapshot.after);
    return room;
  }

  // -------------------------------------------------------------------------
  // Nachrichten

  /** Ein Tisch-Bildschirm meldet sich an: kein Mitglied, keine Raumleitung, nur Zuschauen. */
  private attachDisplay(connectionId: string, message: Extract<ClientMessage, { type: 'display' }>): void {
    if (message.protocol !== PROTOCOL_VERSION) {
      this.error(connectionId, 'protocol', 'Bitte die Seite neu laden – es gibt eine neue Version.');
      return this.deps.close(connectionId);
    }
    if (this.connections.get(connectionId)) return this.error(connectionId, 'notAllowed', 'Diese Verbindung gehört schon zu einem Mitglied.');
    if (!this.displays.has(connectionId) && this.displays.size >= MAX_DISPLAYS) {
      this.error(connectionId, 'roomFull', 'Es sind schon genug Tisch-Bildschirme verbunden.');
      return this.deps.close(connectionId);
    }
    this.displays.add(connectionId);
    this.deps.send(connectionId, { type: 'welcome', protocol: PROTOCOL_VERSION, you: DISPLAY_MEMBER, serverNow: this.deps.now() });
    this.broadcastRoom();
    if (this.game) this.sendGame(connectionId, []);
    if (this.after) this.sendAfter(connectionId);
    this.deps.changed?.();
  }

  private hello(connectionId: string, message: Extract<ClientMessage, { type: 'hello' }>): void {
    if (message.protocol !== PROTOCOL_VERSION) {
      this.error(connectionId, 'protocol', 'Bitte die Seite neu laden – es gibt eine neue Version.');
      return this.deps.close(connectionId);
    }
    if (this.kicked.has(message.token)) {
      this.deps.send(connectionId, { type: 'kicked' });
      return this.deps.close(connectionId);
    }
    const name = cleanName(message.name);
    if (!name) return this.error(connectionId, 'badName', 'Bitte einen anderen Spitznamen wählen.');

    const previous = this.connections.get(connectionId);
    if (previous) this.members.get(previous)?.connections.delete(connectionId);

    let member = this.members.get(this.tokens.get(message.token) ?? '');
    if (!member) {
      const matchSeat = this.match ? this.match.config.tokens.indexOf(message.token) : -1;
      if (this.members.size >= MAX_MEMBERS && matchSeat < 0) {
        this.error(connectionId, 'roomFull', 'Der Raum ist voll.');
        return this.deps.close(connectionId);
      }
      member = {
        id: `m${this.nextMember++}`,
        token: message.token,
        name,
        avatar: cleanAvatar(message.avatar),
        ...crestField(message.crest),
        connections: new Set(),
        disconnectedAt: null,
        awayByDisconnect: false,
        nameFixed: false,
        recentSignals: [],
      };
      this.members.set(member.id, member);
      this.tokens.set(member.token, member.id);
      if (this.match) {
        if (matchSeat >= 0) this.lobby.seats[matchSeat] = { kind: 'human', memberId: member.id, ...(this.match?.config.teams ? { team: this.match.config.teams[matchSeat] } : {}) };
      } else {
        this.hostId ??= member.id;
      }
    } else if (this.mayRename(member)) {
      // Beim Wiederkommen gilt der Name aus dem Profil – außer die Raumleitung hat ihn festgelegt.
      member.name = name;
      member.avatar = cleanAvatar(message.avatar);
      setCrest(member, message.crest);
      this.syncSeatName(member);
    }
    this.connections.set(connectionId, member.id);
    member.connections.add(connectionId);
    member.disconnectedAt = null;

    this.deps.send(connectionId, { type: 'welcome', protocol: PROTOCOL_VERSION, you: member.id, serverNow: this.deps.now() });
    // Zurück nach einem Verbindungsabbruch: Der Bot gibt den Platz wieder ab.
    const seat = this.seatOf(member.id);
    if (member.awayByDisconnect && seat !== null) {
      member.awayByDisconnect = false;
      this.game?.session.returnSeat(seat);
    }
    this.broadcastRoom();
    if (this.game) this.sendGame(connectionId, []);
    if (this.after) this.sendAfter(connectionId);
    this.startMatchIfComplete(connectionId);
    this.deps.changed?.();
  }

  private handle(connectionId: string, member: Member, message: ClientMessage): void {
    const isHost = member.id === this.hostId;
    const deny = () => this.error(connectionId, 'notAllowed', 'Das ist gerade nicht möglich.');
    if (this.match) {
      // Die Plätze einer Turnierpartie stehen fest; Weggehen zählt wie ein Verbindungsabbruch.
      if (message.type === 'takeSeat' || message.type === 'leaveSeat') return deny();
      if (message.type === 'leave' && this.match.config.tokens.includes(member.token)) {
        for (const connection of member.connections) {
          this.deps.close(connection);
          this.connections.delete(connection);
        }
        member.connections.clear();
        member.disconnectedAt = this.deps.now();
        return this.broadcastRoom();
      }
    }
    switch (message.type) {
      case 'setName': {
        if (!this.mayRename(member)) return this.error(connectionId, 'notAllowed', 'Die Spielleitung hat die Namen festgelegt.');
        const name = cleanName(message.name);
        if (!name) return this.error(connectionId, 'badName', 'Bitte einen anderen Spitznamen wählen.');
        member.name = name;
        member.avatar = cleanAvatar(message.avatar);
        setCrest(member, message.crest);
        this.syncSeatName(member);
        return this.broadcastRoom();
      }
      case 'renameMember': {
        const target = this.members.get(message.memberId);
        if (!isHost || !target) return deny();
        const name = cleanName(message.name);
        if (!name) return this.error(connectionId, 'badName', 'Bitte einen anderen Spitznamen wählen.');
        target.name = name;
        target.avatar = cleanAvatar(message.avatar);
        // Die Raumleitung selbst bleibt frei, alle anderen behalten den festgelegten Namen.
        target.nameFixed = target.id !== member.id;
        this.syncSeatName(target);
        return this.broadcastRoom();
      }
      case 'setNamesLocked':
        if (!isHost) return deny();
        this.lobby.namesLocked = message.locked;
        return this.broadcastRoom();
      case 'setTakeBack':
        if (!isHost || this.phase !== 'lobby') return deny();
        this.lobby.takeBack = message.allowed;
        return this.broadcastRoom();
      case 'takeBack': {
        const seat = this.seatOf(member.id);
        if (seat === null || !this.canTakeBack(seat)) return deny();
        return this.requestTakeBack(seat);
      }
      case 'answerTakeBack': {
        const seat = this.seatOf(member.id);
        const pending = this.game?.takeBack?.pending;
        if (seat === null || !pending || !this.takeBackVoters().includes(seat) || pending.accepted.includes(seat)) return deny();
        if (!message.accept) return this.finishTakeBack('declined', seat);
        pending.accepted.push(seat);
        if (!this.settleTakeBack()) this.broadcastGame([]);
        return;
      }
      case 'unseat': {
        if (!isHost) return deny();
        if (this.phase === 'lobby') {
          const seat = this.lobby.seats[message.index];
          if (seat?.kind !== 'human' || seat.memberId === null) return deny();
          seat.memberId = null;
          return this.broadcastRoom();
        }
        const memberId = this.game?.seatMembers[message.index];
        if (this.phase !== 'playing' || !memberId) return deny();
        this.vacateSeat(message.index);
        return this.broadcastRoom();
      }
      case 'setGame': {
        const module = this.deps.findGame(message.gameId);
        if (!isHost || this.phase !== 'lobby' || !module) return deny();
        this.applyGame(module);
        return this.broadcastRoom();
      }
      case 'setPublic':
        if (!isHost || this.phase !== 'lobby') return deny();
        this.lobby.isPublic = message.isPublic;
        return this.broadcastRoom();
      case 'setOption': {
        const module = this.lobbyModule();
        const spec = module?.options.find((o) => o.id === message.id);
        if (!isHost || this.phase !== 'lobby' || !spec?.choices.some((c) => c.value === message.value)) return deny();
        this.lobby.options = { ...this.lobby.options, [message.id]: message.value };
        this.applyTeams();
        return this.broadcastRoom();
      }
      case 'setCustomCardCatalog': {
        if (!isHost || this.phase !== 'lobby') return deny();
        if (message.catalog) {
          this.lobby.options = {
            ...this.lobby.options,
            customCardCatalog: JSON.stringify(message.catalog),
            cardCatalogChecksum: message.catalog.checksum,
          };
        } else {
          const { customCardCatalog, cardCatalogChecksum, ...rest } = this.lobby.options;
          this.lobby.options = rest;
        }
        return this.broadcastRoom();
      }
      case 'setTime':
        if (!isHost || this.phase !== 'lobby') return deny();
        this.lobby.time = message.time;
        return this.broadcastRoom();
      case 'setSeatCount': {
        const module = this.lobbyModule();
        if (!isHost || this.phase !== 'lobby' || !module) return deny();
        const { min, max } = module.info.players;
        if (message.count < min || message.count > Math.min(max, MAX_SEATS)) return deny();
        this.lobby.seats = this.resizeSeats(message.count);
        this.applyTeams();
        return this.broadcastRoom();
      }
      case 'setSeat': {
        if (!isHost || this.phase !== 'lobby' || message.index >= this.lobby.seats.length) return deny();
        const team = this.lobby.seats[message.index]?.team;
        this.lobby.seats[message.index] = message.seat === 'open' ? { kind: 'human', memberId: null } : { kind: 'bot', level: message.seat.bot };
        if (team !== undefined) this.lobby.seats[message.index]!.team = team;
        return this.broadcastRoom();
      }
      case 'setTeam': {
        const count = this.lobbyTeams()?.count ?? 0;
        const seat = this.lobby.seats[message.index];
        const own = seat?.kind === 'human' && seat.memberId === member.id;
        if (this.phase !== 'lobby' || !seat || message.team >= count || !(isHost || own)) return deny();
        seat.team = message.team;
        return this.broadcastRoom();
      }
      case 'shuffleTeams': {
        const count = this.lobbyTeams()?.count ?? 0;
        if (!isHost || this.phase !== 'lobby' || count < 2) return deny();
        // Besetzte Plätze gleichmäßig mischen, freie Plätze behalten ihr Team.
        const occupied = this.lobby.seats.flatMap((s, i) => (s.kind === 'bot' || s.memberId !== null ? [i] : []));
        const teams = shuffledTeams(occupied.length, count, this.deps.random ?? Math.random);
        occupied.forEach((index, position) => {
          this.lobby.seats[index]!.team = teams[position]!;
        });
        return this.broadcastRoom();
      }
      case 'takeSeat': {
        // Ein Platz, den die Raumleitung freigegeben hat und den solange ein Bot spielt, lässt sich übernehmen.
        if (this.phase === 'playing' && this.game && this.isOrphaned(message.index)) {
          if (this.seatOf(member.id) !== null) return deny();
          const index = message.index;
          this.game.seatMembers[index] = member.id;
          this.game.seats[index] = { kind: 'human', name: member.name, avatar: member.avatar, memberId: member.id };
          if (this.game.seatMoved) this.game.seatMoved[index] = this.gameVersion();
          const lobbyIndex = this.game.lobbyIndex?.[index];
          const lobbySeat = lobbyIndex !== undefined ? this.lobby.seats[lobbyIndex] : undefined;
          if (lobbySeat?.kind === 'human') {
            this.unseat(member.id);
            lobbySeat.memberId = member.id;
          }
          member.awayByDisconnect = false;
          this.broadcastRoom();
          this.game.session.returnSeat(index);
          return;
        }
        if (this.phase === 'playing' && this.game?.module.info.joinMidGame) {
          if (this.seatOf(member.id) !== null) return deny();
          const index = message.index;
          const target = this.game.seats[index];
          const canGrow = index === this.game.seats.length && index < Math.min(this.game.module.info.players.max, MAX_SEATS);
          if (!target && !canGrow) return deny();
          if (target && (target.kind !== 'human' || target.memberId !== null)) return deny();
          this.game.seatMembers[index] = member.id;
          this.game.seats[index] = { kind: 'human', name: member.name, avatar: member.avatar, memberId: member.id };
          if (this.game.seatMoved) this.game.seatMoved[index] = this.gameVersion();
          while (this.lobby.seats.length <= index) this.lobby.seats.push({ kind: 'human', memberId: null });
          this.lobby.seats[index] = { kind: 'human', memberId: member.id };
          if (!this.game.session.joinSeat(index, 'human', member.name, undefined, member.avatar)) {
            this.game.seatMembers[index] = null;
            this.game.seats[index] = { kind: 'human', name: 'Frei', memberId: null };
            this.lobby.seats[index] = { kind: 'human', memberId: null };
            return deny();
          }
          return this.broadcastRoom();
        }
        const seat = this.lobby.seats[message.index];
        if (this.phase !== 'lobby' || seat?.kind !== 'human' || seat.memberId !== null) return deny();
        this.unseat(member.id);
        seat.memberId = member.id;
        delete member.join;
        delete member.joinAt;
        return this.broadcastRoom();
      }
      case 'leaveSeat': {
        if (this.phase === 'playing' && this.game?.module.info.joinMidGame) {
          const seat = this.seatOf(member.id);
          if (seat === null || !this.game.session.canLeaveSeat(seat)) return deny();
          this.freeRunningSeat(seat);
          return this.broadcastRoom();
        }
        if (this.phase !== 'lobby') return deny();
        this.unseat(member.id);
        return this.broadcastRoom();
      }
      case 'fillSeats':
        if (!isHost || this.phase !== 'lobby' || !this.lobby.gameId) return deny();
        this.fillOpenSeats();
        return this.broadcastRoom();
      case 'kick': {
        const target = this.members.get(message.memberId);
        if (!isHost || !target || target.id === member.id) return deny();
        this.kicked.add(target.token);
        for (const connection of target.connections) {
          this.deps.send(connection, { type: 'kicked' });
          this.deps.close(connection);
          this.connections.delete(connection);
        }
        return this.removeMember(target);
      }
      case 'start': {
        if (!isHost) return deny();
        if (message.rotate) this.swapTwoSeats();
        return this.start(connectionId);
      }
      case 'toLobby':
        if (!isHost || this.phase === 'lobby') return deny();
        this.endGame();
        this.seatQueued();
        return this.broadcastRoom();
      case 'afterVote':
      case 'afterPropose':
      case 'afterPick':
        return this.afterMessage(connectionId, member, message);
      case 'setAcceptRequests': {
        if (!isHost || this.match) return deny();
        this.lobby.acceptRequests = message.allowed;
        if (!message.allowed) for (const m of this.members.values()) if (m.join === 'asking') delete m.join;
        return this.broadcastRoom();
      }
      case 'askToJoin': {
        if (this.seatOf(member.id) !== null || this.lobby.seats.some((s) => s.kind === 'human' && s.memberId === member.id)) return deny();
        if (!this.joinOffered()) return deny();
        if (member.join) return;
        if ((member.declinedUntil ?? 0) > this.deps.now()) return this.error(connectionId, 'notAllowed', 'Bitte warte einen Moment, bevor du noch einmal fragst.');
        if ([...this.members.values()].filter((m) => m.join).length >= MAX_JOIN_QUEUE) return this.error(connectionId, 'notAllowed', 'Es warten schon genug Anfragen.');
        member.join = 'asking';
        member.joinAt = this.deps.now();
        return this.broadcastRoom();
      }
      case 'cancelAskToJoin': {
        if (!member.join) return;
        delete member.join;
        delete member.joinAt;
        this.broadcastRoom();
        if (this.after) this.broadcastAfter();
        return;
      }
      case 'answerJoin': {
        const target = this.members.get(message.memberId);
        if (!isHost || !target || target.join !== 'asking') return deny();
        this.answerJoin(target, message.ok);
        this.broadcastRoom();
        if (this.after) this.broadcastAfter();
        return;
      }
      case 'acceptAllJoins': {
        if (!isHost) return deny();
        for (const target of [...this.members.values()].filter((m) => m.join === 'asking').sort((a, b) => (a.joinAt ?? 0) - (b.joinAt ?? 0))) this.answerJoin(target, true);
        this.broadcastRoom();
        if (this.after) this.broadcastAfter();
        return;
      }
      case 'move': {
        const seat = this.seatOf(member.id);
        const session = this.game?.session;
        if (!session || seat === null) return deny();
        if (this.game?.takeBack?.pending) return this.error(connectionId, 'notAllowed', 'Erst wird über das Zurücknehmen abgestimmt.');
        if (message.version !== this.gameVersion() && !this.stillValid(seat, message.version)) {
          this.error(connectionId, 'staleMove', 'Der Spielstand hat sich inzwischen geändert.');
          return this.sendGame(connectionId, []);
        }
        if (!session.submit(seat, message.move)) {
          // Mit älterer Version angenommen, aber jetzt nicht mehr möglich: Jemand anderes war schneller
          // (z. B. bei Ligretto auf denselben Stapel) – das ist kein Fehler des Spielers.
          if (message.version !== this.gameVersion()) return this.error(connectionId, 'tooLate', 'Zu spät – jemand war schneller.');
          return this.error(connectionId, 'illegalMove', 'Dieser Zug ist nicht erlaubt.');
        }
        return;
      }
      case 'resign': {
        const seat = this.seatOf(member.id);
        if (seat === null || this.phase !== 'playing') return deny();
        return this.game?.session.resign(seat);
      }
      case 'returnSeat': {
        const seat = this.seatOf(member.id);
        if (seat === null || this.phase !== 'playing') return deny();
        member.awayByDisconnect = false;
        return this.game?.session.returnSeat(seat);
      }
      case 'react':
      case 'say': {
        const allowed: readonly string[] = message.type === 'react' ? REACTIONS : PHRASES;
        const value = message.type === 'react' ? message.emoji : message.phrase;
        const now = this.deps.now();
        if (!allowed.includes(value)) return deny();
        const lastSignal = member.recentSignals.at(-1) ?? 0;
        if (now - lastSignal < SIGNAL_INTERVAL_MS) return;
        member.recentSignals = member.recentSignals.filter((t) => now - t < SIGNAL_WINDOW_MS);
        if (member.recentSignals.length >= SIGNAL_MAX_PER_WINDOW) return;
        member.recentSignals.push(now);
        return this.broadcast({ type: 'signal', from: member.id, kind: message.type, value });
      }
      case 'leave':
        for (const connection of member.connections) {
          this.deps.close(connection);
          this.connections.delete(connection);
        }
        return this.removeMember(member);
    }
  }

  // -------------------------------------------------------------------------
  // Turnierpartie

  /** Beide da und verbunden: Es geht ohne weiteren Klick los. */
  private startMatchIfComplete(connectionId: string): void {
    if (!this.match || this.phase !== 'lobby' || this.match.noShow) return;
    const seated = this.lobby.seats.map((seat) => (seat.kind === 'human' && seat.memberId ? this.members.get(seat.memberId) : undefined));
    if (seated.every((m) => m && m.disconnectedAt === null)) this.start(connectionId);
  }

  private tickMatch(now: number): void {
    if (this.phase === 'lobby' && !this.match!.noShow && now >= this.createdAt + MATCH_ARRIVAL_MS) {
      const arrived = this.lobby.seats.flatMap((seat, index) => (seat.kind === 'human' && seat.memberId ? [index as 0 | 1] : []));
      const seats = this.match!.config.tokens.length;
      const teams = this.match!.config.teams;
      const min = this.lobbyModule()?.info.players.min ?? 2;
      // Beide waren schon da, nur nie gleichzeitig: Dann entscheidet die Wartefrist in der Partie.
      // Am Tisch spielen die, die gekommen sind, wenn es für das Spiel reicht.
      if (arrived.length === seats || (!teams && seats > 2 && arrived.length >= min)) this.start('');
      else if (teams) {
        // Teams: Es spielt nur, wer vollzählig ist. Sonst gewinnt das Team mit mehr Anwesenden kampflos.
        const here = [0, 1].map((team) => arrived.filter((i) => teams[i] === team).length);
        this.match!.noShow = { kind: 'noShow', winner: here[0]! === here[1]! ? null : here[0]! > here[1]! ? 0 : 1 };
        this.broadcastRoom();
      } else if (seats > 2) {
        const rank = this.lobby.seats.map((_, i) => (arrived.includes(i as 0 | 1) ? 0 : 1));
        this.match!.noShow = { kind: 'placed', places: rank.map((v) => rank.filter((o) => o < v).length), walkover: true };
        this.broadcastRoom();
      } else {
        this.match!.noShow = { kind: 'noShow', winner: arrived[0] ?? null };
        this.broadcastRoom();
      }
    }
    const series = this.match!.series;
    if (series && series.nextAt !== null && series.winner === undefined && this.phase === 'finished' && now >= series.nextAt) {
      // Nächste Partie der Serie: Farben getauscht.
      series.nextAt = null;
      const [first, second] = this.lobby.seats;
      if (first && second) this.lobby.seats = [second, first, ...this.lobby.seats.slice(2)];
      this.start('');
      return;
    }
    if (this.phase !== 'playing') return;
    for (const member of this.members.values()) {
      const seat = this.seatOf(member.id);
      if (seat !== null && member.disconnectedAt !== null && now - member.disconnectedAt >= MATCH_AWAY_MS) {
        // Wer in einer Serie wegbleibt, verliert die ganze Begegnung.
        const side = this.match!.config.tokens.indexOf(member.token);
        if (this.match!.series && (side === 0 || side === 1)) forfeitSeries(this.match!.series, side);
        this.game?.session.resign(seat);
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Lobby und Partie

  private start(connectionId: string): void {
    const module = this.lobbyModule();
    if (!module) return this.error(connectionId, 'notAllowed', 'Bitte zuerst ein Spiel wählen.');
    this.seatQueued();
    // Freie Plätze bleiben weg, solange genug Spieler übrig sind – bei 30 Plätzen fürs Bingo muss
    // die Raumleitung so nicht genau abzählen, wer mitspielt. Bei Spielen mit laufendem Einstieg
    // (z. B. Poker) bleiben freie Plätze am Tisch erhalten, damit Nachzügler einsteigen können.
    const occupied = this.lobby.seats.filter((s) => s.kind === 'bot' || s.memberId !== null);
    if (occupied.length < module.info.players.min) {
      return this.error(connectionId, 'notAllowed', 'Es sind noch Plätze frei.');
    }
    if (occupied.filter((s) => s.kind === 'human').length < (module.info.minHumans ?? 1)) {
      return this.error(connectionId, 'notAllowed', `Dieses Spiel braucht mindestens ${module.info.minHumans} Menschen.`);
    }
    const seats = module.info.joinMidGame ? this.lobby.seats : occupied;
    const lobbyIndex = module.info.joinMidGame
      ? this.lobby.seats.map((_, i) => i)
      : this.lobby.seats.flatMap((s, i) => (s.kind === 'bot' || s.memberId !== null ? [i] : []));
    const emptyIndices = module.info.joinMidGame
      ? seats.map((s, i) => (s.kind === 'human' && s.memberId === null ? i : -1)).filter((i) => i >= 0)
      : [];
    this.clearAfter();
    if (this.game) {
      this.lastVersion = this.gameVersion();
      this.game.unsubscribe();
      this.game.session.dispose();
      this.game = null;
    }
    const publicSeats: PublicSeat[] = seats.map((seat) =>
      seat.kind === 'bot'
        ? { kind: 'bot', name: 'Computer', level: seat.level, memberId: null }
        : seat.memberId === null
          ? { kind: 'human', name: 'Frei', memberId: null }
          : { kind: 'human', name: this.members.get(seat.memberId)?.name ?? '?', avatar: this.members.get(seat.memberId)?.avatar, memberId: seat.memberId },
    );
    const teamCount = teamsFor(module.info, this.lobby.options, seats.length)?.count ?? 0;
    const teamOptions: Options = teamCount >= 2 ? { [TEAM_OPTION_ID]: seats.map((seat, i) => seat.team ?? i % teamCount).join(',') } : {};
    const resolvedOptions = resolveOptions(module, { ...this.lobby.options, ...teamOptions });
    const config: SessionConfig = {
      gameId: module.info.id,
      seats: publicSeats.map((seat) => (seat.kind === 'bot' ? { kind: 'bot', name: seat.name, level: seat.level } : { kind: 'human', name: seat.name, avatar: seat.avatar })),
      options: emptyIndices.length > 0 ? { ...resolvedOptions, emptySeats: emptyIndices.join(',') } : resolvedOptions,
      seed: this.deps.randomSeed(),
      time: timePresetsOf(module, this.lobby.options)[this.lobby.time],
    };
    const session = new LocalSession(module, config, this.sessionDeps());
    // Die Versionen zählen über Partien hinweg weiter, damit kein alter Zug in eine neue Partie rutscht.
    const versionOffset = this.lastVersion + 1;
    this.rounds++;
    this.attachGame({ module, session, seatMembers: publicSeats.map((s) => s.memberId), seats: publicSeats, lobbyIndex, time: this.lobby.time, round: this.rounds, versionOffset, unsubscribe: () => {} });
    for (const member of this.members.values()) member.awayByDisconnect = false;
    this.broadcastRoom();
    this.broadcastGame([]);
  }

  private attachGame(game: Game): void {
    this.game = game;
    game.seatMoved = game.seats.map(() => this.gameVersion());
    if (game.module.info.takeBack && !game.module.info.noUndo) game.takeBack ??= { pending: null, last: null, ownMoves: game.seats.map(() => 0), nextAllowed: game.seats.map(() => 0) };
    this.phase = game.session.result ? 'finished' : 'playing';
    game.unsubscribe = game.session.subscribe((change) => this.onSessionChange(change));
  }

  private onSessionChange(change: SessionChange): void {
    if (!this.game) return;
    const actor = change.entry?.actor;
    if (typeof actor === 'number' && this.game.seatMoved) this.game.seatMoved[actor] = this.gameVersion();
    const takeBack = this.game.takeBack;
    if (takeBack && change.entry) {
      // Der nächste Zug lässt den Hinweis auf die letzte Bitte verschwinden.
      takeBack.last = null;
      if (typeof actor === 'number' && change.entry.cause === 'player') takeBack.ownMoves[actor] = (takeBack.ownMoves[actor] ?? 0) + 1;
    }
    const finished = this.game.session.result !== null;
    if (finished && takeBack?.pending) takeBack.pending = null;
    if (this.muted) return;
    if (finished && this.phase === 'playing') {
      this.phase = 'finished';
      this.seriesGameOver();
      this.openAfter();
      this.broadcastRoom();
    }
    this.broadcastGame(change.events);
    this.deps.changed?.();
  }

  /**
   * Ein Zug mit älterer Version gilt trotzdem, wenn dieser Platz seitdem nicht gezogen hat –
   * etwa beim gleichzeitigen Aufstellen, wenn der andere zuerst fertig war. Ob der Zug jetzt
   * noch erlaubt ist, prüft danach die Spielleitung.
   */
  private stillValid(seat: SeatId, version: number): boolean {
    const moved = this.game?.seatMoved?.[seat];
    return moved !== undefined && version >= moved && version < this.gameVersion();
  }

  private gameVersion(): number {
    return this.game ? this.game.session.version + this.game.versionOffset : this.lastVersion;
  }

  private endGame(): void {
    this.clearAfter();
    this.lastVersion = this.gameVersion();
    if (this.game) {
      this.game.unsubscribe();
      this.game.session.dispose();
    }
    this.game = null;
    this.phase = 'lobby';
  }

  private sessionDeps() {
    return {
      botRunner: this.deps.botRunner,
      now: () => this.deps.now(),
      graceMs: CLOCK_GRACE_MS,
      botBudgetMs: this.deps.botBudgetMs,
      // Ein Bot hat einen Zug mit Bedenkpause geparkt: speichern lassen, damit der Wecker neu gestellt wird.
      deadlineChanged: () => this.deps.changed?.(),
    };
  }

  /** Die Teams, die für Spiel, Optionen und Platzzahl der Lobby gelten (Kreuzbinokel nur zu viert mit Option). */
  private lobbyTeams(): ReturnType<typeof teamsFor> {
    const module = this.lobbyModule();
    return module ? teamsFor(module.info, this.lobby.options, this.lobby.seats.length) : undefined;
  }

  private lobbyModule(): AnyGameModule | undefined {
    return this.lobby.gameId ? this.deps.findGame(this.lobby.gameId) : undefined;
  }

  /** Neue Platzzahl: vorhandene Plätze bleiben, neue sind offen für Menschen. */
  private resizeSeats(count: number): LobbySettings['seats'] {
    const seats = this.lobby.seats.slice(0, count);
    while (seats.length < count) seats.push({ kind: 'human', memberId: null });
    return seats;
  }

  /** Teamspiel: jedem Platz ein gültiges Team (sonst im Wechsel); sonst die Teamangaben entfernen. */
  private applyTeams(): void {
    const count = this.lobbyTeams()?.count ?? 0;
    this.lobby.seats.forEach((seat, index) => {
      if (count < 2) delete seat.team;
      else if (seat.team === undefined || seat.team >= count) seat.team = index % count;
    });
  }

  private unseat(memberId: string): void {
    for (const seat of this.lobby.seats) if (seat.kind === 'human' && seat.memberId === memberId) seat.memberId = null;
  }

  /**
   * Verteilt alle verbundenen Mitglieder ohne Platz auf die freien Plätze (ggf. wird die
   * Platzzahl bis zum Spielmaximum erhöht). Ideal für den Klassen-Modus, wenn viele
   * Schülerinnen und Schüler gleichzeitig per QR-Code beitreten.
   */
  private fillOpenSeats(): void {
    const module = this.lobbyModule();
    if (!module) return;
    const seated = new Set(this.lobby.seats.flatMap((s) => (s.kind === 'human' && s.memberId ? [s.memberId] : [])));
    const unseated = [...this.members.values()].filter((m) => m.disconnectedAt === null && !seated.has(m.id));
    if (unseated.length === 0) return;

    const maxSeats = Math.min(module.info.players.max, MAX_SEATS);
    let next = 0;
    for (const seat of this.lobby.seats) {
      if (next >= unseated.length) break;
      if (seat.kind === 'human' && seat.memberId === null) {
        seat.memberId = unseated[next++]!.id;
      }
    }
    while (next < unseated.length && this.lobby.seats.length < maxSeats) {
      this.lobby.seats.push({ kind: 'human', memberId: unseated[next++]!.id });
    }
  }

  private freeRunningSeat(seat: SeatId): void {
    if (!this.game) return;
    const memberId = this.game.seatMembers[seat];
    if (memberId) {
      const m = this.members.get(memberId);
      if (m) m.awayByDisconnect = false;
    }
    this.game.seatMembers[seat] = null;
    this.game.seats[seat] = { kind: 'human', name: 'Frei', memberId: null };
    if (this.lobby.seats[seat]?.kind === 'human') this.lobby.seats[seat] = { kind: 'human', memberId: null };
    this.game.session.leaveSeat(seat, 'Frei');
  }

  /**
   * Nimmt ein Mitglied in der laufenden Partie vom Platz. Bei Spielen mit laufendem Einstieg
   * wird der Platz frei; sonst spielt ein Bot weiter, bis jemand den Platz übernimmt.
   */
  private vacateSeat(seat: SeatId): void {
    const game = this.game;
    if (!game) return;
    if (game.module.info.joinMidGame && game.session.canLeaveSeat(seat)) return this.freeRunningSeat(seat);
    const memberId = game.seatMembers[seat];
    const m = memberId ? this.members.get(memberId) : undefined;
    if (m) m.awayByDisconnect = false;
    game.seatMembers[seat] = null;
    game.seats[seat] = { kind: 'human', name: 'Frei', memberId: null };
    const lobbyIndex = game.lobbyIndex?.[seat];
    const lobbySeat = lobbyIndex !== undefined ? this.lobby.seats[lobbyIndex] : undefined;
    if (lobbySeat?.kind === 'human') lobbySeat.memberId = null;
    // Schon abwesend (Verbindung weg): markAway meldet nichts, also selbst Bescheid geben.
    if (game.session.isAway(seat) || game.session.result) this.broadcastGame([]);
    else game.session.markAway(seat);
    this.settleTakeBack();
  }

  /** Ein freigegebener Platz, den ein Bot vertritt (nicht bei Spielen mit laufendem Einstieg über `leaveSeat`). */
  private isOrphaned(seat: number): boolean {
    const game = this.game;
    if (!game || game.session.result) return false;
    const publicSeat = game.seats[seat];
    return publicSeat?.kind === 'human' && publicSeat.memberId === null && game.seatMembers[seat] === null && game.session.isAway(seat);
  }

  /** Darf ein Mitglied seinen Namen selbst ändern? */
  private mayRename(member: Member): boolean {
    if (member.id === this.hostId) return true;
    return !member.nameFixed && !this.lobby.namesLocked;
  }

  /** Name und Bild am Platz der laufenden Partie nachziehen. */
  private syncSeatName(member: Member): void {
    const seat = this.seatOf(member.id);
    const publicSeat = seat !== null ? this.game?.seats[seat] : undefined;
    if (!publicSeat) return;
    publicSeat.name = member.name;
    publicSeat.avatar = member.avatar;
    this.broadcastGame([]);
  }

  private removeMember(member: Member): void {
    this.unseat(member.id);
    const seat = this.seatOf(member.id);
    if (seat !== null && this.phase === 'playing') this.vacateSeat(seat);
    else if (seat !== null && this.game) this.game.seatMembers[seat] = null;
    this.members.delete(member.id);
    this.tokens.delete(member.token);
    if (this.hostId === member.id) this.hostId = [...this.members.values()].find((m) => m.disconnectedAt === null)?.id ?? this.members.keys().next().value ?? null;
    this.broadcastRoom();
    this.settleTakeBack();
    if (this.after) {
      delete this.after.votes[member.id];
      delete this.after.proposals[member.id];
      delete this.after.picks[member.id];
      this.settleAfter();
    }
  }

  // -------------------------------------------------------------------------
  // Mitspielen ab der nächsten Runde (#299)

  /** Dürfen Zuschauer anfragen? Standard: in öffentlichen Räumen ja, in privaten nein. */
  private requestsOpen(): boolean {
    return !this.match && (this.lobby.acceptRequests ?? this.lobby.isPublic);
  }

  /** Läuft eine Partie, in der neue Spieler ab der nächsten Runde dazukommen können? Nicht bei fester Spielerzahl. */
  private joinOffered(): boolean {
    const module = this.game?.module;
    if (!module || this.phase === 'lobby' || !this.requestsOpen()) return false;
    // Poker u. a. lassen Neue schon mitten in der Partie an den Tisch (`joinSeat`).
    return !module.info.joinMidGame && module.info.players.max > module.info.players.min;
  }

  private answerJoin(target: Member, ok: boolean): void {
    if (ok) {
      target.join = 'queued';
      target.joinAt = this.deps.now();
      return;
    }
    delete target.join;
    delete target.joinAt;
    target.declinedUntil = this.deps.now() + JOIN_DENIED_MS;
    for (const connection of target.connections) this.deps.send(connection, { type: 'joinDenied' });
  }

  /**
   * Vorgemerkte bekommen der Reihe nach einen freien Platz, bei Bedarf werden neue geöffnet (bis zum Maximum des Spiels).
   * Wer keinen Platz findet, bleibt vorgemerkt (Warteliste).
   */
  private seatQueued(): void {
    const module = this.lobbyModule();
    if (!module || this.match) return;
    const cap = Math.min(module.info.players.max, MAX_SEATS);
    const queued = [...this.members.values()].filter((m) => m.join === 'queued').sort((a, b) => (a.joinAt ?? 0) - (b.joinAt ?? 0));
    for (const member of queued) {
      if (this.lobby.seats.some((s) => s.kind === 'human' && s.memberId === member.id)) {
        delete member.join;
        delete member.joinAt;
        continue;
      }
      if (member.disconnectedAt !== null) continue;
      let index = this.lobby.seats.findIndex((s) => s.kind === 'human' && s.memberId === null);
      if (index < 0 && this.lobby.seats.length < cap) {
        this.lobby.seats.push({ kind: 'human', memberId: null });
        index = this.lobby.seats.length - 1;
      }
      if (index < 0) break;
      this.lobby.seats[index] = { ...this.lobby.seats[index]!, kind: 'human', memberId: member.id };
      delete member.join;
      delete member.joinAt;
    }
    this.applyTeams();
  }

  // -------------------------------------------------------------------------
  // Rundenende: Nochmal, anderes Spiel oder Aussteigen (#298)

  /** Bei zwei besetzten Plätzen die Plätze tauschen (Revanche mit Farbwechsel). */
  private swapTwoSeats(): void {
    const activeSeats = this.lobby.seats.filter((s) => s.kind === 'bot' || s.memberId !== null);
    if (activeSeats.length !== 2) return;
    const firstIndex = this.lobby.seats.findIndex((s) => s.kind === 'bot' || s.memberId !== null);
    const secondIndex = this.lobby.seats.findIndex((s, i) => i > firstIndex && (s.kind === 'bot' || s.memberId !== null));
    if (firstIndex < 0 || secondIndex < 0) return;
    const temp = this.lobby.seats[firstIndex]!;
    this.lobby.seats[firstIndex] = this.lobby.seats[secondIndex]!;
    this.lobby.seats[secondIndex] = temp;
  }

  /** Stellt ein Spiel in der Lobby ein: Plätze bleiben, Optionen gehen auf die Standardwerte. */
  private applyGame(module: AnyGameModule): void {
    const { min, max } = module.info.players;
    // Bei Klassen-Simultanspielen (Bingo, Zielzahl, Rechenmauer) gleich 30 Plätze öffnen, bei Spielen mit laufendem Einstieg (Poker) 6 Plätze.
    const gameId = module.info.id;
    const isClassGame = gameId === 'bingo' || gameId === 'target-number' || gameId === 'number-wall';
    const defaultSeats = isClassGame ? Math.min(max, MAX_SEATS) : module.info.joinMidGame ? Math.min(max, 6) : min;
    const count = Math.min(Math.min(max, MAX_SEATS), Math.max(defaultSeats, this.lobby.seats.length));
    this.lobby = { ...this.lobby, gameId, options: resolveOptions(module), seats: this.resizeSeats(count) };
    this.applyTeams();
  }

  /** Menschen mit Platz in der Partie, die gerade verbunden sind – nur sie stimmen ab. */
  private afterVoters(): string[] {
    const ids = this.game?.seatMembers ?? [];
    const seated = ids.filter((id): id is string => id !== null && this.members.get(id)?.disconnectedAt === null);
    // Wer fürs nächste Mal vorgemerkt ist, spielt mit und stimmt mit ab (#299).
    const queued = [...this.members.values()].filter((m) => m.join === 'queued' && m.disconnectedAt === null).map((m) => m.id);
    return [...seated, ...queued];
  }

  /** Verbundene Vorgemerkte – sie bekommen in der nächsten Runde einen Platz. */
  private queuedCount(): number {
    return [...this.members.values()].filter((m) => m.join === 'queued' && m.disconnectedAt === null).length;
  }

  private openAfter(): void {
    if (this.match || !this.game || this.afterVoters().length < 2) return;
    this.after = { round: this.game.round, deadline: this.deps.now() + AFTER_GAME_MS, votes: {}, proposals: {}, picks: {} };
    this.broadcastAfter();
  }

  private clearAfter(): void {
    if (!this.after) return;
    this.after = null;
    this.broadcastAfter();
  }

  /** Darf dieses Spiel jetzt zur Wahl stehen? (Anderes Spiel, online angeboten, passt zu Plätzen und Menschen.) */
  private afterCandidateOk(gameId: string): boolean {
    const module = this.deps.findGame(gameId);
    if (!module || module.info.draft || gameId === this.game?.module.info.id) return false;
    const occupied = this.lobby.seats.filter((s) => s.kind === 'bot' || s.memberId !== null);
    const queued = this.queuedCount();
    const humans = occupied.filter((s) => s.kind === 'human').length + queued;
    const { min, max } = module.info.players;
    return occupied.length + queued >= min && occupied.length + queued <= max && humans >= (module.info.minHumans ?? 1);
  }

  private afterCandidates(after: AfterGameState): string[] {
    return [...new Set(Object.values(after.proposals))].filter((id) => this.afterCandidateOk(id));
  }

  private afterMessage(connectionId: string, member: Member, message: Extract<ClientMessage, { type: 'afterVote' | 'afterPropose' | 'afterPick' }>): void {
    const after = this.after;
    if (!after || !this.afterVoters().includes(member.id)) return this.error(connectionId, 'notAllowed', 'Gerade läuft keine Abstimmung für dich.');
    if (message.type === 'afterVote') {
      after.votes[member.id] = message.choice;
    } else if (message.type === 'afterPropose') {
      const candidates = this.afterCandidates(after);
      if (!this.afterCandidateOk(message.gameId)) return this.error(connectionId, 'notAllowed', 'Dieses Spiel passt gerade nicht.');
      if (!candidates.includes(message.gameId) && candidates.length >= AFTER_MAX_CANDIDATES && !Object.entries(after.proposals).some(([id, game]) => id === member.id && !Object.entries(after.proposals).some(([other, g]) => other !== id && g === game))) {
        return this.error(connectionId, 'notAllowed', 'Es stehen schon genug Spiele zur Wahl.');
      }
      after.proposals[member.id] = message.gameId;
      after.picks[member.id] = message.gameId;
      after.votes[member.id] = 'other';
    } else {
      if (message.gameId !== AFTER_RANDOM && !this.afterCandidates(after).includes(message.gameId)) return this.error(connectionId, 'notAllowed', 'Dieses Spiel steht nicht zur Wahl.');
      after.picks[member.id] = message.gameId;
      after.votes[member.id] = 'other';
    }
    this.settleAfter();
  }

  /** Entscheidet, sobald alle abgestimmt haben oder die Frist um ist; sonst schickt es den Zwischenstand. */
  private settleAfter(deadlineReached = false): void {
    const after = this.after;
    if (!after) return;
    const voters = this.afterVoters();
    const voted = voters.filter((id) => after.votes[id] !== undefined);
    if (voters.length === 0 || (deadlineReached && voted.length === 0)) return this.clearAfter();
    if (!deadlineReached && voted.length < voters.length) return this.broadcastAfter();
    const again = voted.filter((id) => after.votes[id] === 'again').length;
    const other = voted.length - again;
    // Gleichstand: Nochmal (die kleinste Änderung).
    if (other > again && this.resolveOtherGame(after, voted)) return;
    this.clearAfter();
    this.swapTwoSeats();
    this.start('');
  }

  /** Das gewählte andere Spiel einstellen und zurück in die Lobby. false, wenn keins zur Wahl steht. */
  private resolveOtherGame(after: AfterGameState, voted: string[]): boolean {
    const candidates = this.afterCandidates(after);
    const tally = new Map<string, number>();
    for (const id of voted) {
      const pick = after.votes[id] === 'other' ? after.picks[id] : undefined;
      if (pick && (pick === AFTER_RANDOM || candidates.includes(pick))) tally.set(pick, (tally.get(pick) ?? 0) + 1);
    }
    const best = Math.max(0, ...tally.values());
    const leaders = best > 0 ? [...tally].filter(([, n]) => n === best).map(([id]) => id) : candidates.length > 0 ? candidates : [AFTER_RANDOM];
    const random = this.deps.random ?? Math.random;
    let gameId = leaders[Math.floor(random() * leaders.length)] ?? AFTER_RANDOM;
    if (gameId === AFTER_RANDOM) {
      const pool = (this.deps.listGames?.() ?? []).map((m) => m.info.id).filter((id) => this.afterCandidateOk(id));
      const choice = pool[Math.floor(random() * pool.length)];
      if (choice === undefined) return false;
      gameId = choice;
    }
    const module = this.deps.findGame(gameId);
    if (!module) return false;
    // Besetzte Plätze rücken zusammen, damit beim kleineren Spiel niemand abgeschnitten wird.
    this.lobby.seats = this.lobby.seats.filter((s) => s.kind === 'bot' || s.memberId !== null);
    this.endGame();
    this.applyGame(module);
    this.seatQueued();
    this.broadcastRoom();
    return true;
  }

  private afterInfo(connectionId: string): AfterGameInfo | null {
    const after = this.after;
    if (!after) return null;
    const voters = this.afterVoters();
    const voted = voters.filter((id) => after.votes[id] !== undefined);
    const again = voted.filter((id) => after.votes[id] === 'again').length;
    const memberId = this.connections.get(connectionId);
    const canVote = Boolean(memberId && voters.includes(memberId));
    const candidates = this.afterCandidates(after).map((gameId) => ({ gameId, votes: voted.filter((id) => after.votes[id] === 'other' && after.picks[id] === gameId).length }));
    candidates.push({ gameId: AFTER_RANDOM, votes: voted.filter((id) => after.votes[id] === 'other' && after.picks[id] === AFTER_RANDOM).length });
    const choice = memberId ? after.votes[memberId] : undefined;
    const pick = memberId ? after.picks[memberId] : undefined;
    const proposed = memberId ? after.proposals[memberId] : undefined;
    const you = { ...(choice ? { choice } : {}), ...(pick ? { pick } : {}), ...(proposed ? { proposed } : {}) };
    return { round: after.round, deadline: after.deadline, serverNow: this.deps.now(), voters: voters.length, voted: voted.length, again, other: voted.length - again, candidates, ...(canVote ? { you } : {}), canVote };
  }

  private sendAfter(connectionId: string): void {
    this.deps.send(connectionId, { type: 'afterGame', after: this.afterInfo(connectionId) });
  }

  private broadcastAfter(): void {
    for (const [connection, memberId] of this.connections) if (memberId || this.displays.has(connection)) this.sendAfter(connection);
  }

  // -------------------------------------------------------------------------
  // Zurücknehmen mit Zustimmung

  /** Darf in dieser Partie überhaupt zurückgenommen werden? Nie in Turnierpartien, nie bei Spielen ohne `takeBack`. */
  private takeBackEnabled(): boolean {
    return Boolean(this.game?.takeBack) && !this.match && this.lobby.takeBack !== false && this.phase === 'playing';
  }

  /** Darf dieser Platz jetzt um das Zurücknehmen seines letzten Zuges bitten? */
  private canTakeBack(seat: SeatId): boolean {
    const game = this.game;
    const takeBack = game?.takeBack;
    if (!game || !takeBack || !this.takeBackEnabled() || takeBack.pending) return false;
    if ((takeBack.ownMoves[seat] ?? 0) < (takeBack.nextAllowed[seat] ?? 0)) return false;
    return game.session.canUndoSeat(seat);
  }

  /** Wer abstimmt: alle Plätze mit einem Mitglied außer der bittenden Person. Bots (auch für freigegebene Plätze) stimmen zu. */
  private takeBackVoters(): SeatId[] {
    const game = this.game;
    const pending = game?.takeBack?.pending;
    if (!game || !pending) return [];
    return game.seatMembers.flatMap((memberId, seat) => (memberId !== null && seat !== pending.seat ? [seat] : []));
  }

  private requestTakeBack(seat: SeatId): void {
    const game = this.game!;
    const takeBack = game.takeBack!;
    const log = game.session.log;
    let index = log.length - 1;
    while (index >= 0 && !(log[index]?.actor === seat && log[index]?.cause === 'player')) index--;
    const moves = log.slice(index).filter((entry) => entry.actor !== 'system').length;
    takeBack.nextAllowed[seat] = (takeBack.ownMoves[seat] ?? 0) + TAKE_BACK_GAP;
    takeBack.last = null;
    takeBack.pending = { seat, accepted: [], deadline: this.deps.now() + TAKE_BACK_MS, moves };
    // Während der Abstimmung ruht die Partie: keine Züge, keine Bots, die Uhren stehen.
    this.quietly(() => game.session.pause());
    if (!this.settleTakeBack()) this.broadcastGame([{ type: 'takeBack', status: 'pending', seat }]);
  }

  /** Prüft eine offene Bitte: alle zugestimmt, Frist vorbei oder bittende Person weg. true, wenn sie damit erledigt ist. */
  private settleTakeBack(): boolean {
    const game = this.game;
    const pending = game?.takeBack?.pending;
    if (!game || !pending) return false;
    if (game.session.result || game.seatMembers[pending.seat] === null) {
      game.takeBack!.pending = null;
      this.quietly(() => game.session.resume());
      this.broadcastGame([]);
      return true;
    }
    const voters = this.takeBackVoters();
    if (voters.every((seat) => pending.accepted.includes(seat))) {
      this.finishTakeBack('accepted');
      return true;
    }
    if (this.deps.now() >= pending.deadline) {
      this.finishTakeBack('expired');
      return true;
    }
    return false;
  }

  private finishTakeBack(status: 'accepted' | 'declined' | 'expired', by?: SeatId): void {
    const game = this.game!;
    const takeBack = game.takeBack!;
    const pending = takeBack.pending!;
    takeBack.pending = null;
    takeBack.last = { seat: pending.seat, status, moves: pending.moves, ...(by !== undefined ? { by } : {}) };
    // Noch pausiert zurücknehmen, dann weiter: So beginnt die Uhr der bittenden Person erst jetzt.
    const undone = this.quietly(() => (status === 'accepted' ? game.session.undoSeat(pending.seat) : false));
    this.quietly(() => game.session.resume());
    this.broadcastGame([...(undone ? [{ type: 'undo' }] : []), { type: 'takeBack', status, seat: pending.seat }]);
    this.deps.changed?.();
  }

  private quietly<T>(run: () => T): T {
    this.muted = true;
    try {
      return run();
    } finally {
      this.muted = false;
    }
  }

  /** Was ein Platz über die Bitte ums Zurücknehmen erfährt. */
  private takeBackInfo(): TakeBackInfo | null {
    const takeBack = this.game?.takeBack;
    if (!takeBack) return null;
    const pending = takeBack.pending;
    if (pending) {
      const voters = this.takeBackVoters();
      return { seat: pending.seat, status: 'pending', moves: pending.moves, accepted: [...pending.accepted], waiting: voters.filter((s) => !pending.accepted.includes(s)), deadline: pending.deadline };
    }
    const last = takeBack.last;
    return last ? { seat: last.seat, status: last.status, moves: last.moves, accepted: [], waiting: [], deadline: null, ...(last.by !== undefined ? { by: last.by } : {}) } : null;
  }

  /** Der Platz eines Mitglieds in der laufenden Partie oder null (Zuschauer). */
  private seatOf(memberId: string): SeatId | null {
    const index = this.game?.seatMembers.indexOf(memberId) ?? -1;
    return index >= 0 ? index : null;
  }

  // -------------------------------------------------------------------------
  // Senden

  private memberOf(connectionId: string): Member | undefined {
    const id = this.connections.get(connectionId);
    return id ? this.members.get(id) : undefined;
  }

  private roomMessage(): RoomMessage {
    const members: MemberInfo[] = [...this.members.values()].map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, ...(m.crest ? { crest: m.crest } : {}), connected: m.disconnectedAt === null, ...(m.nameFixed ? { nameFixed: true } : {}), ...(m.join ? { join: m.join } : {}) }));
    const series = this.match?.series;
    const match = this.match
      ? { tournament: this.match.config.tournament, label: this.match.config.label, noShow: this.match.noShow !== null, ...(series ? { series: { bestOf: series.bestOf, score: this.seriesScoreBySeat(series), next: series.nextAt, done: series.winner !== undefined } } : {}) }
      : undefined;
    return { type: 'room', code: this.code, phase: this.phase, hostId: this.hostId, members, lobby: this.lobby, ...(this.displays.size > 0 ? { displays: this.displays.size } : {}), ...(match ? { match } : {}) };
  }

  private broadcastRoom(): void {
    this.broadcast(this.roomMessage());
  }

  private broadcast(message: ServerMessage): void {
    for (const [connection, memberId] of this.connections) if (memberId || this.displays.has(connection)) this.deps.send(connection, message);
  }

  private broadcastGame(events: GameEvent[]): void {
    for (const connection of this.connections.keys()) this.sendGame(connection, events);
  }

  private sendGame(connectionId: string, events: GameEvent[]): void {
    if (!this.game) return;
    // Ein Tisch-Bildschirm sieht wie ein Zuschauer nur, was alle sehen.
    if (this.displays.has(connectionId)) return this.deps.send(connectionId, this.gameMessage(null, events));
    const member = this.memberOf(connectionId);
    if (!member) return;
    this.deps.send(connectionId, this.gameMessage(this.seatOf(member.id), events));
  }

  /** Was ein Platz von der Partie erfährt: nur seine Sicht, seine Züge und gefilterte Ereignisse. */
  private gameMessage(seat: SeatId | null, events: GameEvent[]): GameMessage {
    const { module, session, seats, time } = this.game!;
    const viewer = seat ?? 'spectator';
    const filtered = module.eventView ? events.map((e) => module.eventView!(e, viewer)).filter((e): e is GameEvent => e !== null) : events;
    const now = this.deps.now();
    const voting = Boolean(this.game!.takeBack?.pending);
    const clocks = seats.map((_, i) => session.clock(i));
    return {
      type: 'game',
      gameId: module.info.id,
      round: this.game!.round,
      version: this.gameVersion(),
      seats,
      options: session.config.options,
      time,
      yourSeat: seat,
      view: session.view(viewer),
      legalMoves: seat !== null && !session.isAway(seat) && !voting ? session.legalMoves(seat) : [],
      canResign: seat !== null && session.canResign(seat),
      canTakeBack: seat !== null && this.canTakeBack(seat),
      takeBack: this.takeBackInfo(),
      current: session.currentSeats(),
      away: seats.map((_, i) => i).filter((i) => session.isAway(i)),
      thinking: seats.map((_, i) => i).filter((i) => session.isThinking(i)),
      result: session.result,
      forfeit: session.forfeit,
      // Während der Abstimmung stehen die Uhren; der Browser soll sie nicht weiterzählen.
      clocks: voting ? clocks.map((clock) => ({ ...clock, running: false })) : clocks,
      serverNow: now,
      events: filtered,
      replay: this.replayFor(session),
    };
  }

  /** Nach Partieende dürfen alle im Raum Seed und Zugliste kennen (#99); vorher nie. */
  private replayFor(session: LocalSession): ReplayData | null {
    if (!session.result) return null;
    const data = session.replayData();
    return data && data.log.length <= REPLAY_MAX_STEPS ? data : null;
  }

  private error(connectionId: string, code: ErrorCode, message: string): void {
    this.deps.send(connectionId, { type: 'error', code, message });
  }

  private touch(): void {
    this.lastActivity = this.deps.now();
  }
}
