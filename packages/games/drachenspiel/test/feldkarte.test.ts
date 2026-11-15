import { describe, expect, it } from 'vitest';
import { CARDS_DB } from '../src/cards';

// Node-Zugriff ohne @types/node (wie in tests/repo.test.ts und balance.test.ts)
const node = (globalThis as unknown as {
  process: {
    env: Record<string, string | undefined>;
    getBuiltinModule(name: 'node:fs'): {
      existsSync(path: URL): boolean;
      readFileSync(path: URL, encoding?: 'utf8'): string & { toString(enc: 'base64'): string };
      writeFileSync(path: string, data: string): void;
    };
  };
}).process;
const fs = node.getBuiltinModule('node:fs');

/** Alle Karten, die als Tier aufs Feld kommen (auch Tokens), mit ihrem gemalten Bild, falls vorhanden. */
const fieldCards = Object.values(CARDS_DB)
  .filter((card) => !card.isSpell && !card.quest && !card.trap)
  .map((card) => ({ card, file: new URL(`../src/ui/karten/bub-ds-${card.id}.webp`, import.meta.url) }));

describe('Drachenspiel Feldkarte (#435)', () => {
  it('es gibt Tiere mit gemalten Bildern', () => {
    expect(fieldCards.filter(({ file }) => fs.existsSync(file)).length).toBeGreaterThan(100);
  });

  // Kontaktbogen zur Lesbarkeit: FELDBILDER_VORSCHAU=<datei.html> corepack pnpm exec vitest run packages/games/drachenspiel/test/feldkarte.test.ts
  it.runIf(!!node.env.FELDBILDER_VORSCHAU)('schreibt den Kontaktbogen', () => {
    const tiles = fieldCards
      .sort((a, b) => a.card.id.localeCompare(b.card.id))
      .map(({ card, file }) => {
        const img = fs.existsSync(file) ? `<img src="data:image/webp;base64,${fs.readFileSync(file).toString('base64')}" alt="">` : `<span class="emoji">${card.emoji}</span>`;
        return `<figure><div class="oval">${img}</div><figcaption><b>${card.id}</b><br>${card.name}</figcaption></figure>`;
      })
      .join('');
    const missing = fieldCards.filter(({ file }) => !fs.existsSync(file)).map(({ card }) => `${card.id} ${card.name}`);
    fs.writeFileSync(
      node.env.FELDBILDER_VORSCHAU!,
      `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Feldbilder 56 px</title>
<style>
body { margin: 16px; font-family: system-ui, sans-serif; background: #f5f1ea; color: #1f2328; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, 76px); gap: 10px 6px; }
figure { margin: 0; text-align: center; font-size: 9px; line-height: 1.2; }
.oval { width: 56px; height: 66px; margin: 0 auto 3px; border-radius: 50%; overflow: hidden; box-shadow: 0 0 0 2px rgb(60 45 25 / 0.85); background: radial-gradient(circle at 50% 40%, #f3e6c8, #b99a66); display: grid; place-items: center; }
.oval img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 38%; display: block; }
.emoji { font-size: 28px; }
</style></head><body>
<h1 style="font-size:18px">Drachenspiel · Feldbilder in 56 px (#435)</h1>
<p>${fieldCards.length} Tiere, davon ${missing.length} ohne gemaltes Bild (zeigen ihr Emoji)${missing.length ? `: ${missing.join(', ')}` : ''}.</p>
<div class="grid">${tiles}</div></body></html>`,
    );
  });
});
