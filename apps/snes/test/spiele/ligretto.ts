import { gameModule } from '../../../../packages/games/ligretto/src/index';
import { currentPlayers, totals, type Card, type LigrettoMove, type LigrettoState } from '../../../../packages/games/ligretto/src/rules';
import { type SpielAdapter } from './typen';

const SUITS = ['red', 'yellow', 'green', 'blue'];

function toCardIdx(card: Card): number {
  const suit = SUITS.indexOf(card.suit);
  return suit * 10 + (card.value - 1);
}

export const ligretto: SpielAdapter<LigrettoState, LigrettoMove> = {
  nr: 23,
  id: 'ligretto',
  modul: gameModule,
  varianten: [
    {
      name: 'Ligretto 1 Runde, je drei, 2 Plätze',
      snes: [0, 0],
      optionen: { goal: 'r1', flip: 'three' },
      plaetze: 2,
      siege: 2,
    },
    {
      name: 'Ligretto 3 Runden, je drei, 2 Plätze',
      snes: [1, 0],
      optionen: { goal: 'r3', flip: 'three' },
      plaetze: 2,
      siege: 2,
    },
    {
      name: 'Ligretto 1 Runde, einzeln, 2 Plätze',
      snes: [0, 1],
      optionen: { goal: 'r1', flip: 'one' },
      plaetze: 2,
      siege: 2,
    },
    {
      name: 'Ligretto 1 Runde, je drei, 3 Plätze',
      snes: [0, 0],
      optionen: { goal: 'r1', flip: 'three' },
      plaetze: 3,
      siege: 2,
    },
  ],
  zug: (s, m) => {
    const actor = (currentPlayers(s)[0] as number | undefined) ?? 0;
    if (m.type === 'ready') {
      return [actor, 3];
    }
    if (m.type === 'stuck') {
      return [actor, 2];
    }
    if (m.type === 'flip') {
      return [actor, 1];
    }
    if (m.type === 'play') {
      let kind = 0;
      let slot = 0;
      if (m.source.from === 'ligretto') {
        kind = 0;
      } else if (m.source.from === 'talon') {
        kind = 2;
      } else {
        kind = 1;
        slot = m.source.slot;
      }
      const pile = m.pile === null ? 0xff : m.pile;
      return [actor, 0, kind, slot, pile];
    }
    return [0, 0];
  },
  stand: (s) => {
    const bytes: number[] = [];
    const phaseMap: Record<string, number> = { play: 0, roundEnd: 1, gameEnd: 2 };
    bytes.push(phaseMap[s.phase] ?? 0);
    bytes.push(s.round);
    bytes.push(s.nextPileId);

    const sumScores = totals(s.scores);
    for (let seat = 0; seat < s.players.length; seat++) {
      const pl = s.players[seat]!;
      bytes.push(pl.ligretto.length);
      for (const c of pl.ligretto) bytes.push(toCardIdx(c));

      for (let i = 0; i < 5; i++) {
        const c = pl.row[i];
        bytes.push(c ? toCardIdx(c) : 0xff);
      }

      bytes.push(pl.talon.length);
      for (const c of pl.talon) bytes.push(toCardIdx(c));

      bytes.push(pl.hand.length);
      for (const c of pl.hand) bytes.push(toCardIdx(c));

      bytes.push(pl.played);
      bytes.push(pl.stuck ? 1 : 0);
      bytes.push(pl.idleFlips);
      bytes.push(pl.ready ? 1 : 0);

      const score = sumScores[seat] ?? 0;
      bytes.push(score & 0xff);
      bytes.push((score >> 8) & 0xff);
    }

    bytes.push(s.center.length);
    for (const cp of s.center) {
      bytes.push(cp.id);
      bytes.push(SUITS.indexOf(cp.suit));
      bytes.push(cp.cards.length);
    }

    bytes.push(s.cleared.length);

    for (let i = 0; i < 4; i++) {
      const v = s.rng[i] ?? 0;
      bytes.push(v & 0xff);
      bytes.push((v >> 8) & 0xff);
      bytes.push((v >> 16) & 0xff);
      bytes.push((v >> 24) & 0xff);
    }

    return bytes;
  },
  partien: 20,
  botBilder: [5, 10, 20],
  gegenZufall: [6, 2],
};
