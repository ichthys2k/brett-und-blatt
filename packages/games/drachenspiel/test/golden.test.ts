import { describe, expect, it } from 'vitest';
import { drachenspiel } from '../src';
import { CARDS_DB } from '../src/cards';
import type { DrachenspielState, Minion } from '../src/types';

// Schreibt das Verhalten jeder Karte fest (Ausspielen mit jedem Ziel, danach Abschied). Eine
// Änderung an der Datei ist eine Regeländerung und muss bewusst geschehen.
const tier = (id: string, attack: number, health: number, extra: Partial<Minion> = {}): Minion =>
  ({
    id, cardId: 'c43', name: 'Zebra', emoji: '🦓', cost: 3, baseAttack: attack, attack, baseHealth: health, maxHealth: health, health,
    quote: null, sound: null, taunt: false, rush: false, bubble: false, poisonous: false, stealth: false,
    canAttack: true, hasAttacked: false, damage: 0, enchantments: [], playOrder: 0, ...extra,
  }) as Minion;

function board(defId: string): { s: DrachenspielState; me: 0 | 1; opp: 0 | 1 } {
  const s = drachenspiel.setup(2, { deckSelection: 'forest', mulligan: 'off' }, 'golden');
  const me = s.activeSeat as 0 | 1;
  const opp = (1 - me) as 0 | 1;
  s.players[me].mana = 10;
  s.players[me].maxMana = 10;
  s.players[me].health = 20;
  s.players[opp].health = 20;
  s.players[opp].armor = 0;
  s.players[me].hand = [{ uid: 'k', defId }];
  s.players[me].board = [tier('m_eigen', 2, 4, { health: 3, damage: 1 })];
  s.players[opp].board = [tier('m_gross', 3, 5), tier('m_klein', 2, 1), tier('m_blase', 1, 2, { bubble: true }), tier('m_weg', 1, 1, { stealth: true })];
  return { s, me, opp };
}

const summary = (s: DrachenspielState) =>
  s.players.map((p) => ({
    health: p.health,
    mana: p.mana,
    deck: p.deck.length,
    hand: p.hand.map((c) => c.defId),
    board: p.board.map((m) => `${m.cardId}:${m.attack}/${m.health}/${m.maxHealth}${m.taunt ? ' taunt' : ''}${m.rush ? ' rush' : ''}${m.bubble ? ' bubble' : ''}${m.poisonous ? ' poison' : ''}${m.stealth ? ' stealth' : ''}${m.canAttack ? ' ready' : ''}`),
  }));

describe('Verhalten aller Karten', () => {
  it('bleibt wie festgeschrieben', async () => {
    const out: Record<string, unknown> = {};
    for (const defId of Object.keys(CARDS_DB).sort()) {
      const { s, me, opp } = board(defId);
      const moves = drachenspiel.legalMoves(s, me).filter((m) => m.type === 'playCard');
      for (const move of moves) {
        const key = move.type === 'playCard' && move.target ? `${defId}>${move.target.kind === 'hero' ? 'hero' : move.target.id}` : defId;
        const played = drachenspiel.applyMove(s, me, move).state;
        const entry: Record<string, unknown> = { played: summary(played) };
        // Abschied: Das frisch gelegte Tier wird vom Gegner erschlagen.
        const fresh = played.players[me].board.find((m) => m.cardId === defId);
        if (fresh) {
          const next = drachenspiel.applyMove(played, me, { type: 'endTurn' }).state;
          const victim = next.players[me].board.find((m) => m.id === fresh.id)!;
          victim.stealth = false;
          victim.bubble = false;
          next.players[opp].board.push(tier('m_hammer', 50, 50, { canAttack: true }));
          entry.gone = summary(drachenspiel.applyMove(next, opp, { type: 'attack', attackerId: 'm_hammer', target: { kind: 'minion', id: fresh.id } }).state);
        }
        out[key] = entry;
      }
    }
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot('./golden/karten.json');
  });
});
