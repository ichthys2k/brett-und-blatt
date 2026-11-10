import { ORG_KINDS, cleanOrgName, type OrgKind } from './org';
import { cleanAvatar, cleanName, crestField } from './names';

/*
 * Anträge auf eine Organisation (#217, Schritt #228): Wer eine Organisation will, stellt einen Antrag; der Betreiber der Plattform
 * gibt frei oder lehnt ab. Bei der Freigabe entsteht die Organisation, der Antragsteller wird ihr Betreiber. Reine Logik; das
 * Durable Object `OrgDesk` hält das Buch.
 */

export type OrgRequestStatus = 'open' | 'approved' | 'rejected';
export const ORG_PURPOSE_MAX = 200;
export const ORG_NOTE_MAX = 200;
/** Höchstens so viele offene Anträge insgesamt; entschiedene verschwinden nach 30 Tagen. */
export const ORG_REQUESTS_OPEN_MAX = 200;
export const ORG_REQUESTS_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

export interface OrgRequest {
  id: string;
  /** Kennung des Antragstellers (geheim; wird bei der Freigabe zur Kennung des Betreibers). */
  token: string;
  /** Profil des Antragstellers, damit der Betreiber weiß, wer fragt. */
  name: string;
  avatar: string;
  crest?: string;
  orgName: string;
  kind: OrgKind;
  purpose: string;
  at: number;
  status: OrgRequestStatus;
  decidedAt?: number;
  /** Nach der Freigabe: Code der Organisation. */
  code?: string;
  /** Anmerkung des Betreibers, vor allem bei Ablehnung. */
  note?: string;
}

export interface OrgDeskState {
  requests: OrgRequest[];
}

export const emptyDesk = (): OrgDeskState => ({ requests: [] });

const validToken = (token: unknown): token is string => typeof token === 'string' && token.length >= 8 && token.length <= 128;
const randomId = (): string => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');

export type DeskOutcome<T = object> = ({ error: string } | ({ ok: true } & T));

/** Entschiedene Anträge, die älter als 30 Tage sind, fallen weg. */
export function pruneDesk(desk: OrgDeskState, now: number): void {
  desk.requests = desk.requests.filter((r) => r.status === 'open' || now - (r.decidedAt ?? r.at) < ORG_REQUESTS_KEEP_MS);
}

/** Stellt einen Antrag. Je Pass gibt es höchstens einen offenen. */
export function submitRequest(desk: OrgDeskState, input: { token: unknown; name: unknown; avatar?: unknown; crest?: unknown; orgName: unknown; kind: unknown; purpose: unknown }, now: number): DeskOutcome<{ id: string }> {
  pruneDesk(desk, now);
  if (!validToken(input.token)) return { error: 'Ungültige Anmeldung.' };
  const name = typeof input.name === 'string' ? cleanName(input.name) : null;
  if (!name) return { error: 'Bitte zuerst einen Namen wählen.' };
  const orgName = cleanOrgName(input.orgName);
  const kind = ORG_KINDS.find((k) => k === input.kind);
  if (!orgName || !kind) return { error: 'Name oder Art der Organisation fehlt.' };
  const purpose = typeof input.purpose === 'string' ? cleanName(input.purpose, ORG_PURPOSE_MAX) : null;
  if (!purpose) return { error: 'Bitte kurz beschreiben, wofür die Organisation gedacht ist.' };
  if (desk.requests.some((r) => r.token === input.token && r.status === 'open')) return { error: 'Du hast schon einen offenen Antrag.' };
  if (desk.requests.filter((r) => r.status === 'open').length >= ORG_REQUESTS_OPEN_MAX) return { error: 'Gerade sind zu viele Anträge offen. Bitte später noch einmal.' };
  const request: OrgRequest = { id: randomId(), token: input.token, name, avatar: cleanAvatar(typeof input.avatar === 'string' ? input.avatar : ''), ...crestField(input.crest), orgName, kind, purpose, at: now, status: 'open' };
  desk.requests.push(request);
  return { ok: true, id: request.id };
}

/** Lehnt einen offenen Antrag ab oder markiert ihn als genehmigt (die Organisation legt der Aufrufer an, danach `setApproved`). */
export function decideRequest(desk: OrgDeskState, id: unknown, approve: boolean, note: unknown, now: number): DeskOutcome<{ request: OrgRequest }> {
  const request = desk.requests.find((r) => r.id === id);
  if (!request) return { error: 'Diesen Antrag gibt es nicht.' };
  if (request.status !== 'open') return { error: 'Dieser Antrag ist schon entschieden.' };
  if (!approve) {
    request.status = 'rejected';
    request.decidedAt = now;
    const text = typeof note === 'string' ? cleanName(note, ORG_NOTE_MAX) : null;
    if (text) request.note = text;
  }
  return { ok: true, request };
}

/** Trägt nach dem Anlegen der Organisation den Code ein. */
export function setApproved(desk: OrgDeskState, id: string, code: string, now: number): void {
  const request = desk.requests.find((r) => r.id === id);
  if (!request) return;
  request.status = 'approved';
  request.code = code;
  request.decidedAt = now;
}

/** Was der Betreiber sieht: ohne Kennung. */
export interface OrgRequestListing {
  id: string;
  name: string;
  avatar: string;
  orgName: string;
  kind: OrgKind;
  purpose: string;
  at: number;
}
export const openRequests = (desk: OrgDeskState): OrgRequestListing[] =>
  desk.requests.filter((r) => r.status === 'open').map(({ id, name, avatar, orgName, kind, purpose, at }) => ({ id, name, avatar, orgName, kind, purpose, at }));

/** Was ein Antragsteller über seine eigenen Anträge erfährt. */
export interface OrgRequestMine {
  id: string;
  orgName: string;
  kind: OrgKind;
  at: number;
  status: OrgRequestStatus;
  code?: string;
  note?: string;
}
export const requestsOf = (desk: OrgDeskState, token: unknown): OrgRequestMine[] =>
  validToken(token) ? desk.requests.filter((r) => r.token === token).map(({ id, orgName, kind, at, status, code, note }) => ({ id, orgName, kind, at, status, ...(code ? { code } : {}), ...(note ? { note } : {}) })) : [];
