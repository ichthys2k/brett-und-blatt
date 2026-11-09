import { OPEN_ROOM_REFRESH_MS } from './lobby';
import { AVATARS } from './avatars';
import { cleanAvatar, cleanName } from './names';
import type { OpenRoomListing } from './protocol';
import { FORMATS, placementRanking, type FormatContext, type TournamentFormatRules } from './tournament/formats';
import { upgradeSnapshot, type StoredTournamentSnapshot } from './tournament/migrate';
import { SCHEDULE_MAX_MINUTES, assignFields, isLocal, outcomeFromEntry, plannedStarts, type ResultEntry } from './tournament/local-play';
import type { PointRules } from './tournament/protocol';
import { deadlineOutcome, dueAt, roomRequest, setReady, sideOfSeat, type MatchRoomRequest, type RoomReport } from './tournament/online-play';
import { TABLE_SIZE_MAX, TABLE_SIZE_MIN, autoStartTables, decideTable, isTables, rerank, setTableReady, tableDeadlinePlaces, tableRoomRequest, tableSizes, tableStandings, validPlaces, placesFromScores } from './tournament/table-rounds';
import { chooseDisciplines, disciplineOf, hasDisciplines, setWishes, wishCounts } from './tournament/disciplines';
import { bestOfStage, checkSeriesScore } from './tournament/best-of';
import { autoStart, isEvening, isHeld, startStage, startableStage } from './tournament/evening';
import { seededShuffle } from './tournament/pairing';
import { formTeams, isTeamed, ownsToken } from './tournament/teams';
import { isLives, livesRows } from './tournament/lives';
import { dypRows, isDyp } from './tournament/dyp';
import { defaultScoring, standings } from './tournament/scoring';
import {
  DAY_MS,
  ENTRANT_NAME_LENGTH,
  HELPER_MAX_DEVICES,
  TOURNAMENT_MAX_HELPERS,
  type HelperRole,
  type TournamentSchedule,
  type TournamentHelper,
  LEAGUE_KEEP_MS,
  TOURNAMENT_MAX_FIELDS,
  TOURNAMENT_MAX_PLAYERS,
  TOURNAMENT_KEEP_MS,
  type MatchOutcome,
  type MatchScore,
  type MatchSide,
  type MatchSlot,
  type MatchStatus,
  type SlotSource,
  type StandingRow,
  type TableGame,
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
export * from './tournament/local-play';
export * from './tournament/evening';
export * from './tournament/disciplines';
export * from './tournament/table-rounds';
export * from './tournament/best-of';
export * from './tournament/teams';
export * from './tournament/lives';
export * from './tournament/dyp';
export * from './tournament/migrate';
export * from './tournament/protocol';

/**
 * Turniere (W-053) ohne Anbieterbindung: Einschreibung, Auslosung, Tabellen, Baum und
 * Stichtage. Der Cloudflare-Adapter hält ein `Tournament` in einem Durable Object, legt
 * für jede Partie einen normalen Spielraum an und meldet das Ergebnis zurück.
 *
 * Aufgeteilt (W-058 Stufe 0): Formen in `tournament/formats.ts`, Wertung in `scoring.ts`,
 * Austragung online in `online-play.ts`, vor Ort in `local-play.ts` (Stufe 1); diese Klasse hält Zustand, Rollen, Fristen und Sichten.
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

  static create(code: string, seed: string, settings: TournamentSettings, leader: { token: string; name: string }, deps: TournamentDeps, fields = 0, points?: PointRules): Tournament {
    const now = deps.now();
    const local = settings.mode === 'local';
    // Mit Spielstand: vor Ort Tore/Sätze/Punkte, sonst bei „Best of N“ die gewonnenen Partien.
    const withScore = (local && settings.result !== undefined && settings.result !== 'winner') || (settings.bestOf ?? 1) > 1 || (settings.bestOfKo ?? 1) > 1;
    return new Tournament(
      {
        version: 2,
        code,
        seed,
        settings,
        scoring: { ...defaultScoring(settings.format, withScore), ...(local && points ? points : {}) },
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
        ...(local ? { fields: Math.max(0, Math.min(TOURNAMENT_MAX_FIELDS, Math.floor(fields))) } : {}),
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

  /**
   * Darf diese Kennung die Turnierseite sehen? Online in der Einschreibung jeder mit dem Link;
   * vor Ort nur die Leitung, mit Zuschaulink jeder.
   */
  maySee(token: string): boolean {
    if (isLocal(this.s)) return this.s.settings.spectators === true || this.isLeader(token) || this.helperOf(token) !== undefined;
    return this.s.phase === 'signup' || token === this.s.leaderToken || this.playerByToken(token) !== undefined;
  }

  /** Löschen darf nur, wer das Turnier angelegt hat – nicht Mitleitung oder Helfer. */
  mayDelete(token: string): boolean {
    return token !== '' && token === this.s.leaderToken;
  }

  /** Leitung oder Mitleitung. */
  isLeader(token: string): boolean {
    return token === this.s.leaderToken || this.helperOf(token)?.role === 'coleader';
  }

  /** Darf Ergebnisse eintragen: Leitung, Mitleitung oder Helfer. */
  private mayEnter(token: string): boolean {
    return this.isLeader(token) || this.helperOf(token) !== undefined;
  }

  private helperOf(token: string): TournamentHelper | undefined {
    if (!token) return undefined;
    return this.s.helpers?.find((h) => h.tokens.includes(token));
  }

  /** Name und Bild beim Wiederkommen nachziehen. Sagt, ob sich etwas geändert hat. */
  greet(token: string, name: string, avatar: string): boolean {
    const player = this.playerByToken(token);
    const clean = cleanName(name);
    if (!player || !clean || player.members) return false;
    const nextAvatar = cleanAvatar(avatar);
    if (player.name === clean && player.avatar === nextAvatar) return false;
    player.name = clean;
    player.avatar = nextAvatar;
    return true;
  }

  // -------------------------------------------------------------------------
  // Handlungen. Ein Text bedeutet: abgelehnt, mit dieser Begründung.

  join(token: string, name: string, avatar: string): string | null {
    if (isLocal(this.s)) return 'Die Leitung trägt die Teilnehmer ein.';
    if (this.s.phase !== 'signup') return 'Die Einschreibung ist beendet.';
    if (this.playerByToken(token)) return null;
    if (this.s.players.length >= TOURNAMENT_MAX_PLAYERS) return 'Das Turnier ist voll.';
    const clean = cleanName(name);
    if (!clean) return 'Bitte einen anderen Spitznamen wählen.';
    this.s.players.push({ id: `p${this.s.nextPlayer++}`, token, name: clean, avatar: cleanAvatar(avatar), withdrawn: false, ...(this.s.settings.approval ? { pending: true } : {}), ...(this.s.settings.checkin ? { present: false } : {}) });
    this.touch();
    return null;
  }

  /** Anmeldung mit Freigabe: Die Leitung lässt zu oder lehnt ab (dann ist der Eintrag weg). */
  approve(token: string, playerId: string, ok: boolean): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    if (this.s.phase !== 'signup') return 'Die Einschreibung ist beendet.';
    const player = this.s.players.find((p) => p.id === playerId);
    if (!player?.pending) return 'Dazu gibt es keine offene Anfrage.';
    if (ok) delete player.pending;
    else this.s.players = this.s.players.filter((p) => p.id !== playerId);
    this.touch();
    return null;
  }

  /** Check-in: jeder für sich („Ich bin da“), Leitung und Helfer für alle. */
  setPresent(token: string, playerId: string | undefined, on: boolean): string | null {
    if (this.s.phase !== 'signup') return 'Die Einschreibung ist beendet.';
    if (!this.s.settings.checkin) return 'Bei diesem Turnier gibt es keinen Check-in.';
    const own = this.playerByToken(token);
    const target = playerId === undefined ? own : this.s.players.find((p) => p.id === playerId);
    if (!target) return 'Diesen Teilnehmer gibt es nicht.';
    if (target !== own && !this.mayEnter(token)) return 'Das darf nur die Leitung.';
    target.present = on;
    this.touch();
    return null;
  }

  /** Längere Aufbewahrung ein- oder ausschalten (Leitung). */
  setKeepLong(token: string, on: boolean): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    this.s.keepLong = on ? true : undefined;
    if (!on) delete this.s.keepLong;
    this.touch();
    return null;
  }

  leave(token: string): string | null {
    if (isLocal(this.s)) return 'Die Leitung trägt die Teilnehmer ein.';
    if (this.s.phase !== 'signup') return 'Das Turnier läuft schon. Die Leitung kann dich zurückziehen.';
    const gone = this.playerByToken(token);
    this.s.players = this.s.players.filter((p) => p.token !== token);
    if (gone && this.s.wishes) delete this.s.wishes[gone.id];
    this.touch();
    return null;
  }

  /** Spieleabend: eigene Wunschdisziplinen während der Einschreibung. */
  wish(token: string, ids: readonly string[]): string | null {
    const player = this.playerByToken(token);
    if (!player) return 'Schreib dich zuerst ein.';
    const error = setWishes(this.s, player.id, ids);
    if (error) return error;
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
    const waiting = this.s.players.filter((p) => p.pending).length;
    if (waiting > 0) return `Noch ${waiting} Anmeldung${waiting === 1 ? '' : 'en'} wartet auf deine Freigabe.`;
    // Check-in: Wer fehlt, spielt nicht mit.
    if (this.s.settings.checkin) {
      const here = this.s.players.filter((p) => p.present);
      if (here.length < minPlayers) return `Es braucht mindestens ${minPlayers} Anwesende (${here.length} eingecheckt).`;
      this.s.players = here;
    }
    if (isTeamed(this.s)) {
      // Teams: erst nach dem Los zu Teams zusammenfassen, dann zählt die Zahl der Teams.
      const teams = formTeams(this.s);
      if (typeof teams === 'string') return teams;
      if (teams.length < minPlayers) return `Es braucht mindestens ${minPlayers} Teams (${minPlayers * (this.s.settings.teamSize ?? 2)} Spieler).`;
      this.s.roster = this.s.players;
      this.s.players = teams;
    }
    if (this.s.players.length < minPlayers) return `Es braucht mindestens ${minPlayers} Spieler.`;
    if (isTables(this.s) && !tableSizes(this.s.players.length, this.s.settings.tableSize ?? 4, this.s.settings.tableMin ?? TABLE_SIZE_MIN, this.s.settings.tableMax ?? TABLE_SIZE_MAX)) return 'So viele Spieler lassen sich nicht auf Tische verteilen.';
    const now = this.deps.now();
    // Am Turnierabend gibt es Fristen erst, wenn die Leitung eine Runde startet.
    const deadline = (index: number) => (isEvening(this.s) ? 0 : now + (index + 1) * days * DAY_MS);
    // Setzliste: Die Reihenfolge der Teilnehmerliste gilt, 1 ist der Beste; sonst entscheidet das Los.
    const ids = this.s.settings.seeded ? this.s.players.map((p) => p.id) : seededShuffle(this.s.players.map((p) => p.id), `${this.s.seed}/auslosung`);
    if (hasDisciplines(this.s)) this.s.disciplineOrder = chooseDisciplines(this.s);
    this.format.setup(this.ctx, ids, deadline);
    const ruleVersion = isLocal(this.s) || hasDisciplines(this.s) ? undefined : this.deps.ruleVersion?.(this.s.settings.gameId);
    if (ruleVersion !== undefined) this.s.ruleVersion = ruleVersion;
    this.s.phase = 'running';
    this.settle();
    this.touch();
    return null;
  }

  ready(token: string, matchId: string, ready: boolean): string | null {
    if (isLocal(this.s)) return 'Vor Ort ruft die Leitung die Partien auf.';
    const table = this.table(matchId);
    if (table) {
      const seat = table.seats.indexOf(this.playerByToken(token)?.id ?? '');
      if (seat < 0) return 'Das ist nicht dein Tisch.';
      if (isHeld(this.s, { stage: table.stage } as TournamentMatch)) return 'Die Runde hat noch nicht begonnen.';
      const error = setTableReady(this.s, table, seat, ready, this.deps.now());
      if (error) return error;
      this.touch();
      return null;
    }
    const match = this.match(matchId);
    const side = match?.slots.findIndex((slot) => slot.player === this.playerByToken(token)?.id) ?? -1;
    if (!match || side < 0) return 'Das ist nicht deine Partie.';
    if (isHeld(this.s, match)) return 'Die Runde hat noch nicht begonnen.';
    const error = setReady(this.s, match, side as MatchSide, ready, this.deps.now());
    if (error) return error;
    this.touch();
    return null;
  }

  /** Aufträge für Spielräume: Partien, die laufen sollen und noch keinen Raum haben. */
  pendingRooms(): MatchRoomRequest[] {
    return [...this.s.matches.flatMap((m) => roomRequest(this.s, m) ?? []), ...(this.s.tables ?? []).flatMap((t) => tableRoomRequest(this.s, t) ?? [])];
  }

  roomCreated(matchId: string, code: string): void {
    const table = this.table(matchId);
    if (table?.status === 'running' && !table.roomCode) {
      table.roomCode = code;
      this.touch();
      return;
    }
    const match = this.match(matchId);
    if (match?.status === 'running' && !match.roomCode) {
      match.roomCode = code;
      this.touch();
    }
  }

  /** Ergebnis aus einem Spielraum. Veraltete Meldungen (anderer Raum) zählen nicht. */
  report(matchId: string, roomCode: string, report: RoomReport): boolean {
    const table = this.table(matchId);
    if (table) {
      if (table.status !== 'running' || table.roomCode !== roomCode || report.kind !== 'placed' || report.places.length !== table.seats.length) return false;
      decideTable(this.s, table, rerank(report.places), this.deps.now(), report.walkover ? { walkover: true } : {});
      this.settle();
      this.touch();
      return true;
    }
    const match = this.match(matchId);
    if (!match || match.status !== 'running' || match.roomCode !== roomCode || report.kind === 'placed') return false;
    const winner = sideOfSeat(match, report.winner);
    // Best of N: Stand der Serie in der Reihenfolge der Seiten (nach einem Tausch umgedreht).
    const score: MatchScore | undefined = report.kind === 'played' && report.score ? (match.replays % 2 === 1 ? [report.score[1], report.score[0]] : [report.score[0], report.score[1]]) : undefined;
    if (report.kind === 'noShow') {
      if (winner === null) this.reopen(match);
      else this.decide(match, { winner, draw: false, walkover: true });
    } else if (winner !== null) {
      this.decide(match, { winner, draw: false, walkover: false, ...(score ? { score } : {}) });
    } else if (this.needsWinner(match)) {
      // K.-o. braucht einen Sieger: neu ansetzen, Farben getauscht, schnelle Zeit.
      match.replays++;
      this.reopen(match);
    } else {
      this.decide(match, { winner: null, draw: true, walkover: false, ...(score ? { score } : {}) });
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

  /** Stichtage verschieben; am Turnierabend nur die laufende Runde, um Minuten. */
  extend(token: string, days: number, minutes?: number): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    if (isLocal(this.s)) return 'Vor Ort gibt es keine Stichtage.';
    if (this.s.phase !== 'running') return 'Das Turnier läuft nicht.';
    const current = this.currentStage();
    if (isEvening(this.s)) {
      const stage = this.s.stages[current];
      if (!minutes || stage?.startedAt === undefined) return 'Die Runde hat noch nicht begonnen.';
      // Ab dem spätesten Zeitpunkt, der jetzt gilt – auch für Partien, die spät aufgegangen sind.
      const latest = this.s.matches.filter((m) => m.stage === current && m.status === 'open').map((m) => dueAt(this.s, m));
      stage.deadline = Math.max(stage.deadline, this.deps.now(), ...latest) + minutes * 60_000;
      this.touch();
      return null;
    }
    if (minutes) return 'Hier gelten Tage, keine Minuten.';
    this.s.stages.forEach((stage, index) => {
      if (index >= current) stage.deadline += days * DAY_MS;
    });
    this.touch();
    return null;
  }

  /** Turnierabend: Die Leitung startet die nächste Runde; alle Partien darin beginnen zugleich. */
  startRound(token: string): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    const index = startableStage(this.s, this.currentStage());
    if (index === null) return 'Gerade gibt es keine Runde zu starten.';
    startStage(this.s, index, this.deps.now());
    this.settle();
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
  // Vor Ort (W-058 Stufe 1): Die Leitung trägt Teilnehmer und Ergebnisse ein.

  /** Teilnehmer eintragen, einer je Name. Ohne Kennung: Sie brauchen kein Gerät. */
  addEntrants(token: string, names: readonly string[]): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    if (!isLocal(this.s)) return 'Online schreiben sich die Spieler selbst ein.';
    // Nachmelden geht nur im Schweizer System: Wer neu ist, wird ab der nächsten Runde mit gepaart.
    const late = this.s.phase === 'running' && this.s.settings.format === 'swiss';
    if (this.s.phase !== 'signup' && !late) return 'Die Einschreibung ist beendet.';
    const clean = names.map((name) => cleanName(name, ENTRANT_NAME_LENGTH));
    if (clean.some((name) => name === null)) return 'Bitte einen anderen Namen wählen.';
    if (this.s.players.length + clean.length > TOURNAMENT_MAX_PLAYERS) return `Höchstens ${TOURNAMENT_MAX_PLAYERS} Teilnehmer.`;
    const taken = new Set(this.s.players.map((p) => p.name.toLocaleLowerCase('de')));
    for (const name of clean as string[]) {
      if (taken.has(name.toLocaleLowerCase('de'))) return `„${name}“ steht schon auf der Liste.`;
      taken.add(name.toLocaleLowerCase('de'));
    }
    for (const name of clean as string[]) {
      const number = this.s.nextPlayer++;
      this.s.players.push({ id: `p${number}`, token: '', name, avatar: AVATARS[(number - 1) % AVATARS.length]!, withdrawn: false, ...(this.s.settings.checkin && this.s.phase === 'signup' ? { present: false } : {}) });
    }
    this.touch();
    return null;
  }

  removeEntrant(token: string, playerId: string): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    if (!isLocal(this.s) || this.s.phase !== 'signup') return 'Das geht gerade nicht.';
    this.s.players = this.s.players.filter((p) => p.id !== playerId);
    this.touch();
    return null;
  }

  /** Ergebnis vom Tisch: Spielstand oder Sieger. Auch zum Berichtigen, solange nichts daran hängt. */
  enterResult(token: string, matchId: string, entry: ResultEntry): string | null {
    if (!this.mayEnter(token)) return 'Das dürfen nur Leitung und Helfer.';
    if (!isLocal(this.s)) return 'Online meldet der Spielraum das Ergebnis.';
    const match = this.match(matchId);
    if (!match || match.status === 'waiting' || match.slots.some((slot) => !slot.player)) return 'Diese Partie steht noch nicht fest.';
    if (match.outcome?.bye) return 'Ein Freilos hat kein Ergebnis.';
    if (!this.mayChange(match)) return 'Daran hängen schon weitere Partien.';
    // Best of N vor Ort: Der Stand in gewonnenen Partien muss zur Begegnung passen.
    const bestOf = bestOfStage(this.s, match.stage);
    if (bestOf > 1 && 'score' in entry) {
      const wrong = checkSeriesScore(entry.score, bestOf);
      if (wrong) return wrong;
    }
    const outcome = outcomeFromEntry(entry, this.s.settings.draws === true && !this.needsWinner(match));
    if (typeof outcome === 'string') return outcome;
    this.decide(match, outcome);
    this.settle();
    this.touch();
    return null;
  }

  /**
   * Ergebnis eines Tisches: Plätze (0 = erster) oder Punkte im Spiel je Sitz. Vor Ort Leitung
   * und Helfer, online nur die Leitung (z. B. wenn ein Raum hängt).
   */
  enterTable(token: string, tableId: string, entry: { places?: number[]; scores?: number[] }): string | null {
    if (isLocal(this.s) ? !this.mayEnter(token) : !this.isLeader(token)) return isLocal(this.s) ? 'Das dürfen nur Leitung und Helfer.' : 'Das darf nur die Leitung.';
    const table = this.table(tableId);
    if (!table) return 'Diesen Tisch gibt es nicht.';
    const n = table.seats.length;
    let places = entry.places;
    if (entry.scores) {
      if (entry.scores.length !== n || !entry.scores.every((v) => Number.isInteger(v) && Math.abs(v) <= 99_999)) return 'Bitte für jeden Sitz Punkte eintragen.';
      places = placesFromScores(entry.scores, this.s.settings.lowWins === true);
    }
    if (!places || !validPlaces(places, n)) return 'Diese Plätze passen nicht.';
    const later = (this.s.tables ?? []).some((t) => t.stage > table.stage);
    if (later && table.status !== 'done') return 'Diese Runde ist schon vorbei.';
    table.roomCode = null;
    decideTable(this.s, table, places, this.deps.now(), { ...(entry.scores ? { scores: entry.scores } : {}), byLeader: true });
    this.settle();
    this.touch();
    return null;
  }

  /** Neuer Helferlink. Der Code steht danach in der Sicht der Leitung. */
  addHelper(token: string, name: string, role: HelperRole): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    if (!isLocal(this.s)) return 'Helfer gibt es nur vor Ort.';
    const clean = cleanName(name, ENTRANT_NAME_LENGTH);
    if (!clean) return 'Bitte einen anderen Namen wählen.';
    const helpers = (this.s.helpers ??= []);
    if (helpers.length >= TOURNAMENT_MAX_HELPERS) return `Höchstens ${TOURNAMENT_MAX_HELPERS} Helfer.`;
    const number = (this.s.nextHelper ?? 1);
    this.s.nextHelper = number + 1;
    helpers.push({ id: `h${number}`, name: clean, role, code: this.deps.randomClaim(), tokens: [] });
    this.touch();
    return null;
  }

  /** Entfernt einen Helfer; seine Geräte verlieren sofort den Zugang. */
  removeHelper(token: string, helperId: string): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    const helper = this.s.helpers?.find((h) => h.id === helperId);
    if (!helper) return 'Diesen Helfer gibt es nicht.';
    if (helper.tokens.includes(token)) return 'Du kannst dich nicht selbst entfernen.';
    this.s.helpers = this.s.helpers!.filter((h) => h.id !== helperId);
    this.touch();
    return null;
  }

  /** Helferlink einlösen: Dieses Gerät darf danach eintragen. */
  joinAsHelper(token: string, code: string): string | null {
    const helper = this.s.helpers?.find((h) => h.code === code.trim().toUpperCase());
    if (!helper) return 'Dieser Helferlink gilt nicht (mehr).';
    if (token === this.s.leaderToken || helper.tokens.includes(token)) return null;
    if (this.helperOf(token)) return 'Dieses Gerät hilft schon mit.';
    if (helper.tokens.length >= HELPER_MAX_DEVICES) return `Ein Helferlink gilt für höchstens ${HELPER_MAX_DEVICES} Geräte.`;
    helper.tokens.push(token);
    this.touch();
    return null;
  }

  /** Zeitplan setzen oder mit null entfernen. */
  setSchedule(token: string, schedule: TournamentSchedule | null): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    if (!isLocal(this.s)) return 'Einen Zeitplan gibt es nur vor Ort.';
    if (schedule) {
      const { start, matchMinutes, breakMinutes } = schedule;
      const minutes = (n: number, min: number) => Number.isInteger(n) && n >= min && n <= SCHEDULE_MAX_MINUTES;
      if (!Number.isFinite(start) || !minutes(matchMinutes, 1) || !minutes(breakMinutes, 0)) return 'Bitte gültige Zeiten eintragen.';
      this.s.schedule = { start, matchMinutes, breakMinutes };
    } else delete this.s.schedule;
    this.touch();
    return null;
  }

  /** Teams pfeifen gegenseitig: gilt für alle Partien, die danach aufgerufen werden. */
  setReferees(token: string, on: boolean): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    if (!isLocal(this.s)) return 'Schiedsrichter gibt es nur vor Ort.';
    this.s.referees = on;
    this.touch();
    return null;
  }

  /** Zahl der Tische oder Felder; 0 schaltet den Aufruf ab. */
  setFields(token: string, count: number): string | null {
    if (!this.isLeader(token)) return 'Das darf nur die Leitung.';
    if (!isLocal(this.s)) return 'Online gibt es keine Tische.';
    if (!Number.isInteger(count) || count < 0 || count > TOURNAMENT_MAX_FIELDS) return `Zwischen 0 und ${TOURNAMENT_MAX_FIELDS}.`;
    this.s.fields = count;
    if (this.s.phase === 'running') assignFields(this.s, this.deps.now());
    this.touch();
    return null;
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
    if (isLocal(this.s)) return times[0]!;
    for (const match of this.s.matches) if (match.status === 'open' && !isHeld(this.s, match)) times.push(dueAt(this.s, match));
    // Liga nach Kalender: der nächste Spieltag, der noch nicht begonnen hat.
    for (const match of this.s.matches) if (match.status === 'waiting') { const at = this.s.stages[match.stage]?.startsAt; if (at !== undefined) times.push(at); }
    for (const table of this.s.tables ?? []) if (table.status === 'open' && !isHeld(this.s, { stage: table.stage } as TournamentMatch)) times.push(this.tableDue(table));
    // Die Ausschreibung muss sich regelmäßig neu melden, sonst fällt sie aus der Liste.
    if (this.publicListing()) times.push(this.deps.now() + OPEN_ROOM_REFRESH_MS);
    return Math.min(...times);
  }

  /** Karte für „Offene Runden“: nur öffentlich und nur, solange man sich einschreiben kann. */
  publicListing(): OpenRoomListing | null {
    if (this.s.phase !== 'signup' || this.s.settings.isPublic === false || isLocal(this.s)) return null;
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
    // Ligen laufen über Monate und bleiben ein Jahr nach der letzten Aktivität; die Leitung kann das für jedes Turnier verlangen.
    if (this.s.keepLong === true) return (this.s.finishedAt ?? this.s.lastActivity) + LEAGUE_KEEP_MS;
    if (this.s.settings.format === 'league') return this.s.lastActivity + LEAGUE_KEEP_MS;
    return (this.s.finishedAt ?? this.s.lastActivity) + TOURNAMENT_KEEP_MS;
  }

  // -------------------------------------------------------------------------
  // Sicht

  view(token: string | null): TournamentView {
    const s = this.s;
    const planned = s.schedule && s.phase !== 'signup' ? plannedStarts(s, s.schedule) : null;
    const you = token ? (this.playerByToken(token)?.id ?? null) : null;
    return {
      code: s.code,
      settings: s.settings,
      leaderName: s.leaderName,
      phase: s.phase,
      // Wer auf Freigabe wartet, sehen nur die Leitung und er selbst.
      players: s.players.filter((p) => !p.pending || p.id === you || (token !== null && this.isLeader(token))).map(({ id, name, avatar, withdrawn, members, pair, pending, present }) => ({ id, name, avatar, withdrawn, ...(members ? { members: members.map((m) => m.name) } : {}), ...(pair ? { pair: true } : {}), ...(pending ? { pending: true } : {}), ...(present !== undefined ? { present } : {}) })),
      groups: s.groups.map((players, group) => ({ players, table: this.groupTable(group), settled: this.groupSettled(group) })),
      swissTable: s.settings.format === 'swiss' && s.phase !== 'signup' ? this.overallTable() : [],
      table: this.tableRows(),
      fields: s.fields ?? 0,
      stages: s.stages,
      currentStage: this.currentStage(),
      startableStage: startableStage(s, this.currentStage()),
      disciplines: hasDisciplines(s) ? (s.disciplineOrder ? s.disciplineOrder.map((id) => ({ id, wishes: wishCounts(s).find((c) => c.id === id)?.wishes ?? 0 })) : wishCounts(s)) : [],
      yourWishes: (you ? s.wishes?.[you] : undefined) ?? [],
      disciplineTables: hasDisciplines(s) && s.phase !== 'signup' ? this.disciplineTables() : [],
      tableGames: (s.tables ?? []).map(({ everReady: _hidden, ...table }) => table),
      matches: s.matches.map(({ everReady: _hidden, ...match }) => (planned?.has(match.id) ? { ...match, plannedAt: planned.get(match.id)! } : match)),
      schedule: s.schedule ?? null,
      referees: s.referees === true,
      podium: this.podium(),
      ranking: this.ranking(),
      keepLong: s.keepLong === true,
      you,
      isLeader: token !== null && this.isLeader(token),
      mayDelete: token !== null && this.mayDelete(token),
      helperRole: token ? (this.helperOf(token)?.role ?? null) : null,
      helpers: token !== null && this.isLeader(token) ? (s.helpers ?? []).map(({ id, name, role, code, tokens }) => ({ id, name, role, code, devices: tokens.length })) : [],
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
        // Vor Ort läuft eine aufgerufene Partie am Tisch; ein Rückzug entscheidet auch sie.
        if (match.status !== 'open' && !(isLocal(this.s) && match.status === 'running')) continue;
        const gone = match.slots.map((slot) => slot.player === null || this.s.players.find((p) => p.id === slot.player)?.withdrawn === true);
        if (gone[0] || gone[1]) {
          // Ein leerer Platz ist ein Freilos, ein Rückzug kampflos.
          const bye = match.slots.some((slot) => slot.player === null);
          this.decide(match, { winner: gone[0] && gone[1] ? null : gone[0] ? 1 : 0, draw: false, walkover: true, ...(bye ? { bye } : {}) });
          moved = true;
        } else if (!isLocal(this.s) && !isHeld(this.s, match) && now >= dueAt(this.s, match)) {
          this.decide(match, deadlineOutcome(match));
          moved = true;
        }
      }
      if (this.settleTables(now)) moved = true;
      if (this.fillBracket()) moved = true;
      if (this.format.advance(this.ctx)) moved = true;
      if (!moved) break;
    }
    if (isLocal(this.s)) assignFields(this.s, now);
    autoStart(this.s, now);
    if (isEvening(this.s)) autoStartTables(this.s, now, (stage) => this.s.stages[stage]?.startedAt === undefined);
    this.checkFinished();
  }

  /**
   * Tische, die sich von selbst entscheiden: alle Sitze zurückgezogen bis auf höchstens einen,
   * oder (online) die Frist ist abgelaufen.
   */
  private settleTables(now: number): boolean {
    let moved = false;
    for (const table of this.s.tables ?? []) {
      if (table.status === 'done') continue;
      const gone = table.seats.map((id) => this.isWithdrawn(id));
      const remaining = gone.filter((g) => !g).length;
      if (table.status === 'open' && remaining <= 1) {
        decideTable(this.s, table, rerank(gone.map((g) => (g ? 1 : 0))), now, { walkover: true });
        moved = true;
      } else if (table.status === 'open' && !isLocal(this.s) && !isHeld(this.s, { stage: table.stage } as TournamentMatch) && now >= this.tableDue(table)) {
        decideTable(this.s, table, tableDeadlinePlaces(table), now, { walkover: true });
        moved = true;
      }
    }
    return moved;
  }

  private tableDue(table: TableGame): number {
    return dueAt(this.s, { stage: table.stage, openedAt: table.openedAt } as TournamentMatch);
  }

  private table(id: string): TableGame | undefined {
    return this.s.tables?.find((t) => t.id === id);
  }

  private fillBracket(): boolean {
    let moved = false;
    for (const match of this.s.matches) {
      if (match.status !== 'waiting') continue;
      // Liga nach Kalender: Der Spieltag hat noch nicht begonnen.
      if ((this.s.stages[match.stage]?.startsAt ?? 0) > this.deps.now() && this.s.settings.mode !== 'local') continue;
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
    if (source.kind === 'bestThird') {
      // Erst wenn alle Gruppen feststehen, lassen sich die Dritten vergleichen.
      if (!this.s.groups.every((_, group) => this.groupSettled(group))) return undefined;
      const thirds = this.s.groups.flatMap((_, group) => {
        const row = this.groupTable(group).filter((r) => !this.isWithdrawn(r.player))[2];
        return row ? [row] : [];
      });
      const lot = new Map(seededShuffle(thirds.map((r) => r.player), `${this.s.seed}/dritte`).map((p, i) => [p, i]));
      thirds.sort((a, b) => b.points - a.points || b.scored - b.conceded - (a.scored - a.conceded) || b.scored - a.scored || b.wins - a.wins || lot.get(a.player)! - lot.get(b.player)!);
      return thirds[source.rank]?.player ?? null;
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
    // Vor Ort ist die Partie vom Tisch; die Nummer bleibt zur Anzeige stehen.
    delete match.calledAt;
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
    const openTable = this.s.tables?.find((t) => t.status !== 'done');
    if (openTable) return openTable.stage;
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

  /** Spieleabend: Tabelle je Disziplin aus den Partien ihrer Spieltage. */
  private disciplineTables(): { id: string; table: StandingRow[] }[] {
    const ids = this.s.players.map((p) => p.id);
    return (this.s.disciplineOrder ?? []).map((id) => ({ id, table: standings(ids, this.s.matches.filter((m) => disciplineOf(this.s, m.stage) === id), this.s.seed, this.s.scoring) }));
  }

  private overallTable(): StandingRow[] {
    return standings(this.s.players.map((p) => p.id), this.s.matches, this.s.seed, this.s.scoring);
  }

  /** Tabelle der Formen mit Gesamttabelle (Schweizer System, Liga, Tischrunden, Last One Standing, Zufallspartner). */
  private tableRows(): StandingRow[] {
    const s = this.s;
    if (s.phase === 'signup') return [];
    if (isTables(s)) return tableStandings(s);
    if (isLives(s)) return livesRows(s);
    if (isDyp(s)) return dypRows(s);
    return s.settings.format === 'swiss' || s.settings.format === 'league' ? this.overallTable() : [];
  }

  /**
   * Gesamtrangliste am Ende (für „Nächste Phase“ und Platzierungsspiele): bei Tabellenformen die Tabelle, mit
   * Platzierungsspielen deren Plätze, sonst Podium und danach, wer im Baum weiter kam.
   */
  private ranking(): string[] {
    const s = this.s;
    if (s.phase !== 'finished') return [];
    if (s.settings.placements) return placementRanking(s);
    const singles = s.players.filter((p) => !p.pair);
    const table = this.tableRows();
    if (table.length > 0) return table.map((r) => r.player);
    const depth = new Map<string, number>();
    const wins = new Map<string, number>();
    for (const m of s.matches) {
      m.slots.forEach((slot, side) => {
        if (!slot.player || !m.outcome || m.outcome.bye) return;
        depth.set(slot.player, Math.max(depth.get(slot.player) ?? 0, m.stage));
        if (m.outcome.winner === side) wins.set(slot.player, (wins.get(slot.player) ?? 0) + 1);
      });
    }
    const lot = new Map(seededShuffle(singles.map((p) => p.id), `${s.seed}/rang`).map((id, i) => [id, i]));
    const podium = this.podium();
    const rest = singles
      .map((p) => p.id)
      .filter((id) => !podium.includes(id))
      .sort((a, b) => (isWithdrawnId(s, a) ? 1 : 0) - (isWithdrawnId(s, b) ? 1 : 0) || (depth.get(b) ?? -1) - (depth.get(a) ?? -1) || (wins.get(b) ?? 0) - (wins.get(a) ?? 0) || lot.get(a)! - lot.get(b)!);
    return [...podium, ...rest];
  }

  private podium(): string[] {
    return this.s.phase === 'finished' ? this.format.podium(this.ctx) : [];
  }

  private match(id: string): TournamentMatch | undefined {
    return this.s.matches.find((m) => m.id === id);
  }

  private playerByToken(token: string): TournamentPlayer | undefined {
    // Teilnehmer vor Ort haben keine Kennung.
    if (!token) return undefined;
    return this.s.players.find((p) => ownsToken(p, token));
  }

  private isWithdrawn(id: string): boolean {
    return this.s.players.find((p) => p.id === id)?.withdrawn === true;
  }

  private touch(): void {
    this.s.lastActivity = this.deps.now();
  }
}

function isWithdrawnId(s: TournamentSnapshot, id: string): boolean {
  return s.players.find((p) => p.id === id)?.withdrawn === true;
}
