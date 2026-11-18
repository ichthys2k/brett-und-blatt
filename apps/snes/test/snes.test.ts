/*
 * Prüfungen für Brett & Blatt 16 (SNES-ROM) im Prüf-Emulator – nur auf Abruf, weil sie die
 * Werkzeugkette brauchen (werkzeuge/werkzeugkette.sh):
 *
 *   SNES_EMU=… SNES_KERN=… corepack pnpm exec vitest run apps/snes
 *
 * Die TypeScript-Module der Web-App sind der Schiedsrichter: Zufall, Regeln und Bot des ROMs
 * müssen genau zu ihnen passen. Mit SNES_KERN_BSNES läuft das ROM zusätzlich in bsnes und muss
 * dort dieselben Bilder zeigen. Mit SNES_BILDER=<ordner> entstehen Bildschirmfotos.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashSeed, Rng } from '../../../packages/engine/src/random';
import { gameModule as ticTacToe, type TicTacToeState } from '../../../packages/games/tic-tac-toe/src/index';
import { bildAbweichung, kachelText, KNOPF, pngLesen, PruefEmu, symbole } from './emu';

const env = process.env;
const ordner = fileURLToPath(new URL('..', import.meta.url));
const rom = env.SNES_ROM ?? `${ordner}brett-und-blatt-16.sfc`;
const sym = rom.replace(/\.sfc$/, '.sym');
const aktiv = Boolean(env.SNES_EMU && env.SNES_KERN && existsSync(rom) && existsSync(sym));
const bilder = env.SNES_BILDER;
if (bilder) mkdirSync(bilder, { recursive: true });

// Aufbau des Postfachs (src/pruef.c).
const KENNUNG = 0;
const BEFEHL = 4;
const STATUS = 5;
const ARG = 6;
const AUS = 70;
const AUS_STAND = 160;

const ZUFALL_TEXT = 0x01;
const ZUFALL_ZAHLEN = 0x02;
const ZUFALL_BIS = 0x03;
const SPIEL_START = 0x10;
const SPIEL_ZUG = 0x11;
const BOT = 0x12;
const KEIN = 0xff;

interface Auszug {
  ergebnis: number;
  sieger: number;
  amZug: number;
  zuege: number[];
  stand: Uint8Array;
}

class Pruefmodus {
  constructor(
    private emu: PruefEmu,
    private postfach: number,
  ) {}

  async eintreten() {
    await this.emu.run(60);
    await this.emu.poke(this.postfach + KENNUNG, [0x50, 0x52, 0x55, 0x46]); // „PRUF“
    await this.emu.until(this.postfach + STATUS, 0xaa, 120);
  }

  /** Führt einen Befehl aus; gibt Status (1 erledigt, 2 abgelehnt) und Antwort zurück. */
  async befehl(befehl: number, arg: number[] = [], maxBilder = 600): Promise<{ status: number; aus: Uint8Array }> {
    if (arg.length) await this.emu.poke(this.postfach + ARG, arg);
    await this.emu.poke(this.postfach + BEFEHL, [befehl]);
    await this.emu.until(this.postfach + BEFEHL, 0, maxBilder);
    const daten = await this.emu.peek(this.postfach + STATUS, 1 + 64 + 256);
    return { status: daten[0]!, aus: daten.slice(1 + 64) };
  }

  async auszug(befehl: number, arg: number[] = []): Promise<Auszug & { status: number }> {
    const { status, aus } = await this.befehl(befehl, arg);
    const n = aus[3]!;
    const zuege = Array.from({ length: n }, (_, i) => aus[4 + i * 2]! | (aus[5 + i * 2]! << 8));
    return { status, ergebnis: aus[0]!, sieger: aus[1]!, amZug: aus[2]!, zuege, stand: aus.slice(AUS_STAND) };
  }
}

const u32 = (b: Uint8Array, i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
const text = (s: string) => [...Buffer.from(`${s}\0`, 'utf8')];

/** Erwarteter Auszug aus dem Stand der Web-App (Form wie ttt_ausgeben in src/tic_tac_toe.c). */
function tttErwartet(s: TicTacToeState) {
  const ergebnis = ticTacToe.result(s);
  return {
    ergebnis: ergebnis ? (ergebnis.kind === 'win' ? 1 : 2) : 0,
    sieger: ergebnis?.kind === 'win' ? ergebnis.winners[0]! : KEIN,
    amZug: ergebnis ? KEIN : s.turn,
    zuege: ticTacToe.legalMoves(s, s.turn).map((m) => m.cell),
    stand: [...s.board.map((c) => (c === null ? KEIN : c)), s.turn, s.winner ?? KEIN, ...(s.winLine ?? [KEIN, KEIN, KEIN])],
  };
}
function tttIst(a: Auszug) {
  return { ergebnis: a.ergebnis, sieger: a.sieger, amZug: a.amZug, zuege: a.zuege, stand: [...a.stand.slice(0, 14)] };
}

/** Exakter Wert einer Stellung für den Platz am Zug (wie der Bot „schwer“: schnelle Siege zählen mehr). */
const werte = new Map<string, number>();
function tttWert(s: TicTacToeState): number {
  const schluessel = s.board.map((c) => (c === null ? '.' : c)).join('') + s.turn;
  const bekannt = werte.get(schluessel);
  if (bekannt !== undefined) return bekannt;
  const frei = s.board.filter((c) => c === null).length;
  let bester = -100;
  if (frei === 0) bester = 0;
  for (const zug of ticTacToe.legalMoves(s, s.turn)) {
    const nach = ticTacToe.applyMove(s, s.turn, zug).state;
    const w = nach.winner !== null ? frei : ticTacToe.result(nach) ? 0 : -tttWert(nach);
    bester = Math.max(bester, w);
  }
  werte.set(schluessel, bester);
  return bester;
}

describe.skipIf(!aktiv)('Brett & Blatt 16 (SNES-ROM)', () => {
  let emu: PruefEmu;
  let pruef: Pruefmodus;
  const s = aktiv ? symbole(sym) : new Map<string, number>();
  const adresse = (name: string) => {
    const a = s.get(name);
    if (a === undefined) throw new Error(`Symbol fehlt: ${name}`);
    return a;
  };

  beforeAll(async () => {
    emu = await PruefEmu.starten(env.SNES_EMU!, env.SNES_KERN!, rom);
    pruef = new Pruefmodus(emu, adresse('pruef_postfach'));
    await pruef.eintreten();
  });
  afterAll(async () => {
    await emu?.beenden();
  });

  it('Zufall: Startwert und Zahlenfolge wie in der Web-App', async () => {
    const texte = ['abc/main', 'seed-1/mischen', '/main', 'Brett & Blatt 16/test', 'x'.repeat(60)];
    for (const t of texte) {
      const { aus } = await pruef.befehl(ZUFALL_TEXT, text(t));
      expect([0, 1, 2, 3].map((i) => u32(aus, i * 4)), t).toEqual(hashSeed(t));
      const rng = new Rng(hashSeed(t));
      for (let runde = 0; runde < 3; runde++) {
        const { aus: zahlen } = await pruef.befehl(ZUFALL_ZAHLEN, [32]);
        const erwartet = Array.from({ length: 32 }, () => Math.round(rng.next() * 2 ** 32));
        expect(Array.from({ length: 32 }, (_, i) => u32(zahlen, i * 4)), t).toEqual(erwartet);
      }
    }
  });

  it('Zufall: ganze Zahlen in Grenzen wie Rng.int', async () => {
    for (const grenze of [1, 2, 3, 5, 6, 7, 9, 52, 100, 1000, 54321, 65535]) {
      const t = `grenze-${grenze}/main`;
      await pruef.befehl(ZUFALL_TEXT, text(t));
      const rng = Rng.fromSeed(`grenze-${grenze}`);
      const { aus } = await pruef.befehl(ZUFALL_BIS, [64, grenze & 0xff, grenze >> 8]);
      const ist = Array.from({ length: 64 }, (_, i) => aus[i * 2]! | (aus[i * 2 + 1]! << 8));
      expect(ist, `Grenze ${grenze}`).toEqual(Array.from({ length: 64 }, () => rng.int(grenze)));
    }
  });

  it('Tic-Tac-Toe: 300 Zufallspartien Zug für Zug wie in der Web-App, unerlaubte Züge abgelehnt', async () => {
    let zuege = 0;
    for (let partie = 0; partie < 300; partie++) {
      const wahl = Rng.fromSeed(`ttt-${partie}`);
      let stand = ticTacToe.setup({ players: 2, options: {}, rng: wahl } as never);
      let ist = await pruef.auszug(SPIEL_START, [0]);
      expect(tttIst(ist)).toEqual(tttErwartet(stand));
      while (!ticTacToe.result(stand)) {
        // Probe: ein besetztes Feld oder ein Feld außerhalb des Bretts muss abgelehnt werden.
        if (wahl.chance(0.3)) {
          const besetzt = stand.board.findIndex((c) => c !== null);
          const falsch = besetzt >= 0 && wahl.chance(0.5) ? besetzt : 9 + wahl.int(300);
          const abgelehnt = await pruef.auszug(SPIEL_ZUG, [falsch & 0xff, falsch >> 8]);
          expect(abgelehnt.status, `Zug ${falsch}`).toBe(2);
          expect(tttIst(abgelehnt)).toEqual(tttErwartet(stand));
        }
        const zug = wahl.pick(ticTacToe.legalMoves(stand, stand.turn));
        stand = ticTacToe.applyMove(stand, stand.turn, zug).state;
        ist = await pruef.auszug(SPIEL_ZUG, [zug.cell, 0]);
        expect(ist.status).toBe(1);
        expect(tttIst(ist), `Partie ${partie}, Zug ${zug.cell}`).toEqual(tttErwartet(stand));
        zuege++;
      }
      // Nach Spielende ist nichts mehr erlaubt.
      expect((await pruef.auszug(SPIEL_ZUG, [0, 0])).status).toBe(2);
    }
    expect(zuege).toBeGreaterThan(1500);
  });

  it('Tic-Tac-Toe-Bot: jede Stufe zieht erlaubt, „schwer“ immer bestmöglich und schnell genug', async () => {
    const rechenzeit = [0, 0, 0];
    for (let partie = 0; partie < 120; partie++) {
      const wahl = Rng.fromSeed(`bot-${partie}`);
      await pruef.befehl(ZUFALL_TEXT, text(`bot-${partie}/zufall`));
      let stand = ticTacToe.setup({ players: 2, options: {}, rng: wahl } as never);
      await pruef.auszug(SPIEL_START, [0]);
      while (!ticTacToe.result(stand)) {
        const erlaubt = ticTacToe.legalMoves(stand, stand.turn).map((m) => m.cell);
        for (const stufe of [0, 1, 2]) {
          const { status, aus } = await pruef.befehl(BOT, [stufe]);
          expect(status).toBe(1);
          const zug = aus[0]! | (aus[1]! << 8);
          rechenzeit[stufe] = Math.max(rechenzeit[stufe]!, aus[2]! | (aus[3]! << 8));
          expect(erlaubt, `Stufe ${stufe}`).toContain(zug);
          if (stufe === 2) {
            const nach = ticTacToe.applyMove(stand, stand.turn, { type: 'place', cell: zug }).state;
            const frei = stand.board.filter((c) => c === null).length;
            const wert = nach.winner !== null ? frei : ticTacToe.result(nach) ? 0 : -tttWert(nach);
            // Auf leerem Brett wählt der Bot Mitte oder Ecke – alle Züge halten dort das Remis.
            expect(wert, `Stellung ${stand.board.join(',')}`).toBe(tttWert(stand));
          }
        }
        const zug = wahl.pick(ticTacToe.legalMoves(stand, stand.turn));
        stand = ticTacToe.applyMove(stand, stand.turn, zug).state;
        await pruef.auszug(SPIEL_ZUG, [zug.cell, 0]);
      }
    }
    console.log(`Rechenzeit der Bots (Bilder, höchstens): leicht ${rechenzeit[0]}, mittel ${rechenzeit[1]}, schwer ${rechenzeit[2]}`);
    // Länger als eine Sekunde (60 Bilder) darf der Bot nicht rechnen.
    expect(rechenzeit[2]).toBeLessThan(60);
  });

  it('Tic-Tac-Toe-Bot „schwer“ verliert nie – gegen jede Zugfolge des Gegners', async () => {
    let partien = 0;
    async function nachspielen(zuege: number[]) {
      await pruef.auszug(SPIEL_START, [0]);
      let a: Auszug | undefined;
      for (const z of zuege) a = await pruef.auszug(SPIEL_ZUG, [z, 0]);
      return a;
    }
    async function erkunde(zuege: number[], botPlatz: number): Promise<void> {
      let stand = ticTacToe.setup({ players: 2, options: {}, rng: new Rng(hashSeed('x')) } as never);
      for (const z of zuege) stand = ticTacToe.applyMove(stand, stand.turn, { type: 'place', cell: z }).state;
      const ergebnis = ticTacToe.result(stand);
      if (ergebnis) {
        partien++;
        if (ergebnis.kind === 'win') expect(ergebnis.winners[0], `Bot verliert nach ${zuege.join(',')}`).toBe(botPlatz);
        return;
      }
      if (stand.turn === botPlatz) {
        await nachspielen(zuege);
        const { aus } = await pruef.befehl(BOT, [2]);
        await erkunde([...zuege, aus[0]!], botPlatz);
      } else {
        for (const zug of ticTacToe.legalMoves(stand, stand.turn)) await erkunde([...zuege, zug.cell], botPlatz);
      }
    }
    await pruef.befehl(ZUFALL_TEXT, text('nie-verlieren/main'));
    await erkunde([], 0);
    await erkunde([], 1);
    expect(partien).toBeGreaterThan(100);
  }, 600_000);
});

describe.skipIf(!aktiv)('Brett & Blatt 16: Bedienung über Controller', () => {
  let emu: PruefEmu;
  const s = aktiv ? symbole(sym) : new Map<string, number>();
  const adresse = (name: string) => s.get(name)!;
  const zeile = async (y: number) => kachelText(await emu.peek(adresse('karte1'), 2048), y);
  const bildschirm = async (name: string) => {
    if (bilder) await emu.shot(`${bilder}/${name}.png`);
  };

  beforeAll(async () => {
    emu = await PruefEmu.starten(env.SNES_EMU!, env.SNES_KERN!, rom);
  });
  afterAll(async () => {
    await emu?.beenden();
  });

  it('Titel mit Umlauten, Startklang, Hauptmenü', async () => {
    await emu.run(150);
    await bildschirm('1-titel');
    expect(await zeile(18)).toContain('Start drücken');
    expect(await zeile(12)).toContain('Freie Spielesammlung');
    await emu.audio();
    await emu.druecke(0, KNOPF.START, 20);
    expect(await emu.audio()).toBeGreaterThan(1000);
    await emu.run(20);
    expect(await zeile(1)).toContain('Brett & Blatt 16');
    expect(await zeile(8)).toContain('Tic-Tac-Toe');
    expect(await zeile(12)).toContain('Über Brett & Blatt 16');
    await bildschirm('2-hauptmenue');
  });

  it('Partie zu zweit mit zwei Controllern: Kreuz gewinnt, Statistik im SRAM', async () => {
    await emu.druecke(0, KNOPF.A, 10); // Tic-Tac-Toe
    expect(await zeile(1)).toContain('Tic-Tac-Toe');
    // Von „Los geht's!“ vier Zeilen hoch zu „Kreis“, dann zweimal links: Bot mittel → Bot leicht → Controller 2.
    for (let i = 0; i < 4; i++) await emu.druecke(0, KNOPF.HOCH);
    await emu.druecke(0, KNOPF.LINKS);
    await emu.druecke(0, KNOPF.LINKS, 10);
    expect(await zeile(9)).toContain('Controller 2');
    await bildschirm('3-vorbereitung');
    await emu.druecke(0, KNOPF.START, 20);

    const brett = async () => [...(await emu.peek(adresse('partie_stand'), 9))];
    // Cursor beginnt in der Mitte. Kreuz: Mitte; Kreis: links; Kreuz: oben links; Kreis: oben Mitte; Kreuz: unten rechts.
    expect(await zeile(3)).toContain('Kreuz ist dran (Controller 1)');
    await emu.druecke(0, KNOPF.A, 10);
    expect(await zeile(3)).toContain('Kreis ist dran (Controller 2)');
    await emu.druecke(1, KNOPF.LINKS);
    await emu.druecke(1, KNOPF.A, 10);
    await emu.druecke(0, KNOPF.HOCH);
    await emu.druecke(0, KNOPF.A, 10);
    await emu.druecke(1, KNOPF.RECHTS);
    await bildschirm('4-partie');
    await emu.druecke(1, KNOPF.A, 10);
    expect(await brett()).toEqual([1, 2, 0, 2, 1, 0, 0, 0, 0]);
    await emu.druecke(0, KNOPF.RUNTER);
    await emu.druecke(0, KNOPF.RUNTER);
    await emu.druecke(0, KNOPF.RECHTS);
    await emu.druecke(0, KNOPF.A, 30);
    expect(await brett()).toEqual([1, 2, 0, 2, 1, 0, 0, 0, 1]);
    expect(await zeile(3)).toContain('Kreuz gewinnt!');
    await bildschirm('5-sieg');

    // SRAM: Kennung „BB16“, Version 1, dann Partien und Partien zu zweit von Tic-Tac-Toe.
    const sram = await emu.speek(0, 10);
    expect(String.fromCharCode(...sram.slice(0, 4))).toBe('BB16');
    expect(sram[6]! | (sram[7]! << 8)).toBe(1);
    expect(sram[8]! | (sram[9]! << 8)).toBe(1);
  });

  it('Statistik bleibt nach einem Neustart erhalten', async () => {
    await emu.reset();
    await emu.run(150);
    await emu.druecke(0, KNOPF.START, 20);
    await emu.druecke(0, KNOPF.RUNTER);
    await emu.druecke(0, KNOPF.A, 20);
    expect(await zeile(1)).toContain('Statistik');
    expect(await zeile(7)).toMatch(/Partien gesamt\s+1$/);
    expect(await zeile(8)).toMatch(/davon zu zweit\s+1$/);
    await bildschirm('6-statistik');
  });
});

describe.skipIf(!aktiv || !env.SNES_KERN_BSNES)('Brett & Blatt 16 in bsnes: dieselben Bilder wie in Snes9x', () => {
  it('Titel, Hauptmenü, Vorbereitung und Partie stimmen überein, Klang ist hörbar', async () => {
    const ablage = mkdtempSync(`${tmpdir()}/bb16-`);
    const kerne = { snes9x: env.SNES_KERN!, bsnes: env.SNES_KERN_BSNES! };
    const stationen = ['hauptmenue', 'vorbereitung', 'partie', 'anleitung'];
    const laut: Record<string, number> = {};
    for (const [name, kern] of Object.entries(kerne)) {
      const emu = await PruefEmu.starten(env.SNES_EMU!, kern, rom);
      await emu.run(150);
      await emu.audio();
      await emu.druecke(0, KNOPF.START, 40);
      laut[name] = await emu.audio();
      await emu.shot(`${ablage}/${name}-hauptmenue.png`);
      await emu.druecke(0, KNOPF.A, 20);
      await emu.shot(`${ablage}/${name}-vorbereitung.png`);
      await emu.druecke(0, KNOPF.START, 30);
      await emu.shot(`${ablage}/${name}-partie.png`);
      // Pause, zurück ins Menü, über die Vorbereitung zur Anleitung.
      await emu.druecke(0, KNOPF.START, 10);
      await emu.druecke(0, KNOPF.RUNTER);
      await emu.druecke(0, KNOPF.A, 20);
      await emu.druecke(0, KNOPF.A, 20);
      await emu.druecke(0, KNOPF.HOCH, 20);
      await emu.druecke(0, KNOPF.A, 20);
      await emu.shot(`${ablage}/${name}-anleitung.png`);
      if (bilder) for (const st of stationen) copyFileSync(`${ablage}/${name}-${st}.png`, `${bilder}/${name}-${st}.png`);
      await emu.beenden();
    }
    for (const station of stationen) {
      const a = pngLesen(`${ablage}/snes9x-${station}.png`);
      const b = pngLesen(`${ablage}/bsnes-${station}.png`);
      expect(bildAbweichung(a, b), station).toBeLessThan(0.005);
    }
    expect(laut.snes9x).toBeGreaterThan(1000);
    expect(laut.bsnes).toBeGreaterThan(1000);
  });
});
