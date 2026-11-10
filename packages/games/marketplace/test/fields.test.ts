import { describe, expect, it } from 'vitest';
import { fieldGraphicFor } from '../src/ui/fields';

describe('marketplace: Feldgrafiken & Fachwerk-Zunfthäuser (#73)', () => {
  it('ordnet den Zunftfeldern die passenden Zunfthäuser zu', () => {
    // Bäcker
    expect(fieldGraphicFor(1)).toContain('guild-baker');
    expect(fieldGraphicFor(3)).toContain('guild-baker');
    expect(fieldGraphicFor(5)).toContain('guild-baker');

    // Weber
    expect(fieldGraphicFor(7)).toContain('guild-weaver');
    expect(fieldGraphicFor(8)).toContain('guild-weaver');
    expect(fieldGraphicFor(10)).toContain('guild-weaver');

    // Imker
    expect(fieldGraphicFor(12)).toContain('guild-beekeeper');
    expect(fieldGraphicFor(13)).toContain('guild-beekeeper');
    expect(fieldGraphicFor(15)).toContain('guild-beekeeper');

    // Schuster
    expect(fieldGraphicFor(17)).toContain('guild-cobbler');
    expect(fieldGraphicFor(19)).toContain('guild-cobbler');
    expect(fieldGraphicFor(21)).toContain('guild-cobbler');

    // Schmiede
    expect(fieldGraphicFor(23)).toContain('guild-smith');
    expect(fieldGraphicFor(25)).toContain('guild-smith');
    expect(fieldGraphicFor(26)).toContain('guild-smith');

    // Steinmetze
    expect(fieldGraphicFor(28)).toContain('guild-mason');
    expect(fieldGraphicFor(30)).toContain('guild-mason');
    expect(fieldGraphicFor(34)).toContain('guild-mason');
  });

  it('ordnet Gemeinschaftsbetrieben und Eckfeldern ihre Grafiken zu', () => {
    expect(fieldGraphicFor(0)).toContain('corner-gate');
    expect(fieldGraphicFor(6)).toContain('comm-mill');
    expect(fieldGraphicFor(9)).toContain('corner-jail');
    expect(fieldGraphicFor(14)).toContain('comm-bridge');
    expect(fieldGraphicFor(18)).toContain('corner-fair');
    expect(fieldGraphicFor(22)).toContain('comm-scale');
    expect(fieldGraphicFor(27)).toContain('corner-guard');
    expect(fieldGraphicFor(29)).toContain('special-forest');
    expect(fieldGraphicFor(31)).toContain('comm-tavern');
  });
});
