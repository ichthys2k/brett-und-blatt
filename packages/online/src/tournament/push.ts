import type { TournamentSnapshot } from './types';
import { READY_WINDOW_MS } from './types';
import { isHeld } from './evening';
import { isLocal } from './local-play';
import { dueAt } from './online-play';
import { tokensOf } from './teams';
import { PushBook, PushLimiter, pushPayload, type PushKind, type PushSubscriptionData } from '../push';
import type { PushSender } from '../webpush';

/**
 * Web Push für Turniere (#242, Schritt 4): Welche Meldungen sind fällig, und wer bekommt sie?
 * Reine Logik ohne Anbieterbindung; der Versand hängt an der Schnittstelle `PushSender`.
 *
 * Meldungen gibt es nur für Online-Turniere (nicht vor Ort, nicht `LOKAL-…`) und nur an Teilnehmer
 * mit Abo. Jede Meldung trägt nur Art und Ziel – keine Namen.
 */

/** Erinnerung an die Frist: fest zwei Stunden vorher. */
export const DEADLINE_LEAD_MS = 2 * 60 * 60 * 1000;
/** Lebensdauer beim Push-Dienst. */
export const TTL_CALL_S = 3600;
export const TTL_DEADLINE_S = 7200;
/** Höchstens so viele Sendungen je Durchlauf (Grenze für Unteranfragen je Aufruf eines Durable Object). */
export const PUSH_SENDS_PER_RUN = 25;
/** Gemerkte Schlüssel höchstens; darüber werden die ältesten vergessen. */
export const PUSH_SENT_MAX = 4000;

export interface PushNotice {
  /** Geräte-Kennung des Empfängers. */
  token: string;
  kind: PushKind;
  /** Ziel beim Antippen, z. B. `#/turnier/ABCD2345`. */
  url: string;
  ttl: number;
  topic?: string;
  /** Eindeutig je Empfänger und Anlass; dient dem Merken gesendeter Meldungen. */
  key: string;
}

/** Was ein Turnier-Objekt für Web Push im Speicher hält (unter dem Schlüssel `push`, nicht im Turnier-Stand). */
export interface TournamentPushState {
  book: PushBook;
  limiter: PushLimiter;
  /** Schon gesendete (oder bewusst übergangene) Meldungen, in Reihenfolge des Merkens. */
  sent: Set<string>;
}

export function newTournamentPushState(): TournamentPushState {
  return { book: new PushBook(), limiter: new PushLimiter(), sent: new Set() };
}

export function pushStateToJSON(state: TournamentPushState): unknown {
  return { book: state.book.toJSON(), limiter: state.limiter.toJSON(), sent: [...state.sent] };
}

export function pushStateFromJSON(raw: unknown, options: { allowLocal?: boolean } = {}): TournamentPushState {
  const state = newTournamentPushState();
  if (typeof raw !== 'object' || raw === null) return state;
  const { book, limiter, sent } = raw as { book?: unknown; limiter?: unknown; sent?: unknown };
  state.book = PushBook.fromJSON(book, options);
  state.limiter = PushLimiter.fromJSON(limiter);
  if (Array.isArray(sent)) for (const key of sent) if (typeof key === 'string') state.sent.add(key);
  return state;
}

/** Topic: höchstens 32 Zeichen aus dem base64url-Alphabet. */
function topicOf(prefix: string, id: string): string {
  return `${prefix}-${id}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32);
}

/** Gilt dieses Turnier für Web Push? Nicht vor Ort und nicht ohne Netz geleitet. */
export function pushApplies(s: TournamentSnapshot): boolean {
  return !isLocal(s) && !s.code.startsWith('LOKAL-');
}

/** Teilnehmer, die Meldungen bekommen können: angemeldet, zugelassen, nicht zurückgezogen (Teams: alle Mitglieder). */
function participantTokens(s: TournamentSnapshot, playerId: string): string[] {
  const player = s.players.find((p) => p.id === playerId);
  if (!player || player.withdrawn || player.pending || player.pair) return [];
  return tokensOf(player);
}

/** Alle Meldungen, die jetzt fällig sind – ohne die, deren Schlüssel schon gemerkt ist. `tokens` begrenzt die Empfänger (Standard: alle Teilnehmer). */
export function planTournamentPush(s: TournamentSnapshot, sent: ReadonlySet<string>, now: number, tokens?: ReadonlySet<string>): PushNotice[] {
  if (!pushApplies(s) || s.phase === 'signup') return [];
  const url = `#/turnier/${s.code}`;
  const notices: PushNotice[] = [];
  const add = (token: string, kind: PushKind, subject: string, ttl: number, topic?: string) => {
    if (tokens && !tokens.has(token)) return;
    const key = `${kind}:${subject}:${token}`;
    if (sent.has(key)) return;
    notices.push({ token, kind, url, ttl, key, ...(topic ? { topic } : {}) });
  };

  const everyone = s.players.flatMap((p) => participantTokens(s, p.id));
  if (s.phase === 'running') for (const token of everyone) add(token, 'tournamentStarted', 'turnier', TTL_CALL_S);
  if (s.phase === 'finished') for (const token of everyone) add(token, 'tournamentFinished', 'turnier', TTL_CALL_S);
  if (s.phase !== 'running') return notices;

  const missing = (readyAt: number | null) => readyAt === null || now - readyAt >= READY_WINDOW_MS;

  for (const match of s.matches) {
    if ((match.status !== 'open' && match.status !== 'running') || isHeld(s, match)) continue;
    const ids = match.slots.map((slot) => slot.player);
    if (ids.some((id) => !id)) continue;
    const subject = `${match.id}.${match.replays}`;
    const topic = topicOf('m', match.id);
    ids.forEach((id, side) => {
      for (const token of participantTokens(s, id!)) {
        add(token, 'matchCalled', subject, TTL_CALL_S, topic);
        if (match.status === 'open' && missing(match.readyAt[side] ?? null) && deadlineSoon(s, match, now)) add(token, 'deadline', subject, TTL_DEADLINE_S, topicOf('d', match.id));
      }
    });
  }

  for (const table of s.tables ?? []) {
    if ((table.status !== 'open' && table.status !== 'running') || isHeld(s, { stage: table.stage } as never)) continue;
    const topic = topicOf('m', table.id);
    table.seats.forEach((id, seat) => {
      for (const token of participantTokens(s, id)) {
        add(token, 'matchCalled', table.id, TTL_CALL_S, topic);
        if (table.status === 'open' && missing(table.readyAt[seat] ?? null) && deadlineSoon(s, { stage: table.stage, openedAt: table.openedAt }, now)) add(token, 'deadline', table.id, TTL_DEADLINE_S, topicOf('d', table.id));
      }
    });
  }
  return notices;
}

/** Liegt die Erinnerung (zwei Stunden vor Fristende) in der Vergangenheit, das Fristende aber noch nicht, und wurde die Partie nicht erst danach geöffnet? */
function deadlineSoon(s: TournamentSnapshot, match: { stage: number; openedAt: number | null }, now: number): boolean {
  const due = dueAt(s, match as never);
  const remind = due - DEADLINE_LEAD_MS;
  return now >= remind && now < due && (match.openedAt ?? 0) <= remind;
}

/** Wann die nächste Erinnerung fällig wird (für den Wecker), oder `null`. */
export function nextPushWakeup(s: TournamentSnapshot, now: number): number | null {
  if (!pushApplies(s) || s.phase !== 'running') return null;
  let next: number | null = null;
  const consider = (match: { stage: number; openedAt: number | null; status: string }) => {
    if (match.status !== 'open' || isHeld(s, match as never)) return;
    const remind = dueAt(s, match as never) - DEADLINE_LEAD_MS;
    if (remind <= now || (match.openedAt ?? 0) > remind) return;
    next = next === null ? remind : Math.min(next, remind);
  };
  for (const match of s.matches) if (match.slots.every((slot) => slot.player)) consider(match);
  for (const table of s.tables ?? []) consider(table);
  return next;
}

/**
 * Merkt alle Meldungen, die für diese Kennung jetzt fällig wären, ohne sie zu senden. Wer sich erst jetzt anmeldet,
 * bekommt so nicht nachträglich Meldungen über Vergangenes.
 */
export function claimSilently(s: TournamentSnapshot, state: TournamentPushState, token: string, now: number): void {
  for (const notice of planTournamentPush(s, state.sent, now, new Set([token]))) remember(state, notice.key);
  // Erinnerungen für später bleiben möglich: sie sind jetzt noch nicht fällig und stehen nicht im Plan.
}

function remember(state: TournamentPushState, key: string): void {
  state.sent.add(key);
  if (state.sent.size > PUSH_SENT_MAX) {
    const oldest = state.sent.values().next().value;
    if (oldest !== undefined) state.sent.delete(oldest);
  }
}

export interface RunPushOptions {
  /** Pause vor dem einzigen Wiederholungsversuch bei `retry` (Millisekunden). */
  retryDelayMs?: number;
  /** Speichert den Zustand; wird vor dem Senden (Gemerktes) und danach (entzogene Abos) aufgerufen. */
  persist?: () => Promise<void>;
  maxSends?: number;
}

export interface RunPushResult {
  sent: number;
  removed: number;
  /** Es sind noch Meldungen übrig (Grenze je Durchlauf erreicht): bald noch einmal laufen. */
  more: boolean;
}

/** Sendet die fälligen Meldungen. Fehler halten den Turnierablauf nie auf; gemerkt wird vor dem Senden. */
export async function runTournamentPush(s: TournamentSnapshot, state: TournamentPushState, sender: PushSender, now: number, options: RunPushOptions = {}): Promise<RunPushResult> {
  const result: RunPushResult = { sent: 0, removed: 0, more: false };
  // Nur Empfänger mit Abo; wer keines hat, bekommt nichts (und es wird nichts gemerkt).
  const subscribed = new Set(state.book.toJSON().map((entry) => entry.token));
  if (subscribed.size === 0) return result;
  const plan = planTournamentPush(s, state.sent, now, subscribed);
  if (plan.length === 0) return result;
  const maxSends = options.maxSends ?? PUSH_SENDS_PER_RUN;
  const batch = plan.slice(0, maxSends);
  result.more = plan.length > batch.length;
  for (const notice of batch) remember(state, notice.key);
  await options.persist?.();

  const retryDelay = options.retryDelayMs ?? 2000;
  let changed = false;
  for (const notice of batch) {
    const sub: PushSubscriptionData | null = state.book.get(notice.token);
    if (!sub) continue;
    if (!state.limiter.allow(notice.token, notice.kind, now)) continue;
    const send = () => sender.send(sub, pushPayload(notice.kind, notice.url), { ttl: notice.ttl, ...(notice.topic ? { topic: notice.topic } : {}) });
    try {
      let outcome = await send();
      if (outcome === 'retry') {
        if (retryDelay > 0) await new Promise((resolve) => setTimeout(resolve, retryDelay));
        outcome = await send();
      }
      if (outcome === 'ok') result.sent += 1;
      if (outcome === 'gone') {
        result.removed += state.book.removeByEndpoint(sub.endpoint);
        changed = true;
      }
    } catch {
      // Ein kaputter Versand darf nie den Turnierablauf stören.
    }
  }
  if (changed || batch.length > 0) await options.persist?.();
  return result;
}
