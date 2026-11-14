import { pushPayload, type PushSubscriptionData } from './push';
import type { TournamentPushState } from './tournament/push';
import type { PushSender } from './webpush';

/**
 * Web Push für Fernpartien (#242, Schritt 5): „Du bist am Zug“ an Geräte, die gerade nicht verbunden sind.
 * Das Abo-Buch liegt im Speicher des Raums (Schlüssel `push`); der Zustand ist derselbe wie beim Turnier,
 * `sent` bleibt hier leer (der Raum entscheidet selbst, wann jemand neu am Zug ist).
 */

/** Ein Zug in einer Fernpartie kann Tage warten, die Meldung darf bis zu einem Tag beim Push-Dienst liegen. */
export const TTL_TURN_S = 24 * 60 * 60;

export interface DeliverTurnOptions {
  retryDelayMs?: number;
  /** Speichert den Zustand, nachdem Abos entzogen wurden. */
  persist?: () => Promise<void>;
}

/**
 * Schickt „Du bist am Zug“ an die Kennungen mit Abo. Der Spam-Schutz (30 Minuten je Art) gilt;
 * 404/410 entzieht das Abo, ein Fehler hält nichts auf. Gibt die Zahl der gesendeten Meldungen zurück.
 */
export async function deliverTurnPush(state: TournamentPushState, tokens: readonly string[], roomCode: string, sender: PushSender, now: number, options: DeliverTurnOptions = {}): Promise<number> {
  const url = `#/raum/${roomCode}`;
  const topic = `y-${roomCode}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32);
  const retryDelay = options.retryDelayMs ?? 2000;
  let sent = 0;
  let changed = false;
  for (const token of new Set(tokens)) {
    const sub: PushSubscriptionData | null = state.book.get(token);
    if (!sub) continue;
    if (!state.limiter.allow(token, 'yourTurn', now)) continue;
    const send = () => sender.send(sub, pushPayload('yourTurn', url), { ttl: TTL_TURN_S, topic });
    try {
      let outcome = await send();
      if (outcome === 'retry') {
        if (retryDelay > 0) await new Promise((resolve) => setTimeout(resolve, retryDelay));
        outcome = await send();
      }
      if (outcome === 'ok') sent += 1;
      if (outcome === 'gone') {
        state.book.removeByEndpoint(sub.endpoint);
        changed = true;
      }
    } catch {
      // Ein kaputter Versand darf nie den Raum stören.
    }
  }
  if (changed || sent > 0) await options.persist?.();
  return sent;
}
