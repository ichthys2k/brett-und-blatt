import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import type { LigrettoMove, LigrettoState } from '../rules';

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
        <div className="flex flex-wrap gap-2 justify-center">
          {s.centerPiles.length === 0 && (
            <div className="text-xs text-gray-500">Warte auf erste 1...</div>
          )}
          {s.centerPiles.map((cp, i) => (
            <div
              key={i}
              className="w-16 h-24 border-2 border-gray-400 rounded flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: cp.suit === 'red' ? '#fecaca' : cp.suit === 'yellow' ? '#fef3c7' : cp.suit === 'green' ? '#dcfce7' : cp.suit === 'blue' ? '#dbeafe' : '#f3f4f6' }}
            >
              {cp.suit ? `${cp.suit[0].toUpperCase()}${cp.top}` : '?'}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-4 space-y-2">
        <div className="text-sm font-semibold">Deine Karten</div>
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="text-xs">Ligretto ({player.stock.length})</div>
            <div className="w-12 h-16 bg-blue-800 rounded border-2 border-blue-900"></div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-xs">Ablage ({player.pile.length})</div>
            {player.pile.length > 0 ? (
              <div className="w-12 h-16 bg-white border-2 border-gray-400 rounded flex items-center justify-center text-xs font-bold">
                {player.pile[player.pile.length - 1].suit[0].toUpperCase()}{player.pile[player.pile.length - 1].value}
              </div>
            ) : (
              <div className="w-12 h-16 border-2 border-dashed border-gray-300 rounded"></div>
            )}
          </div>
          <div className="flex-1 flex gap-2 flex-wrap">
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
                  className={`w-12 h-16 rounded border-2 flex items-center justify-center text-xs font-bold ${
                    canPlay ? 'bg-white border-green-500 cursor-pointer' : 'bg-gray-100 border-gray-300'
                  }`}
                >
                  {card.suit[0].toUpperCase()}{card.value}
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
