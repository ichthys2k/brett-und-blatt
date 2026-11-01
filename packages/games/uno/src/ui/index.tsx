import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SeatRing, CardFan, useCallDeadline, useElementSize, usePointerDrag, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { getActiveFace } from '../rules';
import { DARK_COLORS, LIGHT_COLORS, type UnoCard, type UnoColor, type UnoMove, type UnoState } from '../types';
import './styles.css';
import { UnoCardView } from './UnoCard';

interface FlyingCard {
  id: string;
  card?: UnoCard;
  isBack?: boolean;
  side: 'light' | 'dark';
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  endX: number;
  endY: number;
  endWidth: number;
  endHeight: number;
  startRot: number;
  endRot: number;
  startScale: number;
  endScale: number;
  durationMs: number;
  delayMs?: number;
}

/** Handkarten: auf schmalen Bildschirmen 64 px, sonst 80 px breit (wie die Kartengröße „md“). */
const handCardWidth = (containerWidth: number) => (containerWidth >= 600 ? 80 : 64);
/** Wenig Höhe (Handy im Querformat, kleine Bildschirme, viele Spieler): kleinere Karten, Mitspieler in einer Zeile. */
const TIGHT_TABLE_HEIGHT = 480;
const CROWDED_TABLE_HEIGHT = 720;
const TIGHT_HAND_CARD_WIDTH = 48;
/** So viel jeder Handkarte bleibt mindestens sichtbar: die Ecke mit Zahl oder Symbol. */
const HAND_MIN_STEP = 26;
/** Mehr Rückseiten zeichnet der Fächer am Mitspieler nicht; die Zahl daneben nennt den Rest. */
const OPPONENT_FAN_MAX = 20;

function cardTilt(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 9) - 4; // -4° bis +4°
}

/** Kleiner verdeckter Fächer am Mitspieler: zeigt auf einen Blick, wie viele Karten er hält. */
function OpponentHand({ count, side }: { count: number; side: 'light' | 'dark' }) {
  if (count === 0) return null;
  const shown = Math.min(count, OPPONENT_FAN_MAX);
  return (
    <div className="uno-mini-hand" aria-hidden="true">
      <CardFan
        count={shown}
        label=""
        cardWidth={14}
        arc={shown > 1 ? Math.min(40, shown * 5) : 0}
        renderCard={() => <div className={`uno-mini-back ${side === 'dark' ? 'uno-mini-back-dark' : ''}`} />}
      />
    </div>
  );
}

export const UnoBoard: React.FC<BoardProps<UnoState, UnoMove>> = ({
  view: state,
  legalMoves: moves,
  onMove,
  events,
  activeSeat,
  viewer,
  seatNames,
  table,
}) => {
  const [selectedWildCard, setSelectedWildCard] = useState<UnoCard | null>(null);
  const [selectedSevenCard, setSelectedSevenCard] = useState<UnoCard | null>(null);
  const [callUnoToggled, setCallUnoToggled] = useState<boolean>(false);
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const [discardLanding, setDiscardLanding] = useState<boolean>(false);

  const tableRef = useRef<HTMLDivElement | null>(null);
  const [measureTable, { height: tableHeight }] = useElementSize<HTMLDivElement>();
  const bindTable = useCallback(
    (node: HTMLDivElement | null) => {
      tableRef.current = node;
      return measureTable(node);
    },
    [measureTable],
  );
  // Viele Mitspieler brauchen sonst mehrere Reihen, darum dort schon früher kompakt.
  const tight = !table && tableHeight > 0 && tableHeight < (state.hands.length > 5 ? CROWDED_TABLE_HEIGHT : TIGHT_TABLE_HEIGHT);
  const discardRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<HTMLDivElement | null>(null);
  const handRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const seatRefs = useRef<Map<number, HTMLElement>>(new Map());
  const lastCardRectsRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const justDroppedCardIdRef = useRef<string | null>(null);
  const lastProcessedEventsRef = useRef<unknown[] | null>(null);
  const animTimeoutsRef = useRef<number[]>([]);

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

  // Wer die vorletzte Karte gelegt hat, muss binnen 3 Sekunden „Eins!“ rufen – sonst 2 Strafkarten.
  const dueSeats = useMemo(
    () =>
      state.options.callUno === 'on' && state.winner === null
        ? state.hands.flatMap((hand, seat) =>
            hand.length === 1 && !state.eliminated[seat] && !state.unoProtection[seat] ? [seat] : [],
          )
        : [],
    [state.options.callUno, state.winner, state.hands, state.eliminated, state.unoProtection],
  );
  useCallDeadline(dueSeats, (seat) => {
    if (viewer === seat || (activeSeat !== null && activeSeat === viewer)) {
      onMove({ type: 'catchUno', target: seat });
    }
  });

  // Kann der Spieler ziehen?
  const canDraw = moves.some((m) => m.type === 'draw');
  // Kann der Spieler passen?
  const canPass = moves.some((m) => m.type === 'pass');

  const canCallUno = useMemo(
    () =>
      state.options.callUno === 'on' &&
      actor !== null &&
      myHand.length === 1 &&
      !(state.eliminated[actor]) &&
      !state.unoProtection[actor],
    [state.options.callUno, actor, myHand.length, state.eliminated, state.unoProtection],
  );

  // Oberste Karte auf dem Ablagestapel & natürlicher Drehwinkel
  const topDiscard = state.discard[state.discard.length - 1];
  const topTilt = topDiscard ? cardTilt(topDiscard.id) : 0;

  // Cleanup aller Animationstimer beim Unmount
  useEffect(() => {
    return () => {
      for (const t of animTimeoutsRef.current) {
        window.clearTimeout(t);
      }
    };
  }, []);

  // Positionen der aktuellen Handkarten kontinuierlich festhalten
  useEffect(() => {
    if (!tableRef.current) return;
    const tableRect = tableRef.current.getBoundingClientRect();
    for (const [id, el] of cardRefs.current.entries()) {
      const r = el.getBoundingClientRect();
      lastCardRectsRef.current.set(id, {
        x: r.left - tableRect.left,
        y: r.top - tableRect.top,
        width: r.width,
        height: r.height,
      });
    }
  });

  // Klick auf eine Handkarte
  const handleCardClick = useCallback((card: UnoCard) => {
    if (!isActor && state.options.jumpIn !== 'on') return;
    if (!playableCardIds.has(card.id)) return;

    const face = getActiveFace(card, side);

    // Farbwahl bei Joker erforderlich
    if (face.color === 'wild') {
      setSelectedWildCard(card);
      return;
    }

    // 7er-Handtausch bei Option sevenZero
    if (face.type === '7' && state.options.sevenZero === 'on') {
      const otherSeats = state.hands
        .map((_, idx) => idx)
        .filter((idx) => idx !== actor && !state.eliminated[idx]);
      if (otherSeats.length === 1) {
        const willHaveOne = myHand.length === 2;
        onMove({
          type: 'play',
          cardId: card.id,
          targetPlayer: otherSeats[0],
          ...(willHaveOne ? { callUno: callUnoToggled } : {}),
        });
        setCallUnoToggled(false);
      } else if (otherSeats.length > 1) {
        setSelectedSevenCard(card);
      }
      return;
    }

    // Reguläres Legen oder Jump-In
    const moveType = isActor ? 'play' : 'jumpIn';
    const willHaveOne = myHand.length === 2;
    onMove({
      type: moveType,
      cardId: card.id,
      ...(willHaveOne ? { callUno: callUnoToggled } : {}),
    });
    setCallUnoToggled(false);
  }, [isActor, state.options, playableCardIds, side, actor, state.hands, state.eliminated, myHand.length, onMove, callUnoToggled]);

  // Pointer Drag & Drop Hook für Handkarten
  const { dragState, bindDrag } = usePointerDrag<UnoCard>({
    threshold: 8,
    targetAttribute: 'data-drop-target',
    disabled: !isActor && state.options.jumpIn !== 'on',
    onDrop: (card, targetId) => {
      if (targetId === 'discard') {
        justDroppedCardIdRef.current = card.id;
        handleCardClick(card);
        return true;
      }
      return false;
    },
    onClick: (card) => {
      handleCardClick(card);
    },
  });

  // Ereignisse (Legen, Ziehen) animieren
  useEffect(() => {
    if (!events || events.length === 0 || events === lastProcessedEventsRef.current) return;
    lastProcessedEventsRef.current = events;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    const tableRect = tableRef.current?.getBoundingClientRect();
    if (!tableRect) return;

    const discardRect = discardRef.current?.getBoundingClientRect();
    const deckRect = deckRef.current?.getBoundingClientRect();
    const handRect = handRef.current?.getBoundingClientRect();

    const newFlying: FlyingCard[] = [];

    for (const e of events) {
      if (e.type === 'cardPlayed') {
        const ev = e as unknown as { type: 'cardPlayed'; player: number; card: UnoCard; jumpIn?: boolean };

        // Wurde die Karte bereits per Drag abgelegt? Dann keine Doppel-Fluganimation
        if (justDroppedCardIdRef.current === ev.card.id) {
          justDroppedCardIdRef.current = null;
          setDiscardLanding(true);
          const t = window.setTimeout(() => setDiscardLanding(false), 240);
          animTimeoutsRef.current.push(t);
          continue;
        }

        const isMe = ev.player === actor;
        let startRect: { x: number; y: number; width: number; height: number } | null = null;

        if (isMe) {
          const known = lastCardRectsRef.current.get(ev.card.id);
          if (known) {
            startRect = known;
          } else if (handRect) {
            startRect = {
              x: handRect.left - tableRect.left + handRect.width / 2 - 32,
              y: handRect.top - tableRect.top,
              width: 64,
              height: 96,
            };
          }
        } else {
          const seatEl = seatRefs.current.get(ev.player);
          if (seatEl) {
            const sr = seatEl.getBoundingClientRect();
            startRect = {
              x: sr.left - tableRect.left + sr.width / 2 - 32,
              y: sr.top - tableRect.top + sr.height / 2 - 48,
              width: 64,
              height: 96,
            };
          }
        }

        if (!startRect) {
          startRect = {
            x: tableRect.width / 2 - 32,
            y: isMe ? tableRect.height - 110 : 20,
            width: 64,
            height: 96,
          };
        }

        const endX = discardRect ? discardRect.left - tableRect.left : tableRect.width / 2 - 44;
        const endY = discardRect ? discardRect.top - tableRect.top : tableRect.height / 2 - 60;
        const endW = discardRect ? discardRect.width : 88;
        const endH = discardRect ? discardRect.height : 136;

        const animId = `play-${ev.card.id}-${Date.now()}`;
        newFlying.push({
          id: animId,
          card: ev.card,
          side,
          startX: startRect.x,
          startY: startRect.y,
          startWidth: startRect.width,
          startHeight: startRect.height,
          endX,
          endY,
          endWidth: endW,
          endHeight: endH,
          startRot: 0,
          endRot: cardTilt(ev.card.id),
          startScale: 1,
          endScale: endW / (startRect.width || endW),
          durationMs: 280,
        });

        const t = window.setTimeout(() => {
          setFlyingCards((prev) => prev.filter((f) => f.id !== animId));
          setDiscardLanding(true);
          const t2 = window.setTimeout(() => setDiscardLanding(false), 240);
          animTimeoutsRef.current.push(t2);
        }, 280);
        animTimeoutsRef.current.push(t);
      } else if (e.type === 'drewCard' || e.type === 'drewPenalty') {
        const isPenalty = e.type === 'drewPenalty';
        const player = (e as unknown as { player: number }).player;
        const count = isPenalty ? (e as unknown as { count: number }).count : 1;
        const isMe = player === actor;

        const startX = deckRect ? deckRect.left - tableRect.left : tableRect.width / 2 - 100;
        const startY = deckRect ? deckRect.top - tableRect.top : tableRect.height / 2 - 60;
        const startW = deckRect ? deckRect.width : 88;
        const startH = deckRect ? deckRect.height : 136;

        let endX = tableRect.width / 2 - 32;
        let endY = isMe ? tableRect.height - 100 : 20;
        let endW = 64;
        let endH = 96;

        if (isMe && handRect) {
          endX = handRect.left - tableRect.left + handRect.width / 2 - 32;
          endY = handRect.top - tableRect.top + 10;
        } else if (!isMe) {
          const seatEl = seatRefs.current.get(player);
          if (seatEl) {
            const sr = seatEl.getBoundingClientRect();
            endX = sr.left - tableRect.left + sr.width / 2 - 32;
            endY = sr.top - tableRect.top;
          }
        }

        for (let i = 0; i < count; i++) {
          const delayMs = i * 65;
          const animId = `draw-${player}-${Date.now()}-${i}`;
          newFlying.push({
            id: animId,
            isBack: true,
            side,
            startX,
            startY,
            startWidth: startW,
            startHeight: startH,
            endX,
            endY,
            endWidth: endW,
            endHeight: endH,
            startRot: 0,
            endRot: i % 2 === 0 ? -2 : 2,
            startScale: 1,
            endScale: endW / startW,
            durationMs: 260,
            delayMs,
          });

          const t = window.setTimeout(() => {
            setFlyingCards((prev) => prev.filter((f) => f.id !== animId));
          }, delayMs + 260);
          animTimeoutsRef.current.push(t);
        }
      }
    }

    if (newFlying.length > 0) {
      setFlyingCards((prev) => [...prev, ...newFlying]);
    }
  }, [events, actor, side]);

  // Farbwahl bestätigen
  const handleColorSelect = (chosenColor: UnoColor) => {
    if (!selectedWildCard) return;
    const willHaveOne = myHand.length === 2;
    onMove({
      type: 'play',
      cardId: selectedWildCard.id,
      chosenColor,
      ...(willHaveOne ? { callUno: callUnoToggled } : {}),
    });
    setSelectedWildCard(null);
    setCallUnoToggled(false);
  };

  // 7er-Tauschziel bestätigen
  const handleSevenTargetSelect = (targetPlayer: number) => {
    if (!selectedSevenCard) return;
    const willHaveOne = myHand.length === 2;
    onMove({
      type: 'play',
      cardId: selectedSevenCard.id,
      targetPlayer,
      ...(willHaveOne ? { callUno: callUnoToggled } : {}),
    });
    setSelectedSevenCard(null);
    setCallUnoToggled(false);
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

  const opponents = (
    <>
      {/* 1. Obere Leiste: Mitspieler & Richtungsanzeige */}
      <div className={`w-full flex items-center gap-2 bg-black/10 rounded-xl ${tight ? 'flex-none overflow-x-auto p-1' : 'flex-wrap justify-around p-2'}`}>
        {state.hands.map((hand: UnoCard[], idx: number) => {
          if (idx === actor) return null; // Eigene Hand ist unten
          const isTurn = state.turn === idx;
          const isEliminated = state.eliminated[idx];
          const hasUno = hand.length === 1;

          return (
            <div
              key={idx}
              ref={(el) => {
                if (el) seatRefs.current.set(idx, el);
                else seatRefs.current.delete(idx);
              }}
              className={`flex flex-none items-center gap-2 rounded-lg border transition-all ${tight ? 'px-2 py-0.5' : 'px-3 py-1.5'} ${
                isTurn ? 'border-yellow-400 bg-yellow-400/20 font-bold' : 'border-white/10 bg-black/20'
              } ${isEliminated ? 'opacity-40 line-through' : ''}`}
            >
              <OpponentHand count={hand.length} side={side} />
              <div className="flex flex-col text-left">
                <span className="text-xs sm:text-sm opacity-90">
                  {seatNames[idx] ?? `Spieler ${idx + 1}`}
                </span>
                <span className="text-xs opacity-70">{hand.length} Karten</span>
              </div>

              {/* Eins!-Warnung / Anprangern */}
              {hasUno && (
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 text-xs font-black rounded bg-red-600 text-white animate-bounce">
                    Eins!
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </>
  );

  const center = (
    <>
      {/* 2. Tischmitte: Ablagestapel, Nachziehstapel und Richtungsring */}
      <div className="uno-center-area my-auto">
        {/* Richtungsring */}
        <div className={`uno-direction-ring ${state.direction === -1 ? 'reverse' : ''}`} />

        {/* Nachziehstapel */}
        <div ref={deckRef} className="flex flex-col items-center gap-1">
          <UnoCardView
            isBack
            side={side}
            size={tight ? 'md' : 'lg'}
            highlight={canDraw && isActor}
            disabled={!canDraw || !isActor}
            onClick={() => onMove({ type: 'draw' })}
            className="hover:scale-105 transition-transform cursor-pointer"
          />
          <span className="text-xs font-semibold text-zinc-400">
            {canDraw && isActor
              ? state.pendingDraw > 0
                ? `+${state.pendingDraw} ziehen (${state.stock.length})`
                : `Ziehen (${state.stock.length})`
              : `${state.stock.length} Stapel`}
          </span>
        </div>

        {/* Ablagestapel mit Drop-Zone */}
        <div
          ref={discardRef}
          data-drop-target="discard"
          className={`uno-discard-zone flex flex-col items-center gap-1 ${
            dragState.isDragging && dragState.targetId === 'discard' ? 'drag-over' : ''
          } ${discardLanding ? 'uno-card-landing' : ''}`}
        >
          <div style={{ transform: `rotate(${topTilt}deg)` }} className="transition-transform duration-200">
            <UnoCardView
              card={topDiscard}
              side={side}
              size={tight ? 'md' : 'lg'}
              mathMode={state.options.mathLabels === 'on'}
              disabled
              className="shadow-2xl"
            />
          </div>
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

    </>
  );

  const own = (
    <>
      {/* 3. Unterer Bereich: Eigene Hand und Aktionen */}
      <div ref={handRef} className="w-full flex flex-col items-center gap-2">
        {/* Aktionsleiste (Ziehen / Passen / "EINS!"-Button) */}
        <div className="flex items-center justify-between w-full px-4 max-w-lg min-h-10">
          {canPass && isActor ? (
            <button
              type="button"
              onClick={() => onMove({ type: 'pass' })}
              className="px-4 py-1.5 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 text-sm font-bold shadow active:scale-95 cursor-pointer"
            >
              Passen
            </button>
          ) : canDraw && isActor ? (
            <button
              type="button"
              onClick={() => onMove({ type: 'draw' })}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold shadow active:scale-95 cursor-pointer transition-all ${
                playableCardIds.size === 0
                  ? 'bg-yellow-500 text-zinc-950 hover:bg-yellow-400 ring-2 ring-yellow-300'
                  : 'bg-zinc-700 text-white hover:bg-zinc-600'
              }`}
            >
              {state.pendingDraw > 0 ? `+${state.pendingDraw} Strafkarten ziehen` : 'Karte ziehen'}
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

          {canCallUno && (
            <button
              type="button"
              onClick={() => onMove({ type: 'callUno' })}
              className="uno-call-btn px-5 py-2 rounded-full font-black text-sm tracking-wider shadow-xl transition-all cursor-pointer bg-yellow-400 text-zinc-950 ring-4 ring-yellow-200"
            >
              📣 EINS! rufen
            </button>
          )}
        </div>

        {/* Handkarten-Fächer mit Pointer Drag & Drop – bricht um, damit jede Karte sichtbar bleibt */}
        <div className="uno-hand-container">
          <CardFan
            count={myHand.length}
            label="Deine Handkarten"
            cardWidth={tight ? TIGHT_HAND_CARD_WIDTH : handCardWidth}
            cardAspect={1.5}
            minStep={HAND_MIN_STEP}
            maxRows={4}
            rowOverlap={0.55}
            keyOf={(index) => myHand[index]!.id}
            renderCard={(index) => {
              const card = myHand[index]!;
              const isPlayable = playableCardIds.has(card.id);
              const isCardDragged = dragState.isDragging && dragState.item?.id === card.id;
              const isCardSnapping = dragState.snapping && dragState.item?.id === card.id;

              const dragStyle: React.CSSProperties = isCardDragged
                ? {
                    transform: `translate3d(${dragState.delta.x}px, ${dragState.delta.y}px, 0) scale(1.1) rotate(3deg)`,
                    zIndex: 60,
                    touchAction: 'none',
                  }
                : isCardSnapping
                  ? {
                      transform: 'translate3d(0, 0, 0)',
                      zIndex: 60,
                    }
                  : {};

              const dragProps = isPlayable && (isActor || state.options.jumpIn === 'on') ? bindDrag(card) : {};

              return (
                <div
                  ref={(el) => {
                    if (el) cardRefs.current.set(card.id, el);
                    else cardRefs.current.delete(card.id);
                  }}
                  className={`uno-hand-card-wrapper ${isCardDragged ? 'uno-card-dragging' : ''} ${
                    isCardSnapping ? 'uno-card-snapping' : ''
                  }`}
                  style={dragStyle}
                  {...dragProps}
                >
                  <UnoCardView
                    card={card}
                    side={side}
                    size="md"
                    mathMode={state.options.mathLabels === 'on'}
                    highlight={isPlayable}
                    disabled={!isPlayable}
                    onClick={() => !dragState.isDragging && handleCardClick(card)}
                  />
                </div>
              );
            }}
          />
        </div>
      </div>

    </>
  );

  return (
    <div ref={bindTable} className={`uno-table ${isDark ? 'bg-zinc-950 text-white' : 'text-zinc-900'}`} data-tight={tight || undefined} data-around={table ? '' : undefined}>
      {/* 0. Animation Layer für fliegende Karten */}
      <div className="uno-flying-layer">
        {flyingCards.map((fc) => (
          <div
            key={fc.id}
            className="uno-flying-card"
            style={
              {
                '--fly-start-x': `${fc.startX}px`,
                '--fly-start-y': `${fc.startY}px`,
                '--fly-end-x': `${fc.endX}px`,
                '--fly-end-y': `${fc.endY}px`,
                '--fly-rot-start': `${fc.startRot}deg`,
                '--fly-rot-end': `${fc.endRot}deg`,
                '--fly-scale-start': fc.startScale,
                '--fly-scale-end': fc.endScale,
                animationDelay: fc.delayMs ? `${fc.delayMs}ms` : undefined,
                animationDuration: `${fc.durationMs}ms`,
                width: fc.startWidth,
                height: fc.startHeight,
              } as React.CSSProperties
            }
          >
            <UnoCardView
              card={fc.card}
              isBack={fc.isBack}
              side={fc.side}
              size={fc.isBack ? 'lg' : 'lg'}
              mathMode={state.options.mathLabels === 'on'}
              disabled
            />
          </div>
        ))}
      </div>

      {table ? (
        <SeatRing
          seats={state.hands.length}
          bottomSeat={actor ?? 0}
          status={table.status}
          bottom={own}
          renderSeat={(seat) => (
            <div
              ref={(el) => {
                if (el) seatRefs.current.set(seat, el);
                else seatRefs.current.delete(seat);
              }}
              className={`flex w-full flex-col items-center gap-1 ${state.eliminated[seat] ? 'opacity-40' : ''}`}
            >
              {seat !== actor && <OpponentHand count={state.hands[seat]?.length ?? 0} side={side} />}
              {table.seatChip(seat)}
              {state.hands[seat]?.length === 1 && <span className="px-1.5 py-0.5 text-xs font-black rounded bg-red-600 text-white">Eins!</span>}
            </div>
          )}
        >
          {center}
        </SeatRing>
      ) : (
        <>
          {opponents}
          {center}
          {own}
        </>
      )}

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

      {/* 5. 7er-Handtausch Modal */}
      {selectedSevenCard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/20 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full text-center">
            <h3 className="text-lg font-extrabold text-white">Mit wem Handkarten tauschen?</h3>
            <div className="flex flex-col gap-2 w-full">
              {state.hands
                .map((hand, idx) => ({ hand, idx }))
                .filter(({ idx }) => idx !== actor && !state.eliminated[idx])
                .map(({ hand, idx }) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSevenTargetSelect(idx)}
                    className="py-2.5 px-4 rounded-xl font-bold text-white bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-between border border-white/20 cursor-pointer"
                  >
                    <span>{seatNames[idx] ?? `Spieler ${idx + 1}`}</span>
                    <span className="text-xs text-zinc-400 font-normal">{hand.length} Karten</span>
                  </button>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setSelectedSevenCard(null)}
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
  seatsAround: true,
  SeatSymbol: ({ className }) => <span className={className}>🃏</span>,
  seatLabel: (seat) => `Spieler ${Number(seat) + 1}`,
  seatDetail: (view, seat) => {
    const s = Number(seat);
    const count = view.hands[s]?.length ?? 0;
    return `${count} ${count === 1 ? 'Karte (Eins!)' : 'Karten'}`;
  },
  sounds: {
    cardPlayed: 'karte-legen',
    drewCard: 'karte-ziehen',
    drewPenalty: 'strafe-ziehen',
    calledUno: 'ruf-eins',
    caughtUno: 'zweifeln',
    skip: 'aussetzen',
    reverse: 'richtungswechsel',
    flip: 'drachen-karte-ziehen',
  },
};
