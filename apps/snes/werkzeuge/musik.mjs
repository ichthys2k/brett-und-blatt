#!/usr/bin/env node
/*
 * Erzeugt die 20 eigenständigen SNES-Soundtracks für „Brett & Blatt 16“ als
 * Impulse-Tracker-Module (.it, Format 2.14) für smconv / SNESMod.
 *
 * Vier Stimmungen analog zu packages/ui/src/audio/music.json (je 5 Stücke):
 *   0..4   Denkraum    (ruhig und konzentriert)
 *   5..9   Kartentisch (gesellig und leicht)
 *   10..14 Patience    (gemütlich und verträumt)
 *   15..19 Spielabend  (fröhlich und verspielt)
 *
 * Aufruf: node werkzeuge/musik.mjs <zielordner>
 * Lizenz: CC BY-SA 4.0 / AGPL-3.0 (eigene Kompositionen, keine Fremddateien).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ziel = process.argv[2] ?? 'res/musik';
mkdirSync(ziel, { recursive: true });

// ------------------------------------------------------------------ Instrumente (Samples + IT-Hüllkurven)
// Alle geloopten Wellenformen haben eine Länge, die ein Vielfaches von 16 Samples ist (BRR-Blöcke!),
// und exakte C5-Stimmung (C-5 = 523.25113 Hz -> C5Speed = periode * 523.25113).

const C5_HZ = 523.25113;

function additiv(periode, obertoene, phaseShift = 0) {
  const n = periode * 2; // 2 Perioden -> mindestens 64 Samples, sauberer Loop
  const pcm = new Int16Array(n);
  let max = 0;
  const f = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    const t = (2 * Math.PI * i) / periode;
    for (let h = 0; h < obertoene.length; h++) {
      if (obertoene[h]) v += obertoene[h] * Math.sin(t * (h + 1) + phaseShift * h);
    }
    f[i] = v;
    if (Math.abs(v) > max) max = Math.abs(v);
  }
  const scale = max > 0 ? 28000 / max : 0;
  for (let i = 0; i < n; i++) pcm[i] = Math.round(f[i] * scale);
  return { pcm, loop: true, loopStart: 0, loopEnd: n, c5Speed: Math.round(periode * C5_HZ) };
}

function kickSample() {
  const n = 768; // 48 BRR-Blöcke
  const pcm = new Int16Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = 42 + 98 * Math.exp(-t * 14);
    phase += (2 * Math.PI * freq) / 11025;
    const env = Math.exp(-t * 6.5) * Math.min(1, i / 12);
    pcm[i] = Math.round(Math.sin(phase) * env * 28000);
  }
  return { pcm, loop: false, loopStart: 0, loopEnd: 0, c5Speed: 11025 };
}

function brushSample() {
  const n = 448; // 28 BRR-Blöcke
  const pcm = new Int16Array(n);
  let seed = 0x12345678;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const white = ((seed >>> 16) / 32768) - 1;
    // Hochpass-Betonung für weiche Besen-Snare / HiHat
    const hp = white - 0.65 * prev;
    prev = white;
    const t = i / n;
    const env = Math.exp(-t * 9) * Math.min(1, i / 8);
    pcm[i] = Math.round(Math.max(-1, Math.min(1, hp)) * env * 22000);
  }
  return { pcm, loop: false, loopStart: 0, loopEnd: 0, c5Speed: 14000 };
}

// 10 klanglich klar unterscheidbare 16-Bit-Instrumente (1-basiert im IT-Format)
const INST = {
  PIANO: 1,     // Warmes Klavier / E-Piano
  HARFE: 2,     // Gezupfte Harfe / Akustik-Laute
  FLOETE: 3,    // Weiche Holzflöte
  STREICHER: 4, // Warmes Streicher-Pad
  BASS: 5,      // Runder Kontrabass / Zupfbass
  MARIMBA: 6,   // Holzige Marimba / Glockenspiel
  AKKORDEON: 7, // Charmantes Café-/Tavernen-Akkordeon
  PULSE: 8,     // Knackiger 16-Bit-Chiptune-Lead
  KICK: 9,      // Sanfte Kick-Drum
  BRUSH: 10,    // Weiche Brush-Snare / Shaker
};

const INSTRUMENTE = [
  {
    name: 'Klavier',
    sample: additiv(32, [1.0, 0.52, 0.24, 0.14, 0.08, 0.04, 0.02], 0.3),
    vol: 58,
    fadeout: 64,
    env: [[0, 64], [3, 56], [14, 34], [34, 14], [60, 0]],
  },
  {
    name: 'Harfe',
    sample: additiv(32, [1.0, 0.42, 0.30, 0.18, 0.12, 0.06, 0.04, 0.02], 0.7),
    vol: 56,
    fadeout: 96,
    env: [[0, 64], [2, 50], [10, 26], [24, 8], [44, 0]],
  },
  {
    name: 'Floete',
    sample: additiv(32, [1.0, 0.22, 0.06, 0.02], 0.1),
    vol: 52,
    fadeout: 48,
    env: [[0, 6], [4, 58], [10, 62], [32, 54], [56, 32], [80, 0]],
    sustain: [2, 2],
  },
  {
    name: 'Streicher',
    sample: additiv(32, [1.0, 0.65, 0.45, 0.30, 0.20, 0.12, 0.08, 0.05], 1.1),
    vol: 42,
    fadeout: 36,
    env: [[0, 0], [10, 48], [22, 58], [50, 54], [80, 0]],
    sustain: [2, 2],
  },
  {
    name: 'Kontrabass',
    sample: additiv(32, [1.0, 0.48, 0.16, 0.05], 0.2),
    vol: 62,
    fadeout: 72,
    env: [[0, 64], [4, 58], [16, 40], [38, 16], [60, 0]],
  },
  {
    name: 'Marimba',
    sample: additiv(32, [1.0, 0.12, 0.05, 0.34, 0.03, 0.02], 0.4),
    vol: 58,
    fadeout: 120,
    env: [[0, 64], [2, 46], [8, 18], [18, 3], [28, 0]],
  },
  {
    name: 'Akkordeon',
    sample: additiv(32, [1.0, 0.72, 0.56, 0.32, 0.24, 0.16, 0.10, 0.06], 0.5),
    vol: 50,
    fadeout: 56,
    env: [[0, 14], [3, 60], [12, 58], [40, 52], [64, 0]],
    sustain: [2, 2],
  },
  {
    name: 'Pulse16',
    sample: additiv(32, [1.0, 0.70, 0.35, 0.0, 0.22, 0.18, 0.10, 0.0], 0.0),
    vol: 48,
    fadeout: 64,
    env: [[0, 62], [3, 56], [14, 42], [36, 24], [60, 0]],
    sustain: [2, 2],
  },
  {
    name: 'Kick',
    sample: kickSample(),
    vol: 56,
    fadeout: 256,
    env: [[0, 64], [12, 64], [24, 0]],
  },
  {
    name: 'Brush',
    sample: brushSample(),
    vol: 34,
    fadeout: 256,
    env: [[0, 64], [10, 40], [18, 0]],
  },
];

// ------------------------------------------------------------------ Musiktheorie-Helfer

const HALBTON = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, H: 11,
};

/** Wandelt z. B. "C5", "Bb4", "F#5" in IT-Notennummer (C-0 = 0, C-5 = 60). */
function noteNr(name) {
  if (!name || name === '-' || name === '.') return -1;
  if (name === 'off') return 255;
  const m = /^([A-H][#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`Unbekannte Note: ${name}`);
  return Number(m[2]) * 12 + HALBTON[m[1]];
}

const AKKORD_INTERVALLE = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  dim: [0, 3, 6],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 14],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
};

/** Liefert Grundton (Oktave 3) und Akkordtöne (Oktave 4) für z. B. "Dm7", "Bb", "G7". */
function akkordToene(symbol) {
  const m = /^([A-H][#b]?)(maj7|m7|m6|sus4|add9|dim|7|6|m|)$/.exec(symbol);
  if (!m) throw new Error(`Unbekannter Akkord: ${symbol}`);
  const root = HALBTON[m[1]];
  const iv = AKKORD_INTERVALLE[m[2]];
  const bass = 36 + root; // Oktave 3 (C3..B3)
  const mid = iv.map((semi) => {
    let n = 48 + root + semi;
    while (n > 65) n -= 12; // warm im Bereich C4..F5 halten
    return n;
  });
  return { bass, mid };
}

/**
 * Parst eine kompakte Melodiezeile wie "D5:4 F5:2 A5:2 G5:6 -:2" in Events [{row, note}].
 * Eine Einheit = 2 Rows (Achtelnote im 4/4 bei 64 Rows = 4 Takte = 32 Achtel; im 3/4 bei 48 Rows = 24 Achtel).
 * Bruchteile wie ":1" (Sechzehntel) oder ":3" (punktierte Achtel) funktionieren direkt in Rows!
 */
function parseMelodie(str, rowScale = 2) {
  const events = [];
  let row = 0;
  for (const tok of str.trim().split(/\s+/)) {
    if (!tok) continue;
    const [nStr, lenStr] = tok.split(':');
    const len = Math.round((lenStr ? Number(lenStr) : 2) * rowScale);
    const n = noteNr(nStr);
    if (n >= 0) events.push({ row, note: n, len });
    row += len;
  }
  return events;
}

// ------------------------------------------------------------------ Pattern-Generator je Stil

function leeresPattern(rows) {
  // 6 Spuren: [melodie, gegenstimme, begleitung, bass, pad/echo, percussion]
  return {
    rows,
    ch: Array.from({ length: 6 }, () => Array.from({ length: rows }, () => null)),
  };
}

function setNote(pat, ch, row, note, inst, vol = 56) {
  if (row < 0 || row >= pat.rows) return;
  pat.ch[ch][row] = { note, inst, vol };
}

/**
 * Baut ein komplettes Pattern (48 oder 64 Rows) aus:
 * - akkorde: 4 (oder 8) Akkordsymbole gleichmäßig über das Pattern verteilt
 * - melodie: Melodie-String (Einheit = 1 Achtel = 2 Rows; bei 64 Rows = 32 Einheiten, bei 48 Rows = 24 Einheiten)
 * - gegen: optionaler Gegenmelodie-String
 * - stil: Begleit-, Bass- und Schlagzeug-Muster
 */
function bauePattern(cfg, teil) {
  const rows = cfg.rows ?? 64;
  const pat = leeresPattern(rows);
  const akkorde = teil.akkorde;
  const schritt = Math.floor(rows / akkorde.length);

  // Spur 0: Hauptmelodie (+ sanftes Pseudo-Echo auf Spur 4 bei ruhigen Stilen)
  const melInst = teil.melInst ?? cfg.melInst;
  const melVol = teil.melVol ?? 56;
  const melEvents = parseMelodie(teil.melodie, 2);
  for (const ev of melEvents) {
    setNote(pat, 0, ev.row, ev.note, melInst, melVol);
    if (cfg.echo && ev.note < 254 && ev.row + 3 < rows) {
      setNote(pat, 4, ev.row + 3, ev.note, cfg.echoInst ?? melInst, Math.round(melVol * 0.34));
    }
  }

  // Spur 1: Gegenmelodie / Harmoniestimme (oder weiche Akkord-Terzen im B/C-Teil)
  if (teil.gegen) {
    const gInst = teil.gegenInst ?? cfg.gegenInst ?? INST.FLOETE;
    const gVol = teil.gegenVol ?? 40;
    for (const ev of parseMelodie(teil.gegen, 2)) {
      setNote(pat, 1, ev.row, ev.note, gInst, gVol);
    }
  }

  // Spur 2 (Begleitung), Spur 3 (Bass), Spur 4 (Pad, falls kein Echo), Spur 5 (Percussion)
  const begInst = cfg.begInst;
  const bassInst = cfg.bassInst ?? INST.BASS;
  const padInst = cfg.padInst ?? INST.STREICHER;

  for (let ai = 0; ai < akkorde.length; ai++) {
    const start = ai * schritt;
    const { bass, mid } = akkordToene(akkorde[ai]);
    const nextBass = akkordToene(akkorde[(ai + 1) % akkorde.length]).bass;

    // Weiches Pad auf Spur 4 (wenn nicht als Echo genutzt und im Teil aktiviert)
    if (!cfg.echo && (teil.pad ?? cfg.pad)) {
      const padNote = mid[mid.length - 1];
      setNote(pat, 4, start, padNote, padInst, teil.padVol ?? 30);
    }

    // Begleit- und Bassmuster je Stil
    switch (cfg.stil) {
      case 'arpeggio': {
        // Ruhiges, perlendes Arpeggio (Denkraum / Patience)
        setNote(pat, 3, start, bass, bassInst, 50);
        if (schritt >= 16) setNote(pat, 3, start + 8, bass + 7 <= 52 ? bass + 7 : bass - 5, bassInst, 38);
        const seq = [mid[0], mid[1], mid[2], mid[1], mid[0] + 12, mid[2], mid[1], mid[2]];
        for (let r = 0; r < schritt; r += 2) {
          const n = seq[(r / 2) % seq.length];
          setNote(pat, 2, start + r, n, begInst, (r % 4 === 0) ? 38 : 28);
        }
        break;
      }
      case 'uhrwerk': {
        // Minimalistischer Denkraum-Puls (Bedenkzeit)
        setNote(pat, 3, start, bass, bassInst, 52);
        if (schritt >= 16) setNote(pat, 3, start + 12, bass, bassInst, 40);
        for (let r = 0; r < schritt; r += 4) {
          const n = mid[(r / 4) % mid.length];
          setNote(pat, 2, start + r, n, begInst, 34);
          if (r + 2 < schritt) setNote(pat, 2, start + r + 2, mid[0] + 12, INST.HARFE, 22);
        }
        break;
      }
      case 'walzer': {
        // 3/4-Walzer (12 Rows pro Takt: 0=Bass, 4=Akkord, 8=Akkord)
        for (let t = 0; t < schritt; t += 12) {
          const b = t === 0 ? bass : (bass + 7 <= 52 ? bass + 7 : bass - 5);
          setNote(pat, 3, start + t, b, bassInst, 52);
          setNote(pat, 2, start + t + 4, mid[0], begInst, 38);
          setNote(pat, 2, start + t + 8, mid[1], begInst, 34);
          if (cfg.perc) {
            setNote(pat, 5, start + t, 60, INST.KICK, 32);
            setNote(pat, 5, start + t + 4, 64, INST.BRUSH, 24);
            setNote(pat, 5, start + t + 8, 64, INST.BRUSH, 20);
          }
        }
        break;
      }
      case 'swing': {
        // Geselliger Kartentisch-Groove mit Walking Bass & Brush
        const walk = [bass, bass + 4, bass + 7, Math.round((bass + nextBass) / 2)];
        for (let q = 0; q < 4 && q * 4 < schritt; q++) {
          setNote(pat, 3, start + q * 4, walk[q % walk.length], bassInst, 52);
        }
        // Synkopiertes Comping auf 0, 6, 10, 14
        const comp = [0, 6, 10, 14];
        for (let c = 0; c < comp.length; c++) {
          if (comp[c] < schritt) setNote(pat, 2, start + comp[c], mid[c % mid.length], begInst, 36);
        }
        if (cfg.perc) {
          for (let r = 0; r < schritt; r += 4) {
            setNote(pat, 5, start + r, (r % 8 === 0) ? 60 : 64, (r % 8 === 0) ? INST.KICK : INST.BRUSH, (r % 8 === 0) ? 38 : 28);
            if (r + 3 < schritt && r % 8 === 4) setNote(pat, 5, start + r + 3, 66, INST.BRUSH, 20);
          }
        }
        break;
      }
      case 'bossa': {
        // Sanfter Bossa-Nova-Groove (Wohnzimmerlicht)
        const bPos = [0, 6, 8, 14];
        for (let i = 0; i < bPos.length; i++) {
          if (bPos[i] < schritt) {
            const bn = (i % 2 === 0) ? bass : (bass + 7 <= 52 ? bass + 7 : bass - 5);
            setNote(pat, 3, start + bPos[i], bn, bassInst, 48);
          }
        }
        const cPos = [0, 3, 6, 10, 12];
        for (let i = 0; i < cPos.length; i++) {
          if (cPos[i] < schritt) setNote(pat, 2, start + cPos[i], mid[i % mid.length], begInst, 34);
        }
        if (cfg.perc) {
          for (let r = 0; r < schritt; r += 2) {
            if (r % 8 === 0) setNote(pat, 5, start + r, 60, INST.KICK, 32);
            else if (r % 4 === 2) setNote(pat, 5, start + r, 67, INST.BRUSH, 18);
          }
        }
        break;
      }
      case 'wiege68': {
        // 6/8-Takt (12 Rows pro Takt: 0,2,4,6,8,10) – Regennachmittag & Seegang
        for (let t = 0; t < schritt; t += 12) {
          setNote(pat, 3, start + t, bass, bassInst, 50);
          setNote(pat, 3, start + t + 6, bass + 7 <= 52 ? bass + 7 : bass - 5, bassInst, 42);
          const arp = [mid[0], mid[1], mid[2], mid[1], mid[2], mid[0]];
          for (let k = 0; k < 6; k++) {
            setNote(pat, 2, start + t + k * 2, arp[k], begInst, (k % 3 === 0) ? 38 : 28);
          }
          if (cfg.perc) {
            setNote(pat, 5, start + t, 60, INST.KICK, 40);
            setNote(pat, 5, start + t + 6, 64, INST.BRUSH, 30);
            setNote(pat, 5, start + t + 10, 66, INST.BRUSH, 20);
          }
        }
        break;
      }
      case 'spielabend': {
        // Fröhlicher, hüpfender 16-Bit-Spielabend-Rhythmus
        for (let r = 0; r < schritt; r += 4) {
          const b = (r % 8 === 0) ? bass : (bass + 7 <= 52 ? bass + 7 : bass - 5);
          setNote(pat, 3, start + r, b, bassInst, 54);
          // Offbeat-Akkord auf +2
          if (r + 2 < schritt) {
            setNote(pat, 2, start + r + 2, mid[(r / 4) % mid.length], begInst, 40);
          }
        }
        if (cfg.perc) {
          for (let r = 0; r < schritt; r += 2) {
            if (r % 8 === 0) setNote(pat, 5, start + r, 60, INST.KICK, 44);
            else if (r % 8 === 4) setNote(pat, 5, start + r, 64, INST.BRUSH, 34);
            else if (r % 4 === 2) setNote(pat, 5, start + r, 68, INST.BRUSH, 20);
          }
        }
        break;
      }
      case 'treibend': {
        // Lebhafter 8tel-Bass & fröhlicher Drive (Volle Fahrt, Siegertreppchen)
        for (let r = 0; r < schritt; r += 2) {
          const b = (r % 4 === 0) ? bass : bass + 12;
          setNote(pat, 3, start + r, b, bassInst, (r % 4 === 0) ? 54 : 40);
          if (r % 4 === 2) setNote(pat, 2, start + r, mid[(r / 4) % mid.length], begInst, 38);
        }
        if (cfg.perc) {
          for (let r = 0; r < schritt; r += 2) {
            if (r % 8 === 0 || r % 8 === 6) setNote(pat, 5, start + r, 60, INST.KICK, 46);
            else if (r % 8 === 4) setNote(pat, 5, start + r, 64, INST.BRUSH, 36);
            else setNote(pat, 5, start + r, 68, INST.BRUSH, 18);
          }
        }
        break;
      }
    }
  }
  return pat;
}

// ------------------------------------------------------------------ Die 20 komponierten Soundtracks

const STUECKE = [
  // ==================== PLAYLIST 0: DENKRAUM (ruhig und konzentriert) ====================
  {
    id: '00_herbstbibliothek',
    titel: 'Herbstbibliothek',
    tempo: 76,
    speed: 6,
    stil: 'arpeggio',
    melInst: INST.PIANO,
    begInst: INST.HARFE,
    gegenInst: INST.FLOETE,
    echo: true,
    echoInst: INST.PIANO,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['Dm', 'Gm7', 'C7', 'Fmaj7'],
        melodie: 'A4:2 D5:4 F5:2 E5:2 D5:2 C5:4 Bb4:2 D5:4 G5:2 F5:2 E5:2 C5:4',
      },
      {
        akkorde: ['Bbmaj7', 'Gm7', 'A7', 'Dm'],
        melodie: 'D5:2 F5:4 A5:2 G5:2 F5:2 E5:4 D5:2 E5:2 F5:2 E5:2 D5:8',
        gegen: '-:4 D5:4 Bb4:4 A4:4 -:4 C#5:4 A4:8',
      },
      {
        akkorde: ['Fmaj7', 'C', 'Gm7', 'Dm'],
        melodie: 'A5:4 G5:2 F5:2 E5:4 C5:4 D5:2 F5:2 G5:2 F5:2 E5:4 D5:4',
        gegen: 'C5:4 E5:4 G5:4 E5:4 Bb4:4 D5:4 A4:8',
      },
      {
        akkorde: ['Bbmaj7', 'C', 'A7', 'A7'],
        melodie: 'F5:4 D5:4 G5:4 E5:4 A5:4 G5:2 F5:2 E5:8',
        gegen: 'D5:8 E5:8 C#5:8 E5:8',
      },
    ],
  },
  {
    id: '01_bedenkzeit',
    titel: 'Bedenkzeit',
    tempo: 82,
    speed: 6,
    stil: 'uhrwerk',
    melInst: INST.FLOETE,
    begInst: INST.MARIMBA,
    gegenInst: INST.PIANO,
    pad: true,
    order: [0, 1, 2, 3, 0, 1, 3, 1],
    teile: [
      {
        akkorde: ['Am', 'Fmaj7', 'Dm7', 'E7'],
        melodie: 'E5:4 A5:4 G5:2 F5:2 E5:4 D5:4 F5:4 E5:8',
      },
      {
        akkorde: ['Am', 'G', 'Fmaj7', 'Am'],
        melodie: 'C5:2 E5:2 A5:4 B5:2 A5:2 G5:4 F5:2 E5:2 D5:2 C5:2 A4:8',
        gegen: 'A4:8 B4:8 C5:8 E5:8',
      },
      {
        akkorde: ['C', 'G', 'Am', 'Em'],
        melodie: 'G5:4 E5:2 C5:2 D5:4 B4:4 C5:2 E5:2 A5:2 G5:2 E5:8',
        gegen: 'E5:4 G5:4 D5:4 G5:4 E5:4 C5:4 B4:8',
      },
      {
        akkorde: ['Dm7', 'Am', 'Fmaj7', 'E7'],
        melodie: 'F5:4 A5:2 G5:2 E5:4 C5:4 D5:4 C5:2 B4:2 E5:8',
        gegen: 'A4:8 C5:8 A4:8 B4:8',
      },
    ],
  },
  {
    id: '02_holzbrett',
    titel: 'Holzbrett',
    tempo: 86,
    speed: 6,
    rows: 48,
    stil: 'walzer',
    melInst: INST.HARFE,
    begInst: INST.PIANO,
    gegenInst: INST.FLOETE,
    pad: true,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['G', 'Em', 'C', 'D7'],
        melodie: 'B4:2 D5:4 G5:4 F#5:2 E5:4 G5:2 F#5:6',
      },
      {
        akkorde: ['G', 'C', 'D7', 'G'],
        melodie: 'D5:2 B4:2 D5:2 E5:4 G5:2 F#5:2 E5:2 D5:2 G5:6',
        gegen: 'B4:6 C5:6 A4:6 B4:6',
      },
      {
        akkorde: ['Em', 'Bm', 'C', 'D'],
        melodie: 'E5:4 G5:2 F#5:4 D5:2 E5:2 F#5:2 G5:2 A5:6',
        gegen: 'G5:6 D5:6 E5:6 F#5:6',
      },
      {
        akkorde: ['C', 'G', 'Am7', 'D7'],
        melodie: 'G5:2 E5:2 C5:2 D5:4 B4:2 C5:2 B4:2 A4:2 D5:6',
        gegen: 'E5:6 D5:6 C5:6 A4:6',
      },
    ],
  },
  {
    id: '03_nachtpartie',
    titel: 'Nachtpartie',
    tempo: 72,
    speed: 6,
    stil: 'arpeggio',
    melInst: INST.PIANO,
    begInst: INST.STREICHER,
    gegenInst: INST.MARIMBA,
    echo: true,
    echoInst: INST.MARIMBA,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['Cm', 'Abmaj7', 'Fm7', 'G7'],
        melodie: 'G4:2 C5:4 Eb5:2 D5:4 C5:4 Ab4:2 C5:2 F5:2 Eb5:2 D5:8',
      },
      {
        akkorde: ['Cm', 'Eb', 'Abmaj7', 'Cm'],
        melodie: 'Eb5:4 G5:4 F5:2 Eb5:2 D5:4 C5:2 Eb5:2 D5:2 B4:2 C5:8',
        gegen: '-:8 Bb4:4 G4:4 Ab4:4 F4:4 G4:8',
      },
      {
        akkorde: ['Eb', 'Bb', 'Cm', 'Gm'],
        melodie: 'G5:4 Bb5:4 F5:4 D5:4 Eb5:2 G5:2 F5:2 Eb5:2 D5:8',
        gegen: 'Eb5:8 D5:8 C5:8 Bb4:8',
      },
      {
        akkorde: ['Abmaj7', 'Fm7', 'G7', 'G7'],
        melodie: 'C5:4 Eb5:4 F5:4 Ab5:4 G5:4 F5:2 Eb5:2 D5:8',
      },
    ],
  },
  {
    id: '04_stille-zuege',
    titel: 'Stille Züge',
    tempo: 74,
    speed: 6,
    stil: 'arpeggio',
    melInst: INST.FLOETE,
    begInst: INST.HARFE,
    gegenInst: INST.PIANO,
    pad: true,
    order: [0, 1, 2, 3, 0, 1, 3, 1],
    teile: [
      {
        akkorde: ['Fmaj7', 'Dm7', 'Bbmaj7', 'C'],
        melodie: 'C5:4 F5:4 A5:4 G5:2 F5:2 D5:4 F5:4 G5:8',
      },
      {
        akkorde: ['Fmaj7', 'Am', 'Gm7', 'Fmaj7'],
        melodie: 'A5:4 G5:2 F5:2 E5:4 C5:4 D5:2 F5:2 G5:2 E5:2 F5:8',
        gegen: 'F5:8 E5:8 D5:4 C5:4 A4:8',
      },
      {
        akkorde: ['Dm7', 'Am', 'Bbmaj7', 'F'],
        melodie: 'F5:4 A5:4 C6:4 A5:4 Bb5:2 A5:2 G5:2 F5:2 A5:8',
        gegen: 'D5:8 E5:8 F5:8 C5:8',
      },
      {
        akkorde: ['Gm7', 'C7', 'Am', 'C'],
        melodie: 'G5:4 Bb5:4 A5:2 G5:2 E5:4 F5:4 A5:4 G5:8',
      },
    ],
  },

  // ==================== PLAYLIST 1: KARTENTISCH (gesellig und leicht) ====================
  {
    id: '05_cafe-am-markt',
    titel: 'Café am Markt',
    tempo: 116,
    speed: 6,
    rows: 48,
    stil: 'walzer',
    melInst: INST.AKKORDEON,
    begInst: INST.PIANO,
    gegenInst: INST.FLOETE,
    perc: true,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['C', 'G7', 'G7', 'C'],
        melodie: 'E5:2 G5:2 C6:2 B5:2 A5:2 G5:2 F5:2 A5:2 G5:2 E5:6',
      },
      {
        akkorde: ['F', 'C', 'D7', 'G7'],
        melodie: 'A5:2 C6:2 A5:2 G5:4 E5:2 F#5:2 A5:2 G5:2 D5:6',
        gegen: 'F5:6 E5:6 D5:6 B4:6',
      },
      {
        akkorde: ['Am', 'Em', 'F', 'C'],
        melodie: 'C6:4 B5:2 A5:2 G5:2 E5:2 F5:2 A5:2 G5:2 E5:6',
        gegen: 'E5:6 G5:6 A5:6 G5:6',
      },
      {
        akkorde: ['Dm7', 'G7', 'C', 'C'],
        melodie: 'F5:2 A5:2 D6:2 B5:2 G5:2 F5:2 E5:4 G5:2 C6:6',
        gegen: 'D5:6 F5:6 E5:12',
      },
    ],
  },
  {
    id: '06_gemischtes-blatt',
    titel: 'Gemischtes Blatt',
    tempo: 108,
    speed: 6,
    stil: 'swing',
    melInst: INST.PIANO,
    begInst: INST.HARFE,
    gegenInst: INST.FLOETE,
    perc: true,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['Fmaj7', 'Dm7', 'Gm7', 'C7'],
        melodie: 'A4:2 C5:2 F5:3 G5:1 A5:2 F5:2 D5:4 G5:2 Bb5:2 A5:2 G5:2 E5:4 C5:4',
      },
      {
        akkorde: ['Fmaj7', 'Bb', 'C7', 'Fmaj7'],
        melodie: 'F5:2 A5:2 C6:3 A5:1 Bb5:2 G5:2 F5:4 E5:2 G5:2 Bb5:2 G5:2 F5:8',
        gegen: 'C5:8 D5:8 G5:4 E5:4 A4:8',
      },
      {
        akkorde: ['Bb', 'F', 'Gm7', 'C7'],
        melodie: 'D6:4 C6:2 Bb5:2 A5:4 F5:4 G5:2 Bb5:2 A5:2 G5:2 E5:8',
        gegen: 'F5:8 C5:8 D5:8 G5:8',
      },
      {
        akkorde: ['Am', 'Dm7', 'Gm7', 'C7'],
        melodie: 'C6:2 A5:2 E5:4 A5:2 F5:2 D5:4 Bb5:2 G5:2 E5:2 G5:2 C6:8',
      },
    ],
  },
  {
    id: '07_sonntagsrunde',
    titel: 'Sonntagsrunde',
    tempo: 104,
    speed: 6,
    stil: 'swing',
    melInst: INST.FLOETE,
    begInst: INST.PIANO,
    gegenInst: INST.MARIMBA,
    perc: true,
    order: [0, 1, 2, 3, 0, 1, 3, 1],
    teile: [
      {
        akkorde: ['G', 'Em', 'Am7', 'D7'],
        melodie: 'D5:2 G5:2 B5:4 A5:2 G5:2 E5:4 C5:2 E5:2 A5:2 G5:2 F#5:8',
      },
      {
        akkorde: ['G', 'C', 'D7', 'G'],
        melodie: 'B5:2 A5:2 G5:2 D5:2 E5:4 G5:4 F#5:2 A5:2 D5:2 F#5:2 G5:8',
        gegen: 'G5:8 E5:8 D5:8 B4:8',
      },
      {
        akkorde: ['C', 'G', 'A7', 'D7'],
        melodie: 'E5:2 G5:2 C6:4 B5:2 A5:2 G5:4 A5:2 G5:2 E5:2 G5:2 F#5:8',
        gegen: 'G5:8 D5:8 E5:8 A5:8',
      },
      {
        akkorde: ['Em', 'C', 'Am7', 'D7'],
        melodie: 'G5:4 B5:4 C6:2 B5:2 G5:4 A5:2 G5:2 F#5:2 E5:2 D5:8',
      },
    ],
  },
  {
    id: '08_stich-fuer-stich',
    titel: 'Stich für Stich',
    tempo: 114,
    speed: 6,
    stil: 'swing',
    melInst: INST.AKKORDEON,
    begInst: INST.MARIMBA,
    gegenInst: INST.PIANO,
    perc: true,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['Dm', 'A7', 'Dm', 'C'],
        melodie: 'D5:2 F5:2 A5:2 -:2 G5:2 E5:2 C#5:2 -:2 D5:2 F5:2 A5:2 F5:2 G5:4 E5:4',
      },
      {
        akkorde: ['F', 'C', 'Gm7', 'A7'],
        melodie: 'A5:2 C6:2 A5:2 F5:2 G5:2 E5:2 C5:4 Bb5:2 A5:2 G5:2 F5:2 E5:8',
        gegen: 'F5:8 E5:8 D5:8 C#5:8',
      },
      {
        akkorde: ['Bb', 'F', 'Gm7', 'Dm'],
        melodie: 'F5:2 Bb5:2 D6:2 Bb5:2 C6:2 A5:2 F5:4 G5:2 Bb5:2 A5:2 G5:2 F5:4 D5:4',
        gegen: 'D5:8 C5:8 Bb4:8 A4:8',
      },
      {
        akkorde: ['Gm7', 'Dm', 'A7', 'Dm'],
        melodie: 'G5:2 Bb5:2 G5:2 E5:2 F5:2 A5:2 F5:2 D5:2 E5:2 G5:2 C#5:2 E5:2 D5:8',
      },
    ],
  },
  {
    id: '09_wohnzimmerlicht',
    titel: 'Wohnzimmerlicht',
    tempo: 94,
    speed: 6,
    stil: 'bossa',
    melInst: INST.PIANO,
    begInst: INST.HARFE,
    gegenInst: INST.FLOETE,
    pad: true,
    perc: true,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['Ebmaj7', 'Cm7', 'Fm7', 'Bb7'],
        melodie: 'G5:3 F5:1 Eb5:2 Bb4:2 G5:3 F5:1 Eb5:4 Ab5:3 G5:1 F5:2 Eb5:2 D5:4 Bb4:4',
      },
      {
        akkorde: ['Ebmaj7', 'Abmaj7', 'Bb7', 'Ebmaj7'],
        melodie: 'Bb5:3 Ab5:1 G5:2 Eb5:2 C6:3 Bb5:1 Ab5:4 G5:2 F5:2 D5:2 F5:2 Eb5:8',
        gegen: 'G5:8 Eb5:8 F5:8 G5:8',
      },
      {
        akkorde: ['Abmaj7', 'Gm7', 'Fm7', 'Ebmaj7'],
        melodie: 'C6:4 Bb5:2 Ab5:2 Bb5:4 G5:4 Ab5:2 G5:2 F5:2 Eb5:2 G5:8',
        gegen: 'Eb5:8 D5:8 C5:8 Bb4:8',
      },
      {
        akkorde: ['Cm7', 'Fm7', 'Bb7', 'Bb7'],
        melodie: 'Eb5:2 G5:2 Bb5:4 Ab5:2 G5:2 F5:4 G5:2 Ab5:2 Bb5:2 Ab5:2 F5:8',
      },
    ],
  },

  // ==================== PLAYLIST 2: PATIENCE (gemütlich und verträumt) ====================
  {
    id: '10_regennachmittag',
    titel: 'Regennachmittag',
    tempo: 78,
    speed: 6,
    rows: 48,
    stil: 'wiege68',
    melInst: INST.PIANO,
    begInst: INST.HARFE,
    gegenInst: INST.FLOETE,
    echo: true,
    echoInst: INST.PIANO,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['Abmaj7', 'Fm7', 'Dbmaj7', 'Eb7'],
        melodie: 'C5:2 Eb5:2 Ab5:2 G5:2 F5:2 Eb5:2 F5:4 Ab5:2 G5:6',
      },
      {
        akkorde: ['Abmaj7', 'Cm7', 'Bbm7', 'Abmaj7'],
        melodie: 'Eb5:2 Ab5:2 C6:2 Bb5:2 Ab5:2 G5:2 F5:2 Eb5:2 Db5:2 C5:6',
        gegen: 'C5:6 Eb5:6 Db5:6 C5:6',
      },
      {
        akkorde: ['Dbmaj7', 'Abmaj7', 'Bbm7', 'Eb7'],
        melodie: 'F5:4 Ab5:2 Eb5:4 C5:2 Db5:2 F5:2 Eb5:2 Bb4:6',
        gegen: 'Ab5:6 Eb5:6 F5:6 G5:6',
      },
      {
        akkorde: ['Fm7', 'Dbmaj7', 'Eb7', 'Abmaj7'],
        melodie: 'Ab5:2 G5:2 F5:2 Eb5:2 Db5:2 C5:2 Bb4:2 C5:2 Eb5:2 Ab4:6',
      },
    ],
  },
  {
    id: '11_kartenhaus',
    titel: 'Kartenhaus',
    tempo: 84,
    speed: 6,
    stil: 'arpeggio',
    melInst: INST.MARIMBA,
    begInst: INST.HARFE,
    gegenInst: INST.FLOETE,
    pad: true,
    order: [0, 1, 2, 3, 0, 1, 3, 1],
    teile: [
      {
        akkorde: ['D', 'Bm', 'G', 'A7'],
        melodie: 'F#5:2 A5:2 D6:4 B5:2 A5:2 F#5:4 G5:2 B5:2 A5:2 G5:2 E5:8',
      },
      {
        akkorde: ['D', 'G', 'A7', 'D'],
        melodie: 'A5:2 F#5:2 D5:4 G5:2 B5:2 D6:4 C#6:2 B5:2 A5:2 G5:2 F#5:8',
        gegen: 'D5:8 B4:8 E5:8 D5:8',
      },
      {
        akkorde: ['G', 'D', 'Em7', 'A7'],
        melodie: 'B5:4 D6:4 A5:4 F#5:4 G5:2 F#5:2 E5:2 D5:2 E5:8',
        gegen: 'G5:8 F#5:8 E5:8 C#5:8',
      },
      {
        akkorde: ['Bm', 'F#m', 'G', 'A7'],
        melodie: 'D6:4 B5:4 C#6:4 A5:4 B5:2 A5:2 G5:2 F#5:2 E5:8',
      },
    ],
  },
  {
    id: '12_morgentee',
    titel: 'Morgentee',
    tempo: 88,
    speed: 6,
    stil: 'arpeggio',
    melInst: INST.FLOETE,
    begInst: INST.HARFE,
    gegenInst: INST.PIANO,
    pad: true,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['A', 'F#m', 'D', 'E7'],
        melodie: 'E5:2 A5:4 C#6:2 B5:2 A5:2 F#5:4 D5:2 F#5:2 A5:2 F#5:2 G#5:8',
      },
      {
        akkorde: ['A', 'D', 'E7', 'A'],
        melodie: 'C#6:4 B5:2 A5:2 F#5:4 A5:4 G#5:2 B5:2 E5:2 G#5:2 A5:8',
        gegen: 'A4:8 D5:8 E5:8 C#5:8',
      },
      {
        akkorde: ['D', 'A', 'Bm7', 'E7'],
        melodie: 'F#5:4 A5:4 E5:4 C#5:4 D5:2 F#5:2 E5:2 D5:2 B4:8',
        gegen: 'A5:8 E5:8 F#5:8 G#5:8',
      },
      {
        akkorde: ['F#m', 'D', 'Bm7', 'E7'],
        melodie: 'A5:4 C#6:4 B5:2 A5:2 F#5:4 D5:2 E5:2 F#5:2 A5:2 G#5:8',
      },
    ],
  },
  {
    id: '13_wolkenzug',
    titel: 'Wolkenzug',
    tempo: 76,
    speed: 6,
    stil: 'arpeggio',
    melInst: INST.PIANO,
    begInst: INST.STREICHER,
    gegenInst: INST.FLOETE,
    echo: true,
    echoInst: INST.HARFE,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['Cmaj7', 'D', 'Em7', 'G'],
        melodie: 'G5:4 B5:4 A5:4 F#5:4 G5:4 E5:4 D5:8',
      },
      {
        akkorde: ['Cmaj7', 'G', 'Am7', 'Cmaj7'],
        melodie: 'E5:2 G5:2 B5:4 A5:2 G5:2 D5:4 E5:2 G5:2 A5:2 G5:2 E5:8',
        gegen: 'C5:8 B4:8 A4:8 G4:8',
      },
      {
        akkorde: ['Fmaj7', 'Cmaj7', 'Dm7', 'G'],
        melodie: 'A5:4 C6:4 G5:4 E5:4 F5:2 E5:2 D5:2 C5:2 D5:8',
        gegen: 'C5:8 E5:8 D5:8 B4:8',
      },
      {
        akkorde: ['Am7', 'Fmaj7', 'D', 'G'],
        melodie: 'E5:4 A5:4 C6:4 A5:4 F#5:4 A5:4 G5:8',
      },
    ],
  },
  {
    id: '14_kerzenschein',
    titel: 'Kerzenschein',
    tempo: 72,
    speed: 6,
    rows: 48,
    stil: 'walzer',
    melInst: INST.PIANO,
    begInst: INST.HARFE,
    gegenInst: INST.FLOETE,
    pad: true,
    order: [0, 1, 2, 3, 0, 1, 3, 1],
    teile: [
      {
        akkorde: ['Em', 'C', 'G', 'D'],
        melodie: 'B4:2 E5:4 G5:4 E5:2 D5:4 B4:2 A4:6',
      },
      {
        akkorde: ['Em', 'Am', 'B7', 'Em'],
        melodie: 'G5:2 F#5:2 E5:2 A5:4 G5:2 F#5:4 D#5:2 E5:6',
        gegen: 'E5:6 C5:6 B4:6 G4:6',
      },
      {
        akkorde: ['G', 'D', 'C', 'G'],
        melodie: 'B5:4 G5:2 A5:4 F#5:2 G5:2 F#5:2 E5:2 D5:6',
        gegen: 'D5:6 F#5:6 E5:6 D5:6',
      },
      {
        akkorde: ['Am', 'Em', 'B7', 'B7'],
        melodie: 'C6:4 A5:2 B5:4 G5:2 F#5:4 E5:2 D#5:6',
      },
    ],
  },

  // ==================== PLAYLIST 3: SPIELABEND (fröhlich und verspielt) ====================
  {
    id: '15_wuerfelglueck',
    titel: 'Würfelglück',
    tempo: 126,
    speed: 6,
    stil: 'spielabend',
    melInst: INST.MARIMBA,
    begInst: INST.PIANO,
    gegenInst: INST.PULSE,
    perc: true,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['C', 'G', 'Am', 'F'],
        melodie: 'G5:2 E5:2 C5:2 E5:2 G5:2 B5:2 G5:4 A5:2 C6:2 A5:2 E5:2 F5:2 A5:2 F5:4',
      },
      {
        akkorde: ['C', 'F', 'G7', 'C'],
        melodie: 'E5:2 G5:2 C6:2 G5:2 A5:2 C6:2 A5:2 F5:2 G5:2 B5:2 D6:2 B5:2 C6:6 -:2',
        gegen: 'C5:4 E5:4 F5:4 A5:4 G5:4 F5:4 E5:8',
      },
      {
        akkorde: ['F', 'C', 'Dm', 'G7'],
        melodie: 'C6:2 A5:2 F5:2 A5:2 G5:2 E5:2 C5:4 F5:2 A5:2 D6:2 C6:2 B5:4 G5:4',
        gegen: 'A5:8 G5:8 F5:8 D5:8',
      },
      {
        akkorde: ['Am', 'F', 'G7', 'G7'],
        melodie: 'E5:2 A5:2 C6:2 A5:2 F5:2 A5:2 C6:2 A5:2 B5:2 G5:2 D5:2 G5:2 B5:8',
      },
    ],
  },
  {
    id: '16_volle-fahrt',
    titel: 'Volle Fahrt',
    tempo: 136,
    speed: 6,
    stil: 'treibend',
    melInst: INST.PULSE,
    begInst: INST.MARIMBA,
    gegenInst: INST.FLOETE,
    perc: true,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['G', 'D', 'Em', 'C'],
        melodie: 'D5:2 G5:2 B5:2 D6:2 A5:4 F#5:4 G5:2 B5:2 G5:2 E5:2 G5:4 E5:4',
      },
      {
        akkorde: ['G', 'C', 'D7', 'G'],
        melodie: 'B5:2 G5:2 D5:2 G5:2 E5:2 G5:2 C6:2 G5:2 F#5:2 A5:2 D6:2 A5:2 G5:6 -:2',
        gegen: 'G5:8 E5:8 A5:8 B5:8',
      },
      {
        akkorde: ['C', 'G', 'D', 'Em'],
        melodie: 'E5:2 G5:2 C6:2 B5:2 G5:4 D5:4 F#5:2 A5:2 D6:2 C6:2 B5:4 G5:4',
        gegen: 'C5:8 B4:8 A4:8 G4:8',
      },
      {
        akkorde: ['C', 'Am', 'D7', 'D7'],
        melodie: 'C6:2 G5:2 E5:2 G5:2 A5:2 E5:2 C5:2 E5:2 F#5:2 A5:2 C6:2 A5:2 D6:8',
      },
    ],
  },
  {
    id: '17_kunterbunt',
    titel: 'Kunterbunt',
    tempo: 122,
    speed: 6,
    stil: 'spielabend',
    melInst: INST.FLOETE,
    begInst: INST.MARIMBA,
    gegenInst: INST.PULSE,
    perc: true,
    order: [0, 1, 2, 3, 0, 1, 3, 1],
    teile: [
      {
        akkorde: ['Bb', 'F', 'Gm', 'Eb'],
        melodie: 'F5:2 Bb5:2 D6:2 Bb5:2 C6:2 A5:2 F5:4 G5:2 Bb5:2 G5:2 D5:2 Eb5:2 G5:2 Bb5:4',
      },
      {
        akkorde: ['Bb', 'Eb', 'F7', 'Bb'],
        melodie: 'D6:2 C6:2 Bb5:2 F5:2 G5:2 Bb5:2 Eb6:2 Bb5:2 C6:2 A5:2 F5:2 A5:2 Bb5:6 -:2',
        gegen: 'F5:8 G5:8 A5:8 F5:8',
      },
      {
        akkorde: ['Eb', 'Bb', 'Cm', 'F7'],
        melodie: 'G5:2 Bb5:2 Eb6:2 D6:2 Bb5:4 F5:4 G5:2 C6:2 Eb6:2 C6:2 A5:4 F5:4',
        gegen: 'Eb5:8 D5:8 Eb5:8 C5:8',
      },
      {
        akkorde: ['Gm', 'Eb', 'F7', 'Bb'],
        melodie: 'Bb5:2 G5:2 D5:2 G5:2 Eb5:2 G5:2 Bb5:2 G5:2 A5:2 C6:2 F5:2 A5:2 Bb5:8',
      },
    ],
  },
  {
    id: '18_seegang',
    titel: 'Seegang',
    tempo: 124,
    speed: 6,
    rows: 48,
    stil: 'wiege68',
    melInst: INST.AKKORDEON,
    begInst: INST.HARFE,
    gegenInst: INST.FLOETE,
    perc: true,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['Dm', 'C', 'Dm', 'A7'],
        melodie: 'D5:2 F5:2 A5:2 G5:2 E5:2 C5:2 D5:2 F5:2 A5:2 E5:6',
      },
      {
        akkorde: ['Dm', 'Bb', 'C', 'Dm'],
        melodie: 'A5:2 F5:2 D5:2 F5:2 Bb5:2 F5:2 G5:2 E5:2 C5:2 D5:6',
        gegen: 'F5:6 D5:6 E5:6 D5:6',
      },
      {
        akkorde: ['F', 'C', 'Gm', 'A7'],
        melodie: 'C6:2 A5:2 F5:2 G5:2 E5:2 C5:2 Bb5:2 G5:2 D5:2 E5:6',
        gegen: 'A5:6 G5:6 G5:6 C#5:6',
      },
      {
        akkorde: ['Bb', 'F', 'A7', 'Dm'],
        melodie: 'D6:2 Bb5:2 F5:2 C6:2 A5:2 F5:2 E5:2 G5:2 C#5:2 D5:6',
      },
    ],
  },
  {
    id: '19_siegertreppchen',
    titel: 'Siegertreppchen',
    tempo: 130,
    speed: 6,
    stil: 'treibend',
    melInst: INST.PULSE,
    begInst: INST.PIANO,
    gegenInst: INST.AKKORDEON,
    perc: true,
    order: [0, 1, 2, 3, 0, 1, 2, 1],
    teile: [
      {
        akkorde: ['D', 'A', 'Bm', 'G'],
        melodie: 'A5:2 D6:2 F#6:2 D6:2 E6:4 C#6:4 D6:2 B5:2 F#5:2 B5:2 G5:4 B5:4',
      },
      {
        akkorde: ['D', 'G', 'A7', 'D'],
        melodie: 'F#5:2 A5:2 D6:2 A5:2 B5:2 D6:2 G5:2 B5:2 A5:2 C#6:2 E6:2 C#6:2 D6:6 -:2',
        gegen: 'D5:8 G5:8 E5:8 F#5:8',
      },
      {
        akkorde: ['G', 'D', 'Em', 'A7'],
        melodie: 'B5:2 D6:2 G6:2 D6:2 F#6:4 D6:4 E6:2 B5:2 G5:2 B5:2 C#6:4 A5:4',
        gegen: 'G5:8 F#5:8 E5:8 E5:8',
      },
      {
        akkorde: ['Bm', 'G', 'A7', 'D'],
        melodie: 'D6:2 B5:2 F#5:2 B5:2 G5:2 B5:2 D6:2 B5:2 C#6:2 A5:2 E5:2 A5:2 D6:8',
      },
    ],
  },
];

// ------------------------------------------------------------------ IT 2.14 Binärschreiber

class Writer {
  constructor() {
    this.chunks = [];
    this.len = 0;
  }
  u8(v) {
    const b = Buffer.alloc(1);
    b[0] = v & 0xff;
    this.chunks.push(b);
    this.len += 1;
  }
  u16(v) {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(v & 0xffff, 0);
    this.chunks.push(b);
    this.len += 2;
  }
  u32(v) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(v >>> 0, 0);
    this.chunks.push(b);
    this.len += 4;
  }
  str(s, fixedLen) {
    const b = Buffer.alloc(fixedLen);
    b.write(s.slice(0, fixedLen), 0, 'latin1');
    this.chunks.push(b);
    this.len += fixedLen;
  }
  bytes(buf) {
    this.chunks.push(buf);
    this.len += buf.length;
  }
  zeros(n) {
    this.bytes(Buffer.alloc(n));
  }
  toBuffer() {
    return Buffer.concat(this.chunks, this.len);
  }
}

function packEnvelope(nodes, sustain) {
  const w = new Writer();
  let flg = nodes && nodes.length ? 1 : 0; // Enabled
  if (sustain) flg |= 4; // Sustain
  w.u8(flg);
  w.u8(nodes ? nodes.length : 0);
  w.u8(0); // LoopStart
  w.u8(0); // LoopEnd
  w.u8(sustain ? sustain[0] : 0);
  w.u8(sustain ? sustain[1] : 0);
  for (let i = 0; i < 25; i++) {
    const node = nodes && i < nodes.length ? nodes[i] : [0, 0];
    w.u8(node[1] & 0xff); // y (0..64)
    w.u16(node[0]);       // x (tick)
  }
  return w.toBuffer();
}

// Exakte IT-Instrument-Serialisierung exakt nach smconv/itloader.cpp!
function encodeInstrumentExact(inst, sampleIdx1Based) {
  const w = new Writer();
  w.str('IMPI', 4);
  w.str(`INST${sampleIdx1Based}`, 12);
  w.u8(0); // 00h (Pflichtbyte nach DOSFilename)
  w.u8(0); // NNA: Cut
  w.u8(0); // DCT
  w.u8(0); // DCA
  w.u16(inst.fadeout ?? 64); // Fadeout
  w.u8(0); // PPS
  w.u8(60); // PPC (C-5)
  w.u8(128); // GlobalVolume
  w.u8(128 | 32); // DefaultPan (disabled bit 7, center 32)
  w.u8(0); // RandomVolume
  w.u8(0); // RandomPanning
  w.u16(0x0214); // TrackerVersion
  w.u8(1); // NumberOfSamples
  w.str(inst.name, 26);
  w.u8(0); // IFC
  w.u8(0); // IFR
  w.u8(0); // MidiChannel
  w.u8(0); // MidiProgram
  w.u16(0); // MidiBank
  w.u8(0); // reserved
  // Notemap: 120 * (Note, Sample)
  for (let n = 0; n < 120; n++) {
    w.u8(n);
    w.u8(sampleIdx1Based);
  }
  w.bytes(packEnvelope(inst.env, inst.sustain)); // VolumeEnvelope
  w.bytes(packEnvelope(null, null));             // PanningEnvelope
  w.bytes(packEnvelope(null, null));             // PitchEnvelope
  return w.toBuffer();
}

function encodeSampleHeader(inst, dataOffset) {
  const s = inst.sample;
  const w = new Writer();
  w.str('IMPS', 4);
  w.str(`${inst.name.slice(0, 8)}.SMP`, 12);
  w.u8(0); // 00h
  w.u8(64); // GlobalVolume
  // Flags: 1=HasSample, 2=16-bit, 16=Loop
  w.u8(1 | 2 | (s.loop ? 16 : 0));
  w.u8(inst.vol ?? 64); // DefaultVolume
  w.str(inst.name, 26);
  w.u8(1); // Convert: bit 0 = signed samples
  w.u8(32); // DefaultPanning (center)
  w.u32(s.pcm.length);
  w.u32(s.loopStart);
  w.u32(s.loopEnd);
  w.u32(s.c5Speed);
  w.u32(0); // SustainStart
  w.u32(0); // SustainEnd
  w.u32(dataOffset);
  w.u8(0); // VibratoSpeed
  w.u8(0); // VibratoDepth
  w.u8(0); // VibratoRate
  w.u8(0); // VibratoForm
  return w.toBuffer();
}

function encodePattern(pat) {
  const body = new Writer();
  for (let r = 0; r < pat.rows; r++) {
    for (let ch = 0; ch < 6; ch++) {
      const cell = pat.ch[ch][r];
      if (!cell) continue;
      // Channel variable: (ch + 1) | 0x80 (new mask follows)
      body.u8((ch + 1) | 0x80);
      // Mask: bit 0 = note, bit 1 = instrument, bit 2 = volume
      let mask = 1;
      if (cell.note < 254) mask |= 2 | 4;
      body.u8(mask);
      body.u8(cell.note);
      if (cell.note < 254) {
        body.u8(cell.inst);
        body.u8(Math.max(0, Math.min(64, cell.vol)));
      }
    }
    body.u8(0); // End of row
  }
  const data = body.toBuffer();
  const w = new Writer();
  w.u16(data.length);
  w.u16(pat.rows);
  w.zeros(4);
  w.bytes(data);
  return w.toBuffer();
}

function encodeIT(stueck) {
  const patterns = stueck.teile.map((t) => bauePattern(stueck, t));
  const ordNum = stueck.order.length;
  const insNum = INSTRUMENTE.length;
  const smpNum = INSTRUMENTE.length;
  const patNum = patterns.length;

  // Feste Kopfgröße: 192 Bytes + ordNum + 4*insNum + 4*smpNum + 4*patNum
  const headerSize = 192 + ordNum + 4 * insNum + 4 * smpNum + 4 * patNum;

  const instBufs = INSTRUMENTE.map((inst, i) => encodeInstrumentExact(inst, i + 1));
  const patBufs = patterns.map((p) => encodePattern(p));

  let pos = headerSize;
  const instOffsets = instBufs.map((b) => { const o = pos; pos += b.length; return o; });
  const smpHeaderSize = 80;
  const smpOffsets = INSTRUMENTE.map(() => { const o = pos; pos += smpHeaderSize; return o; });
  const patOffsets = patBufs.map((b) => { const o = pos; pos += b.length; return o; });
  const smpDataOffsets = INSTRUMENTE.map((inst) => {
    const o = pos;
    pos += inst.sample.pcm.length * 2;
    return o;
  });

  const w = new Writer();
  w.str('IMPM', 4);
  w.str(stueck.titel, 26);
  w.u16(0x1004); // PatternHighlight
  w.u16(ordNum);
  w.u16(insNum);
  w.u16(smpNum);
  w.u16(patNum);
  w.u16(0x0214); // Cwtv
  w.u16(0x0214); // Cmwt
  w.u16(1 | 4 | 8); // Flags: Stereo, UseInstruments, LinearSlides
  w.u16(0); // Special
  w.u8(128); // GlobalVolume
  w.u8(48);  // MixingVolume
  w.u8(stueck.speed ?? 6);
  w.u8(stueck.tempo);
  w.u8(128); // Panning separation
  w.u8(0);   // PWD
  w.u16(0);  // MessageLength
  w.u32(0);  // MessageOffset
  w.u32(0);  // Reserved

  // ChannelPan (64 Bytes): sanftes Stereo-Panning für die 6 Spuren (0=links, 32=mitte, 64=rechts)
  const pans = [28, 40, 20, 32, 46, 36];
  for (let i = 0; i < 64; i++) w.u8(i < 6 ? pans[i] : 160);
  // ChannelVolume (64 Bytes)
  for (let i = 0; i < 64; i++) w.u8(i < 6 ? 64 : 0);

  // Orders
  for (const ord of stueck.order) w.u8(ord);
  // Offset-Tabellen
  for (const o of instOffsets) w.u32(o);
  for (const o of smpOffsets) w.u32(o);
  for (const o of patOffsets) w.u32(o);

  // Instrumente
  for (const b of instBufs) w.bytes(b);
  // Sample-Header
  for (let i = 0; i < INSTRUMENTE.length; i++) {
    w.bytes(encodeSampleHeader(INSTRUMENTE[i], smpDataOffsets[i]));
  }
  // Patterns
  for (const b of patBufs) w.bytes(b);
  // Sample-Daten (16-Bit signed LE)
  for (const inst of INSTRUMENTE) {
    const pcm = inst.sample.pcm;
    const buf = Buffer.alloc(pcm.length * 2);
    for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(pcm[i], i * 2);
    w.bytes(buf);
  }
  return w.toBuffer();
}

// Alle 20 Soundtracks erzeugen
for (const stueck of STUECKE) {
  const buf = encodeIT(stueck);
  writeFileSync(join(ziel, `${stueck.id}.it`), buf);
}
console.log(`musik.mjs: ${STUECKE.length} Soundtracks nach ${ziel}/ erzeugt.`);
