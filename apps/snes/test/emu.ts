/*
 * Steuerung des Prüf-Emulators (werkzeuge/emu/emu.c) aus Node: ein Kindprozess, Befehle
 * zeilenweise über stdin, Antworten zeilenweise über stdout.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** Knöpfe in der Bitfolge von libretro (RETRO_DEVICE_ID_JOYPAD_*). */
export const KNOPF = {
  B: 1 << 0,
  Y: 1 << 1,
  SELECT: 1 << 2,
  START: 1 << 3,
  HOCH: 1 << 4,
  RUNTER: 1 << 5,
  LINKS: 1 << 6,
  RECHTS: 1 << 7,
  A: 1 << 8,
  X: 1 << 9,
  L: 1 << 10,
  R: 1 << 11,
} as const;

export class PruefEmu {
  private puffer = '';
  private wartende: { ok: (zeile: string) => void; fehler: (e: Error) => void }[] = [];
  private constructor(private proc: ChildProcessWithoutNullStreams) {
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (stueck: string) => {
      this.puffer += stueck;
      let ende: number;
      while ((ende = this.puffer.indexOf('\n')) >= 0) {
        const zeile = this.puffer.slice(0, ende);
        this.puffer = this.puffer.slice(ende + 1);
        // Der Kern schreibt gelegentlich eigene Zeilen (z. B. „Map_LoROMMap“) – nur Antworten zählen.
        if (zeile.startsWith('ok')) this.wartende.shift()?.ok(zeile.slice(3));
        else if (zeile.startsWith('fehler')) this.wartende.shift()?.fehler(new Error(zeile));
      }
    });
    proc.on('exit', (code) => {
      for (const w of this.wartende.splice(0)) w.fehler(new Error(`Prüf-Emulator beendet (${code})`));
    });
  }

  static async starten(emu: string, kern: string, rom: string): Promise<PruefEmu> {
    const proc = spawn(emu, [kern, rom], { stdio: ['pipe', 'pipe', 'inherit'] });
    const e = new PruefEmu(proc);
    await e.antwort(); // „ok bereit“
    return e;
  }

  private antwort(): Promise<string> {
    return new Promise((ok, fehler) => this.wartende.push({ ok, fehler }));
  }

  befehl(zeile: string): Promise<string> {
    const a = this.antwort();
    this.proc.stdin.write(`${zeile}\n`);
    return a;
  }

  run(bilder: number) {
    return this.befehl(`run ${bilder}`);
  }
  pad(port: number, maske: number) {
    return this.befehl(`pad ${port} ${maske.toString(16)}`);
  }
  async peek(adresse: number, laenge: number): Promise<Uint8Array> {
    return hexBytes(await this.befehl(`peek ${adresse.toString(16)} ${laenge}`));
  }
  poke(adresse: number, daten: Uint8Array | number[]) {
    return this.befehl(`poke ${adresse.toString(16)} ${bytesHex(daten)}`);
  }
  async speek(adresse: number, laenge: number): Promise<Uint8Array> {
    return hexBytes(await this.befehl(`speek ${adresse.toString(16)} ${laenge}`));
  }
  /** Lässt Bilder laufen, bis das Byte den Wert hat; gibt die Zahl der Bilder zurück. */
  async until(adresse: number, wert: number, max: number): Promise<number> {
    return Number(await this.befehl(`until ${adresse.toString(16)} ${wert.toString(16)} ${max}`));
  }
  shot(datei: string) {
    return this.befehl(`shot ${datei}`);
  }
  async audio(): Promise<number> {
    return Number(await this.befehl('audio'));
  }
  reset() {
    return this.befehl('reset');
  }
  /** Drückt Knöpfe kurz (3 Bilder) und lässt sie wieder los (3 Bilder). */
  async druecke(port: number, maske: number, nachher = 3) {
    await this.pad(port, maske);
    await this.run(3);
    await this.pad(port, 0);
    await this.run(nachher);
  }
  async beenden() {
    await this.befehl('quit');
    this.proc.stdin.end();
  }
}

export function hexBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}

export function bytesHex(b: Uint8Array | number[]): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Liest die Symboldatei des Linkers: Name → Adresse im Arbeitsspeicher (WRAM, $7e0000 = 0). */
export function symbole(pfad: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const zeile of readFileSync(pfad, 'utf8').split('\n')) {
    const treffer = /^([0-9a-f]{8}) (\S+)$/.exec(zeile.trim());
    if (!treffer) continue;
    const adresse = parseInt(treffer[1]!, 16);
    const bank = adresse >> 16;
    if (bank === 0x7e || bank === 0x7f) m.set(treffer[2]!, adresse - 0x7e0000);
  }
  return m;
}

/** Kachelcodes der Schrift zurück in Text (siehe werkzeuge/grafik.mjs, SONDERZEICHEN). */
const SONDER: Record<number, string> = {
  0x80: 'Ä', 0x81: 'Ö', 0x82: 'Ü', 0x83: 'ä', 0x84: 'ö', 0x85: 'ü', 0x86: 'ß', 0x87: '×', 0x88: '·',
  0x89: '–', 0x8a: '„', 0x8b: '“', 0x8c: '◀', 0x8d: '▶', 0x8e: '✚', 0x8f: '…',
};
export function kachelText(karte: Uint8Array, zeile: number): string {
  let s = '';
  for (let x = 0; x < 32; x++) {
    const eintrag = karte[(zeile * 32 + x) * 2]! | (karte[(zeile * 32 + x) * 2 + 1]! << 8);
    const c = eintrag & 0x3ff;
    s += c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : (SONDER[c] ?? ' ');
  }
  return s.trimEnd();
}

/** Liest ein Bildschirmfoto des Prüf-Emulators (RGB, Filter 0) zurück: Breite, Höhe, Bildpunkte. */
export function pngLesen(pfad: string): { b: number; h: number; rgb: Uint8Array } {
  const d = readFileSync(pfad);
  let i = 8;
  let b = 0;
  let h = 0;
  const idat: Buffer[] = [];
  while (i < d.length) {
    const laenge = d.readUInt32BE(i);
    const typ = d.toString('latin1', i + 4, i + 8);
    if (typ === 'IHDR') {
      b = d.readUInt32BE(i + 8);
      h = d.readUInt32BE(i + 12);
    }
    if (typ === 'IDAT') idat.push(d.subarray(i + 8, i + 8 + laenge));
    i += 12 + laenge;
  }
  const roh = inflateSync(Buffer.concat(idat));
  const rgb = new Uint8Array(b * h * 3);
  for (let y = 0; y < h; y++) rgb.set(roh.subarray(y * (b * 3 + 1) + 1, (y + 1) * (b * 3 + 1)), y * b * 3);
  return { b, h, rgb };
}

/** Anteil der Bildpunkte, die sich in einem Farbkanal um mehr als `toleranz` unterscheiden. */
export function bildAbweichung(a: { b: number; h: number; rgb: Uint8Array }, b: { b: number; h: number; rgb: Uint8Array }, toleranz = 12) {
  if (a.b !== b.b || a.h !== b.h) return 1;
  let anders = 0;
  for (let i = 0; i < a.rgb.length; i += 3) {
    if (Math.abs(a.rgb[i]! - b.rgb[i]!) > toleranz || Math.abs(a.rgb[i + 1]! - b.rgb[i + 1]!) > toleranz || Math.abs(a.rgb[i + 2]! - b.rgb[i + 2]!) > toleranz) anders++;
  }
  return anders / (a.b * a.h);
}
