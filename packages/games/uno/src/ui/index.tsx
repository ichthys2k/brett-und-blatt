import React, { useMemo, useState } from 'react';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { getActiveFace } from '../rules';
import { DARK_COLORS, LIGHT_COLORS, type UnoCard, type UnoColor, type UnoMove, type UnoState } from '../types';
import './styles.css';
import { UnoCardView } from './UnoCard';

export const UnoBoard: React.FC<BoardProps<UnoState, UnoMove>> = ({
  view: state,
  legalMoves: moves,
  onMove,
  activeSeat,
  viewer,
  seatNames,
}) => {
  const [selectedWildCard, setSelectedWildCard] = useState<UnoCard | null>(null);
  const [callUnoToggled, setCallUnoToggled] = useState<boolean>(false);

  const actor = typeof viewer === 'number' ? viewer : null;
  const isActor = activeSeat !== null && activeSeat === actor;
  const side = state.activeSide;
  const isDark = side === 'dark';

  // Karten auf der Hand des Spielers
  const myHand: UnoCard[] = actor !== null ? state.hands[actor] ?? [] : [];

  // Kann der Spieler eine bestimmte Karte legen?
  const playableCardIds = useMemo(() => {
    return new Set(
      moves
        .filter((m) => m.type === 'play' || m.type === 'jumpIn')
        .map((m) => (m as { cardId: string }).cardId),
    );
  }, [moves]);

  // Kann der Spieler ziehen?
  const canDraw = moves.some((m) => m.type === 'draw');
  // Kann der Spieler passen?
  const canPass = moves.some((m) => m.type === 'pass');

  // Oberste Karte auf dem Ablagestapel
  const topDiscard = state.discard[state.discard.length - 1];

  // Klick auf eine Handkarte
  const handleCardClick = (card: UnoCard) => {
    if (!isActor && state.options.jumpIn !== 'on') return;
    if (!playableCardIds.has(card.id)) return;

    const face = getActiveFace(card, side);

    // Farbwahl bei Joker erforderlich
    if (face.color === 'wild') {
      setSelectedWildCard(card);
      return;
    }

    // Bei regulärem Legen oder Jump-In
    const matchingMoves = moves.filter(
      (m): m is Extract<UnoMove, { type: 'play' | 'jumpIn' }> =>
        (m.type === 'play' || m.type === 'jumpIn') && m.cardId === card.id,
    );
    const move = matchingMoves[0];
    if (move) {
      const willHaveOne = myHand.length === 2;
      onMove({
        ...move,
        callUno: willHaveOne ? (callUnoToggled || myHand.length === 2) : undefined,
      });
      setCallUnoToggled(false);
    }
  };

  // Farbwahl bestätigen
  const handleColorSelect = (chosenColor: UnoColor) => {
    if (!selectedWildCard) return;
    const willHaveOne = myHand.length === 2;
    onMove({
      type: 'play',
      cardId: selectedWildCard.id,
      chosenColor,
      callUno: willHaveOne ? (callUnoToggled || myHand.length === 2) : undefined,
    });
    setSelectedWildCard(null);
    setCallUnoToggled(false);
  };

  // Anprangern (catchUno)
  const handleCatchUno = (target: number) => {
    onMove({ type: 'catchUno', target });
  };

  const availableColors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const colorLabels: Record<UnoColor, string> = {
    red: 'Rot',
    yellow: 'Gelb',
    green: 'Grün',
    blue: 'Blau',
    orange: 'Orange',
    teal: 'Petrol',
    purple: 'Lila',
    pink: 'Rosa',
    wild: 'Bunt',
  };

  const colorHex: Record<UnoColor, string> = {
    red: '#dc2626',
    yellow: '#eab308',
    green: '#16a34a',
    blue: '#2563eb',
    orange: '#ea580c',
    teal: '#0d9488',
    purple: '#9333ea',
    pink: '#db2777',
    wild: '#18181b',
  };

  return (
    <div className={`uno-table ${isDark ? 'bg-zinc-950 text-white' : 'text-zinc-900'}`}>
      {/* 1. Obere Leiste: Mitspieler & Richtungsanzeige */}
      <div className="w-full flex flex-wrap items-center justify-around gap-2 p-2 bg-black/10 rounded-xl">
        {state.hands.map((hand: UnoCard[], idx: number) => {
          if (idx === actor) return null; // Eigene Hand ist unten
          const isTurn = state.turn === idx;
          const isEliminated = state.eliminated[idx];
          const hasUno = hand.length === 1;
          const isProtected = state.unoProtection[idx];
          const canCatch = isActor && hasUno && !isProtected && state.options.callUno === 'on';

          return (
            <div
              key={idx}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                isTurn ? 'border-yellow-400 bg-yellow-400/20 font-bold' : 'border-white/10 bg-black/20'
              } ${isEliminated ? 'opacity-40 line-through' : ''}`}
            >
              <div className="flex flex-col text-left">
                <span className="text-xs sm:text-sm text-zinc-300">
                  {seatNames[idx] ?? `Spieler ${idx + 1}`}
                </span>
                <span className="text-xs text-zinc-400">{hand.length} Karten</span>
              </div>

              {/* Eins!-Warnung / Anprangern */}
              {hasUno && (
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 text-xs font-black rounded bg-red-600 text-white animate-bounce">
                    Eins!
                  </span>
                  {canCatch && (
                    <button
                      type="button"
                      onClick={() => handleCatchUno(idx)}
                      className="px-2 py-0.5 text-xs font-black rounded bg-yellow-500 text-black hover:bg-yellow-400 cursor-pointer shadow active:scale-95"
                      title="Anprangern: +2 Strafkarten!"
                    >
                      Ertappen!
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 2. Tischmitte: Ablagestapel, Nachziehstapel und Richtungsring */}
      <div className="uno-center-area my-auto">
        {/* Richtungsring */}
        <div className={`uno-direction-ring ${state.direction === -1 ? 'reverse' : ''}`} />

        {/* Nachziehstapel */}
        <div className="flex flex-col items-center gap-1">
          <UnoCardView
            isBack
            side={side}
            size="lg"
            highlight={canDraw && isActor}
            disabled={!canDraw || !isActor}
            onClick={() => onMove({ type: 'draw' })}
            className="hover:scale-105 transition-transform"
          />
          <span className="text-xs font-semibold text-zinc-400">{state.stock.length} Stapel</span>
        </div>

        {/* Ablagestapel */}
        <div className="flex flex-col items-center gap-1">
          <UnoCardView
            card={topDiscard}
            side={side}
            size="lg"
            disabled
            className="shadow-2xl"
          />
          <div
            className="uno-color-badge"
            style={{ backgroundColor: colorHex[state.activeColor] ?? '#18181b' }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
            <span>{colorLabels[state.activeColor] ?? 'Wunschfarbe'}</span>
          </div>
        </div>

        {/* Ausstehende Strafkartenanzeige */}
        {state.pendingDraw > 0 && (
          <div className="absolute -bottom-8 px-4 py-1 rounded-full bg-red-600 text-white font-black text-sm tracking-wide shadow-lg animate-pulse">
            ⚠️ +{state.pendingDraw} Strafkarten ausstehend!
          </div>
        )}
      </div>

      {/* 3. Unterer Bereich: Eigene Hand und Aktionen */}
      <div className="w-full flex flex-col items-center gap-2">
        {/* Aktionsleiste (Passen / "EINS!"-Button) */}
        <div className="flex items-center justify-between w-full px-4 max-w-lg">
          {canPass ? (
            <button
              type="button"
              onClick={() => onMove({ type: 'pass' })}
              className="px-4 py-1.5 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 text-sm font-bold shadow active:scale-95 cursor-pointer"
            >
              Passen
            </button>
          ) : (
            <div />
          )}

          {/* Großer EINS!-Button bei 2 Handkarten */}
          {myHand.length === 2 && isActor && (
            <button
              type="button"
              onClick={() => setCallUnoToggled((v) => !v)}
              className={`uno-call-btn px-5 py-2 rounded-full font-black text-sm tracking-wider shadow-xl transition-all cursor-pointer ${
                callUnoToggled
                  ? 'bg-yellow-400 text-zinc-950 ring-4 ring-yellow-200'
                  : 'bg-red-600 text-white hover:bg-red-500'
              }`}
            >
              {callUnoToggled ? '✓ EINS! aktiviert' : '🚨 EINS! rufen'}
            </button>
          )}
        </div>

        {/* Handkarten-Fächer */}
        <div className="uno-hand-container">
          {myHand.map((card: UnoCard) => {
            const isPlayable = playableCardIds.has(card.id);
            return (
              <div key={card.id} className="uno-hand-card-wrapper">
                <UnoCardView
                  card={card}
                  side={side}
                  size="md"
                  highlight={isPlayable}
                  disabled={!isPlayable}
                  onClick={() => handleCardClick(card)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Farbwahl-Modal bei Jokern */}
      {selectedWildCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/20 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full text-center">
            <h3 className="text-lg font-extrabold text-white">Wähle eine Wunschfarbe</h3>
            <div className="grid grid-cols-2 gap-3 w-full">
              {availableColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  className="py-3 rounded-xl font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer border border-white/30"
                  style={{ backgroundColor: colorHex[color] }}
                >
                  {colorLabels[color]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSelectedWildCard(null)}
              className="text-xs text-zinc-400 hover:text-white mt-1 cursor-pointer"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const gameUi: GameUi<UnoState, UnoMove> = {
  Board: UnoBoard,
  SeatSymbol: ({ className }) => <span className={className}>🃏</span>,
  seatLabel: (seat) => `Spieler ${Number(seat) + 1}`,
  seatDetail: (view, seat) => {
    const s = Number(seat);
    const count = view.hands[s]?.length ?? 0;
    return `${count} ${count === 1 ? 'Karte (Eins!)' : 'Karten'}`;
  },
  sounds: {
    drewCard: 'karte-ziehen',
    drewPenalty: 'leben-weg',
    calledUno: 'ansage',
    caughtUno: 'zweifeln',
    skip: 'karte-legen',
    reverse: 'karte-legen',
    flip: 'drachen-karte-ziehen',
    win: 'sieg',
  },
};
