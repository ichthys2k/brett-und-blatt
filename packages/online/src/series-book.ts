import { seriesStandings, type PointScheme, type SeriesRow, type SeriesTournament } from './series';

/*
 * Serien auf dem Server (#205): Eine Serie hat Namen, Code und Link. Beendete Turniere melden ihr Ergebnis von selbst an die
 * Serie, wenn die Turnierleitung das Turnier mit dem Zuordnungscode (`Code-Schlüssel`) zugeordnet hat; die Rangliste (Punkte nach
 * Platz, Elo) wird bei jeder Sicht neu aus den gemeldeten Turnieren gerechnet. Reine Logik ohne Anbieterbindung; Speicher und
 * Frist stehen im Durable Object `SeriesRoom` (apps/server).
 */

/** Ein Jahr nach der letzten Aktivität, verlängerbar. */
export const SERIES_KEEP_MS = 365 * 24 * 60 * 60 * 1000;
export const SERIES_MAX_TOURNAMENTS = 40;
export const SERIES_NAME_LENGTH = 40;
/** Übergabecode der Serienleitung: einen Tag gültig, höchstens fünf Fehlversuche. */
export const SERIES_TRANSFER_MS = 24 * 60 * 60 * 1000;
export const SERIES_TRANSFER_ATTEMPTS = 5;
const ENTRY_MAX_PLAYERS = 256;
const ENTRY_MAX_MATCHES = 2500;
export const SERIES_CODE_PATTERN = /^[2-9A-HJ-NP-Z]{8}$/;
const KEY_PATTERN = /^[2-9A-HJ-NP-Z]{8}$/;

/** Ein gemeldetes Turnier samt Zeitpunkt (Ende, für die Reihenfolge der Elo-Rechnung). */
export interface SeriesEntry extends SeriesTournament {
  /** Turnier-Code. */
  code: string;
  at: number;
}

export interface SeriesRecord {
  code: string;
  name: string;
  scheme: PointScheme;
  leaderToken: string;
  /** Zuordnungscode: Wer ihn kennt, darf Turniere melden. Nur die Leitung sieht ihn. */
  linkKey: string;
  createdAt: number;
  lastActive: number;
  entries: SeriesEntry[];
  /** Offene Übergabe der Leitung auf ein anderes Gerät (wie bei Turnieren, #203). */
  transfer?: { code: string; expiresAt: number; attempts: number };
}

export interface SeriesView {
  code: string;
  name: string;
  scheme: PointScheme;
  tournaments: { code: string; name: string; at: number; players: number }[];
  standings: SeriesRow[];
  isLeader: boolean;
  /** Nur für die Leitung: der Zuordnungscode (`Code-Schlüssel`). */
  link?: string;
  expiresAt: number;
}

export interface SeriesDeps {
  now: () => number;
  randomKey: () => string;
}

const clean = (text: unknown, max: number) => (typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export class SeriesBook {
  private constructor(
    private s: SeriesRecord,
    private deps: SeriesDeps,
  ) {}

  static create(code: string, name: string, scheme: PointScheme, leaderToken: string, deps: SeriesDeps): SeriesBook | string {
    const title = clean(name, SERIES_NAME_LENGTH);
    if (!title) return 'Bitte einen Namen für die Serie eingeben.';
    if (scheme !== 'linear' && scheme !== 'f1') return 'Unbekannte Punktewertung.';
    if (leaderToken.length < 16 || leaderToken.length > 100) return 'Ungültige Kennung.';
    const now = deps.now();
    return new SeriesBook({ code, name: title, scheme, leaderToken, linkKey: deps.randomKey(), createdAt: now, lastActive: now, entries: [] }, deps);
  }

  static restore(record: SeriesRecord, deps: SeriesDeps): SeriesBook {
    return new SeriesBook(record, deps);
  }

  snapshot(): SeriesRecord {
    return this.s;
  }

  get code(): string {
    return this.s.code;
  }

  expiresAt(): number {
    return this.s.lastActive + SERIES_KEEP_MS;
  }

  mayManage(token: string): boolean {
    return token !== '' && token === this.s.leaderToken;
  }

  /** Passt der Schlüssel? (Der Turnier-Raum prüft damit die Zuordnung.) */
  accepts(key: string): boolean {
    return KEY_PATTERN.test(key) && key === this.s.linkKey;
  }

  /** Ein beendetes Turnier meldet sein Ergebnis; ein erneutes Melden ersetzt den alten Eintrag. */
  report(key: string, entry: SeriesEntry): string | null {
    if (!this.accepts(key)) return 'Der Zuordnungscode passt nicht.';
    const players = entry.players.slice(0, ENTRY_MAX_PLAYERS).map((p) => ({ id: clean(p.id, 12), name: clean(p.name, 24), ...(p.pair ? { pair: true } : {}), ...(p.key && /^[0-9a-f]{16}$/.test(p.key) ? { key: p.key } : {}) }));
    const ids = new Set(players.map((p) => p.id));
    const matches = entry.matches.slice(0, ENTRY_MAX_MATCHES).map((m) => ({ stage: m.stage, id: clean(m.id, 20), slots: m.slots.map((slot) => ({ player: slot.player && ids.has(slot.player) ? slot.player : null })), outcome: m.outcome }));
    const ranking = entry.ranking.filter((id) => ids.has(id));
    const next: SeriesEntry = { code: clean(entry.code, 12), name: clean(entry.name, 40), at: entry.at, players, matches, ranking };
    const others = this.s.entries.filter((e) => e.code !== next.code);
    if (others.length >= SERIES_MAX_TOURNAMENTS) return `Eine Serie nimmt höchstens ${SERIES_MAX_TOURNAMENTS} Turniere auf.`;
    this.s.entries = [...others, next].sort((a, b) => a.at - b.at);
    this.touch();
    return null;
  }

  rename(token: string, name: string): string | null {
    if (!this.mayManage(token)) return 'Das darf nur die Leitung der Serie.';
    const title = clean(name, SERIES_NAME_LENGTH);
    if (!title) return 'Bitte einen Namen eingeben.';
    this.s.name = title;
    this.touch();
    return null;
  }

  setScheme(token: string, scheme: PointScheme): string | null {
    if (!this.mayManage(token)) return 'Das darf nur die Leitung der Serie.';
    if (scheme !== 'linear' && scheme !== 'f1') return 'Unbekannte Punktewertung.';
    this.s.scheme = scheme;
    this.touch();
    return null;
  }

  /** Nimmt ein Turnier wieder aus der Serie. */
  remove(token: string, code: string): string | null {
    if (!this.mayManage(token)) return 'Das darf nur die Leitung der Serie.';
    if (!this.s.entries.some((e) => e.code === code)) return 'Dieses Turnier gehört nicht zur Serie.';
    this.s.entries = this.s.entries.filter((e) => e.code !== code);
    this.touch();
    return null;
  }

  /** Erzeugt einen Einmalcode, mit dem ein anderes Gerät die Leitung der Serie übernimmt. */
  issueTransfer(token: string): { code: string; expiresAt: number } | { error: string } {
    if (!this.mayManage(token)) return { error: 'Das darf nur die Leitung der Serie.' };
    const code = this.deps.randomKey();
    const expiresAt = this.deps.now() + SERIES_TRANSFER_MS;
    this.s.transfer = { code, expiresAt, attempts: 0 };
    this.touch();
    return { code, expiresAt };
  }

  /** Dieses Gerät übernimmt die Leitung; das bisherige Gerät ist danach nicht mehr Leitung. */
  takeLeadership(token: string, code: string): string | null {
    const transfer = this.s.transfer;
    if (token.length < 16 || token.length > 100) return 'Dieses Gerät kann die Leitung nicht übernehmen.';
    if (!transfer) return 'Es liegt keine Übergabe vor.';
    if (this.deps.now() >= transfer.expiresAt) {
      delete this.s.transfer;
      return 'Der Übergabecode ist abgelaufen. Die Leitung erzeugt einen neuen.';
    }
    if (token === this.s.leaderToken) return 'Dieses Gerät ist schon die Leitung.';
    if (code.trim().toUpperCase() !== transfer.code) {
      transfer.attempts++;
      if (transfer.attempts >= SERIES_TRANSFER_ATTEMPTS) delete this.s.transfer;
      return 'Dieser Übergabecode passt nicht.';
    }
    this.s.leaderToken = token;
    delete this.s.transfer;
    this.touch();
    return null;
  }

  /** Aufbewahrung um ein Jahr ab heute verlängern. */
  extend(token: string): string | null {
    if (!this.mayManage(token)) return 'Das darf nur die Leitung der Serie.';
    this.touch();
    return null;
  }

  /** Neuer Zuordnungscode (der alte gilt nicht mehr). */
  newKey(token: string): string | null {
    if (!this.mayManage(token)) return 'Das darf nur die Leitung der Serie.';
    this.s.linkKey = this.deps.randomKey();
    this.touch();
    return null;
  }

  view(token: string | null): SeriesView {
    const s = this.s;
    const leader = token !== null && this.mayManage(token);
    return {
      code: s.code,
      name: s.name,
      scheme: s.scheme,
      tournaments: s.entries.map((e) => ({ code: e.code, name: e.name, at: e.at, players: e.players.filter((p) => !p.pair).length })),
      standings: seriesStandings(s.entries, s.scheme),
      isLeader: leader,
      ...(leader ? { link: `${s.code}-${s.linkKey}` } : {}),
      expiresAt: this.expiresAt(),
    };
  }

  private touch(): void {
    this.s.lastActive = this.deps.now();
  }
}

/** Zerlegt einen Zuordnungscode `CODE-SCHLÜSSEL` (Groß-/Kleinschreibung egal); null, wenn die Form nicht stimmt. */
export function parseSeriesLink(text: string): { code: string; key: string } | null {
  const match = /^\s*([2-9A-HJ-NP-Z]{8})[-\s]?([2-9A-HJ-NP-Z]{8})\s*$/.exec(text.toUpperCase());
  return match ? { code: match[1]!, key: match[2]! } : null;
}
