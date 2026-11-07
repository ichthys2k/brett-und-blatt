import { OPEN_ROOM_REFRESH_MS } from './lobby';
import { cleanAvatar, cleanName } from './names';
import type { OpenRoomListing } from './protocol';
import { FORMATS, type FormatContext, type TournamentFormatRules } from './tournament/formats';
import { upgradeSnapshot, type StoredTournamentSnapshot } from './tournament/migrate';
import { deadlineOutcome, dueAt, roomRequest, setReady, sideOfSeat, type MatchRoomRequest, type RoomReport } from './tournament/online-play';
import { seededShuffle } from './tournament/pairing';
import { defaultScoring, standings } from './tournament/scoring';
import {
  DAY_MS,
  TOURNAMENT_MAX_PLAYERS,
  TOURNAMENT_KEEP_MS,
  type MatchOutcome,
  type MatchSide,
  type MatchSlot,
  type MatchStatus,
  type SlotSource,
  type StandingRow,
  type TournamentMatch,
  type TournamentPhase,
  type TournamentPlayer,
  type TournamentSettings,
  type TournamentSnapshot,
  type TournamentView,
} from './tournament/types';

export * from './tournament/types';
export * from './tournament/pairing';
export * from './tournament/scoring';
export * from './tournament/formats';
export * from './tournament/online-play';
export * from './tournament/migrate';
export * from './tournament/protocol';

/**
 * Turniere (W-053) ohne Anbieterbindung: Einschreibung, Auslosung, Tabellen, Baum und
 * Stichtage. Der Cloudflare-Adapter hält ein `Tournament` in einem Durable Object, legt
 * für jede Partie einen normalen Spielraum an und meldet das Ergebnis zurück.
 *
 * Aufgeteilt (W-058 Stufe 0): Formen in `tournament/formats.ts`, Wertung in `scoring.ts`,
 * Austragung online in `online-play.ts`; diese Klasse hält Zustand, Rollen, Fristen und Sichten.
 */

export interface TournamentDeps {
  now(): number;
  /** Zufallscode für die Neuausstellung durch die Leitung. */
  randomClaim(): string;
  /** Der veröffentlichte Regelstand eines Spiels. */
  ruleVersion?(gameId: string): number | undefined;
}

export class Tournament {
  private constructor(
    private s: TournamentSnapshot,
    private deps: TournamentDeps,
  ) {}

  static create(code: string, seed: string, settings: TournamentSettings, leader: { token: string; name: string }, deps: TournamentDeps): Tournament {
    const now = deps.now();
    return new Tournament(
      {
        version: 2,
        code,
        seed,
        settings,
        scoring: defaultScoring(settings.format),
        leaderToken: leader.token,
        leaderName: cleanName(leader.name) ?? 'Leitung',
        phase: 'signup',
        players: [],
        nextPlayer: 1,
        groups: [],
        stages: [],
        matches: [],
        claims: {},
        createdAt: now,
        lastActivity: now,
        finishedAt: null,
      },
      deps,
    );
  }

  /** Stellt ein gespeichertes Turnier wieder her; ältere Schnappschüsse werden dabei umgeschrieben. */
  static restore(snapshot: StoredTournamentSnapshot, deps: TournamentDeps): Tournament {
    return new Tournament(upgradeSnapshot(snapshot), deps);
  }

  /** Die Form dieses Turniers. */
  private get format(): TournamentFormatRules {
    return FORMATS[this.s.settings.format];
  }

  /** Was die Formen vom Turnier sehen dürfen. */
  private get ctx(): FormatContext {
    return {
      s: this.s,
      now: () => this.deps.now(),
      newMatch: (id, stage, group, slots, status) => this.newMatch(id, stage, group, slots, status),
      match: (id) => this.match(id),
      groupTable: (group) => this.groupTable(group),
      groupSettled: (group) => this.groupSettled(group),
      overallTable: () => this.overallTable(),
      isWithdrawn: (id) => this.isWithdrawn(id),
    };
  }

  snapshot(): TournamentSnapshot {
    return this.s;
  }

  get phase(): TournamentPhase {
    return this.s.phase;
  }

  get name(): string {
    return this.s.settings.name;
  }

  /** Darf diese Kennung die Turnierseite sehen? In der Einschreibung jeder mit dem Link. */
  maySee(token: string): boolean {
    return this.s.phase === 'signup' || token === this.s.leaderToken || this.playerByToken(token) !== undefined;
  }

  isLeader(token: string): boolean {
    return token === this.s.leaderToken;
  }

  /** Name und Bild beim Wiederkommen nachziehen. Sagt, ob sich etwas geändert hat. */
  greet(token: string, name: string, avatar: string): boolean {
    const player = this.playerByToken(token);
    const clean = cleanName(name);
    if (!player || !clean) return false;
    const nextAvatar = cleanAvatar(avatar);
    if (player.name === clean && player.avatar === nextAvatar) return false;
    player.name = clean;
    player.avatar = nextAvatar;
    return true;
  }

  // -------------------------------------------------------------------------
  // Handlungen. Ein Text bedeutet: abgelehnt, mit dieser Begründung.

  join(token: string, name: string, avatar: string): string | null {
    if (this.s.phase !== 'signup') return 'Die Einschreibung ist beendet.';
    if (this.playerByToken(token)) return null;
    if (this.s.players.length >= TOURNAMENT_MAX_PLAYERS) return 'Das Turnier ist voll.';
    const clean = cleanName(name);
    if (!clean) return 'Bitte einen anderen Spitznamen wählen.';
    this.s.players.push({ id: `p${this.s.nextPlayer++}`, token, name: clean, avatar: cleanAvatar(avatar), withdrawn: false });
    this.touch();
    return null;
  }

  leave(token: string): string | null {
    if (this.s.phase !== 'signup') return 'Das Turnier läuft schon. Die Leitung kann dich zurückziehen.';
    this.s.players = this.s.players.filter((p) => p.token !== token);
    this.touch();
    return null;
  }

  /** Neues Gerät über den Einmalcode der Leitung: Die Kennung wechselt, das alte Gerät ist draußen. */
  claim(token: string, code: string): string | null {
    const playerId = Object.keys(this.s.claims).find((id) => this.s.claims[id] === code.trim().toUpperCase());
    const player = this.s.players.find((p) => p.id === playerId);
    if (!player) return 'Dieser Code passt nicht.';
    if (this.playerByToken(token)) return 'Du bist in diesem Turnier schon eingeschrieben.';
    player.token = token;
    delete this.s.claims[player.id];
    this.touch();
    return null;
  }

  start(token: string): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    if (this.s.phase !== 'signup') return 'Das Turnier läuft schon.';
    const { days } = this.s.settings;
    const { minPlayers } = this.format;
    if (this.s.players.length < minPlayers) return `Es braucht mindestens ${minPlayers} Spieler.`;
    const now = this.deps.now();
    const deadline = (index: number) => now + (index + 1) * days * DAY_MS;
    const ids = seededShuffle(this.s.players.map((p) => p.id), `${this.s.seed}/auslosung`);
    this.format.setup(this.ctx, ids, deadline);
    const ruleVersion = this.deps.ruleVersion?.(this.s.settings.gameId);
    if (ruleVersion !== undefined) this.s.ruleVersion = ruleVersion;
    this.s.phase = 'running';
    this.settle();
    this.touch();
    return null;
  }

  ready(token: string, matchId: string, ready: boolean): string | null {
    const match = this.match(matchId);
    const side = match?.slots.findIndex((slot) => slot.player === this.playerByToken(token)?.id) ?? -1;
    if (!match || side < 0) return 'Das ist nicht deine Partie.';
    const error = setReady(this.s, match, side as MatchSide, ready, this.deps.now());
    if (error) return error;
    this.touch();
    return null;
  }

  /** Aufträge für Spielräume: Partien, die laufen sollen und noch keinen Raum haben. */
  pendingRooms(): MatchRoomRequest[] {
    return this.s.matches.flatMap((m) => roomRequest(this.s, m) ?? []);
  }

  roomCreated(matchId: string, code: string): void {
    const match = this.match(matchId);
    if (match?.status === 'running' && !match.roomCode) {
      match.roomCode = code;
      this.touch();
    }
  }

  /** Ergebnis aus einem Spielraum. Veraltete Meldungen (anderer Raum) zählen nicht. */
  report(matchId: string, roomCode: string, report: RoomReport): boolean {
    const match = this.match(matchId);
    if (!match || match.status !== 'running' || match.roomCode !== roomCode) return false;
    const winner = sideOfSeat(match, report.winner);
    if (report.kind === 'noShow') {
      if (winner === null) this.reopen(match);
      else this.decide(match, { winner, draw: false, walkover: true });
    } else if (winner !== null) {
      this.decide(match, { winner, draw: false, walkover: false });
    } else if (this.needsWinner(match)) {
      // K.-o. braucht einen Sieger: neu ansetzen, Farben getauscht, schnelle Zeit.
      match.replays++;
      this.reopen(match);
    } else {
      this.decide(match, { winner: null, draw: true, walkover: false });
    }
    this.settle();
    this.touch();
    return true;
  }

  setResult(token: string, matchId: string, winner: MatchSide | 'draw' | 'none'): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    const match = this.match(matchId);
    if (!match || match.status === 'waiting') return 'Diese Partie steht noch nicht fest.';
    if (!this.mayChange(match)) return 'Daran hängen schon weitere Partien.';
    if (winner === 'draw' && this.needsWinner(match)) return 'Im K.-o.-Spiel braucht es einen Sieger.';
    match.status = 'open';
    match.roomCode = null;
    this.decide(match, winner === 'draw' ? { winner: null, draw: true, walkover: false, byLeader: true } : winner === 'none' ? { winner: null, draw: false, walkover: true, byLeader: true } : { winner, draw: false, walkover: true, byLeader: true });
    this.settle();
    this.touch();
    return null;
  }

  extend(token: string, days: number): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    if (this.s.phase !== 'running') return 'Das Turnier läuft nicht.';
    const current = this.currentStage();
    this.s.stages.forEach((stage, index) => {
      if (index >= current) stage.deadline += days * DAY_MS;
    });
    this.touch();
    return null;
  }

  /** Rückzug: Offene Partien gehen kampflos an den Gegner, gespielte bleiben stehen. */
  withdraw(token: string, playerId: string): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    const player = this.s.players.find((p) => p.id === playerId);
    if (!player || this.s.phase !== 'running') return 'Das geht gerade nicht.';
    player.withdrawn = true;
    this.settle();
    this.touch();
    return null;
  }

  /** Einmalcode für ein neues Gerät eines Spielers. */
  reissue(token: string, playerId: string): { code: string } | { error: string } {
    if (!this.isLeader(token)) return { error: 'Das darf nur die Leitung.' };
    if (!this.s.players.some((p) => p.id === playerId)) return { error: 'Diesen Spieler gibt es nicht.' };
    const code = this.deps.randomClaim();
    this.s.claims[playerId] = code;
    this.touch();
    return { code };
  }

  // -------------------------------------------------------------------------
  // Zeit

  /** Erledigt fällige Stichtage und räumt ab. Sagt, ob sich etwas geändert hat. */
  tick(): boolean {
    if (this.s.phase !== 'running') return false;
    const before = JSON.stringify(this.s.matches);
    this.settle();
    const changed = before !== JSON.stringify(this.s.matches);
    if (changed) this.touch();
    return changed;
  }

  /** Wann `tick` wieder etwas tun kann, oder wann das Turnier gelöscht wird. */
  nextWakeup(): number {
    const times = [this.expiresAt()];
    for (const match of this.s.matches) if (match.status === 'open') times.push(dueAt(this.s, match));
    // Die Ausschreibung muss sich regelmäßig neu melden, sonst fällt sie aus der Liste.
    if (this.publicListing()) times.push(this.deps.now() + OPEN_ROOM_REFRESH_MS);
    return Math.min(...times);
  }

  /** Karte für „Offene Runden“: nur öffentlich und nur, solange man sich einschreiben kann. */
  publicListing(): OpenRoomListing | null {
    if (this.s.phase !== 'signup' || this.s.settings.isPublic === false) return null;
    return {
      code: this.s.code,
      gameId: this.s.settings.gameId,
      gameName: this.s.settings.name,
      gameEmoji: '🏆',
      hostName: this.s.leaderName,
      hostAvatar: '🏆',
      totalSeats: TOURNAMENT_MAX_PLAYERS,
      filledSeats: this.s.players.length,
      createdAt: this.s.createdAt,
      updatedAt: this.deps.now(),
      tournament: true,
    };
  }

  /** Ab dann darf das Turnier samt allen Daten verschwinden. */
  expiresAt(): number {
    return (this.s.finishedAt ?? this.s.lastActivity) + TOURNAMENT_KEEP_MS;
  }

  // -------------------------------------------------------------------------
  // Sicht

  view(token: string | null): TournamentView {
    const s = this.s;
    const you = token ? (this.playerByToken(token)?.id ?? null) : null;
    return {
      code: s.code,
      settings: s.settings,
      leaderName: s.leaderName,
      phase: s.phase,
      players: s.players.map(({ id, name, avatar, withdrawn }) => ({ id, name, avatar, withdrawn })),
      groups: s.groups.map((players, group) => ({ players, table: this.groupTable(group), settled: this.groupSettled(group) })),
      swissTable: s.settings.format === 'swiss' && s.phase !== 'signup' ? this.overallTable() : [],
      stages: s.stages,
      currentStage: this.currentStage(),
      matches: s.matches.map(({ everReady: _hidden, ...match }) => match),
      podium: this.podium(),
      you,
      isLeader: token !== null && this.isLeader(token),
      rulesChanged: s.ruleVersion !== undefined && s.phase === 'running' && this.deps.ruleVersion?.(s.settings.gameId) !== s.ruleVersion,
      serverNow: this.deps.now(),
    };
  }

  // -------------------------------------------------------------------------
  // Aufbau

  private newMatch(id: string, stage: number, group: number | null, slots: [MatchSlot, MatchSlot], status: MatchStatus): TournamentMatch {
    return { id, stage, group, slots, status, openedAt: status === 'open' ? this.deps.now() : null, readyAt: [null, null], everReady: [false, false], roomCode: null, replays: 0, outcome: null };
  }

  // -------------------------------------------------------------------------
  // Fortschritt

  /**
   * Bringt alles auf den Stand: Rückzüge, Stichtage, Gruppen in den Baum, Sieger weiter,
   * nächste Schweizer Runde, Turnierende. Läuft, bis sich nichts mehr bewegt, weil eine
   * kampflose Partie die nächste auslösen kann.
   */
  private settle(): void {
    const now = this.deps.now();
    for (let pass = 0; pass < 200; pass++) {
      let moved = false;
      for (const match of this.s.matches) {
        if (match.status !== 'open') continue;
        const gone = match.slots.map((slot) => slot.player === null || this.s.players.find((p) => p.id === slot.player)?.withdrawn === true);
        if (gone[0] || gone[1]) {
          // Ein leerer Platz ist ein Freilos, ein Rückzug kampflos.
          const bye = match.slots.some((slot) => slot.player === null);
          this.decide(match, { winner: gone[0] && gone[1] ? null : gone[0] ? 1 : 0, draw: false, walkover: true, ...(bye ? { bye } : {}) });
          moved = true;
        } else if (now >= dueAt(this.s, match)) {
          this.decide(match, deadlineOutcome(match));
          moved = true;
        }
      }
      if (this.fillBracket()) moved = true;
      if (this.format.advance(this.ctx)) moved = true;
      if (!moved) break;
    }
    this.checkFinished();
  }

  private fillBracket(): boolean {
    let moved = false;
    for (const match of this.s.matches) {
      if (match.status !== 'waiting') continue;
      let known = true;
      for (const slot of match.slots) {
        const source = slot.from;
        if (!source) continue;
        const resolved = this.resolveSource(source);
        if (resolved === undefined) known = false;
        else slot.player = resolved;
      }
      if (known) {
        match.status = 'open';
        match.openedAt = this.deps.now();
        moved = true;
      }
    }
    return moved;
  }

  /** Der Spieler einer Herkunft; null: niemand kam weiter; undefined: noch nicht entschieden. */
  private resolveSource(source: SlotSource): string | null | undefined {
    if (source.kind === 'groupPlace') {
      if (!this.groupSettled(source.group)) return undefined;
      return this.groupTable(source.group).filter((row) => !this.isWithdrawn(row.player))[source.place]?.player ?? null;
    }
    const match = this.match(source.match);
    if (!match?.outcome) return undefined;
    const { winner } = match.outcome;
    if (winner === null) return null;
    return match.slots[source.kind === 'winner' ? winner : 1 - winner]!.player;
  }

  private checkFinished(): void {
    if (this.s.phase !== 'running') return;
    const allDone = this.s.matches.every((m) => m.outcome);
    if (allDone && !this.format.moreRounds(this.ctx)) {
      this.s.phase = 'finished';
      this.s.finishedAt = this.deps.now();
    }
  }

  private decide(match: TournamentMatch, outcome: MatchOutcome): void {
    match.outcome = outcome;
    match.status = 'done';
    match.finishedAt = this.deps.now();
    match.readyAt = [null, null];
  }

  private reopen(match: TournamentMatch): void {
    match.status = 'open';
    match.roomCode = null;
    match.readyAt = [null, null];
    match.openedAt = this.deps.now();
  }

  /** Ein festgelegtes Ergebnis darf nichts umstoßen, woran schon andere Partien hängen. */
  private mayChange(match: TournamentMatch): boolean {
    return match.status !== 'done' || this.format.mayChangeDone(this.ctx, match);
  }

  private needsWinner(match: TournamentMatch): boolean {
    return this.format.needsWinner(this.ctx, match);
  }

  private currentStage(): number {
    const open = this.s.matches.find((m) => !m.outcome);
    return open ? open.stage : Math.max(0, this.s.stages.length - 1);
  }

  private groupMatches(group: number): TournamentMatch[] {
    return this.s.matches.filter((m) => m.group === group);
  }

  private groupSettled(group: number): boolean {
    const matches = this.groupMatches(group);
    return matches.length > 0 && matches.every((m) => m.outcome);
  }

  private groupTable(group: number): StandingRow[] {
    return standings(this.s.groups[group] ?? [], this.groupMatches(group), this.s.seed, this.s.scoring);
  }

  private overallTable(): StandingRow[] {
    return standings(this.s.players.map((p) => p.id), this.s.matches, this.s.seed, this.s.scoring);
  }

  private podium(): string[] {
    return this.s.phase === 'finished' ? this.format.podium(this.ctx) : [];
  }

  private match(id: string): TournamentMatch | undefined {
    return this.s.matches.find((m) => m.id === id);
  }

  private playerByToken(token: string): TournamentPlayer | undefined {
    return this.s.players.find((p) => p.token === token);
  }

  private isWithdrawn(id: string): boolean {
    return this.s.players.find((p) => p.id === id)?.withdrawn === true;
  }

  private touch(): void {
    this.s.lastActivity = this.deps.now();
  }
}
