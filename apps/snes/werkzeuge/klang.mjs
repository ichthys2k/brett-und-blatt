#!/usr/bin/env node
/*
 * Erzeugt die Klangeffekte von Brett & Blatt 16 als kurze WAV-Dateien (16 Bit, mono, 16 kHz).
 * Die Makefile-Regeln wandeln sie mit `snesbrr` in BRR-Samples für den Klangprozessor SPC700.
 * Alles wird aus Formeln erzeugt – keine fremden Aufnahmen, keine Lizenzfragen.
 *
 *   node werkzeuge/klang.mjs <ausgabeordner>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'res';
mkdirSync(out, { recursive: true });
const RATE = 16000;

function wav(name, samples) {
  // BRR arbeitet in Blöcken zu 16 Samples.
  const n = Math.ceil(samples.length / 16) * 16;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] ?? 0));
    buf.writeInt16LE(Math.round(v * 30000), 44 + i * 2);
  }
  writeFileSync(join(out, `${name}.wav`), buf);
}

/** Ein Ton mit Obertönen und Hüllkurve (Anschlag, Abklingen). */
function ton(freq, dauer, { obertoene = [1, 0.35, 0.15], abkling = 6, anschlag = 0.004 } = {}) {
  const n = Math.round(dauer * RATE);
  return Array.from({ length: n }, (_, i) => {
    const t = i / RATE;
    const huelle = Math.min(1, t / anschlag) * Math.exp(-t * abkling);
    let v = 0;
    obertoene.forEach((a, k) => (v += a * Math.sin(2 * Math.PI * freq * (k + 1) * t)));
    return v * huelle * 0.6;
  });
}
function folge(...teile) {
  return teile.flat();
}
function mische(a, b, versatz) {
  const n = Math.max(a.length, versatz + b.length);
  return Array.from({ length: n }, (_, i) => (a[i] ?? 0) + (b[i - versatz] ?? 0));
}

// Holzklack beim Setzen: kurzer Ton mit schnell fallender Tonhöhe und etwas Rauschen.
{
  const n = Math.round(0.09 * RATE);
  let x = 1;
  const s = Array.from({ length: n }, (_, i) => {
    const t = i / RATE;
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const rauschen = (x / 0x7fffffff - 0.5) * Math.exp(-t * 90);
    const f = 520 * Math.exp(-t * 12);
    return (Math.sin(2 * Math.PI * f * t) * 0.8 + rauschen) * Math.exp(-t * 38);
  });
  wav('setzen', s);
}
// Menüklick: heller, sehr kurzer Ton.
wav('klick', ton(1320, 0.05, { abkling: 70, obertoene: [1, 0.2] }));
// Start: fröhliche Anfangs-Fanfare C–E–G–C (aufsteigend mit Hall).
{
  let s = ton(523, 0.35, { abkling: 12, obertoene: [1, 0.4, 0.15] });
  s = mische(s, ton(659, 0.32, { abkling: 12, obertoene: [1, 0.4, 0.15] }), Math.round(0.07 * RATE));
  s = mische(s, ton(784, 0.30, { abkling: 11, obertoene: [1, 0.4, 0.15] }), Math.round(0.14 * RATE));
  s = mische(s, ton(1047, 0.45, { abkling: 8, obertoene: [1, 0.5, 0.2] }), Math.round(0.21 * RATE));
  wav('start', s.map((v) => v * 0.6));
}
// Sieg: kleine Fanfare C–E–G–C.
{
  let s = ton(523, 0.5, { abkling: 7 });
  s = mische(s, ton(659, 0.45, { abkling: 7 }), Math.round(0.08 * RATE));
  s = mische(s, ton(784, 0.4, { abkling: 7 }), Math.round(0.16 * RATE));
  s = mische(s, ton(1047, 0.42, { abkling: 6 }), Math.round(0.24 * RATE));
  wav('sieg', s.map((v) => v * 0.5));
}
// Unentschieden/Niederlage: zwei absteigende Töne.
wav('ende', folge(ton(440, 0.14, { abkling: 10 }), ton(330, 0.3, { abkling: 7 })));
// Würfeln: klackernde Würfel im Becher bzw. auf Filz.
{
  const n = Math.round(0.24 * RATE);
  let x = 42;
  const s = new Float64Array(n);
  const schlaege = [0, 0.038, 0.076, 0.12, 0.165, 0.20];
  const tonhoehen = [580, 720, 480, 650, 520, 680];
  const staerken = [0.75, 0.85, 0.65, 0.55, 0.45, 0.3];
  for (let k = 0; k < schlaege.length; k++) {
    const startIdx = Math.round(schlaege[k] * RATE);
    const f = tonhoehen[k];
    const amp = staerken[k];
    for (let i = startIdx; i < n; i++) {
      const t = (i - startIdx) / RATE;
      if (t > 0.04) break;
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      const rauschen = (x / 0x7fffffff - 0.5) * Math.exp(-t * 120);
      const klack = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 70);
      s[i] += (klack * 0.7 + rauschen * 0.5) * amp;
    }
  }
  wav('wuerfeln', Array.from(s));
}
// Karte: sanftes Schiebegeräusch / Kartenziehen.
{
  const n = Math.round(0.08 * RATE);
  let x = 123;
  const s = Array.from({ length: n }, (_, i) => {
    const t = i / RATE;
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const rauschen = (x / 0x7fffffff - 0.5) * Math.exp(-t * 55);
    const ton = Math.sin(2 * Math.PI * (900 - t * 5000) * t) * Math.exp(-t * 60);
    return (ton * 0.4 + rauschen * 0.6) * Math.min(1, t / 0.005) * 0.8;
  });
  wav('karte', s);
}
console.log('Klänge: setzen, klick, start, sieg, ende, wuerfeln, karte');
