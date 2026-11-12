import { PushBook, PushLimiter, pushPayload, type PushKind } from './push';
import type { SeekMatch } from './seeking';
import type { PushSender } from './webpush';

/**
 * Web Push fürs Schwarze Brett (#65, nach #242): „Jemand ist dabei“, „Vorschlag wartet auf deine Zusage“ und
 * „Der Raum steht“ an Geräte, die gerade nicht am Brett hängen. Reine Logik ohne Anbieterbindung.
 *
 * Abos gehören der Kurzkennung (`owner`) am Brett, nie der Geräte-Kennung, und werden nach `BOARD_PUSH_MAX_AGE_MS`
 * ohne neue Meldung vergessen. Texte tragen nur Art und Ziel – keine Namen und keine Spielnamen.
 */

/** So lange gilt ein Abo am Brett höchstens (Zettel hängt 30 Minuten, mit Verlängern etwas länger). */
export const BOARD_PUSH_MAX_AGE_MS = 3 * 60 * 60 * 1000;
export const TTL_BOARD_S = 600;

export interface BoardPushState {
  book: PushBook;
  limiter: PushLimiter;
}

export function newBoardPushState(): BoardPushState {
  return { book: new PushBook(), limiter: new PushLimiter() };
}

export function boardPushToJSON(state: BoardPushState): unknown {
  return { book: state.book.toJSON(), limiter: state.limiter.toJSON() };
}

export function boardPushFromJSON(raw: unknown, options: { allowLocal?: boolean } = {}): BoardPushState {
  const state = newBoardPushState();
  if (typeof raw !== 'object' || raw === null) return state;
  const { book, limiter } = raw as { book?: unknown; limiter?: unknown };
  state.book = PushBook.fromJSON(book, options);
  state.limiter = PushLimiter.fromJSON(limiter);
  return state;
}

export interface BoardSignature {
  votes: number;
  proposal: string | null;
}

/** Welche Hinweise sind seit `before` fällig? Nur neue Zustimmungen und ein neuer Vorschlag zählen. */
export function boardPushKinds(before: BoardSignature | undefined, after: BoardSignature): PushKind[] {
  if (!before) return [];
  const kinds: PushKind[] = [];
  if (after.votes > before.votes) kinds.push('boardYes');
  if (after.proposal !== null && after.proposal !== before.proposal) kinds.push('boardProposal');
  return kinds;
}

export interface BoardMatchTarget {
  owners: readonly string[];
  code: string;
}

export function matchTarget(match: SeekMatch, code: string): BoardMatchTarget {
  return { owners: match.owners, code };
}

export interface DeliverBoardOptions {
  retryDelayMs?: number;
  persist?: () => Promise<void>;
}

/**
 * Schickt eine Meldung an eine Person, wenn sie ein Abo hat und der Spam-Schutz (30 Minuten je Art) es zulässt.
 * 404/410 entzieht das Abo; ein Fehler hält nichts auf. Gibt zurück, ob gesendet wurde.
 */
export async function deliverBoardPush(state: BoardPushState, owner: string, kind: PushKind, url: string, sender: PushSender, now: number, options: DeliverBoardOptions = {}): Promise<boolean> {
  const sub = state.book.get(owner);
  if (!sub) return false;
  if (!state.limiter.allow(owner, kind, now)) return false;
  const topic = `b-${kind}`.slice(0, 32);
  const send = () => sender.send(sub, pushPayload(kind, url), { ttl: TTL_BOARD_S, topic });
  const retryDelay = options.retryDelayMs ?? 2000;
  let sent = false;
  let changed = false;
  try {
    let outcome = await send();
    if (outcome === 'retry') {
      if (retryDelay > 0) await new Promise((resolve) => setTimeout(resolve, retryDelay));
      outcome = await send();
    }
    sent = outcome === 'ok';
    if (outcome === 'gone') {
      state.book.removeByEndpoint(sub.endpoint);
      changed = true;
    }
  } catch {
    // Ein kaputter Versand darf das Brett nie stören.
  }
  if (changed || sent) await options.persist?.();
  return sent;
}
