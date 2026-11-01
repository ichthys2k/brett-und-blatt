import { sortHand, cardSuit, type CardId, type SeatId, type Suit } from '@brett-und-blatt/engine';
import { CardFan, PlayingCard, TRICK_HAND_MIN_STEP, SeatRing, TrickTable, trickHandCardWidth, useTrickDisplay, type BoardProps, type GameUi, type TrickTableSlot } from '@brett-und-blatt/ui';
import {
  getContract,
  owingSolo,
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
  table,
}: BoardProps<DokoState, DokoMove>) {
  const mySeat: number = typeof viewer === 'number' ? viewer : view.activeSeats[0];
  // Sortiert nach dem laufenden Spiel (vor der Ansage nach dem üblichen Standardspiel).
  const myHand: CardId[] = sortHand(view.hands[mySeat] || [], getContract(view));
  const isMyRe = view.reTeam.includes(mySeat);

  const displayTrick = useTrickDisplay(view.currentTrick, view.completedTricks);

  // TrickTable Slots
  const trickSlots: TrickTableSlot[] = view.activeSeats.map((seat: number) => {
    const played = displayTrick.cards.find((p) => p.player === seat);
    const isLead = displayTrick.cards[0]?.player === seat;
    const isWin = displayTrick.winner === seat;
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
      isWinner: isWin,
    };
  });

  const announcementMoves = legalMoves.filter((m) => m.type === 'announce') as {
    type: 'announce';
    call: DokoAnnouncement;
  }[];

  // Erlaubte Karten heben sich ab; unerlaubte Klicks lehnt die Spielleitung ohnehin ab.
  const playableCards = new Set(legalMoves.flatMap((m) => (m.type === 'play' ? [m.card] : [])));

  // Kopfzeile
  const header = (
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 flat:py-1 bg-stone-100 dark:bg-stone-800 rounded-xl text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            {view.gameNumber > view.totalGames ? `Nachspiel (${view.totalGames} Spiele gespielt)` : `Spiel ${view.gameNumber} von ${view.totalGames}`}
          </span>
          <span className="text-stone-700 dark:text-stone-300 font-medium">
            {formatContract(view.contract)}
          </span>
          {view.contract.mandatory && (
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-800 dark:text-rose-300 rounded text-xs font-semibold">
              Pflichtsolo{view.forcedSeat != null ? ' (Vorführung)' : ''}
            </span>
          )}
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

  );

  const dialogs = (
    <>
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

      {/* Pflichtsolo-Stand */}
      {view.mandatorySolo && view.phase !== 'play' && (
        <div className="px-3 py-2 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-700 dark:text-stone-300 flex flex-wrap gap-x-3 gap-y-1">
          <span className="font-semibold">Pflichtsolo:</span>
          {Array.from({ length: view.playerCount }, (_, s) => (
            <span key={s}>
              {owingSolo(view).includes(s) ? '○' : '✓'} {seatNames[s] ?? `Spieler ${s + 1}`}
            </span>
          ))}
        </div>
      )}

      {/* Vorführung */}
      {view.phase === 'chooseSolo' && view.forcedSeat != null && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 rounded-xl text-sm text-rose-900 dark:text-rose-200">
          <strong>Vorführung:</strong> {view.forcedSeat === mySeat ? 'Du musst' : `${seatNames[view.forcedSeat] ?? `Spieler ${view.forcedSeat + 1}`} muss`} jetzt das
          Pflichtsolo spielen, weil sonst nicht mehr genug Spiele übrig sind.
        </div>
      )}

      {/* Solo-Wahl */}
      {view.phase === 'chooseSolo' && legalMoves.length > 0 && (
        <div className="p-4 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 mb-2">
            {owingSolo(view).includes(mySeat) ? 'Pflichtsolo wählen' : 'Vorbehalt festlegen'}
          </h3>
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

    </>
  );

  // Stich-Tisch in der Mitte
  const trick = (
      <div className="flex min-h-[90px] flex-1 flex-col">
        <TrickTable
          slots={trickSlots}
          bottomSeat={mySeat}
          deckStyle={view.deckStyle}
          cardWidth={80}
          collecting={displayTrick.collecting}
        />
      </div>

  );

  // Eigene Handkarten (12 Karten)
  const hand = (
      <div className="flex w-full flex-col items-center gap-2 mt-auto">
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
            
            return (
              <PlayingCard
                card={card === 'back' ? null : card}
                deckStyle={view.deckStyle}
                highlight={playableCards.has(card) ? 'target' : null}
                onClick={() => {
                  if (view.phase === 'play' && card !== 'back') {
                    onMove({ type: 'play', card });
                  }
                }}
              />
            );
          }}
        />
      </div>

  );

  // Runden-Auswertung
  const roundEnd = (
    <>
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
              {view.history[view.history.length - 1].mandatory && (
                <div className="mt-1 text-xs text-stone-300">Pflichtsolo – zählt nicht als Spiel der Serie, der Geber gibt noch einmal.</div>
              )}
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
    </>
  );

  return (
    <div className={`flex h-full flex-col w-full mx-auto p-1 gap-2 sm:p-2 flat:p-0 ${table ? '' : 'max-w-4xl'}`}>
      {header}
      {table ? (
        <SeatRing
          seats={seatNames.length}
          bottomSeat={mySeat}
          status={table.status}
          bottom={hand}
          renderSeat={(seat) => (
            <>
              {seat !== mySeat && (view.hands[seat]?.length ?? 0) > 0 && (
                <div className="w-20" aria-hidden="true">
                  <CardFan count={view.hands[seat]!.length} label="" cardWidth={16} renderCard={() => <PlayingCard card={null} deckStyle={view.deckStyle} />} />
                </div>
              )}
              {table.seatChip(seat)}
            </>
          )}
        >
          {dialogs}
          {roundEnd}
          {trick}
        </SeatRing>
      ) : (
        <>
          {dialogs}
          {trick}
          {hand}
          {roundEnd}
        </>
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
  seatsAround: true,
  sounds: {
    cardPlayed: 'karte-legen',
    trickTaken: 'stich-einsammeln',
    announced: (event) => {
      const call = (event.detail as { call?: string } | undefined)?.call;
      if (call === 're') return 'ruf-re';
      if (call === 'kontra') return 'ruf-kontra';
      if (call === 'no90') return 'ruf-keine-neunzig';
      return 'ansage';
    },
    newDeal: 'karten-austeilen',
  },
  SeatSymbol: ({ className }) => <span className={className}>🎴</span>,
  seatLabel: (seat: SeatId) => `Spieler ${seat + 1}`,
  seatDetail: (view: DokoState, seat: SeatId) => {
    const score = view.scores[seat] ?? 0;
    const isRe = view.reTeam.includes(seat);
    const isRevealed = view.revealedRe.includes(seat) || view.phase === 'roundOver';
    const solo = view.mandatorySolo ? (owingSolo(view).includes(seat) ? ' · Solo offen' : ' · Solo ✓') : '';
    return `${score} Pkt${isRevealed ? (isRe ? ' · Re' : ' · Kontra') : ''}${solo}`;
  },
};
