import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { PlayingCard } from '@brett-und-blatt/ui';
import type { LigrettoMove, LigrettoState, Suit } from '../rules';

function suitToCardSuit(suit: Suit): 'hearts' | 'diamonds' | 'clubs' | 'spades' {
  if (suit === 'red') return 'hearts';
  if (suit === 'yellow') return 'diamonds';
  if (suit === 'green') return 'clubs';
  return 'spades';
}

function Board({ view, legalMoves, onMove, viewer }: BoardProps<LigrettoState, LigrettoMove>) {
  const s = view as LigrettoState;
  const moves = (legalMoves || []) as LigrettoMove[];

  if (viewer === 'spectator') {
    return (
      <div className="flex flex-col items-center gap-4 p-4">
        <div className="text-lg font-bold">Ligretto</div>
        <div className="text-sm">Zuschauermodus</div>
      </div>
    );
  }

  const seat = viewer as number;
  const player = s.players[seat];
  const playHandMoves = moves.filter((m) => m.type === 'playFromHand');
  const playPileMoves = moves.filter((m) => m.type === 'playFromPile');
  const flipMoves = moves.filter((m) => m.type === 'flip');
  const ligrettoMoves = moves.filter((m) => m.type === 'callLigretto');

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <div className="text-center">
        <div className="text-xl font-bold">Ligretto</div>
        <div className="text-sm">Runde {s.round}</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <div className="text-sm font-semibold">Mittelfeld</div>
        <div className="flex flex-wrap gap-3 justify-center">
          {s.centerPiles.length === 0 && (
            <div className="text-xs text-gray-500">Warte auf erste 1...</div>
          )}
          {s.centerPiles.map((cp, i) => (
            <div key={i} className="relative">
              {cp.suit ? (
                <PlayingCard card={{ suit: suitToCardSuit(cp.suit), rank: String(cp.top) as any }} />
              ) : (
                <div className="w-[72px] h-[100px] border-2 border-dashed border-gray-400 rounded-lg"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="text-sm font-semibold">Deine Karten</div>
        <div className="flex gap-4 items-end">
          <div className="flex flex-col items-center">
            <div className="text-xs mb-1">Ligretto ({player.stock.length})</div>
            <div className="w-[72px] h-[100px] bg-gradient-to-br from-blue-700 to-blue-900 rounded-lg border-2 border-blue-950 shadow"></div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-xs mb-1">Ablage ({player.pile.length})</div>
            {player.pile.length > 0 ? (
              <PlayingCard card={{ suit: suitToCardSuit(player.pile[player.pile.length - 1].suit), rank: String(player.pile[player.pile.length - 1].value) as any }} />
            ) : (
              <div className="w-[72px] h-[100px] border-2 border-dashed border-gray-300 rounded-lg"></div>
            )}
          </div>
          <div className="flex-1 flex gap-2 flex-wrap items-end">
            {player.hand.map((card) => {
              const canPlay = playHandMoves.some((m) => m.type === 'playFromHand' && m.cardId === card.id);
              return (
                <button
                  key={card.id}
                  onClick={() => {
                    const m = playHandMoves.find((mv) => mv.type === 'playFromHand' && mv.cardId === card.id);
                    if (m) onMove(m);
                  }}
                  disabled={!canPlay}
                  className={`p-0 border-0 bg-transparent ${canPlay ? 'cursor-pointer hover:scale-105 transition-transform' : 'opacity-60'}`}
                >
                  <PlayingCard card={{ suit: suitToCardSuit(card.suit), rank: String(card.value) as any }} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2">
          {flipMoves.length > 0 && (
            <button onClick={() => onMove(flipMoves[0])} className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
              Umblättern
            </button>
          )}
          {playPileMoves.length > 0 && (
            <button onClick={() => onMove(playPileMoves[0])} className="px-3 py-1 bg-green-500 text-white rounded text-sm">
              Ablagestapel legen
            </button>
          )}
          {ligrettoMoves.length > 0 && (
            <button onClick={() => onMove(ligrettoMoves[0])} className="px-3 py-1 bg-red-500 text-white rounded text-sm font-bold">
              Ligretto!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const gameUi: GameUi<LigrettoState, LigrettoMove> = {
  Board,
  SeatSymbol: () => <span>⚡</span>,
  seatLabel: (seat) => `Spieler ${seat + 1}`,
  sounds: {},
};

export const ui = gameUi;
