/*
 * Prüfungen für Brett & Blatt 16 (SNES-ROM) im Prüf-Emulator – nur auf Abruf, weil sie die
 * Werkzeugkette brauchen (werkzeuge/werkzeugkette.sh):
 *
 *   SNES_EMU=… SNES_KERN=… corepack pnpm exec vitest run apps/snes
 *
 * Diese Datei: Zufall, Sonderprüfungen für Tic-Tac-Toe, Bedienung über Controller und der
 * Bildvergleich mit bsnes (SNES_KERN_BSNES). Regeln und Bots aller Spiele prüfen regeln.test.ts
 * und bots.test.ts. Mit SNES_BILDER=<ordner> entstehen Bildschirmfotos.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashSeed, Rng } from '../../../packages/engine/src/random';
import { gameModule as ticTacToe, type TicTacToeState } from '../../../packages/games/tic-tac-toe/src/index';
import { bildAbweichung, kachelText, KNOPF, pngLesen, PruefEmu, symbole } from './emu';
import { AKTIV, Pruefmodus, ROM, SYM, ZUFALL_BIS, ZUFALL_ZAHLEN } from './pruefmodus';

const env = process.env;
const bilder = env.SNES_BILDER;
if (bilder) mkdirSync(bilder, { recursive: true });

const u32 = (b: Uint8Array, i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;

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
const tttStart = () => ticTacToe.setup(2, {}, 'x');

describe.skipIf(!AKTIV)('Brett & Blatt 16: Zufall und Tic-Tac-Toe-Bot', () => {
  let p: Pruefmodus;

  beforeAll(async () => {
    p = await Pruefmodus.starten();
  });
  afterAll(async () => {
    await p?.beenden();
  });

  it('Zufall: Startwert und Zahlenfolge wie in der Web-App', async () => {
    const texte = ['abc/main', 'seed-1/mischen', '/main', 'Brett & Blatt 16/test', 'x'.repeat(60), 'snes-1/würfel', 'Ää Öö Üü ß/×·'];
    for (const t of texte) {
      const { aus } = await p.zufall(t);
      expect([0, 1, 2, 3].map((i) => u32(aus, i * 4)), t).toEqual(hashSeed(t));
      const rng = new Rng(hashSeed(t));
      for (let runde = 0; runde < 3; runde++) {
        const { aus: zahlen } = await p.befehl(ZUFALL_ZAHLEN, [32], 128);
        const erwartet = Array.from({ length: 32 }, () => Math.round(rng.next() * 2 ** 32));
        expect(Array.from({ length: 32 }, (_, i) => u32(zahlen, i * 4)), t).toEqual(erwartet);
      }
    }
  });

  it('Zufall: ganze Zahlen in Grenzen wie Rng.int', async () => {
    for (const grenze of [1, 2, 3, 5, 6, 7, 9, 52, 100, 1000, 54321, 65535]) {
      await p.zufall(`grenze-${grenze}/main`);
      const rng = Rng.fromSeed(`grenze-${grenze}`);
      const { aus } = await p.befehl(ZUFALL_BIS, [64, grenze & 0xff, grenze >> 8], 128);
      const ist = Array.from({ length: 64 }, (_, i) => aus[i * 2]! | (aus[i * 2 + 1]! << 8));
      expect(ist, `Grenze ${grenze}`).toEqual(Array.from({ length: 64 }, () => rng.int(grenze)));
    }
  });

  it('Tic-Tac-Toe-Bot „schwer“ wählt immer einen bestmöglichen Zug', async () => {
    for (let partie = 0; partie < 60; partie++) {
      const wahl = Rng.fromSeed(`bestzug-${partie}`);
      await p.zufall(`bestzug-${partie}/zufall`);
      let s = tttStart();
      await p.start(0);
      while (!ticTacToe.result(s)) {
        const { zug } = await p.bot(2);
        const nach = ticTacToe.applyMove(s, s.turn, { type: 'place', cell: zug[0]! }).state;
        const frei = s.board.filter((c) => c === null).length;
        const wert = nach.winner !== null ? frei : ticTacToe.result(nach) ? 0 : -tttWert(nach);
        // Auf leerem Brett wählt der Bot Mitte oder Ecke – alle Züge halten dort das Remis.
        expect(wert, `Stellung ${s.board.join(',')}`).toBe(tttWert(s));
        const m = wahl.pick(ticTacToe.legalMoves(s, s.turn));
        s = ticTacToe.applyMove(s, s.turn, m).state;
        await p.zug([m.cell]);
      }
    }
  }, 600_000);

  it('Tic-Tac-Toe-Bot „schwer“ verliert nie – gegen jede Zugfolge des Gegners', async () => {
    let partien = 0;
    async function erkunde(zuege: number[], botPlatz: number): Promise<void> {
      let s = tttStart();
      for (const z of zuege) s = ticTacToe.applyMove(s, s.turn, { type: 'place', cell: z }).state;
      const ergebnis = ticTacToe.result(s);
      if (ergebnis) {
        partien++;
        if (ergebnis.kind === 'win') expect(ergebnis.winners[0], `Bot verliert nach ${zuege.join(',')}`).toBe(botPlatz);
        return;
      }
      if (s.turn === botPlatz) {
        await p.start(0);
        for (const z of zuege) await p.zug([z]);
        const { zug } = await p.bot(2);
        await erkunde([...zuege, zug[0]!], botPlatz);
      } else {
        for (const m of ticTacToe.legalMoves(s, s.turn)) await erkunde([...zuege, m.cell], botPlatz);
      }
    }
    await p.zufall('nie-verlieren/main');
    await erkunde([], 0);
    await erkunde([], 1);
    expect(partien).toBeGreaterThan(100);
  }, 600_000);
});

describe.skipIf(!AKTIV)('Brett & Blatt 16: Speicheraufteilung', () => {
  it('C-Variablen in Bank $7E bleiben unter $8000 (darüber liegen feste Bereiche von PVSnesLib)', () => {
    const zeilen = readFileSync(SYM.replace(/\.sym$/, '.symfull'), 'utf8').split('\n');
    const enden = zeilen.filter((z) => z.endsWith(' SECTIONEND_.bss')).map((z) => parseInt(z.slice(0, 8), 16)).filter((a) => a >> 16 === 0x7e);
    expect(enden.length).toBeGreaterThan(0);
    expect(Math.max(...enden).toString(16)).toMatch(/^7e[0-7]/);
  });
});

describe.skipIf(!AKTIV)('Brett & Blatt 16: Bedienung über Controller', () => {
  let emu: PruefEmu;
  const s = AKTIV ? symbole(SYM) : new Map<string, number>();
  const adresse = (name: string) => s.get(name)!;
  const zeile = async (y: number) => kachelText(await emu.peek(adresse('karte1'), 2048), y);
  const bildschirm = async (name: string) => {
    if (bilder) await emu.shot(`${bilder}/${name}.png`);
  };

  beforeAll(async () => {
    emu = await PruefEmu.starten(env.SNES_EMU!, env.SNES_KERN!, ROM);
  });
  afterAll(async () => {
    await emu?.beenden();
  });

  it('Titel mit Umlauten, Version 1.0, Startklang, Hauptmenü', async () => {
    await emu.run(150);
    // „Start drücken“ blinkt: bis zu 64 Bilder auf die sichtbare Phase warten.
    let blinkt = '';
    for (let i = 0; i < 16 && !blinkt.includes('Start drücken'); i++) {
      blinkt = await zeile(18);
      if (!blinkt.includes('Start drücken')) await emu.run(4);
    }
    await bildschirm('1-titel');
    expect(blinkt).toContain('Start drücken');
    expect(await zeile(12)).toContain('Freie Spielesammlung');
    expect(await zeile(26)).toContain('Version 1.0');
    await emu.audio();
    await emu.druecke(0, KNOPF.START, 20);
    expect(await emu.audio()).toBeGreaterThan(1000);
    await emu.run(20);
    expect(await zeile(1)).toContain('Brett & Blatt 16');
    expect(await zeile(4)).toContain('Alle (31)');
    expect(await zeile(5)).toContain('Tic-Tac-Toe');
    expect(await zeile(23)).toContain('Seite 1/2');
    await bildschirm('2-hauptmenue');
  });

  it('Hauptmenü: L/R blättert seitenweise, Links/Rechts wechselt Kategorien', async () => {
    // Seitenweise blättern in „Alle (31)“
    await emu.druecke(0, KNOPF.R, 10);
    expect(await zeile(23)).toContain('Seite 2/2');
    expect(await zeile(5)).toContain('Solitaire');
    await emu.druecke(0, KNOPF.L, 10);
    expect(await zeile(23)).toContain('Seite 1/2');
    expect(await zeile(5)).toContain('Tic-Tac-Toe');

    // Kategorien-Filter durchschalten
    await emu.druecke(0, KNOPF.RECHTS, 10);
    expect(await zeile(4)).toContain('Brettspiele (7)');
    expect(await zeile(5)).toContain('Tic-Tac-Toe');
    await emu.druecke(0, KNOPF.RECHTS, 10);
    expect(await zeile(4)).toContain('Würfel & Familie (8)');
    expect(await zeile(5)).toContain('Teiler-Duell');
    await emu.druecke(0, KNOPF.RECHTS, 10);
    expect(await zeile(4)).toContain('Kartenspiele (10)');
    expect(await zeile(5)).toContain('Elf zuerst!');
    await emu.druecke(0, KNOPF.RECHTS, 10);
    expect(await zeile(4)).toContain('Stich- & Denksport (6)');
    expect(await zeile(5)).toContain('Skat');
    // Zurück auf „Alle (31)“
    await emu.druecke(0, KNOPF.RECHTS, 10);
    expect(await zeile(4)).toContain('Alle (31)');
    expect(await zeile(5)).toContain('Tic-Tac-Toe');
    // Menüklick darf nach dem Ausklingen nicht in einer Schleife hängen bleiben.
    await emu.run(40);
    await emu.audio();
    await emu.run(90);
    expect(await emu.audio()).toBe(0);
  });

  it('Partie zu zweit mit zwei Controllern: Kreuz gewinnt, Statistik im 32-Spiele-SRAM', async () => {
    await emu.druecke(0, KNOPF.A, 10); // Tic-Tac-Toe
    expect(await zeile(1)).toContain('Tic-Tac-Toe');
    // Von „Los geht's!“ hoch bis „Kreis“, dann fünfmal links: Bot mittel → Bot leicht → Controller 5 … 2.
    for (let i = 0; i < 4; i++) await emu.druecke(0, KNOPF.HOCH);
    for (let i = 0; i < 5; i++) await emu.druecke(0, KNOPF.LINKS);
    await emu.run(10);
    expect(await zeile(6)).toContain('Controller 2');
    await bildschirm('3-vorbereitung');
    await emu.druecke(0, KNOPF.START, 20);

    const brett = async () => [...(await emu.peek(adresse('spielstand'), 9))];
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

    // SRAM (712 Bytes): Kennung „BB16“, Version 2, 32 × 22 Bytes Statistik, Prüfsumme.
    const sram = await emu.speek(0, 712);
    expect(String.fromCharCode(...sram.slice(0, 4))).toBe('BB16');
    expect(sram[4]).toBe(2);
    expect(sram[6]! | (sram[7]! << 8)).toBe(1);
    expect(sram[8]! | (sram[9]! << 8)).toBe(1);
    // Alle übrigen 31 Plätze (Index 1..31, inkl. Spiele 16..30) sind nach Kaltstart sauber 0.
    expect(sram.slice(6 + 22, 6 + 32 * 22).every((b) => b === 0)).toBe(true);
  });

  it('Statistik bleibt nach einem Neustart erhalten und deckt alle 31 Spiele ab', async () => {
    await emu.reset();
    await emu.run(150);
    await emu.druecke(0, KNOPF.START, 20);
    await emu.run(20);
    // Hauptmenü: zweimal hoch landet auf „Statistik“ (vorletzter Eintrag).
    await emu.druecke(0, KNOPF.HOCH, 10);
    await emu.druecke(0, KNOPF.HOCH, 10);
    await emu.druecke(0, KNOPF.A, 20);
    expect(await zeile(1)).toContain('Statistik');
    expect(await zeile(5)).toContain('Tic-Tac-Toe');
    expect(await zeile(8)).toMatch(/Partien gesamt\s+1$/);
    expect(await zeile(9)).toMatch(/nur Menschen\s+1$/);
    await bildschirm('6-statistik');
    // Einmal links springt zum 31. Spiel (Go, Index 30) – im erweiterten 32-Spiele-SRAM.
    await emu.druecke(0, KNOPF.LINKS, 10);
    expect(await zeile(5)).toContain('Go');
    expect(await zeile(8)).toMatch(/Partien gesamt\s+0$/);
  });

  it('Musikbox zeigt alle 4 Stimmungen und 20 Soundtracks, spielt Musik und schaltet stumm', async () => {
    // Aus der Statistik zurück ins Hauptmenü (Cursor steht auf „Statistik“), einmal hoch zu „Musikbox“.
    await emu.druecke(0, KNOPF.B, 10);
    await emu.druecke(0, KNOPF.HOCH, 10);
    await emu.druecke(0, KNOPF.A, 15);
    expect(await zeile(1)).toContain('Musikbox');
    expect(await zeile(5)).toContain('Denkraum');
    expect(await zeile(8)).toContain('Herbstbibliothek');
    await emu.druecke(0, KNOPF.RECHTS, 10);
    expect(await zeile(5)).toContain('Kartentisch');
    expect(await zeile(8)).toContain('Cafe am Markt');
    await emu.druecke(0, KNOPF.RECHTS, 10);
    expect(await zeile(5)).toContain('Patience');
    expect(await zeile(8)).toContain('Regennachmittag');
    await emu.druecke(0, KNOPF.RECHTS, 10);
    expect(await zeile(5)).toContain('Spielabend');
    expect(await zeile(8)).toContain('Würfelglück');
    // Stück abspielen und echten SPC700-Klang prüfen.
    await emu.audio();
    await emu.druecke(0, KNOPF.A, 20);
    await emu.run(60);
    expect(await emu.audio()).toBeGreaterThan(1000);
    expect(await zeile(19)).toContain('An');
    expect(await zeile(21)).toContain('Würfelglück');
    await bildschirm('7-musikbox');
    // Stummschalten mit X.
    await emu.druecke(0, KNOPF.X, 15);
    expect(await zeile(19)).toContain('Aus');
    expect(await zeile(21)).toContain('Stille');
    await emu.druecke(0, KNOPF.B, 10);
  });

  it('Battle Chess: großes 24×24-Brett, Zug- und Schlagkampf-Animation, saubere Rückkehr ins Menü', async () => {
    // Im Hauptmenü auf „Stich- & Denksport“ (4× Rechts) → Schach (4× Runter).
    for (let i = 0; i < 4; i++) await emu.druecke(0, KNOPF.RECHTS, 10);
    for (let i = 0; i < 4; i++) await emu.druecke(0, KNOPF.RUNTER, 10);
    await emu.druecke(0, KNOPF.A, 15);
    expect(await zeile(1)).toContain('Schach');
    // Schwarz auf Controller 2 umstellen, damit wir einen direkten Schlagkampf spielen können.
    for (let i = 0; i < 4; i++) await emu.druecke(0, KNOPF.HOCH);
    for (let i = 0; i < 5; i++) await emu.druecke(0, KNOPF.LINKS);
    await emu.run(10);
    await emu.druecke(0, KNOPF.START, 30);
    expect(await zeile(0)).toContain('Schach');
    expect(await zeile(0)).toContain('Weiß');
    await bildschirm('8-battle-chess-start');

    // Weiß: e2-e4
    await emu.druecke(0, KNOPF.A, 15);
    await emu.druecke(0, KNOPF.HOCH, 10);
    await emu.druecke(0, KNOPF.HOCH, 10);
    await emu.druecke(0, KNOPF.A, 80);
    expect(await zeile(0)).toContain('Schwarz');

    // Schwarz (Controller 2): d7-d5
    await emu.druecke(1, KNOPF.LINKS, 10);
    for (let i = 0; i < 3; i++) await emu.druecke(1, KNOPF.HOCH, 10);
    await emu.druecke(1, KNOPF.A, 15);
    await emu.druecke(1, KNOPF.RUNTER, 10);
    await emu.druecke(1, KNOPF.RUNTER, 10);
    await emu.druecke(1, KNOPF.A, 80);
    expect(await zeile(0)).toContain('Weiß');

    // Weiß (Controller 1): e4×d5 mit Kampf-Animation auf dem Brett
    await emu.druecke(0, KNOPF.RECHTS, 10);
    await emu.druecke(0, KNOPF.RUNTER, 10);
    await emu.druecke(0, KNOPF.A, 15);
    await emu.druecke(0, KNOPF.HOCH, 10);
    await emu.druecke(0, KNOPF.LINKS, 10);
    await emu.druecke(0, KNOPF.A, 2);
    await emu.run(28);
    await bildschirm('9-battle-chess-kampf');
    await emu.run(120);
    expect(await zeile(0)).toContain('Schwarz');

    // Über Pause zurück ins Hauptmenü → Standard-Kacheln & -Paletten wiederhergestellt.
    await emu.druecke(0, KNOPF.START, 20);
    await emu.druecke(0, KNOPF.RUNTER, 10);
    await emu.druecke(0, KNOPF.A, 35);
    expect(await zeile(1)).toContain('Brett & Blatt 16');
  });
});

describe.skipIf(!AKTIV || !env.SNES_KERN_BSNES)('Brett & Blatt 16 in bsnes: dieselben Bilder wie in Snes9x', () => {
  it('Hauptmenü, Vorbereitung, Partie und Anleitung stimmen überein, Klang ist hörbar', async () => {
    const ablage = mkdtempSync(`${tmpdir()}/bb16-`);
    const kerne = { snes9x: env.SNES_KERN!, bsnes: env.SNES_KERN_BSNES! };
    const stationen = ['hauptmenue', 'vorbereitung', 'partie', 'anleitung'];
    const laut: Record<string, number> = {};
    for (const [name, kern] of Object.entries(kerne)) {
      const emu = await PruefEmu.starten(env.SNES_EMU!, kern, ROM);
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
