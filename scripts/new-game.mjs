#!/usr/bin/env node
/**
 * Legt ein neues Spiel als Kopie der Vorlage (Tic-Tac-Toe) an.
 *
 *   pnpm neues-spiel <id> "<Name>"
 *   pnpm neues-spiel muehle "Mühle"
 *
 * Die Kopie ist sofort lauffähig und besteht alle Prüfungen. Danach ersetzt man
 * Schritt für Schritt Regeln, Bot und Oberfläche durch die des neuen Spiels.
 */
import { cpSync, existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, name = id] = process.argv.slice(2);

if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('Bitte eine id aus Kleinbuchstaben, Ziffern und Bindestrichen angeben, z. B.: pnpm neues-spiel muehle "Mühle"');
  process.exit(1);
}

const template = join(root, 'packages/games/tic-tac-toe');
const target = join(root, 'packages/games', id);
if (existsSync(target)) {
  console.error(`Den Ordner ${target} gibt es schon.`);
  process.exit(1);
}

cpSync(template, target, { recursive: true, filter: (source) => !source.includes('node_modules') });
renameSync(join(target, 'test/tic-tac-toe.test.ts'), join(target, `test/${id}.test.ts`));

function replaceInTree(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      replaceInTree(path);
      continue;
    }
    const text = readFileSync(path, 'utf8');
    const replaced = text.replaceAll('tic-tac-toe', id).replaceAll('Tic-Tac-Toe', name);
    if (replaced !== text) writeFileSync(path, replaced);
  }
}
replaceInTree(target);

console.log(`Neues Spiel angelegt: packages/games/${id}

Nächste Schritte:
  1. pnpm install            (verknüpft das neue Paket)
  2. src/meta.ts             Steckbrief anpassen (Beschreibung, Emoji, Spielerzahl)
  3. src/rules.ts            Regeln schreiben (Spielstand, Züge, Ergebnis)
  4. src/bots.ts             Bot anpassen – oder erst einmal nur die allgemeinen Bots nutzen
  5. src/ui/index.tsx        Oberfläche bauen
  6. test/${id}.test.ts      eigene Regeltests ergänzen
  7. pnpm test && pnpm dev   prüfen und ausprobieren

Anleitung: CONTRIBUTING.md`);
