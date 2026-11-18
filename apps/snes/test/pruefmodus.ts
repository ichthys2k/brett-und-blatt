/*
 * Steuerung des Prüfmodus im ROM (src/pruef.c) über das Postfach im Arbeitsspeicher.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PruefEmu, symbole } from './emu';

const env = process.env;
const ordner = fileURLToPath(new URL('..', import.meta.url));
export const ROM = env.SNES_ROM ?? `${ordner}brett-und-blatt-16.sfc`;
export const SYM = ROM.replace(/\.sfc$/, '.sym');
/** Laufen die Prüfungen? Nur mit Werkzeugkette und gebautem ROM. */
export const AKTIV = Boolean(env.SNES_EMU && env.SNES_KERN && existsSync(ROM) && existsSync(SYM));

// Aufbau des Postfachs.
const KENNUNG = 0;
const BEFEHL = 4;
const STATUS = 5;
const ARG = 6;
const AUS = 70;
const AUS_ZUEGE = 16;

export const ZUFALL_TEXT = 0x01;
export const ZUFALL_ZAHLEN = 0x02;
export const ZUFALL_BIS = 0x03;
export const SPIEL_START = 0x10;
export const SPIEL_ZUG = 0x11;
export const BOT = 0x12;
export const KEIN = 0xff;

export interface Auszug {
  status: number;
  ergebnis: number;
  sieger: number;
  amZug: number;
  /** Erlaubte Züge als Bytefolgen. */
  zuege: number[][];
  stand: number[];
}

export class Pruefmodus {
  private constructor(
    readonly emu: PruefEmu,
    private postfach: number,
  ) {}

  /** Startet einen Prüf-Emulator mit dem ROM und schaltet in den Prüfmodus. */
  static async starten(kern = env.SNES_KERN!): Promise<Pruefmodus> {
    const emu = await PruefEmu.starten(env.SNES_EMU!, kern, ROM);
    const adresse = symbole(SYM).get('pruef_postfach');
    if (adresse === undefined) throw new Error('Symbol pruef_postfach fehlt');
    const p = new Pruefmodus(emu, adresse);
    await emu.run(60);
    await emu.poke(adresse + KENNUNG, [0x50, 0x52, 0x55, 0x46]); // „PRUF“
    await emu.until(adresse + STATUS, 0xaa, 120);
    return p;
  }

  beenden() {
    return this.emu.beenden();
  }

  /** Führt einen Befehl aus; gibt Status (1 erledigt, 2 abgelehnt, 3 zu lang) und die ersten `laenge` Bytes der Antwort zurück. */
  async befehl(befehl: number, arg: number[] = [], laenge = 256, maxBilder = 3600): Promise<{ status: number; aus: Uint8Array }> {
    if (arg.length) await this.emu.poke(this.postfach + ARG, arg);
    await this.emu.poke(this.postfach + BEFEHL, [befehl]);
    await this.emu.until(this.postfach + BEFEHL, 0, maxBilder);
    const status = (await this.emu.peek(this.postfach + STATUS, 1))[0]!;
    const aus = await this.emu.peek(this.postfach + AUS, laenge);
    return { status, aus };
  }

  /** Befehl mit Auszug als Antwort (SPIEL_START, SPIEL_ZUG). */
  async auszug(befehl: number, arg: number[] = []): Promise<Auszug> {
    const { status, aus: kopf } = await this.befehl(befehl, arg, AUS_ZUEGE);
    const n = kopf[4]! | (kopf[5]! << 8);
    const zugBytes = kopf[6]! | (kopf[7]! << 8);
    const standBytes = kopf[8]! | (kopf[9]! << 8);
    const rest = await this.emu.peek(this.postfach + AUS + AUS_ZUEGE, zugBytes + standBytes);
    const zuege: number[][] = [];
    let i = 0;
    for (let k = 0; k < n; k++) {
      const laenge = rest[i]!;
      zuege.push([...rest.slice(i + 1, i + 1 + laenge)]);
      i += 1 + laenge;
    }
    return { status, ergebnis: kopf[0]!, sieger: kopf[1]!, amZug: kopf[2]!, zuege, stand: [...rest.slice(zugBytes, zugBytes + standBytes)] };
  }

  start(spiel: number, optionen: number[] = []) {
    return this.auszug(SPIEL_START, [spiel, ...optionen, 0, 0, 0, 0].slice(0, 5));
  }

  zug(bytes: number[]) {
    return this.auszug(SPIEL_ZUG, [bytes.length, ...bytes]);
  }

  /** Bot-Zug ohne Ausführen: Zugbytes und Rechenzeit in Bildern. */
  async bot(stufe: number): Promise<{ zug: number[]; bilder: number; status: number }> {
    const { status, aus } = await this.befehl(BOT, [stufe], 32);
    return { status, bilder: aus[0]! | (aus[1]! << 8), zug: [...aus.slice(3, 3 + aus[2]!)] };
  }

  zufall(text: string) {
    return this.befehl(ZUFALL_TEXT, [...Buffer.from(`${text}\0`, 'utf8')], 16);
  }
}
