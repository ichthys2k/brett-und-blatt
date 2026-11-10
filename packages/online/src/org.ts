import { orgCapabilities, canGrantRole, isOrgRole, type OrgRole } from './org-roles';
import type { Capability } from './capabilities';
import { ROOM_EMOJIS } from './codes';
import { cleanAvatar, cleanName, crestField } from './names';

/*
 * Organisationen (#217, Schritt #227) – Logik ohne Anbieterbindung, Konzept `docs/spiele/rechte-und-rollen.md`.
 *
 * Eine Organisation (Verein, Schule, Klasse) hat Mitglieder mit einer oder mehreren Rollen. Geheim ist nur die Kennung aus dem
 * Spielerpass (`token`); nach außen gibt es eine zufällige öffentliche Kennung (`id`) je Mitglied. Rollen kommen auf zwei Wegen:
 * per Einmal-Einladung (Gäste und Neue) oder direkt an ein Mitglied (das Angebot muss angenommen werden). Jede Änderung steht im
 * Protokoll.
 */

export const ORG_CODE_LENGTH = 6;
export const ORG_NAME_MAX = 40;
export const ORG_KINDS = ['verein', 'schule', 'klasse'] as const;
export type OrgKind = (typeof ORG_KINDS)[number];
export type OrgStatus = 'pending' | 'active' | 'blocked';
/** Obergrenze der Mitglieder: 200, bei Klassen 40. */
export const ORG_MAX_MEMBERS: Readonly<Record<OrgKind, number>> = { verein: 200, schule: 200, klasse: 40 };
/** Eine Einladung gilt 24 Stunden; nach fünf falschen Codes ist das Einlösen zehn Minuten gesperrt. */
export const ORG_INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const ORG_INVITE_ATTEMPTS = 5;
export const ORG_INVITE_BLOCK_MS = 10 * 60 * 1000;
export const ORG_MAX_INVITES = 30;
export const ORG_LOG_MAX = 200;
/** Ohne Aktivität wird eine Organisation nach einem Jahr gelöscht. */
export const ORG_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const INVITE_LETTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ORG_INVITE_PATTERN = /^[2-9A-HJ-NP-Z]{8}$/;

export function randomOrgCode(randomInt: (n: number) => number): string {
  let code = '';
  for (let i = 0; i < ORG_CODE_LENGTH; i++) code += ROOM_EMOJIS[randomInt(ROOM_EMOJIS.length)];
  return code;
}

/** Liest einen Organisationscode aus einer Eingabe oder einem Link (`#/org/<Code>`); null, wenn es keiner ist. */
export function parseOrgCode(input: string): string | null {
  const fromLink = /#\/org\/([^/?#\s]+)/.exec(input)?.[1];
  const text = fromLink ? decodeURIComponent(fromLink) : input;
  const known = new Set<string>(ROOM_EMOJIS);
  const parts = Array.from(text.normalize('NFC').replace(/[\s︎️‍]/g, ''));
  if (parts.length !== ORG_CODE_LENGTH || !parts.every((p) => known.has(p))) return null;
  return parts.join('');
}

export type OrgLogAction = 'create' | 'join' | 'invite' | 'inviteRevoked' | 'offer' | 'accept' | 'decline' | 'revoke' | 'remove' | 'leave' | 'config';

export interface OrgLogEntry {
  at: number;
  /** Öffentliche Kennung des Handelnden (null: System). */
  by: string | null;
  action: OrgLogAction;
  /** Öffentliche Kennung der betroffenen Person. */
  subject?: string;
  roles?: OrgRole[];
}

export interface OrgMember {
  id: string;
  name: string;
  avatar: string;
  crest?: string;
  roles: OrgRole[];
  /** Angebotene Rollen, die das Mitglied noch annehmen oder ablehnen muss. */
  offered: OrgRole[];
  joinedAt: number;
  via: 'founder' | 'invite' | 'direct';
}

export interface OrgInvite {
  id: string;
  /** Der Einmal-Code; nur beim Anlegen bekommt ihn der Ersteller zu sehen. */
  code: string;
  roles: OrgRole[];
  by: string;
  at: number;
  expiresAt: number;
}

export interface OrgState {
  code: string;
  name: string;
  kind: OrgKind;
  status: OrgStatus;
  /** Darf die Leitung Rollen vergeben (unterhalb von Leitung und Betreiber)? */
  leaderMayGrant: boolean;
  createdAt: number;
  lastActive: number;
  members: Record<string, OrgMember>;
  invites: OrgInvite[];
  /** Fehlversuche beim Einlösen von Einladungen. */
  redeemFails: { count: number; since: number };
  log: OrgLogEntry[];
}

/** Ein Mitglied in der Sicht; angebotene Rollen sehen nur Betreiber und Leitung. */
export type OrgViewMember = Pick<OrgMember, 'id' | 'name' | 'avatar' | 'crest' | 'roles'> & { offered?: OrgRole[] };

/** Was ein Mitglied von der Organisation sieht – nie eine Kennung und nie einen Einladungs-Code. */
export interface OrgView {
  code: string;
  name: string;
  kind: OrgKind;
  status: OrgStatus;
  leaderMayGrant: boolean;
  /** Ich bin Mitglied. */
  me: { id: string; roles: OrgRole[]; offered: OrgRole[]; capabilities: Capability[] } | null;
  members: OrgViewMember[];
  /** Nur für Betreiber und Leitung. */
  invites: { id: string; roles: OrgRole[]; expiresAt: number }[];
  log: OrgLogEntry[];
}

const randomId = (): string => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
const randomInvite = (): string => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => INVITE_LETTERS[b % INVITE_LETTERS.length]).join('');
const validToken = (token: unknown): token is string => typeof token === 'string' && token.length >= 8 && token.length <= 128;

export type OrgOutcome = { error: string } | { ok: true };
const fail = (error: string): OrgOutcome => ({ error });
const ok: OrgOutcome = { ok: true };

export const cleanOrgName = (raw: unknown): string | null => (typeof raw === 'string' ? cleanName(raw, ORG_NAME_MAX) : null);

/** Liest eine Liste von Rollen aus dem Netz; unbekannte oder doppelte fallen weg. */
export function parseRoles(raw: unknown): OrgRole[] {
  if (!Array.isArray(raw)) return [];
  const roles: OrgRole[] = [];
  for (const item of raw) if (isOrgRole(item) && !roles.includes(item)) roles.push(item);
  return roles;
}

function log(state: OrgState, entry: OrgLogEntry): void {
  state.log.push(entry);
  if (state.log.length > ORG_LOG_MAX) state.log.splice(0, state.log.length - ORG_LOG_MAX);
  state.lastActive = entry.at;
}

const memberOf = (state: OrgState, token: unknown): OrgMember | undefined => (validToken(token) ? state.members[token] : undefined);
const byId = (state: OrgState, id: unknown): [string, OrgMember] | null => Object.entries(state.members).find(([, m]) => m.id === id) ?? null;
const operators = (state: OrgState): number => Object.values(state.members).filter((m) => m.roles.includes('operator')).length;

/** Rollen eines Geräts in dieser Organisation (leer für Fremde). */
export const rolesOf = (state: OrgState, token: unknown): OrgRole[] => memberOf(state, token)?.roles ?? [];
/** Rechte eines Geräts in dieser Organisation: nichts in einer gesperrten oder noch nicht freigegebenen. */
export const orgCapabilitiesOf = (state: OrgState, token: unknown): Capability[] => (state.status === 'active' ? orgCapabilities(rolesOf(state, token)) : []);

/** Legt eine Organisation an; der Anleger wird Betreiber. Antrag und Freigabe (#228) laufen vorher und setzen `status`. */
export function createOrg(code: string, input: { name: unknown; kind: unknown }, founder: { token: unknown; name: unknown; avatar?: unknown; crest?: unknown }, now: number, status: OrgStatus = 'active'): OrgState | string {
  const name = cleanOrgName(input.name);
  const own = typeof founder.name === 'string' ? cleanName(founder.name) : null;
  const kind = ORG_KINDS.find((k) => k === input.kind);
  if (!name || !kind) return 'Name oder Art der Organisation fehlt.';
  if (!own || !validToken(founder.token)) return 'Das Profil fehlt.';
  const id = randomId();
  const state: OrgState = {
    code,
    name,
    kind,
    status,
    leaderMayGrant: true,
    createdAt: now,
    lastActive: now,
    members: { [founder.token]: { id, name: own, avatar: cleanAvatar(typeof founder.avatar === 'string' ? founder.avatar : ''), ...crestField(founder.crest), roles: ['operator'], offered: [], joinedAt: now, via: 'founder' } },
    invites: [],
    redeemFails: { count: 0, since: 0 },
    log: [],
  };
  log(state, { at: now, by: id, action: 'create', roles: ['operator'] });
  return state;
}

const mayManage = (state: OrgState): OrgOutcome | null => (state.status === 'active' ? null : fail('Diese Organisation ist nicht freigegeben.'));

/** Prüft, ob `token` jede der Rollen vergeben darf. */
function denyGrant(state: OrgState, token: unknown, roles: readonly OrgRole[]): OrgOutcome | null {
  const granter = memberOf(state, token);
  if (!granter) return fail('Du bist nicht in dieser Organisation.');
  for (const role of roles) if (!canGrantRole(granter.roles, role, state.leaderMayGrant)) return fail('Diese Rolle darfst du nicht vergeben.');
  return null;
}

/** Legt eine Einmal-Einladung an. Der Code steht nur in der Antwort; die Rollen dürfen auch leer sein (reine Mitgliedschaft). */
export function createInvite(state: OrgState, token: unknown, rawRoles: unknown, now: number): { error: string } | { ok: true; id: string; code: string; expiresAt: number } {
  const problem = mayManage(state);
  if (problem) return problem as { error: string };
  const roles = parseRoles(rawRoles);
  const denied = denyGrant(state, token, roles);
  if (denied) return denied as { error: string };
  if (roles.length === 0 && !canGrantRole(memberOf(state, token)!.roles, 'screen', state.leaderMayGrant)) return { error: 'Das darfst du nicht.' };
  state.invites = state.invites.filter((i) => i.expiresAt > now);
  if (state.invites.length >= ORG_MAX_INVITES) return { error: 'Es gibt schon zu viele offene Einladungen.' };
  let code = randomInvite();
  while (state.invites.some((i) => i.code === code)) code = randomInvite();
  const by = memberOf(state, token)!.id;
  const invite: OrgInvite = { id: randomId(), code, roles, by, at: now, expiresAt: now + ORG_INVITE_TTL_MS };
  state.invites.push(invite);
  log(state, { at: now, by, action: 'invite', roles });
  return { ok: true, id: invite.id, code, expiresAt: invite.expiresAt };
}

export function revokeInvite(state: OrgState, token: unknown, id: unknown, now: number): OrgOutcome {
  const invite = state.invites.find((i) => i.id === id);
  if (!invite) return fail('Diese Einladung gibt es nicht (mehr).');
  const denied = denyGrant(state, token, invite.roles);
  if (denied) return denied;
  state.invites = state.invites.filter((i) => i !== invite);
  log(state, { at: now, by: memberOf(state, token)!.id, action: 'inviteRevoked', roles: invite.roles });
  return ok;
}

const capacity = (state: OrgState): number => ORG_MAX_MEMBERS[state.kind];

/** Löst eine Einladung ein: Wer noch nicht Mitglied ist, wird es; Rollen kommen sofort dazu. Fehlversuche sperren zeitweise. */
export function redeemInvite(state: OrgState, who: { token: unknown; name: unknown; avatar?: unknown; crest?: unknown }, rawCode: unknown, now: number): OrgOutcome {
  const blocked = mayManage(state);
  if (blocked) return blocked;
  if (!validToken(who.token)) return fail('Ungültige Anmeldung.');
  const name = typeof who.name === 'string' ? cleanName(who.name) : null;
  if (!name) return fail('Bitte zuerst einen Namen wählen.');
  if (state.redeemFails.count >= ORG_INVITE_ATTEMPTS && now < state.redeemFails.since + ORG_INVITE_BLOCK_MS) return fail('Zu viele Versuche. Bitte warte ein paar Minuten.');
  if (state.redeemFails.count >= ORG_INVITE_ATTEMPTS) state.redeemFails = { count: 0, since: 0 };
  const code = typeof rawCode === 'string' ? rawCode.toUpperCase().replace(/[\s-]/g, '') : '';
  const invite = ORG_INVITE_PATTERN.test(code) ? state.invites.find((i) => i.code === code && i.expiresAt > now) : undefined;
  if (!invite) {
    state.redeemFails = { count: state.redeemFails.count + 1, since: state.redeemFails.count === 0 ? now : state.redeemFails.since };
    return fail('Dieser Einladungscode gilt nicht (mehr).');
  }
  let member = state.members[who.token];
  if (!member) {
    if (Object.keys(state.members).length >= capacity(state)) return fail('Die Organisation ist voll.');
    member = { id: randomId(), name, avatar: cleanAvatar(typeof who.avatar === 'string' ? who.avatar : ''), ...crestField(who.crest), roles: [], offered: [], joinedAt: now, via: 'invite' };
    state.members[who.token] = member;
  }
  for (const role of invite.roles) if (!member.roles.includes(role)) member.roles.push(role);
  member.offered = member.offered.filter((r) => !member!.roles.includes(r));
  state.invites = state.invites.filter((i) => i !== invite);
  state.redeemFails = { count: 0, since: 0 };
  log(state, { at: now, by: member.id, action: 'join', subject: member.id, roles: invite.roles });
  return ok;
}

/** Bietet einem Mitglied Rollen an; es gelten erst, wenn die Person sie annimmt. */
export function offerRoles(state: OrgState, token: unknown, memberId: unknown, rawRoles: unknown, now: number): OrgOutcome {
  const blocked = mayManage(state);
  if (blocked) return blocked;
  const roles = parseRoles(rawRoles);
  if (roles.length === 0) return fail('Es fehlt eine Rolle.');
  const denied = denyGrant(state, token, roles);
  if (denied) return denied;
  const found = byId(state, memberId);
  if (!found) return fail('Dieses Mitglied gibt es nicht.');
  const target = found[1];
  const fresh = roles.filter((r) => !target.roles.includes(r));
  if (fresh.length === 0) return ok;
  for (const role of fresh) if (!target.offered.includes(role)) target.offered.push(role);
  log(state, { at: now, by: memberOf(state, token)!.id, action: 'offer', subject: target.id, roles: fresh });
  return ok;
}

/** Das Mitglied nimmt seine angebotenen Rollen an oder lehnt sie ab. */
export function answerOffer(state: OrgState, token: unknown, accept: boolean, now: number): OrgOutcome {
  const member = memberOf(state, token);
  if (!member) return fail('Du bist nicht in dieser Organisation.');
  if (member.offered.length === 0) return ok;
  const roles = member.offered;
  member.offered = [];
  if (accept) for (const role of roles) if (!member.roles.includes(role)) member.roles.push(role);
  log(state, { at: now, by: member.id, action: accept ? 'accept' : 'decline', subject: member.id, roles });
  return ok;
}

/** Entzieht Rollen. Der letzte Betreiber behält seine Rolle. */
export function revokeRoles(state: OrgState, token: unknown, memberId: unknown, rawRoles: unknown, now: number): OrgOutcome {
  const roles = parseRoles(rawRoles);
  if (roles.length === 0) return fail('Es fehlt eine Rolle.');
  const denied = denyGrant(state, token, roles);
  if (denied) return denied;
  const found = byId(state, memberId);
  if (!found) return fail('Dieses Mitglied gibt es nicht.');
  const target = found[1];
  if (roles.includes('operator') && target.roles.includes('operator') && operators(state) === 1) return fail('Es muss mindestens einen Betreiber geben.');
  const removed = roles.filter((r) => target.roles.includes(r));
  target.roles = target.roles.filter((r) => !roles.includes(r));
  target.offered = target.offered.filter((r) => !roles.includes(r));
  if (removed.length > 0) log(state, { at: now, by: memberOf(state, token)!.id, action: 'revoke', subject: target.id, roles: removed });
  return ok;
}

/** Nimmt ein Mitglied auf (nur Betreiber). */
export function removeOrgMember(state: OrgState, token: unknown, memberId: unknown, now: number): OrgOutcome {
  const actor = memberOf(state, token);
  if (!actor || !orgCapabilities(actor.roles).includes('manageMembers')) return fail('Das darf nur der Betreiber.');
  const found = byId(state, memberId);
  if (!found) return fail('Dieses Mitglied gibt es nicht.');
  if (found[1].roles.includes('operator') && operators(state) === 1) return fail('Der letzte Betreiber kann nicht entfernt werden.');
  delete state.members[found[0]];
  log(state, { at: now, by: actor.id, action: 'remove', subject: found[1].id });
  return ok;
}

/** Austritt. Der letzte Betreiber geht nicht, solange es andere Mitglieder gibt. */
export function leaveOrg(state: OrgState, token: unknown, now: number): OrgOutcome {
  const member = memberOf(state, token);
  if (!member) return ok;
  if (member.roles.includes('operator') && operators(state) === 1 && Object.keys(state.members).length > 1) return fail('Du bist der einzige Betreiber. Ernenne zuerst jemand anderen oder löse die Organisation auf.');
  delete state.members[token as string];
  log(state, { at: now, by: member.id, action: 'leave', subject: member.id });
  return ok;
}

/** Name und Vergabe-Einstellung ändert nur, wer Mitglieder verwalten darf (Betreiber). */
export function configureOrg(state: OrgState, token: unknown, change: { name?: unknown; leaderMayGrant?: unknown }, now: number): OrgOutcome {
  const actor = memberOf(state, token);
  if (!actor || !orgCapabilities(actor.roles).includes('manageMembers')) return fail('Das darf nur der Betreiber.');
  if (change.name !== undefined) {
    const name = cleanOrgName(change.name);
    if (!name) return fail('Der Name ist nicht erlaubt.');
    state.name = name;
  }
  if (typeof change.leaderMayGrant === 'boolean') state.leaderMayGrant = change.leaderMayGrant;
  log(state, { at: now, by: actor.id, action: 'config' });
  return ok;
}

/** Ändert Name, Bild und Wappen eines Mitglieds (nach Änderungen am Profil). */
export function updateOrgMember(state: OrgState, token: unknown, who: { name?: unknown; avatar?: unknown; crest?: unknown }, now: number): OrgOutcome {
  const member = memberOf(state, token);
  if (!member) return fail('Du bist nicht in dieser Organisation.');
  const name = typeof who.name === 'string' ? cleanName(who.name) : null;
  if (name) member.name = name;
  if (typeof who.avatar === 'string') member.avatar = cleanAvatar(who.avatar) || member.avatar;
  if ('crest' in who) {
    const { crest } = crestField(who.crest);
    if (crest) member.crest = crest;
    else delete member.crest;
  }
  state.lastActive = now;
  return ok;
}

export const isOrgExpired = (state: OrgState, now: number): boolean => now >= state.lastActive + ORG_TTL_MS;
export const mayDissolveOrg = (state: OrgState, token: unknown): boolean => memberOf(state, token)?.roles.includes('operator') === true;

/** Die Sicht für ein Gerät. Fremde sehen nur Name und Zustand. */
export function orgView(state: OrgState, token: unknown, now: number): OrgView {
  const member = memberOf(state, token);
  const roles = member?.roles ?? [];
  const staff = roles.includes('operator') || roles.includes('lead');
  return {
    code: state.code,
    name: state.name,
    kind: state.kind,
    status: state.status,
    leaderMayGrant: state.leaderMayGrant,
    me: member ? { id: member.id, roles: [...member.roles], offered: [...member.offered], capabilities: orgCapabilitiesOf(state, token) } : null,
    members: member ? Object.values(state.members).map(({ id, name, avatar, crest, roles: r, offered }) => ({ id, name, avatar, ...(crest ? { crest } : {}), roles: r, ...(staff && offered.length > 0 ? { offered } : {}) })) : [],
    invites: staff ? state.invites.filter((i) => i.expiresAt > now).map(({ id, roles: r, expiresAt }) => ({ id, roles: r, expiresAt })) : [],
    log: staff ? state.log.slice(-50) : [],
  };
}
