import type { Tournament } from '../tournament';
import type { TournamentClientMessage } from './protocol';

/**
 * Wendet eine Nachricht der Turnierseite auf ein Turnier an. Gemeinsam für den Server (Durable Object) und die
 * Leitung ohne Netz im Browser (W-058 Stufe 6): Beide führen dieselben Regeln aus, nur der Weg der Nachricht
 * unterscheidet sich. `hello` gehört nicht hierher (es betrifft die Verbindung, nicht das Turnier).
 */

export interface Sender {
  token: string;
  name: string;
  avatar: string;
}

export type DispatchResult =
  /** Abgelehnt, mit Begründung. */
  | { kind: 'error'; message: string }
  /** Angenommen; `claim` ist ein Einmalcode, der nur an den Absender geht. */
  | { kind: 'ok'; claim?: { player: string; code: string }; leaderCode?: { code: string; expiresAt: number } }
  /** Das Turnier soll gelöscht werden (nur Hauptleitung). */
  | { kind: 'delete' };

export function applyTournamentMessage(t: Tournament, from: Sender, message: Exclude<TournamentClientMessage, { type: 'hello' }>): DispatchResult {
  const { token } = from;
  let error: string | null = null;
  switch (message.type) {
    case 'approve':
      error = t.approve(token, message.player, message.ok);
      break;
    case 'present':
      error = t.setPresent(token, message.player, message.on);
      break;
    case 'keepLong':
      error = t.setKeepLong(token, message.on);
      break;
    case 'leaderCode': {
      const issued = t.issueLeaderTransfer(token);
      return 'error' in issued ? { kind: 'error', message: issued.error } : { kind: 'ok', leaderCode: issued };
    }
    case 'takeLeader':
      error = t.takeLeadership(token, from.name, message.code);
      break;
    case 'delete':
      return t.mayDelete(token) ? { kind: 'delete' } : { kind: 'error', message: 'Löschen darf nur, wer das Turnier angelegt hat.' };
    case 'join':
      error = t.join(token, from.name, from.avatar);
      break;
    case 'leave':
      error = t.leave(token);
      break;
    case 'claim':
      error = t.claim(token, message.code);
      break;
    case 'start':
      error = t.start(token);
      break;
    case 'ready':
      error = t.ready(token, message.match, message.ready);
      break;
    case 'setResult':
      error = t.setResult(token, message.match, message.winner);
      break;
    case 'extend':
      error = t.extend(token, message.days, message.minutes);
      break;
    case 'startRound':
      error = t.startRound(token);
      break;
    case 'wish':
      error = t.wish(token, message.disciplines);
      break;
    case 'enterTable':
      error = t.enterTable(token, message.table, { ...(message.places ? { places: message.places } : {}), ...(message.scores ? { scores: message.scores } : {}) });
      break;
    case 'withdraw':
      error = t.withdraw(token, message.player);
      break;
    case 'reissue': {
      const issued = t.reissue(token, message.player);
      if ('error' in issued) error = issued.error;
      else return { kind: 'ok', claim: { player: message.player, code: issued.code } };
      break;
    }
    case 'addEntrants':
      error = t.addEntrants(token, message.names);
      break;
    case 'removeEntrant':
      error = t.removeEntrant(token, message.player);
      break;
    case 'enterResult':
      error = t.enterResult(token, message.match, message.score ? { score: message.score } : { winner: message.winner! });
      break;
    case 'setFields':
      error = t.setFields(token, message.count);
      break;
    case 'addHelper':
      error = t.addHelper(token, message.name, message.role);
      break;
    case 'removeHelper':
      error = t.removeHelper(token, message.helper);
      break;
    case 'helper':
      error = t.joinAsHelper(token, message.code);
      break;
    case 'setSchedule':
      error = t.setSchedule(token, message.schedule);
      break;
    case 'setReferees':
      error = t.setReferees(token, message.on);
      break;
  }
  return error ? { kind: 'error', message: error } : { kind: 'ok' };
}
