/*
 * Begriffe, Fragen und Merkmale liegen in `content/wortspiele/wer-bin-ich.json` und kommen
 * vom Spieleserver (`GET /wortspiele/wer-bin-ich`), sonst aus der mitgelieferten Datei.
 * Jeder Begriff nennt die Fragen, auf die die Antwort „Ja“ ist; alle anderen sind „Nein“.
 */

export interface WhoQuestion {
  id: string;
  text: string;
}

export interface WhoTerm {
  id: string;
  name: string;
  emoji: string;
  yes: string[];
  aliases?: string[];
}

export interface WhoPack {
  id: string;
  name: string;
  questions: WhoQuestion[];
  terms: WhoTerm[];
}

export interface WhoCatalog {
  status: string;
  packs: WhoPack[];
}

let catalog: WhoCatalog | null = null;
let packs = new Map<string, WhoPack>();

export function setWhoCatalog(next: WhoCatalog): void {
  catalog = next;
  packs = new Map(next.packs.map((p) => [p.id, p]));
}

export function hasWhoCatalog(): boolean {
  return catalog !== null;
}

export function whoCatalog(): WhoCatalog {
  if (!catalog) throw new Error('Wer bin ich?: Die Begriffe sind nicht geladen.');
  return catalog;
}

export function packById(id: string): WhoPack {
  const pack = packs.get(id) ?? whoCatalog().packs[0];
  if (!pack) throw new Error('Wer bin ich?: kein Begriffspaket');
  return pack;
}

export function termOf(pack: WhoPack, id: string | null): WhoTerm | undefined {
  return id === null ? undefined : pack.terms.find((t) => t.id === id);
}

export function questionOf(pack: WhoPack, id: string): WhoQuestion | undefined {
  return pack.questions.find((q) => q.id === id);
}

/** Wahre Antwort aus dem Katalog: Steht die Frage in den Ja-Merkmalen? */
export function truthOf(term: WhoTerm, questionId: string): boolean {
  return term.yes.includes(questionId);
}

export function parseWhoCatalog(data: unknown): WhoCatalog {
  const d = data as Partial<WhoCatalog> | null;
  if (!d || !Array.isArray(d.packs) || d.packs.length === 0) throw new Error('Wer bin ich?: keine Pakete gefunden');
  for (const pack of d.packs) {
    if (typeof pack.id !== 'string' || !Array.isArray(pack.questions) || !Array.isArray(pack.terms)) throw new Error('Wer bin ich?: Paket unvollständig');
    const questionIds = new Set(pack.questions.map((q) => q.id));
    if (pack.terms.length < 10) throw new Error(`Wer bin ich?: Paket ${pack.id} hat zu wenige Begriffe`);
    for (const term of pack.terms) {
      if (typeof term.id !== 'string' || typeof term.name !== 'string' || !Array.isArray(term.yes)) throw new Error(`Wer bin ich?: Begriff in ${pack.id} unvollständig`);
      if (!term.yes.every((q) => questionIds.has(q))) throw new Error(`Wer bin ich?: ${term.id} nennt eine unbekannte Frage`);
    }
  }
  return { status: String(d.status ?? ''), packs: d.packs };
}
