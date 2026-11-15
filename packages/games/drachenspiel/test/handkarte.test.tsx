import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CARDS_DB } from '../src/cards';
import { CardFace, handKind } from '../src/ui/parts';

const cards = Object.values(CARDS_DB);
const find = (test: (id: string) => boolean) => cards.find((card) => test(card.id))!;

describe('Drachenspiel Handkarte (#436)', () => {
  it('jede Karte hat eine Art für den Rahmen', () => {
    const kinds = new Set(cards.map(handKind));
    expect([...kinds].sort()).toEqual(['building', 'minion', 'quest', 'spell', 'trap']);
  });

  it('Tier: Kosten, Angriff und Leben als Symbole, Inhalt weiter aus der Anki-Vorlage', () => {
    const def = find((id) => handKind(CARDS_DB[id]!) === 'minion' && !!CARDS_DB[id]!.keywords?.length);
    const html = renderToStaticMarkup(<CardFace def={def} />);
    expect(html).toContain('ds-hand-card ds-hand-minion ds-hand-marked');
    expect(html).toContain(`aria-label="Knappen ${def.cost}"`);
    expect(html).toContain(`aria-label="Angriff ${def.attack}"`);
    expect(html).toContain(`aria-label="Ausdauer ${def.health}"`);
    expect(html).toContain('ds-sym-mark');
    expect(html).toContain('bub-combat-name');
    expect(html).toContain(`bub-ds-${def.id}.webp`);
  });

  it('Kniffe, Fallen und Aufgaben zeigen keine Werte', () => {
    for (const kind of ['spell', 'trap', 'quest'] as const) {
      const def = cards.find((card) => handKind(card) === kind)!;
      const html = renderToStaticMarkup(<CardFace def={def} />);
      expect(html).toContain(`ds-hand-${kind}`);
      expect(html).not.toContain('aria-label="Angriff');
      expect(html).not.toContain('aria-label="Ausdauer');
    }
  });
});
