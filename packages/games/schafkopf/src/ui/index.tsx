import { cardId, type CardId, type SeatId, type Suit } from '@brett-und-blatt/engine';
import { CardFan, PlayingCard, TrickTable, type BoardProps, type GameUi, type TrickTableSlot } from '@brett-und-blatt/ui';
import { useState } from 'react';
import {
  type SchafkopfContract,
  type SchafkopfGameType,
  type SchafkopfMove,
  type SchafkopfState,
} from '../rules.js';

export function SchafkopfBoard({
  view,
  legalMoves,
  onMove,
  viewer,
  seatNames,
}: BoardProps<SchafkopfState, SchafkopfMove>) {
  const mySeat: number = typeof viewer === 'number' ? viewer : 0;
  const myHand: CardId[] = view.hands[mySeat] || [];
  const isDeclarer = mySeat === view.declarerSeat;
  const isPartner = mySeat === view.partnerSeat;

  const [selectedGameType, setSelectedGameType] = useState<SchafkopfGameType>('sauspiel');
  const [selectedSuit, setSelectedSuit] = useState<Suit>('C');

  // 4 TrickTable Slots
  const trickSlots: TrickTableSlot[] = [0, 1, 2, 3].map((seat) => {
    const played = view.currentTrick.find((p) => p.player === seat);
    const isLead = view.currentTrick[0]?.player === seat;
    let label = seatNames[seat] ?? `Spieler ${seat + 1}`;
    if (seat === view.declarerSeat) label += ' (Solist)';
    else if (seat === view.partnerSeat && (view.partnerRevealed || mySeat === view.partnerSeat)) {
      label += ' (Partner)';
    }

    return {
      seat,
      name: label,
      card: played ? played.card : null,
      isLeader: isLead,
    };
  });

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto p-2 sm:p-4 gap-4">
      {/* Kopfzeile */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-100 dark:bg-stone-800 rounded-xl text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            Spiel {view.gameNumber} von {view.totalGames}
          </span>
          {view.contract && (
            <span className="text-stone-700 dark:text-stone-300 font-medium">
              {formatContract(view.contract)}
            </span>
          )}
          {view.multiplier > 1 && (
            <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-xs font-bold">
              {view.multiplier}x (Gestoßen)
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs sm:text-sm">
          <span>Geber: {seatNames[view.dealerSeat] ?? `Spieler ${view.dealerSeat + 1}`}</span>
        </div>
      </div>

      {/* Rufsau-Hinweis am Tisch */}
      {view.contract?.gameType === 'sauspiel' && view.contract.calledSuit && (
        <div className="flex items-center justify-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl text-sm text-amber-900 dark:text-amber-200">
          <span>Gerufen:</span>
          <strong className="flex items-center gap-1">
            {formatSuitName(view.contract.calledSuit)}-Sau
          </strong>
          {view.partnerRevealed ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              (Gefallen! Partner ist {seatNames[view.partnerSeat!] ?? `Spieler ${view.partnerSeat! + 1}`})
            </span>
          ) : isPartner ? (
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
              (Du bist der geheimer Partner!)
            </span>
          ) : (
            <span className="text-stone-500 text-xs">
              (Partner noch geheim)
            </span>
          )}
        </div>
      )}

      {/* Bidding Phase */}
      {view.phase === 'bidding' && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl">
          <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">Spielansage</h3>
          <p className="text-sm mb-3 text-stone-700 dark:text-stone-300">
            {legalMoves.length > 0 ? (
              <strong>Du bist am Zug: Spielst du oder sagst du weiter?</strong>
            ) : (
              <span>Warten auf die anderen Spieler...</span>
            )}
          </p>
          {legalMoves.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 rounded-lg text-sm font-medium"
                onClick={() => onMove({ type: 'pass' })}
              >
                Weiter
              </button>
              {legalMoves
                .filter((m) => m.type === 'wantToPlay')
                .map((m) => (
                  <button
                    key={(m as { type: 'wantToPlay'; contractType: SchafkopfGameType }).contractType}
                    type="button"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow"
                    onClick={() => onMove(m)}
                  >
                    Ich spiele ({formatGameTypeName((m as { type: 'wantToPlay'; contractType: SchafkopfGameType }).contractType)})
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Declare Phase */}
      {view.phase === 'declare' && isDeclarer && (
        <div className="p-4 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 mb-2">Spielart festlegen</h3>
          <div className="flex flex-wrap gap-2">
            {legalMoves
              .filter((m) => m.type === 'declare')
              .map((m, idx) => {
                const decl = (m as { type: 'declare'; contract: SchafkopfContract }).contract;
                return (
                  <button
                    key={idx}
                    type="button"
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow"
                    onClick={() => onMove(m)}
                  >
                    {formatContract(decl)}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Doubling Phase */}
      {view.phase === 'doubling' && legalMoves.length > 0 && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center justify-between">
          <span className="text-sm font-medium text-rose-900 dark:text-rose-200">
            Möchtest du stoßen (Wert verdoppeln)?
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 rounded-lg text-xs font-semibold"
              onClick={() => onMove({ type: 'skipDoubling' })}
            >
              Nein
            </button>
            <button
              type="button"
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow"
              onClick={() => onMove({ type: 'double' })}
            >
              Stoßen!
            </button>
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

      {/* Eigene Handkarten */}
      <div className="flex flex-col items-center gap-2 mt-auto">
        <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
          Deine Hand ({myHand.filter((c: CardId) => c !== 'back').length} Karten)
        </div>
        <div className="w-full flex justify-center overflow-x-auto pb-2">
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
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
      {(view.phase === 'roundOver' || view.phase === 'passedOut') && (
        <div className="p-4 bg-stone-900/90 text-white rounded-2xl shadow-xl flex flex-col items-center gap-3">
          <h2 className="text-lg font-bold">
            {view.phase === 'passedOut' ? 'Alle weiter – neu geben' : 'Runde beendet'}
          </h2>
          {view.history.length > 0 && view.phase === 'roundOver' && (
            <div className="text-sm text-stone-200 text-center">
              {view.history[view.history.length - 1].won ? (
                <span className="text-emerald-400 font-semibold">
                  Spielende Partei hat gewonnen!
                </span>
              ) : (
                <span className="text-rose-400 font-semibold">
                  Spielende Partei hat verloren!
                </span>
              )}
              <div className="mt-1 text-xs text-stone-400">
                Augen: {view.history[view.history.length - 1].declarerEyes} : {view.history[view.history.length - 1].opponentEyes}
              </div>
            </div>
          )}
          <button
            type="button"
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-xl shadow transition"
            onClick={() => onMove({ type: 'nextGame' })}
          >
            Nächstes Spiel
          </button>
        </div>
      )}
    </div>
  );
}

function formatSuitName(suit: Suit): string {
  switch (suit) {
    case 'C':
      return 'Eichel';
    case 'S':
      return 'Gras';
    case 'H':
      return 'Herz';
    case 'D':
      return 'Schellen';
  }
}

function formatGameTypeName(type: SchafkopfGameType): string {
  switch (type) {
    case 'sauspiel':
      return 'Sauspiel';
    case 'wenz':
      return 'Wenz';
    case 'solo':
      return 'Farbsolo';
    case 'geier':
      return 'Geier';
    case 'farbwenz':
      return 'Farbwenz';
    case 'bettel':
      return 'Bettel';
    case 'ramsch':
      return 'Ramsch';
  }
}

function formatContract(contract: SchafkopfContract): string {
  let text = formatGameTypeName(contract.gameType);
  if (contract.calledSuit) {
    text += ` auf die ${formatSuitName(contract.calledSuit)}-Sau`;
  }
  if (contract.trumpSuit) {
    text += ` (${formatSuitName(contract.trumpSuit)})`;
  }
  if (contract.tout) text += ' Tout';
  return text;
}

export const gameUi: GameUi<SchafkopfState, SchafkopfMove> = {
  Board: SchafkopfBoard,
  SeatSymbol: ({ className }) => <span className={className}>🎴</span>,
  seatLabel: (seat: SeatId) => `Spieler ${seat + 1}`,
  seatDetail: (view: SchafkopfState, seat: SeatId) => {
    const score = view.scores[seat] ?? 0;
    return `${score} Pkt`;
  },
};
