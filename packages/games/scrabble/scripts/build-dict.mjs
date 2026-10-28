#!/usr/bin/env node
/**
 * Baut das Wörterbuch für Wortgitter als minimierten Wortgraphen (DAWG).
 *
 * Quelle: „german-wordlist“ von Tanglet (https://github.com/enz/german-wordlist), CC0 1.0.
 * Aufruf: node scripts/build-dict.mjs <Pfad zur Datei „words“>
 *
 * Regeln: Großschreibung, ß → SS, nur A–Z und ÄÖÜ, 2 bis 15 Buchstaben.
 * Ausgabe: src/dict/dawg.ts mit dem Graphen als Base64-Text.
 *
 * Format: ein Uint32 je Kante, Kanten eines Knotens hintereinander.
 *   Bits 0–4   Buchstabe (Index in ALPHABET)
 *   Bit 5      letzte Kante dieses Knotens
 *   Bit 6      Wortende nach dieser Kante
 *   Bits 7–31  Index der ersten Kante des Zielknotens (0 = Knoten ohne Kanten)
 * Der Wurzelknoten beginnt bei Index 1 (Index 0 ist ein Platzhalter).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];
if (!source) {
  console.error('Aufruf: node scripts/build-dict.mjs <Pfad zur Datei „words“>');
  process.exit(1);
}

const words = new Set();
for (const line of readFileSync(source, 'utf8').split('\n')) {
  const word = line.trim().toUpperCase().replaceAll('ß', 'SS').replaceAll('ẞ', 'SS');
  if (/^[A-ZÄÖÜ]{2,15}$/.test(word)) words.add(word);
}
const sorted = [...words].sort();

// Präfixbaum aufbauen und dabei von unten minimieren (Daciuk et al.).
const register = new Map();
let nextId = 0;
const newNode = () => ({ id: nextId++, end: false, edges: [] }); // edges: [letter, node]
const signature = (node) => `${node.end ? 1 : 0}|${node.edges.map(([l, n]) => `${l}:${n.id}`).join(',')}`;
function minimize(node, downTo) {
  // Ersetzt Kinder ab Tiefe downTo des letzten Pfads durch registrierte Gleiche.
  while (path.length > downTo) {
    const [parent, letter, child] = path.pop();
    const sig = signature(child);
    const existing = register.get(sig);
    if (existing) parent.edges[parent.edges.length - 1] = [letter, existing];
    else register.set(sig, child);
  }
}
const rootNode = newNode();
let path = []; // [parent, letter, child]
let previous = '';
for (const word of sorted) {
  let common = 0;
  while (common < word.length && common < previous.length && word[common] === previous[common]) common++;
  minimize(rootNode, common);
  let node = path.length ? path[path.length - 1][2] : rootNode;
  for (let i = common; i < word.length; i++) {
    const child = newNode();
    node.edges.push([word[i], child]);
    path.push([node, word[i], child]);
    node = child;
  }
  node.end = true;
  previous = word;
}
minimize(rootNode, 0);

// Serialisieren: jeder Knoten mit Kanten bekommt einen Block; Wortende steht an der Kante.
const offsets = new Map();
const order = [];
const visit = (node) => {
  if (offsets.has(node) || node.edges.length === 0) return;
  offsets.set(node, -1);
  order.push(node);
  for (const [, child] of node.edges) visit(child);
};
visit(rootNode);
let cursor = 1;
for (const node of order) {
  offsets.set(node, cursor);
  cursor += node.edges.length;
}
if (cursor >= 2 ** 25) throw new Error('Wörterbuch zu groß für das Format');
const data = new Uint32Array(cursor);
for (const node of order) {
  const start = offsets.get(node);
  node.edges.forEach(([letter, child], i) => {
    const target = child.edges.length ? offsets.get(child) : 0;
    data[start + i] =
      ALPHABET.indexOf(letter) | (i === node.edges.length - 1 ? 1 << 5 : 0) | (child.end ? 1 << 6 : 0) | (target << 7);
  });
}
if (offsets.get(rootNode) !== 1) throw new Error('Wurzel muss bei 1 beginnen');

const base64 = Buffer.from(data.buffer).toString('base64');
writeFileSync(
  join(root, 'src/dict/dawg.ts'),
  `// Erzeugt von scripts/build-dict.mjs – nicht von Hand ändern.\n// Quelle: german-wordlist (https://github.com/enz/german-wordlist), CC0 1.0.\nexport const WORD_COUNT = ${sorted.length};\nexport const DAWG_BASE64 =\n  '${base64}';\n`,
);
console.log(`${sorted.length} Wörter, ${cursor} Kanten, ${(base64.length / 1024 / 1024).toFixed(2)} MB Base64`);
