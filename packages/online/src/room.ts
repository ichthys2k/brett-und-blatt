import {
  LocalSession,
  resolveOptions,
  type AnyGameModule,
  type BotLevel,
  type BotRunner,
  type GameEvent,
  type SeatId,
  type SessionChange,
  type SessionConfig,
  type SessionSnapshot,
  timePresetsOf,
} from '@brett-und-blatt/engine';
import { cleanAvatar, cleanName } from './names';
import {
  MAX_SEATS,
  PHRASES,
  PROTOCOL_VERSION,
  REACTIONS,
  parseClientMessage,
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
} from './protocol';

/** Höchstens so viele Mitglieder (Spieler und Zuschauer) pro Raum. */
export const MAX_MEMBERS = 40;
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
}

interface Member {
  id: string;
  /** Geheime Kennung des Geräts. Geht nie an andere Mitglieder. */
  token: string;
  name: string;
  avatar: string;
  connections: Set<string>;
  /** Seit wann keine Verbindung mehr besteht (null: verbunden). */
  disconnectedAt: number | null;
  /** Hat der Raum den Platz wegen der fehlenden Verbindung einem Bot übergeben? */
  awayByDisconnect: boolean;
  /** Zeitstempel kürzlich gesendeter Signale zur Spam-Begrenzung. */
  recentSignals: number[];
}

interface Game {
  module: AnyGameModule;
  session: LocalSession;
  /** Welches Mitglied an welchem Platz sitzt (null bei Bots). */
  seatMembers: (string | null)[];
  seats: PublicSeat[];
  time: LobbySettings['time'];
  round: number;
  /** Damit die Versionsnummer nach einem Neustart des Servers weiterzählt statt bei 0 anzufangen. */
  versionOffset: number;
  /** Version nach dem letzten Zug je Platz (auch Bot- oder Zeitablauf-Zug für ihn); nicht gespeichert. */
  seatMoved?: number[];
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
  members: { id: string; token: string; name: string; avatar: string; awayByDisconnect: boolean; disconnectedAt: number | null }[];
  kicked: string[];
  nextMember: number;
  lastVersion: number;
  rounds: number;
  createdAt?: number;
  lastActivity: number;
  game: { session: SessionSnapshot; seatMembers: (string | null)[]; seats: PublicSeat[]; time: LobbySettings['time']; version: number; round: number } | null;
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
  private hostId: string | null = null;
  private phase: RoomPhase = 'lobby';
  private lobby: LobbySettings;
  private game: Game | null = null;
  private nextMember = 1;
  private lastVersion = 0;
  /** Wie viele Partien in diesem Raum schon begonnen haben. */
  private rounds = 0;
  private createdAt: number;
  private lastActivity: number;

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

  connect(connectionId: string): void {
    this.connections.set(connectionId, null);
    this.touch();
  }

  /** Nach einem Neustart des Servers: eine noch offene Verbindung wieder einem Mitglied zuordnen. */
  reattach(connectionId: string, memberId: string): void {
    const member = this.members.get(memberId);
    if (!member) return;
    this.connections.set(connectionId, memberId);
    member.connections.add(connectionId);
    member.disconnectedAt = null;
  }

  disconnect(connectionId: string): void {
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
    this.touch();
    const message = parseClientMessage(raw);
    if (!message) return this.error(connectionId, 'badMessage', 'Unbekannte Nachricht.');
    if (message.type === 'ping') return this.deps.send(connectionId, { type: 'pong', serverNow: this.deps.now() });
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
    if (this.phase !== 'lobby') return null;
    if (!this.lobby.gameId) return null;
    const module = this.deps.findGame(this.lobby.gameId);
    if (!module) return null;
    const openSeats = this.lobby.seats.filter((s) => s.kind === 'human' && s.memberId === null).length;
    if (openSeats === 0) return null;
    const hasConnected = [...this.members.values()].some((m) => m.disconnectedAt === null);
    if (!hasConnected) return null;
    const host = this.hostId ? this.members.get(this.hostId) : undefined;
    return {
      code: this.code,
      gameId: this.lobby.gameId,
      gameName: module.info.name,
      gameEmoji: module.info.emoji,
      hostName: host?.name ?? 'Anonym',
      hostAvatar: host?.avatar ?? '🎲',
      totalSeats: this.lobby.seats.length,
      filledSeats: this.lobby.seats.length - openSeats,
      createdAt: this.createdAt,
      updatedAt: this.lastActivity,
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
      members: [...this.members.values()].map(({ id, token, name, avatar, awayByDisconnect, disconnectedAt }) => ({ id, token, name, avatar, awayByDisconnect, disconnectedAt })),
      kicked: [...this.kicked],
      nextMember: this.nextMember,
      lastVersion: this.lastVersion,
      rounds: this.rounds,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      game: game ? { session: game.session.snapshot(), seatMembers: [...game.seatMembers], seats: game.seats, time: game.time, version: this.gameVersion(), round: game.round } : null,
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
    const now = deps.now();
    for (const m of snapshot.members) {
      // Wer schon vorher weg war, behält seinen Zeitpunkt – sonst begänne die Frist bei jedem
      // Aufwachen des Servers von vorn. Wer verbunden war, gilt bis zur Wiederzuordnung als weg.
      room.members.set(m.id, { ...m, connections: new Set(), disconnectedAt: m.disconnectedAt ?? now, recentSignals: [] });
      room.tokens.set(m.token, m.id);
    }
    const saved = snapshot.game;
    const module = saved ? deps.findGame(saved.session.config.gameId) : undefined;
    if (saved && module) {
      const session = LocalSession.restore(module, saved.session, room.sessionDeps(), { resumeClocks: true });
      room.attachGame({ module, session, seatMembers: saved.seatMembers, seats: saved.seats, time: saved.time, round: saved.round, versionOffset: saved.version - session.version, unsubscribe: () => {} });
    } else if (saved) {
      room.phase = 'lobby';
    }
    return room;
  }

  // -------------------------------------------------------------------------
  // Nachrichten

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
      if (this.members.size >= MAX_MEMBERS) {
        this.error(connectionId, 'roomFull', 'Der Raum ist voll.');
        return this.deps.close(connectionId);
      }
      member = {
        id: `m${this.nextMember++}`,
        token: message.token,
        name,
        avatar: cleanAvatar(message.avatar),
        connections: new Set(),
        disconnectedAt: null,
        awayByDisconnect: false,
        recentSignals: [],
      };
      this.members.set(member.id, member);
      this.tokens.set(member.token, member.id);
      this.hostId ??= member.id;
    } else {
      member.name = name;
      member.avatar = cleanAvatar(message.avatar);
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
    this.deps.changed?.();
  }

  private handle(connectionId: string, member: Member, message: ClientMessage): void {
    const isHost = member.id === this.hostId;
    const deny = () => this.error(connectionId, 'notAllowed', 'Das ist gerade nicht möglich.');
    switch (message.type) {
      case 'setName': {
        const name = cleanName(message.name);
        if (!name) return this.error(connectionId, 'badName', 'Bitte einen anderen Spitznamen wählen.');
        member.name = name;
        member.avatar = cleanAvatar(message.avatar);
        return this.broadcastRoom();
      }
      case 'setGame': {
        const module = this.deps.findGame(message.gameId);
        if (!isHost || this.phase !== 'lobby' || !module) return deny();
        const { min, max } = module.info.players;
        // Bei Bingo gleich 30 Plätze öffnen (freie Plätze fallen beim Start ohnehin weg), damit eine ganze Klasse sofort Platz nehmen kann.
        const defaultSeats = message.gameId === 'bingo' ? Math.min(max, MAX_SEATS) : min;
        const count = Math.min(Math.min(max, MAX_SEATS), Math.max(defaultSeats, this.lobby.seats.length));
        this.lobby = { gameId: message.gameId, options: resolveOptions(module), time: this.lobby.time, seats: this.resizeSeats(count), isPublic: this.lobby.isPublic };
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
        return this.broadcastRoom();
      }
      case 'setSeat': {
        if (!isHost || this.phase !== 'lobby' || message.index >= this.lobby.seats.length) return deny();
        this.lobby.seats[message.index] = message.seat === 'open' ? { kind: 'human', memberId: null } : { kind: 'bot', level: message.seat.bot };
        return this.broadcastRoom();
      }
      case 'takeSeat': {
        const seat = this.lobby.seats[message.index];
        if (this.phase !== 'lobby' || seat?.kind !== 'human' || seat.memberId !== null) return deny();
        this.unseat(member.id);
        seat.memberId = member.id;
        return this.broadcastRoom();
      }
      case 'leaveSeat':
        if (this.phase !== 'lobby') return deny();
        this.unseat(member.id);
        return this.broadcastRoom();
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
        const activeSeats = this.lobby.seats.filter((s) => s.kind === 'bot' || s.memberId !== null);
        if (message.rotate && activeSeats.length === 2) {
          const firstIndex = this.lobby.seats.findIndex((s) => s.kind === 'bot' || s.memberId !== null);
          const secondIndex = this.lobby.seats.findIndex((s, i) => i > firstIndex && (s.kind === 'bot' || s.memberId !== null));
          if (firstIndex >= 0 && secondIndex >= 0) {
            const temp = this.lobby.seats[firstIndex]!;
            this.lobby.seats[firstIndex] = this.lobby.seats[secondIndex]!;
            this.lobby.seats[secondIndex] = temp;
          }
        }
        return this.start(connectionId);
      }
      case 'toLobby':
        if (!isHost || this.phase === 'lobby') return deny();
        this.endGame();
        return this.broadcastRoom();
      case 'move': {
        const seat = this.seatOf(member.id);
        const session = this.game?.session;
        if (!session || seat === null) return deny();
        if (message.version !== this.gameVersion() && !this.stillValid(seat, message.version)) {
          this.error(connectionId, 'staleMove', 'Der Spielstand hat sich inzwischen geändert.');
          return this.sendGame(connectionId, []);
        }
        if (!session.submit(seat, message.move)) return this.error(connectionId, 'illegalMove', 'Dieser Zug ist nicht erlaubt.');
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
  // Lobby und Partie

  private start(connectionId: string): void {
    const module = this.lobbyModule();
    if (!module) return this.error(connectionId, 'notAllowed', 'Bitte zuerst ein Spiel wählen.');
    // Freie Plätze bleiben weg, solange genug Spieler übrig sind – bei 30 Plätzen fürs Bingo muss
    // die Raumleitung so nicht genau abzählen, wer mitspielt.
    const seats = this.lobby.seats.filter((s) => s.kind === 'bot' || s.memberId !== null);
    if (seats.length < module.info.players.min) {
      return this.error(connectionId, 'notAllowed', 'Es sind noch Plätze frei.');
    }
    if (this.game) {
      this.lastVersion = this.gameVersion();
      this.game.unsubscribe();
      this.game.session.dispose();
      this.game = null;
    }
    const publicSeats: PublicSeat[] = seats.map((seat) =>
      seat.kind === 'bot'
        ? { kind: 'bot', name: 'Computer', level: seat.level, memberId: null }
        : { kind: 'human', name: this.members.get(seat.memberId ?? '')?.name ?? '?', memberId: seat.memberId },
    );
    const config: SessionConfig = {
      gameId: module.info.id,
      seats: publicSeats.map((seat) => (seat.kind === 'bot' ? { kind: 'bot', name: seat.name, level: seat.level } : { kind: 'human', name: seat.name })),
      options: resolveOptions(module, this.lobby.options),
      seed: this.deps.randomSeed(),
      time: timePresetsOf(module, this.lobby.options)[this.lobby.time],
    };
    const session = new LocalSession(module, config, this.sessionDeps());
    // Die Versionen zählen über Partien hinweg weiter, damit kein alter Zug in eine neue Partie rutscht.
    const versionOffset = this.lastVersion + 1;
    this.rounds++;
    this.attachGame({ module, session, seatMembers: publicSeats.map((s) => s.memberId), seats: publicSeats, time: this.lobby.time, round: this.rounds, versionOffset, unsubscribe: () => {} });
    for (const member of this.members.values()) member.awayByDisconnect = false;
    this.broadcastRoom();
    this.broadcastGame([]);
  }

  private attachGame(game: Game): void {
    this.game = game;
    game.seatMoved = game.seats.map(() => this.gameVersion());
    this.phase = game.session.result ? 'finished' : 'playing';
    game.unsubscribe = game.session.subscribe((change) => this.onSessionChange(change));
  }

  private onSessionChange(change: SessionChange): void {
    if (!this.game) return;
    const actor = change.entry?.actor;
    if (typeof actor === 'number' && this.game.seatMoved) this.game.seatMoved[actor] = this.gameVersion();
    const finished = this.game.session.result !== null;
    if (finished && this.phase === 'playing') {
      this.phase = 'finished';
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

  private lobbyModule(): AnyGameModule | undefined {
    return this.lobby.gameId ? this.deps.findGame(this.lobby.gameId) : undefined;
  }

  /** Neue Platzzahl: vorhandene Plätze bleiben, neue sind offen für Menschen. */
  private resizeSeats(count: number): LobbySettings['seats'] {
    const seats = this.lobby.seats.slice(0, count);
    while (seats.length < count) seats.push({ kind: 'human', memberId: null });
    return seats;
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

  private removeMember(member: Member): void {
    this.unseat(member.id);
    const seat = this.seatOf(member.id);
    if (seat !== null && this.phase === 'playing') this.game?.session.markAway(seat);
    this.members.delete(member.id);
    this.tokens.delete(member.token);
    if (this.hostId === member.id) this.hostId = [...this.members.values()].find((m) => m.disconnectedAt === null)?.id ?? this.members.keys().next().value ?? null;
    this.broadcastRoom();
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
    const members: MemberInfo[] = [...this.members.values()].map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, connected: m.disconnectedAt === null }));
    return { type: 'room', code: this.code, phase: this.phase, hostId: this.hostId, members, lobby: this.lobby };
  }

  private broadcastRoom(): void {
    this.broadcast(this.roomMessage());
  }

  private broadcast(message: ServerMessage): void {
    for (const [connection, memberId] of this.connections) if (memberId) this.deps.send(connection, message);
  }

  private broadcastGame(events: GameEvent[]): void {
    for (const connection of this.connections.keys()) this.sendGame(connection, events);
  }

  private sendGame(connectionId: string, events: GameEvent[]): void {
    const member = this.memberOf(connectionId);
    if (!member || !this.game) return;
    this.deps.send(connectionId, this.gameMessage(this.seatOf(member.id), events));
  }

  /** Was ein Platz von der Partie erfährt: nur seine Sicht, seine Züge und gefilterte Ereignisse. */
  private gameMessage(seat: SeatId | null, events: GameEvent[]): GameMessage {
    const { module, session, seats, time } = this.game!;
    const viewer = seat ?? 'spectator';
    const filtered = module.eventView ? events.map((e) => module.eventView!(e, viewer)).filter((e): e is GameEvent => e !== null) : events;
    const now = this.deps.now();
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
      legalMoves: seat !== null && !session.isAway(seat) ? session.legalMoves(seat) : [],
      canResign: seat !== null && session.canResign(seat),
      current: session.currentSeats(),
      away: seats.map((_, i) => i).filter((i) => session.isAway(i)),
      thinking: seats.map((_, i) => i).filter((i) => session.isThinking(i)),
      result: session.result,
      forfeit: session.forfeit,
      clocks: seats.map((_, i) => session.clock(i)),
      serverNow: now,
      events: filtered,
    };
  }

  private error(connectionId: string, code: ErrorCode, message: string): void {
    this.deps.send(connectionId, { type: 'error', code, message });
  }

  private touch(): void {
    this.lastActivity = this.deps.now();
  }
}
