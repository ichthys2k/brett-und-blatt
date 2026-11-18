/*
 * Regelvergleich: Jedes Spiel im ROM spielt Zufallspartien Zug für Zug gegen sein TypeScript-Modul
 * (Adapter in test/spiele/). Nach jedem Zug müssen Ergebnis, Platz am Zug, die erlaubten Züge und
 * der Spielstand übereinstimmen; verfälschte Züge muss das ROM ablehnen.
 *
 *   SNES_EMU=… SNES_KERN=… corepack pnpm exec vitest run apps/snes/test/regeln.test.ts
 *   SNES_SPIELE=reversi,mill …   nur diese Spiele
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveOptions } from '../../../packages/engine/src/module-helpers';
import { Rng } from '../../../packages/engine/src/random';
import { AKTIV, KEIN, Pruefmodus, type Auszug } from './pruefmodus';
import { ALLE } from './spiele/alle';
import type { SpielAdapter } from './spiele/typen';

const nur = process.env.SNES_SPIELE?.split(',');
const spiele = ALLE.filter((a) => !nur || nur.includes(a.id));
const schluessel = (z: number[]) => z.join(',');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function erwartet(a: SpielAdapter<any, any>, s: any) {
  const ergebnis = a.modul.result(s);
  const amZug: number | undefined = a.modul.currentPlayers(s)[0];
  return {
    ergebnis: ergebnis ? (ergebnis.kind === 'win' ? 1 : ergebnis.kind === 'draw' ? 2 : 3) : 0,
    sieger: ergebnis?.kind === 'win' ? ergebnis.winners.reduce((m: number, w: number) => m | (1 << w), 0) : 0,
    amZug: amZug ?? KEIN,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zuege: amZug === undefined ? [] : a.modul.legalMoves(s, amZug).map((m: any) => schluessel(a.zug(s, m))).sort(),
    stand: a.stand(s),
  };
}
function ist(x: Auszug) {
  return { ergebnis: x.ergebnis, sieger: x.sieger, amZug: x.amZug, zuege: x.zuege.map(schluessel).sort(), stand: x.stand };
}

describe.skipIf(!AKTIV)('Regeln wie in der Web-App', () => {
  let p: Pruefmodus;
  beforeAll(async () => {
    p = await Pruefmodus.starten();
  });
  afterAll(async () => {
    await p?.beenden();
  });

  for (const a of spiele) {
    for (const v of a.varianten) {
      it(`${a.id} (${v.name}): ${a.partien} Zufallspartien`, async () => {
        let zuege = 0;
        let laengste = 0;
        for (let partie = 0; partie < a.partien; partie++) {
          const wahl = Rng.fromSeed(`${a.id}-${v.name}-${partie}`);
          const plaetze = v.plaetze ?? 2;
          let s = a.modul.setup(plaetze, resolveOptions(a.modul, v.optionen), `snes-${partie}`);
          let x = await p.start(a.nr, v.snes, plaetze, `snes-${partie}`);
          expect(x.status, 'Start').toBe(1);
          expect(ist(x), `Partie ${partie}, Start`).toEqual(erwartet(a, s));
          let n = 0;
          while (!a.modul.result(s)) {
            const actor = a.modul.currentPlayers(s)[0];
            const moves = a.modul.legalMoves(s, actor);
            // Probe: ein verfälschter Zug (ein Byte verändert) muss abgelehnt werden, wenn er nicht erlaubt ist.
            if (wahl.chance(0.2)) {
              const echt = a.zug(s, wahl.pick(moves));
              const falsch = [...echt];
              const i = wahl.int(falsch.length);
              falsch[i] = (falsch[i]! + 1 + wahl.int(254)) & 0xff;
              const erlaubt = new Set(x.zuege.map(schluessel));
              if (!erlaubt.has(schluessel(falsch))) {
                const abgelehnt = await p.zug(falsch);
                expect(abgelehnt.status, `verfälschter Zug ${falsch}`).toBe(2);
              }
            }
            const zug = wahl.pick(moves);
            const bytes = a.zug(s, zug);
            s = a.modul.applyMove(s, actor, zug).state;
            x = await p.zug(bytes);
            expect(x.status, `Partie ${partie}, Zug ${n}: ${bytes}`).toBe(1);
            expect(ist(x), `Partie ${partie}, nach Zug ${n}: ${bytes}`).toEqual(erwartet(a, s));
            n++;
          }
          zuege += n;
          laengste = Math.max(laengste, n);
          // Nach Spielende ist nichts mehr erlaubt.
          expect(x.zuege).toEqual([]);
        }
        console.log(`${a.id} (${v.name}): ${a.partien} Partien, ${zuege} Züge, längste ${laengste}`);
      }, 1_800_000);
    }
  }
});
