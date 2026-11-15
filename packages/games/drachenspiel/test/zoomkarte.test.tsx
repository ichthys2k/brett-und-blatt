import { InspectBody } from '@brett-und-blatt/ui';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CARDS_DB } from '../src/cards';
import { zoomContent } from '../src/ui/parts';

const cosmetics = { ankiOverrides: {}, mediaUrlMap: {} };
const cards = Object.values(CARDS_DB);

describe('Drachenspiel Zoomkarte (#437)', () => {
  it('zeigt die Karte im Rahmen mit Symbolen, Text, Eigenschaften, Herkunft und Spruch', () => {
    const def = cards.find((card) => !card.isSpell && card.keywords?.length && card.quote)!;
    const content = zoomContent({ kind: 'card', defId: def.id }, cosmetics)!;
    const html = renderToStaticMarkup(<InspectBody content={content} onClose={() => undefined} />);
    expect(html).toContain('bub-inspect-custom');
    expect(html).toContain('ds-zoom-face');
    expect(html).toContain(`aria-label="Knappen ${def.cost}"`);
    expect(html).toContain('ds-zoom-traits');
    expect(html).toContain('ds-sym-mark');
    expect(html).toContain(def.quote!);
    expect(html).toContain('Schließen');
    // Die Beschreibung für Titel und Tests bleibt erhalten.
    expect(content.title).toBe(def.name);
    // Ohne Fensterrahmen: Antippen der Karte schließt, kein eigener Knopf im Fenster.
    expect(content.bare).toBe(true);
    expect(html).toContain('ds-zoom-origin');
    expect(content.stats?.map((s) => s.label)).toEqual(['Kosten', 'Angriff', 'Leben']);
  });

  it('ein eigenes Kartenset ersetzt den Regeltext', () => {
    const def = cards.find((card) => card.isSpell && card.text)!;
    const fields = Array.from({ length: 15 }, () => '');
    fields[10] = '<b>Eigener</b> Text';
    const override = { id: 1, guid: def.id, mid: 1, mod: 0, usn: 0, tags: [], fields, sfld: '', csum: 0, flags: 0, data: '' };
    const content = zoomContent({ kind: 'card', defId: def.id }, { ankiOverrides: { [def.id]: override } as never, mediaUrlMap: {} })!;
    expect(renderToStaticMarkup(<InspectBody content={content} />)).toContain('Eigener Text');
  });
});
