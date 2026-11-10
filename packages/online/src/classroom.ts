import { ROOM_EMOJIS } from './codes';
import type { OrgRole } from './org-roles';
import { DEFAULT_CARD_SECTIONS, parseSections, sanitizeCard, type CardSections, type ClassCard } from './classcard';
import { cleanAvatar, cleanName, crestField } from './names';

/*
 * Klassen (Vorhaben #135, Schritt #150) – Logik ohne Anbieterbindung.
 *
 * Eine Klasse ist eine dauerhafte Gruppe von Pässen (Schulklasse, AG, Verein, Familie). Der Code besteht aus sechs Emoji aus 16
 * (16,7 Millionen Möglichkeiten), weil eine Klasse monatelang lebt. Geheim ist nur die Geräte-Kennung (`token`), mit der jedes Mitglied
 * sich ausweist; nach außen gibt es eine zufällige öffentliche Kennung (`id`) je Mitglied.
 */

export const CLASS_CODE_LENGTH = 6;
export const CLASS_MAX_MEMBERS = 60;
export const CLASS_MAX_PENDING = 30;
export const CLASS_NAME_MAX = 30;
/** Ohne Aktivität wird eine Klasse nach einem Jahr gelöscht. */
export const CLASS_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function randomClassCode(randomInt: (n: number) => number): string {
  let code = '';
  for (let i = 0; i < CLASS_CODE_LENGTH; i++) code += ROOM_EMOJIS[randomInt(ROOM_EMOJIS.length)];
  return code;
}

/** Liest einen Klassencode aus einer Eingabe oder einem Link; null, wenn es keiner ist. */
export function parseClassCode(input: string): string | null {
  const fromLink = /#\/klasse\/([^/?#\s]+)/.exec(input)?.[1];
  const text = fromLink ? decodeURIComponent(fromLink) : input;
  const known = new Set<string>(ROOM_EMOJIS);
  const parts = Array.from(text.normalize('NFC').replace(/[\s︎️‍]/g, ''));
  if (parts.length !== CLASS_CODE_LENGTH || !parts.every((p) => known.has(p))) return null;
  return parts.join('');
}

export interface ClassMember {
  id: string;
  name: string;
  avatar: string;
  crest?: string;
  lead: boolean;
  joinedAt: number;
  /** Spielstand-Schnappschuss für die anderen Mitglieder (#151). */
  card?: ClassCard;
}
export interface ClassPending {
  id: string;
  name: string;
  avatar: string;
  crest?: string;
  at: number;
}
export interface ClassState {
  code: string;
  name: string;
  /** Darf man gerade beitreten? */
  open: boolean;
  /** Müssen Beitritte bestätigt werden? */
  approval: boolean;
  /** Was die Klassenkarten zeigen dürfen (Vorgabe der Leitung). Alte Klassen ohne Angabe zeigen alles. */
  sections?: CardSections;
  createdAt: number;
  lastActive: number;
  /** Mitglieder nach Geräte-Kennung. */
  members: Record<string, ClassMember>;
  pending: Record<string, ClassPending>;
}

/** Was ein Mitglied von der Klasse sieht – nie eine Geräte-Kennung. */
export interface ClassView {
  code: string;
  name: string;
  open: boolean;
  approval: boolean;
  me: string | null;
  lead: boolean;
  /** Ich warte auf Bestätigung. */
  waiting: boolean;
  sections: CardSections;
  members: Pick<ClassMember, 'id' | 'name' | 'avatar' | 'crest' | 'lead' | 'card'>[];
  /** Nur für die Leitung. */
  pending: Pick<ClassPending, 'id' | 'name' | 'avatar'>[];
}

const randomId = (): string => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
const validToken = (token: unknown): token is string => typeof token === 'string' && token.length >= 8 && token.length <= 128;

export function cleanClassName(raw: unknown): string | null {
  return typeof raw === 'string' ? cleanName(raw, CLASS_NAME_MAX) : null;
}

export function createClass(code: string, className: unknown, who: { token: unknown; name: unknown; avatar?: unknown; crest?: unknown }, now: number): ClassState | string {
  const name = cleanClassName(className);
  const own = typeof who.name === 'string' ? cleanName(who.name) : null;
  if (!name || !own || !validToken(who.token)) return 'Name der Klasse oder Profil fehlt.';
  return {
    code,
    name,
    open: true,
    approval: false,
    createdAt: now,
    lastActive: now,
    members: { [who.token]: { id: randomId(), name: own, avatar: cleanAvatar(typeof who.avatar === 'string' ? who.avatar : ''), ...crestField(who.crest), lead: true, joinedAt: now } },
    pending: {},
  };
}

const leads = (state: ClassState): number => Object.values(state.members).filter((m) => m.lead).length;
const byId = <T extends { id: string }>(table: Record<string, T>, id: unknown): [string, T] | null => Object.entries(table).find(([, item]) => item.id === id) ?? null;

export type Outcome = { error: string } | { ok: true };
const fail = (error: string): Outcome => ({ error });
const ok: Outcome = { ok: true };

/** Beitritt: sofort Mitglied oder auf der Warteliste, je nach Einstellung der Leitung. */
export function joinClass(state: ClassState, who: { token: unknown; name: unknown; avatar?: unknown; crest?: unknown }, now: number): Outcome {
  if (!validToken(who.token)) return fail('Ungültige Anmeldung.');
  const name = typeof who.name === 'string' ? cleanName(who.name) : null;
  if (!name) return fail('Bitte zuerst einen Namen wählen.');
  if (state.members[who.token]) return ok;
  if (!state.open) return fail('Der Beitritt ist gerade geschlossen.');
  const entry = { name, avatar: cleanAvatar(typeof who.avatar === 'string' ? who.avatar : ''), ...crestField(who.crest) };
  if (state.approval) {
    if (!state.pending[who.token] && Object.keys(state.pending).length >= CLASS_MAX_PENDING) return fail('Es warten schon zu viele auf Bestätigung.');
    state.pending[who.token] = { id: randomId(), ...entry, at: now };
    state.lastActive = now;
    return ok;
  }
  if (Object.keys(state.members).length >= CLASS_MAX_MEMBERS) return fail('Die Klasse ist voll.');
  state.members[who.token] = { id: randomId(), ...entry, lead: false, joinedAt: now };
  state.lastActive = now;
  return ok;
}

/** Die Leitung trägt ein Mitglied ein, etwa ein Kind mit Klassenausweis (#152); Beitrittssperre und Bestätigung gelten dafür nicht. */
export function enrollMember(state: ClassState, leaderToken: unknown, who: { token: unknown; name: unknown; avatar?: unknown }, now: number): Outcome {
  const denied = mustLead(state, leaderToken);
  if (denied) return denied;
  if (!validToken(who.token)) return fail('Ungültige Kennung.');
  const name = typeof who.name === 'string' ? cleanName(who.name) : null;
  if (!name) return fail('Der Name ist nicht erlaubt.');
  if (state.members[who.token]) return ok;
  if (Object.keys(state.members).length >= CLASS_MAX_MEMBERS) return fail('Die Klasse ist voll.');
  state.members[who.token] = { id: randomId(), name, avatar: cleanAvatar(typeof who.avatar === 'string' ? who.avatar : ''), lead: false, joinedAt: now };
  state.lastActive = now;
  return ok;
}

/** Ändert Name, Bild und Wappen eines Mitglieds (nach Änderungen am Profil). */
export function updateMember(state: ClassState, token: unknown, who: { name?: unknown; avatar?: unknown; crest?: unknown }, now: number): Outcome {
  const member = validToken(token) ? state.members[token] : undefined;
  if (!member) return fail('Du bist nicht in dieser Klasse.');
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

export function leaveClass(state: ClassState, token: unknown): Outcome {
  if (!validToken(token)) return fail('Ungültige Anmeldung.');
  delete state.pending[token];
  const member = state.members[token];
  if (!member) return ok;
  if (member.lead && leads(state) === 1 && Object.keys(state.members).length > 1) return fail('Du bist die einzige Leitung. Ernenne zuerst jemand anderen oder löse die Klasse auf.');
  delete state.members[token];
  return ok;
}

const mustLead = (state: ClassState, token: unknown): Outcome | null => (validToken(token) && state.members[token]?.lead ? null : fail('Das darf nur die Leitung.'));

export function decide(state: ClassState, token: unknown, id: unknown, accept: boolean, now: number): Outcome {
  const denied = mustLead(state, token);
  if (denied) return denied;
  const found = byId(state.pending, id);
  if (!found) return fail('Diese Anfrage gibt es nicht (mehr).');
  const [key, entry] = found;
  delete state.pending[key];
  if (accept) {
    if (Object.keys(state.members).length >= CLASS_MAX_MEMBERS) return fail('Die Klasse ist voll.');
    state.members[key] = { id: entry.id, name: entry.name, avatar: entry.avatar, ...(entry.crest ? { crest: entry.crest } : {}), lead: false, joinedAt: now };
  }
  state.lastActive = now;
  return ok;
}

export function removeMember(state: ClassState, token: unknown, id: unknown): Outcome {
  const denied = mustLead(state, token);
  if (denied) return denied;
  const found = byId(state.members, id);
  if (!found) return fail('Dieses Mitglied gibt es nicht.');
  if (found[1].lead) return fail('Eine Leitung kann nur selbst gehen oder die Klasse auflösen.');
  delete state.members[found[0]];
  return ok;
}

export function setLead(state: ClassState, token: unknown, id: unknown, lead: boolean): Outcome {
  const denied = mustLead(state, token);
  if (denied) return denied;
  const found = byId(state.members, id);
  if (!found) return fail('Dieses Mitglied gibt es nicht.');
  if (!lead && found[1].lead && leads(state) === 1) return fail('Es muss mindestens eine Leitung geben.');
  found[1].lead = lead;
  return ok;
}

export function configureClass(state: ClassState, token: unknown, change: { name?: unknown; open?: unknown; approval?: unknown; sections?: unknown }, now: number): Outcome {
  const denied = mustLead(state, token);
  if (denied) return denied;
  if (change.name !== undefined) {
    const name = cleanClassName(change.name);
    if (!name) return fail('Der Name der Klasse ist nicht erlaubt.');
    state.name = name;
  }
  if (typeof change.open === 'boolean') state.open = change.open;
  if (typeof change.approval === 'boolean') state.approval = change.approval;
  const sections = parseSections(change.sections);
  if (sections && Object.keys(sections).length > 0) {
    state.sections = { ...sectionsOf(state), ...sections };
    // Was die Klasse nicht mehr zeigen will, fällt aus den vorhandenen Karten.
    for (const member of Object.values(state.members)) if (member.card) member.card = sanitizeCard(member.card, state.sections, member.card.at) ?? undefined;
  }
  state.lastActive = now;
  return ok;
}

export const mayDissolve = (state: ClassState, token: unknown): boolean => validToken(token) && state.members[token]?.lead === true;
export const isClassExpired = (state: ClassState, now: number): boolean => now >= state.lastActive + CLASS_TTL_MS;

export const sectionsOf = (state: ClassState): CardSections => ({ ...DEFAULT_CARD_SECTIONS, ...state.sections });

/** Legt die eigene Klassenkarte ab; die Klasse bestimmt, was sie enthalten darf. */
export function putCard(state: ClassState, token: unknown, card: unknown, now: number): Outcome {
  const member = validToken(token) ? state.members[token] : undefined;
  if (!member) return fail('Du bist nicht in dieser Klasse.');
  const clean = sanitizeCard(card, sectionsOf(state), now);
  if (!clean) return fail('Ungültige Karte.');
  member.card = clean;
  state.lastActive = now;
  return ok;
}

/** Die Sicht für ein Gerät. Ein Fremder sieht nur Name und Zustand, nicht die Mitglieder. */
export function classView(state: ClassState, token: unknown): ClassView {
  const member = validToken(token) ? state.members[token] : undefined;
  const lead = member?.lead === true;
  const waiting = validToken(token) && !!state.pending[token];
  return {
    code: state.code,
    name: state.name,
    open: state.open,
    approval: state.approval,
    sections: sectionsOf(state),
    me: member?.id ?? null,
    lead,
    waiting,
    members: member ? Object.values(state.members).map(({ id, name, avatar, crest, lead: l, card }) => ({ id, name, avatar, ...(crest ? { crest } : {}), lead: l, ...(card ? { card } : {}) })) : [],
    pending: lead ? Object.values(state.pending).map(({ id, name, avatar }) => ({ id, name, avatar })) : [],
  };
}

/**
 * Rollen einer Klasse im Rollenmodell der Organisationen (#232): Eine Klasse ist eine Gruppe mit Lehrkräften als Leitung. Die
 * dienstälteste Leitung gilt als Betreiber, weitere Leitungen als Leitung, Schüler haben keine Rolle. So kann eine Klasse
 * Turniere und Serien tragen, ohne dass ihr Speicher umgebaut werden muss.
 */
export function classRoles(state: ClassState, token: unknown): OrgRole[] {
  const member = validToken(token) ? state.members[token] : undefined;
  if (!member?.lead) return [];
  const oldest = Object.entries(state.members)
    .filter(([, m]) => m.lead)
    .sort(([, a], [, b]) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0];
  return oldest?.[0] === token ? ['operator'] : ['lead'];
}
