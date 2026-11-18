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
// Start: aufsteigender Zweiklang.
wav('start', folge(ton(659, 0.09, { abkling: 14 }), ton(988, 0.22, { abkling: 9 })));
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
console.log('Klänge: setzen, klick, start, sieg, ende');
