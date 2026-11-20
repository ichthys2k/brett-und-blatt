/**
 * #580: Hinweise des Karten-Parsers (ungültige oder begrenzte Werte) erreichen die Übersicht.
 * Weg: Anki-Feld → catalogOf (Parser) → Spieloption (catalogOptionFor) → sanitizeCustomCardCatalog
 * (so liest `Play`/`Room` die Option) → `notices` der Übersicht.
 */
import { describe, expect, it } from 'vitest';
import { sanitizeCustomCardCatalog, BUB_QUARTETT_CARD_FIELDS } from '../packages/engine/src';
import { catalogOf, catalogOptionFor } from '../apps/web/src/lib/activeCardSet';
import { generateTemplateCollection } from '../apps/web/src/lib/gameCardTemplates';

type Feld = (typeof BUB_QUARTETT_CARD_FIELDS)[number];
const at = (name: Feld) => BUB_QUARTETT_CARD_FIELDS.indexOf(name);

describe('Kartenset-Hinweise (#580)', () => {
  it('meldet eine Nichtzahl im Feld Gewicht des Elefanten in der Übersicht', async () => {
    const col = await generateTemplateCollection('quartett-tiere');
    const note = col.notes.find((n) => n.fields[at('Name')] === 'Afrikanischer Elefant');
    expect(note).toBeDefined();
    const slot = [1, 2, 3, 4, 5, 6].find((i) => /gewicht/i.test(note!.fields[at(`Wert${i}_Name` as Feld)] ?? ''));
    expect(slot).toBeDefined();
    note!.fields[at(`Wert${slot}_Zahl` as Feld)] = 'viel';

    const catalog = catalogOf(col)!;
    expect(catalog.notices.some((n) => n.includes('Elefant') && n.includes('Zahl'))).toBe(true);

    const option = await catalogOptionFor('quartett', catalog);
    expect(option).not.toBeNull();
    const shown = sanitizeCustomCardCatalog(option)!; // so lesen Play.tsx und Room.tsx die Option
    expect(shown.notices.some((n) => n.includes('Elefant') && n.includes('Standardwert'))).toBe(true);
  });

  it('ohne ungültige Werte bleibt die Hinweisliste leer', async () => {
    const col = await generateTemplateCollection('quartett-tiere');
    const note = col.notes.find((n) => n.fields[at('Name')] === 'Afrikanischer Elefant')!;
    note.fields[at('Wert1_Zahl')] = '12345';
    const option = await catalogOptionFor('quartett', catalogOf(col));
    expect(sanitizeCustomCardCatalog(option)!.notices).toEqual([]);
  });
});
