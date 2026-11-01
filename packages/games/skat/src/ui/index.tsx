import { sortHand, cardEyePoints, cardSuit, type CardId, type SeatId } from '@brett-und-blatt/engine';
import { CardFan, PlayingCard, TRICK_HAND_MIN_STEP, TrickTable, trickHandCardWidth, useTrickDisplay, type BoardProps, type GameUi, type TrickTableSlot } from '@brett-und-blatt/ui';
import { useState } from 'react';
import {
  getContract,
  ALL_BID_VALUES,
  SKAT_BASE_VALUES,
  calculateGameValue,
  countSpitzen,
  nextPossibleBid,
  type SkatDeclaration,
  type SkatGameType,
  type SkatMove,
  type SkatState,
} from '../rules.js';

export function SkatBoard({
  view,
  legalMoves,
  onMove,
  viewer,
  seatNames,
}: BoardProps<SkatState, SkatMove>) {
  const mySeat: number = typeof viewer === 'number' ? viewer : view.activeSeats[0];
  const isDeclarer = mySeat === view.declarerSeat;
  // Sortiert nach dem laufenden Spiel (vor der Ansage nach dem üblichen Standardspiel).
  const myHand: CardId[] = sortHand(view.hands[mySeat] || [], getContract(view));

  const [selectedToDiscard, setSelectedToDiscard] = useState<CardId[]>([]);
  const [selectedGameType, setSelectedGameType] = useState<SkatGameType>('grand');
  const [selectedSchneider, setSelectedSchneider] = useState(false);
  const [selectedSchwarz, setSelectedSchwarz] = useState(false);
  const [selectedOuvert, setSelectedOuvert] = useState(false);

  const displayTrick = useTrickDisplay(view.currentTrick, view.completedTricks);

  const trickSlots: TrickTableSlot[] = view.activeSeats.map((seat: number) => {
    const played = displayTrick.cards.find((p) => p.player === seat);
    const isLead = displayTrick.cards[0]?.player === seat;
    const isWin = displayTrick.winner === seat;
    const name = seatNames[seat] ?? `Spieler ${seat + 1}${seat === view.declarerSeat ? ' (Alleinspieler)' : ''}`;
    return {
      seat,
      name,
      card: played ? played.card : null,
      isLeader: isLead,
      isWinner: isWin,
    };
  });

  // Erlaubte Karten heben sich ab; unerlaubte Klicks lehnt die Spielleitung ohnehin ab.
  const playableCards = new Set(legalMoves.flatMap((m) => (m.type === 'play' ? [m.card] : [])));

  return (
    <div className="flex h-full flex-col w-full max-w-4xl mx-auto p-1 gap-2 sm:p-2 flat:p-0">
      {/* Kopfzeile mit Status und Spielstand */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 flat:py-1 bg-stone-100 dark:bg-stone-800 rounded-xl text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            Spiel {view.gameNumber} von {view.totalGames}
          </span>
          {view.declarerSeat !== null && (
            <span className="text-stone-600 dark:text-stone-300">
              Alleinspieler: <strong>{seatNames[view.declarerSeat] ?? `Spieler ${view.declarerSeat + 1}`}</strong> ({view.declaration ? formatDeclaration(view.declaration) : 'Ansage offen'})
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs sm:text-sm">
          {view.countEyes && (
            <span>
              Augen: {view.declarerEyes} (Allein) : {view.opponentEyes} (Gegner)
            </span>
          )}
          <span>
            Geber: {seatNames[view.dealerSeat] ?? `Spieler ${view.dealerSeat + 1}`}
          </span>
        </div>
      </div>

      {/* Runden-Ablauf & Dialoge */}
      {view.phase === 'bidding' && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl">
          <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">Reizen</h3>
          <p className="text-sm mb-3 text-stone-700 dark:text-stone-300">
            {view.biddingSpeaker === mySeat ? (
              <strong>Du bist am Zug zu sprechen!</strong>
            ) : (
              <span>{seatNames[view.biddingSpeaker] ?? `Spieler ${view.biddingSpeaker + 1}`} ist am Zug.</span>
            )}
            {' '}(Aktuelles Gebot: {view.currentBidValue > 0 ? view.currentBidValue : 'Noch kein Gebot'})
          </p>

          {view.biddingSpeaker === mySeat && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 rounded-lg text-sm font-medium"
                onClick={() => onMove({ type: 'pass' })}
              >
                Passe
              </button>
              {view.currentBidValue === 0 ? (
                <button
                  type="button"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium shadow"
                  onClick={() => onMove({ type: 'bid', value: 18 })}
                >
                  18 sagen
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium shadow"
                    onClick={() => onMove({ type: 'hold' })}
                  >
                    Halten ({view.currentBidValue})
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow"
                    onClick={() => onMove({ type: 'bid', value: nextPossibleBid(view.currentBidValue) })}
                  >
                    {nextPossibleBid(view.currentBidValue)} sagen
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {view.phase === 'skatDecision' && isDeclarer && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl">
          <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-2">Skat aufnehmen?</h3>
          <p className="text-sm mb-3 text-stone-700 dark:text-stone-300">
            Du hast das Reizen mit {view.highestBid} gewonnen. Möchtest du den Skat aufnehmen oder verdeckt Hand spielen?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow"
              onClick={() => onMove({ type: 'takeSkat' })}
            >
              Skat aufnehmen
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium shadow"
              onClick={() => onMove({ type: 'playHand' })}
            >
              Hand spielen (+1 Gewinnstufe)
            </button>
          </div>
        </div>
      )}

      {view.phase === 'discard' && isDeclarer && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-300 dark:border-indigo-800 rounded-xl">
          <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">2 Karten drücken</h3>
          <p className="text-sm mb-3 text-stone-700 dark:text-stone-300">
            Wähle zwei Karten aus deiner Hand, die verdeckt in den Skat gelegt werden ({selectedToDiscard.length}/2 gewählt).
          </p>
          <button
            type="button"
            disabled={selectedToDiscard.length !== 2}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium shadow"
            onClick={() => {
              if (selectedToDiscard.length === 2) {
                onMove({ type: 'discard', cards: [selectedToDiscard[0], selectedToDiscard[1]] });
                setSelectedToDiscard([]);
              }
            }}
          >
            Ausgewählte 2 Karten drücken
          </button>
        </div>
      )}

      {view.phase === 'declare' && isDeclarer && (
        <div className="p-4 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 mb-2">Spiel ansagen</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {(['grand', 'C', 'S', 'H', 'D', 'null'] as SkatGameType[]).map((g) => (
              <button
                key={g}
                type="button"
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedGameType === g
                    ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/40 font-bold'
                    : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700'
                }`}
                onClick={() => setSelectedGameType(g)}
              >
                <div className="text-sm">{formatGameTypeName(g)}</div>
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  Grundwert {SKAT_BASE_VALUES[g]}
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium shadow"
            onClick={() => {
              onMove({
                type: 'declare',
                declaration: {
                  gameType: selectedGameType,
                  hand: view.discardedCards.length === 0,
                  schneider: selectedSchneider,
                  schwarz: selectedSchwarz,
                  ouvert: selectedOuvert,
                },
              });
            }}
          >
            {formatGameTypeName(selectedGameType)} ansagen
          </button>
        </div>
      )}

      {/* Stich-Tisch in der Mitte */}
      <div className="flex min-h-[90px] flex-1 flex-col">
        <TrickTable
          slots={trickSlots}
          bottomSeat={mySeat}
          deckStyle={view.deckStyle}
          cardWidth={80}
          collecting={displayTrick.collecting}
        />
      </div>

      {/* Eigene Handkarten */}
      <div className="flex flex-col items-center gap-2 mt-auto">
        <div className="text-xs font-medium text-stone-500 dark:text-stone-400 flat:hidden">
          Deine Hand ({myHand.filter((c: CardId) => c !== 'back').length} Karten)
        </div>
        <CardFan
          className="w-full pb-1"
          count={myHand.length}
          label="Deine Handkarten"
          cardWidth={trickHandCardWidth}
          minStep={TRICK_HAND_MIN_STEP}
          maxRows={2}
          keyOf={(idx) => (myHand[idx] === 'back' ? `back-${idx}` : myHand[idx]!)}
          renderCard={(idx) => {
            const card = myHand[idx]!;
            const isSelected = selectedToDiscard.includes(card);
            return (
              <PlayingCard
                card={card === 'back' ? null : card}
                deckStyle={view.deckStyle}
                highlight={playableCards.has(card) ? 'target' : null}
                selected={isSelected}
                onClick={() => {
                  if (view.phase === 'discard' && isDeclarer) {
                    if (selectedToDiscard.includes(card)) {
                      setSelectedToDiscard(selectedToDiscard.filter((c) => c !== card));
                    } else if (selectedToDiscard.length < 2) {
                      setSelectedToDiscard([...selectedToDiscard, card]);
                    }
                  } else if (view.phase === 'play' && card !== 'back') {
                    onMove({ type: 'play', card });
                  }
                }}
              />
            );
          }}
        />
      </div>

      {/* Runden-Auswertung */}
      {(view.phase === 'roundOver' || view.phase === 'passedOut') && (
        <div className="p-4 bg-stone-900/90 text-white rounded-2xl shadow-xl flex flex-col items-center gap-3">
          <h2 className="text-lg font-bold">
            {view.phase === 'passedOut' ? 'Spiel eingepasst' : 'Runde beendet'}
          </h2>
          {view.history.length > 0 && view.phase === 'roundOver' && (
            <div className="text-sm text-stone-200 text-center">
              {view.history[view.history.length - 1].won ? (
                <span className="text-emerald-400 font-semibold">
                  Alleinspieler ({seatNames[view.history[view.history.length - 1].declarerSeat] ?? `Spieler ${view.history[view.history.length - 1].declarerSeat + 1}`}) hat gewonnen!
                </span>
              ) : (
                <span className="text-rose-400 font-semibold">
                  Alleinspieler ({seatNames[view.history[view.history.length - 1].declarerSeat] ?? `Spieler ${view.history[view.history.length - 1].declarerSeat + 1}`}) hat verloren!
                </span>
              )}
              <div className="mt-1 text-xs text-stone-400">
                Spielwert: {view.history[view.history.length - 1].gameValue} (Reizwert: {view.history[view.history.length - 1].highestBid})
                {' • '}Augen: {view.history[view.history.length - 1].declarerEyes} : {120 - view.history[view.history.length - 1].declarerEyes}
              </div>
            </div>
          )}
          <button
            type="button"
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl shadow transition"
            onClick={() => onMove({ type: 'nextGame' })}
          >
            Nächstes Spiel
          </button>
        </div>
      )}
    </div>
  );
}

function formatGameTypeName(type: SkatGameType): string {
  switch (type) {
    case 'grand':
      return 'Grand';
    case 'null':
      return 'Null';
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

function formatDeclaration(decl: SkatDeclaration): string {
  let text = formatGameTypeName(decl.gameType);
  if (decl.hand) text += ' Hand';
  if (decl.ouvert) text += ' Ouvert';
  if (decl.schneider) text += ' Schneider';
  if (decl.schwarz) text += ' Schwarz';
  return text;
}

export const gameUi: GameUi<SkatState, SkatMove> = {
  Board: SkatBoard,
  sounds: {
    cardPlayed: 'karte-legen',
    trickTaken: 'stich-einsammeln',
    announced: (event) => {
      const detail = event.detail as { declaration?: { schwarz?: boolean; schneider?: boolean; ouvert?: boolean; hand?: boolean } } | undefined;
      const d = detail?.declaration;
      if (event.call === 'bid') return 'reizen-klopfen';
      if (event.call === 'playHand') return 'ruf-hand';
      if (d?.ouvert) return 'ruf-ouvert';
      if (d?.schwarz) return 'ruf-schwarz';
      if (d?.schneider) return 'ruf-schneider';
      return 'ansage';
    },
    newDeal: 'karten-austeilen',
  },
  SeatSymbol: ({ className }) => <span className={className}>🃏</span>,
  seatLabel: (seat: SeatId) => `Spieler ${seat + 1}`,
  seatDetail: (view: SkatState, seat: SeatId) => {
    const isDeclarer = seat === view.declarerSeat;
    const score = view.scores[seat] ?? 0;
    return `${score} Pkt${isDeclarer ? ' · Allein' : ''}`;
  },
};
