import { CREST_SHIELDS, DEFAULT_CREST } from '@brett-und-blatt/engine';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayerChip, PlayerCrest } from '../src';

/* Ausgabe vor #491 festgehalten (Snapshot): ohne die neuen Eigenschaften zeichnen Wappen und kompakter Chip wie vorher. */
describe('unverändert ohne neue Eigenschaften (#491)', () => {
  for (const shield of CREST_SHIELDS) {
    it(`PlayerCrest ${shield}`, () => {
      const spec = { ...DEFAULT_CREST, shield, ornaments: ['rahmen', 'lorbeer', 'krone', 'band'] as never };
      expect(renderToStaticMarkup(<PlayerCrest spec={spec} size={80} label="Wappen von Mia" />)).toMatchSnapshot();
      expect(renderToStaticMarkup(<PlayerCrest spec={spec} size={40} />)).toMatchSnapshot();
    });
  }
  it('PlayerChip kompakt', () => {
    const chip = <PlayerChip name="Mia" symbol="●" avatar="🦊" detail="Computer · mittel" active winner={false} clock={null} score={3} />;
    expect(renderToStaticMarkup(chip)).toMatchSnapshot();
  });
});
