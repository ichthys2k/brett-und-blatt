import { cardSuit, type CardId, type SeatId, type Suit } from '@brett-und-blatt/engine';
import { CardFan, PlayingCard, TrickTable, type BoardProps, type GameUi, type TrickTableSlot } from '@brett-und-blatt/ui';
import {
  type DokoAnnouncement,
  type DokoContract,
  type DokoContractType,
  type DokoMove,
  type DokoState,
} from '../rules.js';

export function DokoBoard({
  view,
  legalMoves,
  onMove,
  viewer,
  seatNames,
}: BoardProps<DokoState, DokoMove>) {
  const mySeat: number = typeof viewer === 'number' ? viewer : view.activeSeats[0];
  const myHand: CardId[] = view.hands[mySeat] || [];
  const isMyRe = view.reTeam.includes(mySeat);

  // TrickTable Slots
  const trickSlots: TrickTableSlot[] = view.activeSeats.map((seat: number) => {
    const played = view.currentTrick.find((p) => p.player === seat);
    const isLead = view.currentTrick[0]?.player === seat;
    let name = seatNames[seat] ?? `Spieler ${seat + 1}`;

    const isSeatRe = view.reTeam.includes(seat);
    const isRevealed = view.revealedRe.includes(seat) || view.phase === 'roundOver' || seat === mySeat;

    if (isRevealed) {
      name += isSeatRe ? ' (Re)' : ' (Kontra)';
    }

    return {
      seat,
      name,
      card: played ? played.card : null,
      isLeader: isLead,
    };
  });

  const announcementMoves = legalMoves.filter((m) => m.type === 'announce') as {
    type: 'announce';
    call: DokoAnnouncement;
  }[];

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto p-2 sm:p-4 gap-4">
      {/* Kopfzeile */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-100 dark:bg-stone-800 rounded-xl text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            Spiel {view.gameNumber} von {view.totalGames}
          </span>
          <span className="text-stone-700 dark:text-stone-300 font-medium">
            {formatContract(view.contract)}
          </span>
          {view.hochzeitSeat !== null && view.reTeam.length === 1 && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded text-xs font-semibold">
              Hochzeit sucht Partner ({view.hochzeitTrickCount}/3)
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs sm:text-sm">
          <span>
            Augen: {view.reEyes} (Re) : {view.kontraEyes} (Kontra)
          </span>
          <span>Geber: {seatNames[view.dealerSeat] ?? `Spieler ${view.dealerSeat + 1}`}</span>
        </div>
      </div>

      {/* Vorbehaltsphase */}
      {view.phase === 'reservations' && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-300 dark:border-indigo-800 rounded-xl">
          <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">Vorbehaltsabfrage</h3>
          <p className="text-sm mb-3 text-stone-700 dark:text-stone-300">
            {legalMoves.length > 0 ? (
              <strong>Bist du gesund oder hast du einen Vorbehalt (Hochzeit / Solo)?</strong>
            ) : (
              <span>Warten auf die anderen Spieler...</span>
            )}
          </p>
          {legalMoves.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 rounded-lg text-sm font-medium"
                onClick={() => onMove({ type: 'healthy' })}
              >
                Gesund
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow"
                onClick={() => onMove({ type: 'reservation' })}
              >
                Vorbehalt anmelden
              </button>
            </div>
          )}
        </div>
      )}

      {/* Solo-Wahl */}
      {view.phase === 'chooseSolo' && legalMoves.length > 0 && (
        <div className="p-4 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 mb-2">Vorbehalt festlegen</h3>
          <div className="flex flex-wrap gap-2">
            {legalMoves
              .filter((m) => m.type === 'chooseContract')
              .map((m, idx) => {
                const c = (m as { type: 'chooseContract'; contract: DokoContract }).contract;
                return (
                  <button
                    key={idx}
                    type="button"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow"
                    onClick={() => onMove(m)}
                  >
                    {formatContract(c)}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Ansage-Knöpfe im Kartenspiel */}
      {view.phase === 'play' && announcementMoves.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center justify-between">
          <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Mögliche Ansage für dein Team:
          </span>
          <div className="flex gap-2">
            {announcementMoves.map((m) => (
              <button
                key={m.call}
                type="button"
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow uppercase"
                onClick={() => onMove(m)}
              >
                {formatAnnouncement(m.call)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TrickTable in der Mitte */}
      <div className="my-2">
        <TrickTable
          slots={trickSlots}
          bottomSeat={mySeat}
          deckStyle={view.deckStyle}
          cardWidth={80}
        />
      </div>

      {/* Eigene Handkarten (12 Karten) */}
      <div className="flex flex-col items-center gap-2 mt-auto">
        <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
          Deine Hand ({myHand.filter((c: CardId) => c !== 'back').length} Karten)
        </div>
        <div className="w-full flex justify-center overflow-x-auto pb-2">
          <div className="flex flex-wrap justify-center gap-1 sm:gap-1.5 max-w-full">
            {myHand.map((card: CardId, idx: number) => (
              <div key={`${card}-${idx}`} className="transition-transform hover:-translate-y-2">
                <PlayingCard
                  card={card === 'back' ? null : card}
                  deckStyle={view.deckStyle}
                  onClick={() => {
                    if (view.phase === 'play' && card !== 'back') {
                      onMove({ type: 'play', card });
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Runden-Auswertung */}
      {view.phase === 'roundOver' && (
        <div className="p-4 bg-stone-900/90 text-white rounded-2xl shadow-xl flex flex-col items-center gap-3">
          <h2 className="text-lg font-bold">Runde beendet</h2>
          {view.history.length > 0 && (
            <div className="text-sm text-stone-200 text-center">
              {view.history[view.history.length - 1].won ? (
                <span className="text-emerald-400 font-semibold">
                  Team Re hat gewonnen! ({view.history[view.history.length - 1].reEyes} Augen)
                </span>
              ) : (
                <span className="text-rose-400 font-semibold">
                  Team Kontra hat gewonnen! ({view.history[view.history.length - 1].kontraEyes} Augen)
                </span>
              )}
              <div className="mt-1 text-xs text-stone-400">
                Punkte: {view.history[view.history.length - 1].points} Pkt
              </div>
            </div>
          )}
          <button
            type="button"
            className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl shadow transition"
            onClick={() => onMove({ type: 'nextGame' })}
          >
            Nächstes Spiel
          </button>
        </div>
      )}
    </div>
  );
}

function formatContract(c: DokoContract): string {
  switch (c.type) {
    case 'normal':
      return 'Normalspiel';
    case 'hochzeit':
      return 'Hochzeit';
    case 'damensolo':
      return 'Damensolo';
    case 'bubensolo':
      return 'Bubensolo';
    case 'fleischlos':
      return 'Fleischloser';
    case 'farbsolo':
      return `Farbsolo ${formatSuit(c.trumpSuit ?? 'D')}`;
  }
}

function formatSuit(suit: Suit): string {
  switch (suit) {
    case 'C':
      return 'Kreuz';
    case 'S':
      return 'Pik';
    case 'H':
      return 'Herz';
    case 'D':
      return 'Karo';
  }
}

function formatAnnouncement(call: DokoAnnouncement): string {
  switch (call) {
    case 're':
      return 'Re!';
    case 'kontra':
      return 'Kontra!';
    case 'no90':
      return 'Keine 90!';
    case 'no60':
      return 'Keine 60!';
    case 'no30':
      return 'Keine 30!';
    case 'schwarz':
      return 'Schwarz!';
  }
}

export const gameUi: GameUi<DokoState, DokoMove> = {
  Board: DokoBoard,
  SeatSymbol: ({ className }) => <span className={className}>🎴</span>,
  seatLabel: (seat: SeatId) => `Spieler ${seat + 1}`,
  seatDetail: (view: DokoState, seat: SeatId) => {
    const score = view.scores[seat] ?? 0;
    const isRe = view.reTeam.includes(seat);
    const isRevealed = view.revealedRe.includes(seat) || view.phase === 'roundOver';
    return `${score} Pkt${isRevealed ? (isRe ? ' · Re' : ' · Kontra') : ''}`;
  },
};
