/**
 * VR-App (#350, #358): Die Übersetzer des Kartentischs passen zu den echten Spielständen.
 * Je Kartenspiel werden Partien gespielt; in jedem Schritt muss der Tisch jede eigene Handkarte
 * zeigen und jeder erlaubte Zug entweder am Tisch erreichbar sein oder einen Zugtext fürs 2D-Fenster haben.
 */
import { describe, expect, it } from 'vitest';
import type { AnyGameModule } from '../packages/engine/src';
import { describeMoves, resolveOptions, settleSystemMoves } from '../packages/engine/src';
import type { GameMessage } from '../packages/online/src';
import { onlineGames } from '../apps/server/src/games';
import { GAME_CHOICES } from '../apps/xr/src/catalog';
import { CARD_GAMES, cardMoveIndexes, cardsOfMove, readCardView } from '../apps/xr/src/scene/card-views';

function moduleOf(id: string): AnyGameModule {
  const found = onlineGames.find((m) => m.info.id === id);
  if (!found) throw new Error(`Spiel ${id} fehlt`);
  return found;
}

function messageFor(module: AnyGameModule, state: unknown, seat: number, seats: number): GameMessage {
  const view = module.playerView(state, seat);
  const legalMoves = module.legalMoves(state, seat);
  return {
    gameId: module.info.id,
    yourSeat: seat,
    seats: Array.from({ length: seats }, (_, i) => ({ kind: 'human', name: `P${i + 1}`, memberId: null })),
    view,
    legalMoves,
    moveLabels: describeMoves(module, view, legalMoves) ?? undefined,
  } as unknown as GameMessage;
}

describe('VR-Kartentisch', () => {
  it('jedes Online-Spiel hat Zugtexte (für Fenster, Tafel und Bildschirmleser)', () => {
    expect(onlineGames.filter((m) => !m.describeMove).map((m) => m.info.id)).toEqual([]);
  });

  it('kennt alle Online-Spiele in der Lobby', () => {
    expect(GAME_CHOICES.map((g) => g.id).sort()).toEqual(onlineGames.map((m) => m.info.id).sort());
  });

  for (const id of CARD_GAMES) {
    it(`${id}: Tisch zeigt die Hand, jeder Zug ist erreichbar`, () => {
      const module = moduleOf(id);
      const { min, max } = module.info.players;
      for (const seats of [...new Set([min, Math.min(max, 4)])]) {
        const options = resolveOptions(module, {});
        let state = settleSystemMoves(module, module.setup(seats, options, `xr-${id}-${seats}`));
        for (let step = 0; step < 300 && !module.result(state); step++) {
          const current = module.currentPlayers(state).filter((a): a is number => a !== 'system');
          if (current.length === 0) break;
          const seat = current[step % current.length]!;
          const message = messageFor(module, state, seat, seats);
          const view = readCardView(message);
          expect(view, `${id} Schritt ${step}`).not.toBeNull();
          const handIds = view!.hand.map((c) => c.id);
          expect(new Set(handIds).size).toBe(handIds.length);
          const handled = cardMoveIndexes(message.legalMoves);
          message.legalMoves.forEach((move, i) => {
            const where = `${id} Schritt ${step}: ${JSON.stringify(move)}`;
            if (!handled.has(i)) {
              expect(message.moveLabels?.[i], where).toBeTruthy();
              return;
            }
            const cards = cardsOfMove(move);
            for (const card of cards) expect(handIds, where).toContain(card);
            if (cards.length === 0) {
              const index = (move as { index?: number }).index;
              if (index === undefined) expect(view!.drawFrom, where).toBeUndefined();
              else {
                const source = view!.others.find((o) => o.seat === view!.drawFrom);
                expect(source?.count ?? 0, where).toBeGreaterThan(index);
              }
            }
          });
          const moves = message.legalMoves;
          if (moves.length === 0) break;
          state = settleSystemMoves(module, module.applyMove(state, seat, moves[(step * 7 + 3) % moves.length]).state);
        }
      }
    });
  }
});
