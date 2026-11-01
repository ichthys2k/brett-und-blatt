/*
 * Begriffe liegen in `content/wortspiele/begriffe.json` und kommen vom Spieleserver
 * (`GET /wortspiele/begriffe`), sonst aus der mitgelieferten Datei. Feste Sperrwörter gibt es
 * nicht – die legt das andere Team selbst fest. `hints` nutzt nur der Bot (als Vorschläge für
 * Sperrwörter und zum Raten), `clues` sind seine eigenen Umschreibungen.
 */

export interface DuelTerm {
  name: string;
  aliases?: string[];
  hints: string[];
  clues: string[];
}

export interface DuelPack {
  id: string;
  name: string;
  terms: DuelTerm[];
}

export interface DuelCatalog {
  status: string;
  packs: DuelPack[];
}

let catalog: DuelCatalog | null = null;
let packs = new Map<string, DuelPack>();

export function setDuelCatalog(next: DuelCatalog): void {
  catalog = next;
  packs = new Map(next.packs.map((p) => [p.id, p]));
}

export function hasDuelCatalog(): boolean {
  return catalog !== null;
}

export function duelCatalog(): DuelCatalog {
  if (!catalog) throw new Error('Umschreibe-Duell: Die Begriffe sind nicht geladen.');
  return catalog;
}

export function duelPack(id: string): DuelPack {
  const pack = packs.get(id) ?? duelCatalog().packs[0];
  if (!pack) throw new Error('Umschreibe-Duell: kein Begriffspaket');
  return pack;
}

export function parseDuelCatalog(data: unknown): DuelCatalog {
  const d = data as Partial<DuelCatalog> | null;
  if (!d || !Array.isArray(d.packs) || d.packs.length === 0) throw new Error('Umschreibe-Duell: keine Pakete gefunden');
  for (const pack of d.packs) {
    if (typeof pack.id !== 'string' || !Array.isArray(pack.terms) || pack.terms.length < 10) throw new Error(`Umschreibe-Duell: Paket ${String(pack.id)} unvollständig`);
    for (const term of pack.terms) {
      if (typeof term.name !== 'string' || !Array.isArray(term.hints) || !Array.isArray(term.clues)) throw new Error(`Umschreibe-Duell: Begriff in ${pack.id} unvollständig`);
    }
  }
  return { status: String(d.status ?? ''), packs: d.packs };
}
