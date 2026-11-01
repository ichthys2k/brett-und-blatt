/*
 * Kategorien und Wortlisten liegen nicht hier, sondern in `content/wortspiele/kategorien.json`.
 * Sie kommen vom Spieleserver (`GET /wortspiele/kategorien`), sonst aus der gleichnamigen
 * Datei neben dem JS-Paket (`prepare` in `index.ts`). Was nicht in den Listen
 * steht, ist nicht falsch – darüber stimmt die Runde ab.
 */
import { normalizeWord } from '@brett-und-blatt/engine';

export interface SprintCategory {
  id: string;
  name: string;
  pack: string;
  words: string[];
}

export interface SprintPack {
  id: string;
  name: string;
}

export interface SprintCatalog {
  status: string;
  packs: SprintPack[];
  categories: SprintCategory[];
}

let catalog: SprintCatalog | null = null;
let byId = new Map<string, SprintCategory>();
/** Je Kategorie die Wörter nach normalisiertem Schlüssel – für schnelles Nachschlagen. */
let keys = new Map<string, Map<string, string>>();

export function setSprintCatalog(next: SprintCatalog): void {
  catalog = next;
  byId = new Map(next.categories.map((c) => [c.id, c]));
  keys = new Map(next.categories.map((c) => [c.id, new Map(c.words.map((w) => [normalizeWord(w), w]))]));
}

export function hasSprintCatalog(): boolean {
  return catalog !== null && catalog.categories.length > 0;
}

export function sprintCatalog(): SprintCatalog {
  if (!catalog) throw new Error('Kategorien-Sprint: Die Wortlisten sind nicht geladen.');
  return catalog;
}

export function categoryById(id: string): SprintCategory | undefined {
  return byId.get(id);
}

/** Wörter einer Kategorie nach normalisiertem Schlüssel. */
export function categoryKeys(id: string): Map<string, string> {
  return keys.get(id) ?? new Map();
}

/** Prüft rohe Daten (Server oder Datei); wirft mit klarer Meldung bei kaputten Daten. */
export function parseSprintCatalog(data: unknown): SprintCatalog {
  const d = data as Partial<SprintCatalog> | null;
  if (!d || !Array.isArray(d.categories) || d.categories.length === 0) throw new Error('Kategorien-Sprint: keine Kategorien gefunden');
  if (!Array.isArray(d.packs) || d.packs.length === 0) throw new Error('Kategorien-Sprint: keine Pakete gefunden');
  const packIds = new Set(d.packs.map((p) => p.id));
  const ids = new Set<string>();
  for (const c of d.categories) {
    if (typeof c.id !== 'string' || ids.has(c.id)) throw new Error(`Kategorien-Sprint: doppelte oder fehlende id (${String(c.id)})`);
    ids.add(c.id);
    if (typeof c.name !== 'string' || !packIds.has(c.pack)) throw new Error(`Kategorien-Sprint: Kategorie ${c.id} unvollständig`);
    if (!Array.isArray(c.words) || !c.words.every((w) => typeof w === 'string' && w.length > 0)) throw new Error(`Kategorien-Sprint: Wörter von ${c.id} ungültig`);
  }
  return { status: String(d.status ?? ''), packs: d.packs, categories: d.categories };
}
