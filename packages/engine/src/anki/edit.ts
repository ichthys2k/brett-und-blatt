import { cardOrds } from './collection';
import { newId } from './ids';
import { stripHtmlKeepMedia } from './text';
import type { AnkiCollection, AnkiNote, AnkiNotetype, AnkiReq } from './types';

/*
 * Bearbeiten von Notiztypen und Suchen (Vorhaben #101, L4). Reine Funktionen auf unveränderlichen Sammlungen. Notiztypen behalten alle
 * Schlüssel, die wir nicht kennen; beim Ändern von Feldern ziehen die Notizen mit (gleiche Feldzahl und Reihenfolge).
 */

const sec = (ms: number): number => Math.floor(ms / 1000);

// ---------------------------------------------------------------- Welche Felder braucht eine Vorlage? (`req`)

/** Würde die Vorderseite mit diesen nicht leeren Feldern etwas aus einem Feld zeigen? (Anki erzeugt sonst keine Karte; fester Text zählt nicht.) */
export function templateUsesFields(qfmt: string, nonEmpty: ReadonlySet<string>): boolean {
  const tokens = [...qfmt.matchAll(/\{\{([^{}]+?)\}\}/g)].map((m) => m[1]!.trim());
  const walk = (from: number, to: number): boolean => {
    for (let i = from; i < to; i++) {
      const tag = tokens[i]!;
      if (tag.startsWith('!') || tag.startsWith('/')) continue;
      if (tag.startsWith('#') || tag.startsWith('^')) {
        const name = tag.slice(1).trim();
        let depth = 1;
        let end = -1;
        for (let j = i + 1; j < to; j++) {
          const t = tokens[j]!;
          if ((t.startsWith('#') || t.startsWith('^')) && t.slice(1).trim() === name) depth++;
          else if (t.startsWith('/') && t.slice(1).trim() === name && --depth === 0) {
            end = j;
            break;
          }
        }
        if (end < 0) continue;
        const show = tag.startsWith('#') ? nonEmpty.has(name) : !nonEmpty.has(name);
        if (show && walk(i + 1, end)) return true;
        i = end;
        continue;
      }
      const parts = tag.split(':').map((p) => p.trim());
      const field = parts.pop()!;
      // Das Eingabefeld zum Tippen der Antwort zeigt selbst nichts und zählt nicht.
      if (field !== 'FrontSide' && !parts.some((f) => f.toLowerCase() === 'type') && nonEmpty.has(field)) return true;
    }
    return false;
  };
  return walk(0, tokens.length);
}

/** Berechnet, welche Felder jede Vorlage braucht (wie Anki: „any“ = eines genügt, „all“ = alle, „none“ = die Vorlage zeigt nie ein Feld). */
export function computeReq(nt: Pick<AnkiNotetype, 'flds' | 'tmpls' | 'type'>): AnkiReq[] {
  if (nt.type === 1) return [];
  const names = nt.flds.map((f) => f.name);
  return nt.tmpls.map((t, ord): AnkiReq => {
    const all = new Set(names);
    if (!templateUsesFields(t.qfmt, all)) return [ord, 'none', []];
    const any = names.map((n, i) => [n, i] as const).filter(([n]) => templateUsesFields(t.qfmt, new Set([n]))).map(([, i]) => i);
    if (any.length > 0) return [ord, 'any', any];
    const required = names.map((n, i) => [n, i] as const).filter(([n]) => !templateUsesFields(t.qfmt, new Set(names.filter((m) => m !== n)))).map(([, i]) => i);
    return [ord, 'all', required];
  });
}

// ---------------------------------------------------------------- Notiztypen ändern

const withType = (col: AnkiCollection, id: number, change: (nt: AnkiNotetype) => AnkiNotetype, now: number): AnkiCollection => {
  if (!col.notetypes.some((nt) => nt.id === id)) return col;
  return {
    ...col,
    notetypes: col.notetypes.map((nt) => {
      if (nt.id !== id) return nt;
      const next = change(nt);
      return { ...next, mod: sec(now), req: next.type === 1 ? [] : computeReq(next) };
    }),
  };
};
const mapNotes = (col: AnkiCollection, mid: number, change: (fields: string[]) => string[], now: number): AnkiNote[] => col.notes.map((n) => (n.mid === mid ? { ...n, fields: change(n.fields), mod: sec(now) } : n));

/** Ersetzt in den Tags einer Vorlage (`{{Feld}}`, `{{#Feld}}`, `{{filter:Feld}}` …) den Feldnamen. */
export function renameFieldInTemplate(template: string, from: string, to: string): string {
  return template.replace(/\{\{([#^/]?)((?:[^{}:]*:)*)([^{}:]*)\}\}/g, (whole, mark: string, filters: string, name: string) => (name.trim() === from ? `{{${mark}${filters}${to}}}` : whole));
}

export function renameNotetype(col: AnkiCollection, id: number, name: string, now = Date.now()): AnkiCollection {
  const trimmed = name.trim().slice(0, 100);
  if (!trimmed) return col;
  return withType(col, id, (nt) => ({ ...nt, name: trimmed }), now);
}

export function updateNotetypeCss(col: AnkiCollection, id: number, css: string, now = Date.now()): AnkiCollection {
  return withType(col, id, (nt) => ({ ...nt, css: css.slice(0, 50_000) }), now);
}

export function setSortField(col: AnkiCollection, id: number, ord: number, now = Date.now()): AnkiCollection {
  return withType(col, id, (nt) => ({ ...nt, sortf: ord >= 0 && ord < nt.flds.length ? ord : nt.sortf }), now);
}

export function addField(col: AnkiCollection, id: number, name: string, now = Date.now()): AnkiCollection {
  const nt = col.notetypes.find((t) => t.id === id);
  const clean = name.trim().replace(/[:{}"]/g, '').slice(0, 100);
  if (!nt || !clean || nt.flds.some((f) => f.name.toLowerCase() === clean.toLowerCase()) || nt.flds.length >= 40) return col;
  const next = withType(col, id, (t) => ({ ...t, flds: [...t.flds, { ...t.flds[t.flds.length - 1]!, name: clean, ord: t.flds.length, id: undefined, tag: undefined }] }), now);
  return { ...next, notes: mapNotes(next, id, (f) => [...f, ''], now) };
}

export function renameField(col: AnkiCollection, id: number, ord: number, name: string, now = Date.now()): AnkiCollection {
  const nt = col.notetypes.find((t) => t.id === id);
  const clean = name.trim().replace(/[:{}"]/g, '').slice(0, 100);
  const old = nt?.flds[ord]?.name;
  if (!nt || old === undefined || !clean || clean === old || nt.flds.some((f, i) => i !== ord && f.name.toLowerCase() === clean.toLowerCase())) return col;
  return withType(
    col,
    id,
    (t) => ({ ...t, flds: t.flds.map((f, i) => (i === ord ? { ...f, name: clean } : f)), tmpls: t.tmpls.map((tm) => ({ ...tm, qfmt: renameFieldInTemplate(tm.qfmt, old, clean), afmt: renameFieldInTemplate(tm.afmt, old, clean), ...(typeof tm.bqfmt === 'string' ? { bqfmt: renameFieldInTemplate(tm.bqfmt, old, clean) } : {}), ...(typeof tm.bafmt === 'string' ? { bafmt: renameFieldInTemplate(tm.bafmt, old, clean) } : {}) })) }),
    now,
  );
}

export function removeField(col: AnkiCollection, id: number, ord: number, now = Date.now()): AnkiCollection {
  const nt = col.notetypes.find((t) => t.id === id);
  if (!nt || nt.flds.length <= 1 || !nt.flds[ord]) return col;
  const next = withType(col, id, (t) => ({ ...t, flds: t.flds.filter((_, i) => i !== ord).map((f, i) => ({ ...f, ord: i })), sortf: t.sortf === ord ? 0 : t.sortf > ord ? t.sortf - 1 : t.sortf }), now);
  return { ...next, notes: mapNotes(next, id, (f) => f.filter((_, i) => i !== ord), now) };
}

export function moveField(col: AnkiCollection, id: number, from: number, to: number, now = Date.now()): AnkiCollection {
  const nt = col.notetypes.find((t) => t.id === id);
  if (!nt || from === to || !nt.flds[from] || to < 0 || to >= nt.flds.length) return col;
  const order = nt.flds.map((_, i) => i);
  order.splice(to, 0, order.splice(from, 1)[0]!);
  const next = withType(col, id, (t) => ({ ...t, flds: order.map((old, i) => ({ ...t.flds[old]!, ord: i })), sortf: order.indexOf(t.sortf) }), now);
  return { ...next, notes: mapNotes(next, id, (f) => order.map((old) => f[old] ?? ''), now) };
}

export function addTemplate(col: AnkiCollection, id: number, name: string, now = Date.now()): AnkiCollection {
  const nt = col.notetypes.find((t) => t.id === id);
  if (!nt || nt.type === 1 || nt.tmpls.length >= 20) return col;
  const clean = name.trim().slice(0, 100) || `Karte ${nt.tmpls.length + 1}`;
  return withType(col, id, (t) => ({ ...t, tmpls: [...t.tmpls, { ...t.tmpls[t.tmpls.length - 1]!, name: clean, ord: t.tmpls.length, id: undefined }] }), now);
}

export function updateTemplate(col: AnkiCollection, id: number, ord: number, patch: { name?: string; qfmt?: string; afmt?: string }, now = Date.now()): AnkiCollection {
  const nt = col.notetypes.find((t) => t.id === id);
  if (!nt?.tmpls[ord]) return col;
  return withType(
    col,
    id,
    (t) => ({
      ...t,
      tmpls: t.tmpls.map((tm, i) => (i === ord ? { ...tm, ...(patch.name?.trim() ? { name: patch.name.trim().slice(0, 100) } : {}), ...(patch.qfmt !== undefined ? { qfmt: patch.qfmt.slice(0, 50_000) } : {}), ...(patch.afmt !== undefined ? { afmt: patch.afmt.slice(0, 50_000) } : {}) } : tm)),
    }),
    now,
  );
}

/** Löscht eine Vorlage (mindestens eine bleibt); ihre Karten fallen weg, die späteren rücken nach. */
export function removeTemplate(col: AnkiCollection, id: number, ord: number, now = Date.now()): AnkiCollection {
  const nt = col.notetypes.find((t) => t.id === id);
  if (!nt || nt.type === 1 || nt.tmpls.length <= 1 || !nt.tmpls[ord]) return col;
  return withType(col, id, (t) => ({ ...t, tmpls: t.tmpls.filter((_, i) => i !== ord).map((tm, i) => ({ ...tm, ord: i })) }), now);
}

export function cloneNotetype(col: AnkiCollection, id: number, name: string, now = Date.now()): { col: AnkiCollection; id: number } | null {
  const nt = col.notetypes.find((t) => t.id === id);
  if (!nt) return null;
  const newTypeId = newId(now, new Set(col.notetypes.map((t) => t.id)));
  const copy: AnkiNotetype = { ...nt, id: newTypeId, name: name.trim().slice(0, 100) || `${nt.name} (Kopie)`, mod: sec(now), flds: nt.flds.map((f) => ({ ...f, id: undefined })), tmpls: nt.tmpls.map((t) => ({ ...t, id: undefined })) };
  return { col: { ...col, notetypes: [...col.notetypes, copy] }, id: newTypeId };
}

/** Löscht einen Notiztyp, den keine Notiz mehr braucht. */
export function removeNotetype(col: AnkiCollection, id: number, now = Date.now()): AnkiCollection {
  if (col.notes.some((n) => n.mid === id) || col.notetypes.length <= 1) return col;
  return { ...col, notetypes: col.notetypes.filter((t) => t.id !== id), graves: [...col.graves, { kind: 'notetype', key: String(id), at: now }] };
}

/** Wechselt den Notiztyp einer Notiz; `map[i]` ist das alte Feld für das neue Feld `i` (-1 = leer). */
export function changeNotetype(col: AnkiCollection, noteId: number, newMid: number, map: readonly number[], now = Date.now()): AnkiCollection {
  const nt = col.notetypes.find((t) => t.id === newMid);
  const note = col.notes.find((n) => n.id === noteId);
  if (!nt || !note || nt.flds.length !== map.length) return col;
  const fields = map.map((from) => (from >= 0 ? (note.fields[from] ?? '') : ''));
  return { ...col, notes: col.notes.map((n) => (n.id === noteId ? { ...n, mid: newMid, fields, mod: sec(now) } : n)) };
}

// ---------------------------------------------------------------- Duplikate

/** Gruppen von Notizen mit gleichem ersten Feld (ohne HTML) im selben Notiztyp. */
export function findDuplicates(col: AnkiCollection): AnkiNote[][] {
  const groups = new Map<string, AnkiNote[]>();
  for (const note of col.notes) {
    const key = `${note.mid}\u0000${stripHtmlKeepMedia(note.fields[0] ?? '').trim().toLowerCase()}`;
    if (key.endsWith('\u0000')) continue;
    groups.set(key, [...(groups.get(key) ?? []), note]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Notizen ohne eine einzige Karte (alle Vorderseiten wären leer). */
export function notesWithoutCards(col: AnkiCollection): AnkiNote[] {
  const types = new Map(col.notetypes.map((t) => [t.id, t]));
  return col.notes.filter((n) => {
    const nt = types.get(n.mid);
    return nt ? cardOrds(nt, n.fields).length === 0 : false;
  });
}

// ---------------------------------------------------------------- Suche (Teilmenge der Anki-Suche)

type Term = { negate: boolean; kind: 'text' | 'tag' | 'deck' | 'note' | 'field'; field?: string; value: string };

function tokenizeSearch(query: string): string[] {
  const out: string[] = [];
  const re = /-?(?:[^\s"]+:)?"(?:[^"\\]|\\.)*"|\S+/g;
  for (const m of query.matchAll(re)) out.push(m[0]);
  return out;
}

function toTerm(token: string): Term {
  let t = token;
  const negate = t.startsWith('-') && t.length > 1;
  if (negate) t = t.slice(1);
  const colon = /^([^\s":]+):(.*)$/s.exec(t);
  const unquote = (s: string) => (s.startsWith('"') && s.endsWith('"') && s.length >= 2 ? s.slice(1, -1).replace(/\\(.)/g, '$1') : s);
  if (colon) {
    const key = colon[1]!.toLowerCase();
    const value = unquote(colon[2]!);
    if (key === 'tag') return { negate, kind: 'tag', value };
    if (key === 'deck') return { negate, kind: 'deck', value };
    if (key === 'note') return { negate, kind: 'note', value };
    return { negate, kind: 'field', field: colon[1]!, value };
  }
  return { negate, kind: 'text', value: unquote(t) };
}

const glob = (pattern: string): RegExp => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/_/g, '.')}$`, 'is');

function matchTerm(col: AnkiCollection, note: AnkiNote, term: Term): boolean {
  const nt = col.notetypes.find((t) => t.id === note.mid);
  let ok: boolean;
  switch (term.kind) {
    case 'tag': {
      const re = glob(term.value);
      ok = term.value === 'none' ? note.tags.length === 0 : note.tags.some((tag) => re.test(tag) || tag.toLowerCase().startsWith(`${term.value.toLowerCase()}::`));
      break;
    }
    case 'deck': {
      const re = glob(term.value);
      const deck = col.decks.find((d) => d.id === note.did);
      ok = !!deck && (re.test(deck.name) || deck.name.toLowerCase().startsWith(`${term.value.toLowerCase()}::`));
      break;
    }
    case 'note':
      ok = !!nt && glob(term.value).test(nt.name);
      break;
    case 'field': {
      const at = nt?.flds.findIndex((f) => f.name.toLowerCase() === term.field!.toLowerCase()) ?? -1;
      ok = at >= 0 && glob(term.value).test(stripHtmlKeepMedia(note.fields[at] ?? '').trim());
      break;
    }
    default: {
      const needle = term.value.toLowerCase();
      ok = !needle || note.fields.some((f) => stripHtmlKeepMedia(f).toLowerCase().includes(needle)) || note.tags.some((tag) => tag.toLowerCase().includes(needle));
    }
  }
  return term.negate ? !ok : ok;
}

/** Sucht Notizen: freie Wörter (alle müssen vorkommen), `"Satz mit Leerzeichen"`, `-nicht`, `tag:x`, `deck:x`, `note:Typ`, `feld:wert`, `a or b`; `*` und `_` sind Platzhalter. */
export function searchNotes(col: AnkiCollection, query: string): AnkiNote[] {
  const tokens = tokenizeSearch(query.trim());
  if (tokens.length === 0) return col.notes;
  const groups: Term[][] = [[]];
  for (const token of tokens) {
    if (token.toLowerCase() === 'or') groups.push([]);
    else if (token.toLowerCase() !== 'and') groups[groups.length - 1]!.push(toTerm(token));
  }
  return col.notes.filter((note) => groups.some((terms) => terms.length > 0 && terms.every((term) => matchTerm(col, note, term))));
}

// ---------------------------------------------------------------- Stapel (Baum)

export interface DeckNode {
  id: number;
  name: string;
  /** Letzter Namensteil. */
  label: string;
  depth: number;
  /** Notizen in diesem Stapel (ohne Unterstapel) und mit. */
  own: number;
  total: number;
}

/** Die Stapel als flache Liste in Baumreihenfolge. */
export function deckTree(col: AnkiCollection): DeckNode[] {
  const counts = new Map<number, number>();
  for (const n of col.notes) counts.set(n.did, (counts.get(n.did) ?? 0) + 1);
  return [...col.decks]
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map((d) => {
      const own = counts.get(d.id) ?? 0;
      const total = col.decks.filter((o) => o.id === d.id || o.name.startsWith(`${d.name}::`)).reduce((sum, o) => sum + (counts.get(o.id) ?? 0), 0);
      const parts = d.name.split('::');
      return { id: d.id, name: d.name, label: parts[parts.length - 1]!, depth: parts.length - 1, own, total };
    });
}

// ---------------------------------------------------------------- Mehrere Notizen auf einmal

const touch = (col: AnkiCollection, ids: ReadonlySet<number>, change: (n: AnkiNote) => AnkiNote, now: number): AnkiCollection => ({ ...col, notes: col.notes.map((n) => (ids.has(n.id) ? { ...change(n), mod: sec(now) } : n)) });

/** Verschiebt Notizen in einen anderen Stapel. */
export function moveNotes(col: AnkiCollection, ids: readonly number[], deckId: number, now = Date.now()): AnkiCollection {
  if (!col.decks.some((d) => d.id === deckId)) return col;
  return touch(col, new Set(ids), (n) => (n.did === deckId ? n : { ...n, did: deckId }), now);
}

/** Fügt Tags hinzu oder nimmt sie weg. */
export function tagNotes(col: AnkiCollection, ids: readonly number[], add: readonly string[], remove: readonly string[] = [], now = Date.now()): AnkiCollection {
  const clean = (list: readonly string[]) => list.map((t) => t.trim().replace(/\s+/g, '_')).filter(Boolean);
  const plus = clean(add);
  const minus = new Set(clean(remove).map((t) => t.toLowerCase()));
  return touch(col, new Set(ids), (n) => ({ ...n, tags: [...new Set([...n.tags.filter((t) => !minus.has(t.toLowerCase())), ...plus])] }), now);
}

/** Standard-Zuordnung beim Wechsel des Notiztyps: Felder gleichen Namens, sonst nach Reihenfolge. */
export function defaultFieldMap(from: Pick<AnkiNotetype, 'flds'>, to: Pick<AnkiNotetype, 'flds'>): number[] {
  return to.flds.map((f, i) => {
    const byName = from.flds.findIndex((o) => o.name === f.name);
    return byName >= 0 ? byName : i < from.flds.length ? i : -1;
  });
}

/** Wechselt den Notiztyp mehrerer Notizen (alle mit demselben alten Typ) mit derselben Zuordnung. */
export function changeNotetypeMany(col: AnkiCollection, ids: readonly number[], newMid: number, map: readonly number[], now = Date.now()): AnkiCollection {
  let next = col;
  for (const id of ids) next = changeNotetype(next, id, newMid, map, now);
  return next;
}
