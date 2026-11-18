/*
 * Bots im ROM: Jede Stufe zieht erlaubt und bleibt im Zeitbudget; „schwer“ schlägt einen
 * Zufallsspieler deutlich.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveOptions } from '../../../packages/engine/src/module-helpers';
import { Rng } from '../../../packages/engine/src/random';
import { AKTIV, Pruefmodus } from './pruefmodus';
import { ALLE } from './spiele/alle';

const nur = process.env.SNES_SPIELE?.split(',');
const spiele = ALLE.filter((a) => !nur || nur.includes(a.id));
const schluessel = (z: number[]) => z.join(',');

describe.skipIf(!AKTIV)('Bots im ROM', () => {
  let p: Pruefmodus;
  beforeAll(async () => {
    p = await Pruefmodus.starten();
  });
  afterAll(async () => {
    await p?.beenden();
  });

  for (const a of spiele) {
    for (const v of a.varianten) {
      it(`${a.id} (${v.name}): Bots ziehen erlaubt, schnell genug und „schwer“ schlägt Zufall`, async () => {
        const rechenzeit = [0, 0, 0];
        const [partien, noetig] = a.gegenZufall;
        let siege = 0;
        let remis = 0;
        for (let partie = 0; partie < partien; partie++) {
          const wahl = Rng.fromSeed(`bot-${a.id}-${v.name}-${partie}`);
          await p.zufall(`bot-${a.id}-${partie}/main`);
          const plaetze = v.plaetze ?? 2;
          const botPlatz = partie % plaetze;
          let s = a.modul.setup(plaetze, resolveOptions(a.modul, v.optionen), `bot-${partie}`);
          await p.start(a.nr, v.snes, plaetze, `bot-${partie}`);
          let n = 0;
          while (!a.modul.result(s)) {
            const actor = a.modul.currentPlayers(s)[0];
            const moves = a.modul.legalMoves(s, actor);
            const erlaubt = new Map([...moves, ...(a.extra?.(s) ?? [])].map((m: unknown) => [schluessel(a.zug(s, m)), m]));
            let zug: unknown;
            if (actor === botPlatz) {
              // In den ersten Partien alle Stufen an derselben Stellung prüfen, gezogen wird mit „schwer“.
              for (const stufe of partie < 2 ? [0, 1, 2] : [2]) {
                const b = await p.bot(stufe);
                expect(b.status).toBe(1);
                rechenzeit[stufe] = Math.max(rechenzeit[stufe]!, b.bilder);
                expect(erlaubt.has(schluessel(b.zug)), `Stufe ${stufe}: ${b.zug}`).toBe(true);
                if (stufe === 2) zug = erlaubt.get(schluessel(b.zug));
              }
            } else {
              zug = wahl.pick(moves);
            }
            const bytes = a.zug(s, zug);
            s = a.modul.applyMove(s, actor, zug).state;
            const x = await p.zug(bytes);
            expect(x.status).toBe(1);
            n++;
          }
          const r = a.modul.result(s);
          if (r.kind === 'win' && r.winners.includes(botPlatz)) siege++;
          if (r.kind === 'draw') remis++;
        }
        console.log(`${a.id} (${v.name}): Rechenzeit in Bildern leicht ${rechenzeit[0]}, mittel ${rechenzeit[1]}, schwer ${rechenzeit[2]}; „schwer“ gegen Zufall ${siege} Siege, ${remis} Remis aus ${partien}`);
        rechenzeit.forEach((r, stufe) => expect(r, `Rechenzeit Stufe ${stufe}`).toBeLessThanOrEqual(a.botBilder[stufe]!));
        expect(siege).toBeGreaterThanOrEqual(noetig);
      }, 1_800_000);
    }
  }
});
