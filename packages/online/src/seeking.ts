import { cleanAvatar, cleanName } from './names';

/**
 * Das Schwarze Brett „Wer hat Lust?“ (#65): Zettel mit Wunschspielen, „Bin dabei“ und ein Vorschlag,
 * sobald sich genug Leute für ein Spiel finden. Reine Logik ohne Anbieterbindung – der Cloudflare-Adapter hält sie
 * im Verzeichnis (`LobbyRegistry`) und legt bei einem Treffer den Raum an.
 *
 * **Kein freier Text:** Ein Zettel besteht aus Auswahllisten (Spiele, Spielerzahl, Stimmung); nur Name und Bild kommen
 * aus dem Profil und laufen durch denselben Filter wie überall (`cleanName`).
 */

/** So lange hängt ein Zettel, wenn niemand ihn verlängert. */
export const SEEK_NOTE_MS = 30 * 60 * 1000;
/** So lange haben alle Zeit, einen Vorschlag zu bestätigen. */
export const SEEK_PROPOSAL_MS = 60 * 1000;
/** Ist die Verfasserin oder der Verfasser so lange nicht mehr verbunden, nimmt das Brett den Zettel ab. */
export const SEEK_AWAY_MS = 2 * 60 * 1000;
/** Höchstens so viele Zettel hängen zugleich; der älteste fällt zuerst heraus. */
export const SEEK_MAX_NOTES = 200;
/** Höchstens so viele Wunschspiele je Zettel. */
export const SEEK_MAX_GAMES = 3;
/** „Bin dabei“ höchstens so oft je Minute und Person. */
export const SEEK_VOTES_PER_MINUTE = 5;
/** Ein neuer Zettel frühestens so lange nach dem letzten Versuch. */
export const SEEK_POST_GAP_MS = 10 * 1000;
/** Kennung für „Egal, überrascht mich“ – beim Treffer zieht das Brett ein passendes Spiel. */
export const SEEK_ANY = 'random';

export const SEEK_MOODS = ['relaxed', 'serious', 'kids', 'learning'] as const;
export type SeekMood = (typeof SEEK_MOODS)[number];
export const SEEK_SEATS = ['any', '2', '3-4', '5+'] as const;
export type SeekSeats = (typeof SEEK_SEATS)[number];

/** Was das Brett über ein Spiel wissen muss – kommt vom Spieleserver. */
export interface SeekGame {
  id: string;
  min: number;
  max: number;
}

export interface SeekDeps {
  now(): number;
  /** Ein online angebotenes Spiel (kein Entwurf) oder undefined. */
  game(id: string): SeekGame | undefined;
  /** Alle online angebotenen Spiele – für „Egal“. */
  games(): SeekGame[];
  random(): number;
}

interface Proposal {
  gameId: string;
  /** Verfasser zuerst. */
  members: string[];
  confirmed: string[];
  deadline: number;
}

interface Note {
  id: string;
  owner: string;
  name: string;
  avatar: string;
  games: string[];
  seats: SeekSeats;
  mood: SeekMood;
  createdAt: number;
  expiresAt: number;
  /** Zustimmungen je Spiel (Kennungen der Zustimmenden, in der Reihenfolge des Eintreffens). */
  votes: Record<string, string[]>;
  proposal: Proposal | null;
  /** Seit wann der Verfasser nicht mehr verbunden ist (null: verbunden). */
  awaySince: number | null;
}

/** Was nach außen dringt: ein Treffer, aus dem der Adapter einen Raum macht. */
export interface SeekMatch {
  gameId: string;
  /** Die Verfasserin oder der Verfasser wird Raumleitung. */
  host: string;
  /** Alle, die bestätigt haben (Verfasser zuerst). */
  owners: string[];
}

export interface SeekPostInput {
  name: string;
  avatar: string;
  games: string[];
  seats: string;
  mood: string;
}

export type SeekError = 'name' | 'games' | 'seats' | 'mood' | 'busy' | 'rate' | 'unknown' | 'own' | 'gone';

export interface SeekResult {
  ok: boolean;
  error?: SeekError;
  /** Fertige Treffer (bestätigt) – der Adapter legt jeweils einen Raum an. */
  matches: SeekMatch[];
}

/** Ein Zettel, wie ihn eine bestimmte Person sieht. */
export interface SeekNoteView {
  id: string;
  name: string;
  avatar: string;
  games: string[];
  seats: SeekSeats;
  mood: SeekMood;
  expiresAt: number;
  /** Zustimmungen je Spiel. */
  votes: Record<string, number>;
  mine: boolean;
  /** Das Spiel, für das diese Person hier „Bin dabei“ gewählt hat. */
  joined: string | null;
}

export interface SeekProposalView {
  noteId: string;
  gameId: string;
  /** Namen aller Beteiligten (Verfasser zuerst). */
  names: string[];
  confirmed: number;
  total: number;
  deadline: number;
  youConfirmed: boolean;
}

export interface SeekBoardView {
  notes: SeekNoteView[];
  /** Ein Vorschlag, an dem diese Person beteiligt ist und den sie noch bestätigen muss oder bestätigt hat. */
  proposal: SeekProposalView | null;
}

export interface SeekSaved {
  notes: Note[];
  nextId: number;
  /** Namen der Zustimmenden (für den Vorschlag „Mau-Mau mit Anna, Ben …“). */
  names?: Record<string, string>;
}

const need = (game: SeekGame): number => Math.max(2, game.min);

/** Das Schwarze Brett: Zettel, Zustimmungen und Vorschläge. */
export class SeekingBoard {
  private notes: Note[] = [];
  private nextId = 1;
  private names: Record<string, string> = {};
  private readonly voteTimes = new Map<string, number[]>();
  private readonly lastPost = new Map<string, number>();

  constructor(private readonly deps: SeekDeps, saved?: SeekSaved) {
    if (saved) {
      this.notes = saved.notes;
      this.nextId = saved.nextId;
      this.names = saved.names ?? {};
    }
  }

  get size(): number {
    return this.notes.length;
  }

  toJSON(): SeekSaved {
    return { notes: structuredClone(this.notes), nextId: this.nextId, names: { ...this.names } };
  }

  // -------------------------------------------------------------------------
  // Zettel

  post(owner: string, input: SeekPostInput): SeekResult {
    const now = this.deps.now();
    const fail = (error: SeekError): SeekResult => ({ ok: false, error, matches: [] });
    if (now - (this.lastPost.get(owner) ?? -Infinity) < SEEK_POST_GAP_MS) return fail('rate');
    this.lastPost.set(owner, now);
    const name = cleanName(input.name);
    if (!name) return fail('name');
    const games = [...new Set(input.games)];
    if (games.length > SEEK_MAX_GAMES) return fail('games');
    if (games.some((id) => id !== SEEK_ANY && !this.deps.game(id))) return fail('games');
    if (!(SEEK_SEATS as readonly string[]).includes(input.seats)) return fail('seats');
    if (!(SEEK_MOODS as readonly string[]).includes(input.mood)) return fail('mood');
    // Höchstens ein Zettel je Person: ein neuer ersetzt den alten.
    this.removeNoteOf(owner);
    this.notes.push({
      id: `z${this.nextId++}`,
      owner,
      name,
      avatar: cleanAvatar(input.avatar),
      games: games.length === 0 ? [SEEK_ANY] : games,
      seats: input.seats as SeekSeats,
      mood: input.mood as SeekMood,
      createdAt: now,
      expiresAt: now + SEEK_NOTE_MS,
      votes: {},
      proposal: null,
      awaySince: null,
    });
    // Zu viele Zettel: der älteste fällt heraus.
    while (this.notes.length > SEEK_MAX_NOTES) this.removeNote(this.notes[0]!);
    return { ok: true, matches: [] };
  }

  withdraw(owner: string): SeekResult {
    const had = this.removeNoteOf(owner);
    return { ok: had, ...(had ? {} : { error: 'unknown' as const }), matches: [] };
  }

  /** Der Zettel hängt wieder volle 30 Minuten. */
  extend(owner: string): SeekResult {
    const note = this.notes.find((n) => n.owner === owner);
    if (!note) return { ok: false, error: 'unknown', matches: [] };
    note.expiresAt = this.deps.now() + SEEK_NOTE_MS;
    return { ok: true, matches: [] };
  }

  /** Die Verfasserin oder der Verfasser ist weg oder wieder da. */
  markAway(owner: string, away: boolean): void {
    const note = this.notes.find((n) => n.owner === owner);
    if (note) note.awaySince = away ? (note.awaySince ?? this.deps.now()) : null;
  }

  // -------------------------------------------------------------------------
  // Zustimmen und Bestätigen

  /** „Bin dabei“: für ein Spiel auf einem fremden Zettel. Eine Stimme je Person und Zettel (die neue ersetzt die alte). */
  join(voter: string, noteId: string, gameId: string, voterName = 'Jemand'): SeekResult {
    const note = this.notes.find((n) => n.id === noteId);
    if (!note) return { ok: false, error: 'gone', matches: [] };
    if (note.owner === voter) return { ok: false, error: 'own', matches: [] };
    if (!note.games.includes(gameId)) return { ok: false, error: 'games', matches: [] };
    const now = this.deps.now();
    const times = (this.voteTimes.get(voter) ?? []).filter((t) => now - t < 60_000);
    if (times.length >= SEEK_VOTES_PER_MINUTE) return { ok: false, error: 'rate', matches: [] };
    this.voteTimes.set(voter, [...times, now]);
    this.names[voter] = cleanName(voterName) ?? 'Jemand';
    this.removeVote(note, voter);
    (note.votes[gameId] ??= []).push(voter);
    this.maybePropose(note);
    return { ok: true, matches: [] };
  }

  unjoin(voter: string, noteId: string): SeekResult {
    const note = this.notes.find((n) => n.id === noteId);
    if (!note) return { ok: false, error: 'gone', matches: [] };
    this.dropVoter(note, voter);
    this.maybePropose(note);
    return { ok: true, matches: [] };
  }

  /** Ein Vorschlag wird bestätigt oder abgelehnt (Ablehnen nimmt die Stimme zurück). */
  confirm(owner: string, noteId: string, ok: boolean): SeekResult {
    const note = this.notes.find((n) => n.id === noteId);
    const proposal = note?.proposal;
    if (!note || !proposal || !proposal.members.includes(owner) || proposal.confirmed.includes(owner)) return { ok: false, error: 'gone', matches: [] };
    if (!ok) {
      this.dropVoter(note, owner);
      this.maybePropose(note);
      return { ok: true, matches: [] };
    }
    proposal.confirmed.push(owner);
    const matches = proposal.confirmed.length === proposal.members.length ? this.complete(note) : [];
    return { ok: true, matches };
  }

  /** Abgelaufene Zettel und Vorschläge abräumen; liefert Treffer, deren Frist mit genug Bestätigungen endete. */
  tick(): SeekMatch[] {
    const now = this.deps.now();
    const matches: SeekMatch[] = [];
    for (const note of [...this.notes]) {
      if (!this.notes.includes(note)) continue;
      if (note.expiresAt <= now || (note.awaySince !== null && now - note.awaySince >= SEEK_AWAY_MS)) {
        this.removeNote(note);
        continue;
      }
      const proposal = note.proposal;
      if (!proposal || proposal.deadline > now) continue;
      const game = this.deps.game(proposal.gameId);
      if (game && proposal.confirmed.length >= need(game)) {
        // Genug haben bestätigt: Es geht mit denen los, die da sind.
        matches.push(...this.complete(note, proposal.confirmed));
      } else {
        for (const member of proposal.members) if (!proposal.confirmed.includes(member)) this.dropVoter(note, member);
        note.proposal = null;
        this.maybePropose(note);
      }
    }
    return matches;
  }

  /** Wann `tick()` das nächste Mal etwas ändert; null bei leerem Brett. */
  nextWakeup(): number | null {
    let next: number | null = null;
    const consider = (at: number) => {
      if (next === null || at < next) next = at;
    };
    for (const note of this.notes) {
      consider(note.expiresAt);
      if (note.awaySince !== null) consider(note.awaySince + SEEK_AWAY_MS);
      if (note.proposal) consider(note.proposal.deadline);
    }
    return next;
  }

  // -------------------------------------------------------------------------
  // Sicht

  view(viewer: string | null): SeekBoardView {
    const notes = [...this.notes]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map<SeekNoteView>((note) => ({
        id: note.id,
        name: note.name,
        avatar: note.avatar,
        games: note.games,
        seats: note.seats,
        mood: note.mood,
        expiresAt: note.expiresAt,
        votes: Object.fromEntries(Object.entries(note.votes).map(([gameId, ids]) => [gameId, ids.length])),
        mine: viewer !== null && note.owner === viewer,
        joined: viewer === null ? null : (Object.entries(note.votes).find(([, ids]) => ids.includes(viewer))?.[0] ?? null),
      }));
    let proposal: SeekProposalView | null = null;
    if (viewer !== null) {
      for (const note of this.notes) {
        const p = note.proposal;
        if (!p || !p.members.includes(viewer)) continue;
        if (proposal === null || p.deadline < proposal.deadline) {
          proposal = {
            noteId: note.id,
            gameId: p.gameId,
            names: p.members.map((id) => (id === note.owner ? note.name : (this.names[id] ?? 'Jemand'))),
            confirmed: p.confirmed.length,
            total: p.members.length,
            deadline: p.deadline,
            youConfirmed: p.confirmed.includes(viewer),
          };
        }
      }
    }
    return { notes, proposal };
  }

  // -------------------------------------------------------------------------
  // Intern

  private removeVote(note: Note, voter: string): void {
    for (const [gameId, ids] of Object.entries(note.votes)) {
      const kept = ids.filter((id) => id !== voter);
      if (kept.length === 0) delete note.votes[gameId];
      else note.votes[gameId] = kept;
    }
  }

  /** Stimme zurücknehmen und aus einem laufenden Vorschlag streichen. */
  private dropVoter(note: Note, voter: string): void {
    this.removeVote(note, voter);
    const proposal = note.proposal;
    if (!proposal) return;
    proposal.members = proposal.members.filter((id) => id !== voter);
    proposal.confirmed = proposal.confirmed.filter((id) => id !== voter);
    const game = this.deps.game(proposal.gameId);
    // Zu wenige übrig: der Vorschlag fällt weg (die Zustimmungen der anderen bleiben).
    if (!game || proposal.members.length < need(game)) note.proposal = null;
  }

  private removeNoteOf(owner: string): boolean {
    const note = this.notes.find((n) => n.owner === owner);
    if (note) this.removeNote(note);
    return Boolean(note);
  }

  /** Zettel abnehmen; Beteiligte an dessen Vorschlag bleiben auf anderen Zetteln unberührt. */
  private removeNote(note: Note): void {
    this.notes = this.notes.filter((n) => n !== note);
  }

  /** Eine Person ist vermittelt: Zettel und Zustimmungen überall weg, aus anderen Vorschlägen heraus. */
  private removePerson(owner: string): void {
    this.removeNoteOf(owner);
    for (const note of [...this.notes]) {
      const hadVote = Object.values(note.votes).some((ids) => ids.includes(owner));
      if (hadVote || note.proposal?.members.includes(owner)) {
        this.dropVoter(note, owner);
        this.maybePropose(note);
      }
    }
  }

  /** Hat ein Spiel genug Zustimmungen, entsteht ein Vorschlag (nie zwei zugleich auf einem Zettel). */
  private maybePropose(note: Note): void {
    if (note.proposal) return;
    const now = this.deps.now();
    for (const gameId of note.games) {
      const voters = note.votes[gameId] ?? [];
      let resolved = gameId === SEEK_ANY ? undefined : this.deps.game(gameId);
      if (gameId === SEEK_ANY) {
        // „Egal“: ein Spiel ziehen, das zu den bisher Beteiligten passt.
        const count = Math.min(voters.length + 1, 99);
        const pool = this.deps.games().filter((g) => g.min <= count && count <= g.max && g.max >= 2);
        if (voters.length < 1 || pool.length === 0) continue;
        resolved = pool[Math.floor(this.deps.random() * pool.length)]!;
      }
      if (!resolved || voters.length + 1 < need(resolved)) continue;
      const members = [note.owner, ...voters.slice(0, resolved.max - 1)];
      note.proposal = { gameId: resolved.id, members, confirmed: [note.owner], deadline: now + SEEK_PROPOSAL_MS };
      return;
    }
  }

  /** Alle (oder die Bestätigten) sind vermittelt: Treffer melden und alle von der Tafel nehmen. */
  private complete(note: Note, who?: string[]): SeekMatch[] {
    const proposal = note.proposal!;
    const owners = who ?? proposal.confirmed;
    const match: SeekMatch = { gameId: proposal.gameId, host: note.owner, owners: [...owners] };
    for (const owner of owners) this.removePerson(owner);
    this.removeNote(note);
    return [match];
  }
}

// ---------------------------------------------------------------------------
// Nachrichten zwischen Browser und Brett

export type BoardClientMessage =
  /** Erste Nachricht: die geheime Geräte-Kennung (daraus bildet der Server eine Kurzkennung). */
  | { type: 'hello'; token: string }
  | { type: 'post'; name: string; avatar: string; games: string[]; seats: string; mood: string }
  | { type: 'withdraw' }
  | { type: 'extend' }
  | { type: 'join'; noteId: string; gameId: string; name: string }
  | { type: 'unjoin'; noteId: string }
  | { type: 'confirm'; noteId: string; ok: boolean };

export type BoardServerMessage =
  | ({ type: 'board'; you: string | null } & SeekBoardView)
  /** Eine Gruppe hat sich gefunden: Der Raum steht, alle gehen hinein. */
  | { type: 'matched'; code: string; gameId: string }
  | { type: 'boardError'; error: SeekError | 'hello' | 'message' };

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Liest eine Nachricht vom Brett-Browser; alles Ungültige ergibt null. */
export function parseBoardMessage(raw: string): BoardClientMessage | null {
  if (raw.length > 2000) return null;
  let m: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    m = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  switch (m.type) {
    case 'hello':
      return isStr(m.token, 200) && m.token.length >= 32 ? { type: 'hello', token: m.token } : null;
    case 'post':
      return typeof m.name === 'string' && m.name.length <= 100 && isStr(m.avatar, 20) && Array.isArray(m.games) && m.games.length <= 10 && m.games.every((g) => isStr(g, 60)) && isStr(m.seats, 10) && isStr(m.mood, 20)
        ? { type: 'post', name: m.name, avatar: m.avatar, games: m.games as string[], seats: m.seats, mood: m.mood }
        : null;
    case 'join':
      return isStr(m.noteId, 20) && isStr(m.gameId, 60) && typeof m.name === 'string' && m.name.length <= 100 ? { type: 'join', noteId: m.noteId, gameId: m.gameId, name: m.name } : null;
    case 'unjoin':
      return isStr(m.noteId, 20) ? { type: 'unjoin', noteId: m.noteId } : null;
    case 'confirm':
      return isStr(m.noteId, 20) && typeof m.ok === 'boolean' ? { type: 'confirm', noteId: m.noteId, ok: m.ok } : null;
    case 'withdraw':
    case 'extend':
      return { type: m.type };
    default:
      return null;
  }
}
