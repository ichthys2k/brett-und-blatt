import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { KeywordId } from '../src/types';
import { edgesFor, KEYWORD_SYMBOLS, KeywordEdges, KeywordMark, StatGem, type StatKind, type StatState, type SymbolSize } from '../src/ui/symbole';
import { TRAIT_DEFINITIONS } from '../src/ui/traits';

// Node-Zugriff ohne @types/node (wie in tests/repo.test.ts und balance.test.ts)
const node = (globalThis as unknown as {
  process: {
    env: Record<string, string | undefined>;
    getBuiltinModule(name: 'node:fs'): { readFileSync(path: URL, encoding?: 'utf8'): string & { toString(enc: 'base64'): string }; writeFileSync(path: string, data: string): void };
  };
}).process;
const { readFileSync, writeFileSync } = node.getBuiltinModule('node:fs');

const KEYWORDS = Object.keys(TRAIT_DEFINITIONS) as KeywordId[];
const SIZES: SymbolSize[] = ['feld', 'hand', 'zoom'];
const KINDS: StatKind[] = ['cost', 'attack', 'health', 'armor'];
const STATES: StatState[] = ['base', 'buffed', 'hurt'];

describe('Drachenspiel Symbolsatz (#434)', () => {
  it('jedes Schlüsselwort aus TRAIT_DEFINITIONS hat ein Zeichen', () => {
    expect(KEYWORDS.filter((k) => !KEYWORD_SYMBOLS[k])).toEqual([]);
    expect(Object.keys(KEYWORD_SYMBOLS).sort()).toEqual([...KEYWORDS].sort());
  });

  it('Zeichen unterscheiden sich in Form und Farbe', () => {
    const glyphs = KEYWORDS.map((k) => renderToStaticMarkup(<KeywordMark keyword={k} />).replace(/data-keyword="[^"]*"|aria-label="[^"]*"|title="[^"]*"/g, ''));
    expect(new Set(glyphs).size).toBe(KEYWORDS.length);
    expect(new Set(KEYWORDS.map((k) => KEYWORD_SYMBOLS[k].color)).size).toBe(KEYWORDS.length);
  });

  it('Zeichen tragen Namen und Beschreibung als title und aria-label', () => {
    for (const k of KEYWORDS) {
      const html = renderToStaticMarkup(<KeywordMark keyword={k} size="feld" />);
      expect(html).toContain(`aria-label="${TRAIT_DEFINITIONS[k].name}"`);
      expect(html).toContain('role="img"');
      expect(html).toContain('ds-sym-feld');
    }
  });

  it('Wertesymbole zeigen die Zahl als Text und nennen den Zustand', () => {
    const html = renderToStaticMarkup(<StatGem kind="health" value={3} state="hurt" size="zoom" />);
    expect(html).toContain('<span class="ds-sym-num">3</span>');
    expect(html).toContain('aria-label="Ausdauer 3, verletzt"');
    expect(renderToStaticMarkup(<StatGem kind="cost" value={2} state="buffed" />)).toContain('aria-label="Knappen 2, verbilligt"');
    expect(renderToStaticMarkup(<StatGem kind="attack" value={5} />)).toContain('aria-label="Angriff 5"');
  });

  it('Rand-Effekte nur für Schildwall, Prunkschild, Verkleidet und Kältestarre', () => {
    expect(edgesFor(KEYWORDS)).toEqual(['veil', 'ice', 'bubble', 'shield']);
    expect(edgesFor(['rush', 'lifesteal'])).toEqual([]);
    expect(renderToStaticMarkup(<KeywordEdges keywords={['rush']} />)).toBe('');
    expect(renderToStaticMarkup(<KeywordEdges keywords={['taunt', 'taunt']} />)).toBe('<span class="ds-sym-edge ds-sym-edge-shield" aria-hidden="true"></span>');
  });

  // Vorschau zur Abnahme: SYMBOLE_VORSCHAU=<datei.html> corepack pnpm exec vitest run packages/games/drachenspiel/test/symbole.test.tsx
  it.runIf(!!node.env.SYMBOLE_VORSCHAU)('schreibt die Vorschau', () => {
    writeFileSync(node.env.SYMBOLE_VORSCHAU!, previewHtml());
  });
});

function previewHtml(): string {
  const css = readFileSync(new URL('../src/ui/symbole.css', import.meta.url), 'utf8');
  const art = readFileSync(new URL('../src/ui/karten/bub-ds-bug_dragonfly.webp', import.meta.url)).toString('base64');
  const row = (size: SymbolSize) =>
    renderToStaticMarkup(
      <section>
        <h3>Größe „{size}“</h3>
        <div className="row">
          {KINDS.flatMap((kind) => STATES.map((state) => <StatGem key={kind + state} kind={kind} value={kind === 'cost' ? 3 : 12} state={state} size={size} />))}
        </div>
        <div className="row">
          {KINDS.map((kind) => (
            <StatGem key={kind} kind={kind} value={4} size={size} />
          ))}
        </div>
        <div className="row">
          {KEYWORDS.map((k) => (
            <KeywordMark key={k} keyword={k} size={size} />
          ))}
        </div>
      </section>,
    );
  const legend = renderToStaticMarkup(
    <ul className="legend">
      {KEYWORDS.map((k) => (
        <li key={k}>
          <KeywordMark keyword={k} size="hand" /> <b>{TRAIT_DEFINITIONS[k].name}</b> – {TRAIT_DEFINITIONS[k].description}
        </li>
      ))}
    </ul>,
  );
  const sample = (keywords: KeywordId[], label: string, shape: 'oval' | 'rect') =>
    renderToStaticMarkup(
      <figure>
        <div className={`art ${shape}`}>
          <KeywordEdges keywords={keywords} />
          <StatGem kind="attack" value={3} size="feld" className="atk" />
          <StatGem kind="health" value={2} state="hurt" size="feld" className="hp" />
        </div>
        <figcaption>{label}</figcaption>
      </figure>,
    );
  const samples = [
    sample([], 'ohne', 'oval'),
    sample(['taunt'], 'Schildwall', 'oval'),
    sample(['bubble'], 'Prunkschild', 'oval'),
    sample(['stealth'], 'Verkleidet', 'oval'),
    sample(['frostbite'], 'Kältestarre', 'oval'),
    sample(['taunt', 'bubble'], 'Schildwall + Prunkschild', 'oval'),
    sample(['frostbite', 'stealth'], 'Kältestarre + Verkleidet', 'rect'),
  ].join('');
  const panel = (theme: 'hell' | 'dunkel') => `<div class="panel ${theme}"><h2>${theme === 'hell' ? 'Hell' : 'Dunkel'}</h2>${SIZES.map(row).join('')}<h3>Rand-Effekte (Feldbild)</h3><div class="row samples">${samples}</div></div>`;
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Drachenspiel Symbole</title>
<style>
${css}
body { margin: 0; font-family: system-ui, sans-serif; background: #ccc; }
h1 { margin: 16px; font-size: 20px; }
.panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; padding: 0 16px 16px; }
.panel { padding: 12px 16px; border-radius: 12px; }
.panel.hell { background: #f5f1ea; color: #1f2328; }
.panel.dunkel { background: #121417; color: #e9e7e3; --ds-sym-halo: drop-shadow(0 0 1px rgb(255 255 255 / 0.55)); }
h2 { margin: 4px 0 8px; } h3 { margin: 14px 0 6px; font-size: 14px; }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }
.samples { gap: 18px; }
figure { margin: 0; text-align: center; font-size: 12px; }
.art { position: relative; width: 84px; height: 104px; margin: 8px; background: url(data:image/webp;base64,${art}) center / cover; }
.art.oval { border-radius: 50%; } .art.rect { border-radius: 8px; }
.art .atk { position: absolute; left: -8px; bottom: -6px; } .art .hp { position: absolute; right: -8px; bottom: -6px; }
.legend { list-style: none; padding: 0 16px 24px; margin: 0; display: grid; gap: 6px; }
.legend li { display: flex; align-items: center; gap: 8px; }
</style></head>
<body><h1>Drachenspiel · Symbolsatz (S1, #434)</h1><div class="panels">${panel('hell')}${panel('dunkel')}</div>${legend}</body></html>`;
}
