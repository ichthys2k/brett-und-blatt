import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cardRank, type CardId, type Suit } from '@brett-und-blatt/engine';
import {
  CardFan,
  useCallDeadline,
  PlayingCard,
  SuitShape,
  usePointerDrag,
  type BoardProps,
  type GameUi,
} from '@brett-und-blatt/ui';
import { getNextPlayer } from '../rules';
import type { MauMauDeckStyle, MauMauMove, MauMauState } from '../types';
import './styles.css';

/** Breite der Handkarten nach verfügbarem Platz (vorher per CSS: 3,1–4,75 rem). */
const handCardWidth = (containerWidth: number) => Math.round(Math.min(76, Math.max(50, containerWidth * 0.16)));
/** Anteil jeder Handkarte, der mindestens sichtbar bleibt: die Ecke mit Wert und Farbe. */
const HAND_MIN_VISIBLE = 0.4;
/** Mehr Rückseiten zeichnet der Fächer am Mitspieler nicht; die Zahl daneben nennt den Rest. */
const OPPONENT_FAN_MAX = 20;

interface FlyingCard {
  id: string;
  card?: CardId;
  isBack?: boolean;
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
  durationMs: number;
  delayMs?: number;
}

const SUIT_LABELS: Record<MauMauDeckStyle, Record<Suit, string>> = {
  french: { C: 'Kreuz', D: 'Karo', H: 'Herz', S: 'Pik' },
  'four-color': { C: 'Kreuz', D: 'Karo', H: 'Herz', S: 'Pik' },
  german: { C: 'Eichel', D: 'Schellen', H: 'Herz', S: 'Gras' },
  bavarian: { C: 'Eichel', D: 'Schellen', H: 'Herz', S: 'Gras' },
  simple: { C: 'Grün', D: 'Gelb', H: 'Rot', S: 'Blau' },
};

const SUIT_COLORS: Record<Suit, string> = {
  C: '#1f2328',
  D: '#d97706',
  H: '#c62828',
  S: '#2e7d32',
};

const SEAT_SYMBOLS = ['♠', '♥', '♦', '♣', '★'];

function cardTilt(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 7) - 3;
}

function suitLabel(style: MauMauDeckStyle, suit: Suit): string {
  return SUIT_LABELS[style][suit];
}

function SuitIcon({ suit, style, className = '' }: { suit: Suit; style: MauMauDeckStyle; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill={SUIT_COLORS[suit]} aria-hidden="true">
      <SuitShape suit={suit} deckStyle={style} />
    </svg>
  );
}

export const MauMauBoard: React.FC<BoardProps<MauMauState, MauMauMove>> = ({
  view: state,
  legalMoves: moves,
  onMove,
  events,
  activeSeat,
  viewer,
  seatNames,
}) => {
  const [selectedJack, setSelectedJack] = useState<CardId | null>(null);
  const [callMauToggled, setCallMauToggled] = useState(false);
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const [discardLanding, setDiscardLanding] = useState(false);

  const tableRef = useRef<HTMLDivElement | null>(null);
  const discardRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<HTMLDivElement | null>(null);
  const handRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<CardId, HTMLElement>>(new Map());
  const seatRefs = useRef<Map<number, HTMLElement>>(new Map());
  const lastCardRectsRef = useRef<Map<CardId, { x: number; y: number; width: number; height: number }>>(new Map());
  const justDroppedCardIdRef = useRef<CardId | null>(null);
  const lastProcessedEventsRef = useRef<unknown[] | null>(null);
  const animTimeoutsRef = useRef<number[]>([]);

  const actor = typeof viewer === 'number' ? viewer : null;
  const isActor = activeSeat !== null && activeSeat === actor;
  const myHand: CardId[] = actor !== null ? state.hands[actor] ?? [] : [];
  const deckStyle = state.options.deckStyle;

  const playMoves = useMemo(
    () => moves.filter((m): m is Extract<MauMauMove, { type: 'play' }> => m.type === 'play'),
    [moves],
  );

  const playableCardIds = useMemo(() => new Set(playMoves.map((m) => m.cardId)), [playMoves]);

  const canCallMau = useMemo(
    () =>
      state.options.mauCall === 'on' &&
      actor !== null &&
      myHand.length === 1 &&
      !state.mauProtection[actor],
    [state.options.mauCall, actor, myHand.length, state.mauProtection],
  );

  // Wer die vorletzte Karte gelegt hat, muss binnen 3 Sekunden „Mau!“ rufen – sonst 2 Strafkarten.
  // Zuständig ist der Platz selbst oder, wer gerade am Gerät handelt (Hot-Seat, Bot-Gegner).
  const dueSeats = useMemo(
    () =>
      state.options.mauCall === 'on' && state.winner === null
        ? state.hands.flatMap((hand, seat) => (hand.length === 1 && !state.mauProtection[seat] ? [seat] : []))
        : [],
    [state.options.mauCall, state.winner, state.hands, state.mauProtection],
  );
  useCallDeadline(dueSeats, (seat) => {
    if (viewer === seat || (activeSeat !== null && activeSeat === viewer)) {
      onMove({ type: 'catchMau', target: seat });
    }
  });

  const canDraw = moves.some((m) => m.type === 'draw');
  const canPass = moves.some((m) => m.type === 'pass');
  const topDiscard = state.discard[state.discard.length - 1];
  const topTilt = topDiscard ? cardTilt(topDiscard) : 0;
  const nextSeat = getNextPlayer(state.turn, state.direction, state.hands.length);

  useEffect(() => {
    return () => {
      for (const timeout of animTimeoutsRef.current) window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!tableRef.current) return;
    const tableRect = tableRef.current.getBoundingClientRect();
    for (const [id, el] of cardRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      lastCardRectsRef.current.set(id, {
        x: rect.left - tableRect.left,
        y: rect.top - tableRect.top,
        width: rect.width,
        height: rect.height,
      });
    }
  });

  const pushTimeout = (callback: () => void, ms: number) => {
    const timeout = window.setTimeout(callback, ms);
    animTimeoutsRef.current.push(timeout);
  };

  const performPlay = useCallback(
    (cardId: CardId, chosenSuit?: Suit) => {
      const willHaveOne = myHand.length === 2;
      onMove({
        type: 'play',
        cardId,
        ...(chosenSuit ? { chosenSuit } : {}),
        ...(willHaveOne ? { callMau: callMauToggled } : {}),
      });
      setCallMauToggled(false);
    },
    [callMauToggled, myHand.length, onMove],
  );

  const handleCardClick = useCallback(
    (cardId: CardId) => {
      if (!isActor || !playableCardIds.has(cardId)) return;
      const card = myHand.find((c) => c === cardId);
      if (!card) return;

      if (cardRank(card) === 11 && myHand.length > 1) {
        setSelectedJack(cardId);
        return;
      }
      performPlay(cardId);
    },
    [isActor, myHand, performPlay, playableCardIds],
  );

  const { dragState, bindDrag } = usePointerDrag<CardId>({
    threshold: 8,
    targetAttribute: 'data-drop-target',
    disabled: !isActor,
    onDrop: (cardId, targetId) => {
      if (targetId !== 'discard') return false;
      if (!playableCardIds.has(cardId)) return false;
      justDroppedCardIdRef.current = cardId;
      handleCardClick(cardId);
      return true;
    },
    onClick: (cardId) => handleCardClick(cardId),
  });

  // Flug-Animationen aus den Ereignissen des letzten Zuges.
  useEffect(() => {
    if (!events || events.length === 0 || events === lastProcessedEventsRef.current) return;
    lastProcessedEventsRef.current = events;

    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const tableRect = tableRef.current?.getBoundingClientRect();
    if (!tableRect) return;
    const discardRect = discardRef.current?.getBoundingClientRect();
    const deckRect = deckRef.current?.getBoundingClientRect();
    const handRect = handRef.current?.getBoundingClientRect();
    const newFlying: FlyingCard[] = [];

    for (const event of events) {
      if (event.type === 'cardPlayed') {
        const played = event as unknown as { type: 'cardPlayed'; player: number; card: CardId };
        if (justDroppedCardIdRef.current === played.card) {
          justDroppedCardIdRef.current = null;
          setDiscardLanding(true);
          pushTimeout(() => setDiscardLanding(false), 240);
          continue;
        }

        const isMe = played.player === actor;
        let startRect: { x: number; y: number; width: number; height: number } | null = null;
        if (isMe) {
          startRect = lastCardRectsRef.current.get(played.card) ?? null;
          if (!startRect && handRect) {
            startRect = {
              x: handRect.left - tableRect.left + handRect.width / 2 - 30,
              y: handRect.top - tableRect.top,
              width: 60,
              height: 84,
            };
          }
        } else {
          const seatEl = seatRefs.current.get(played.player);
          if (seatEl) {
            const rect = seatEl.getBoundingClientRect();
            startRect = {
              x: rect.left - tableRect.left + rect.width / 2 - 30,
              y: rect.top - tableRect.top + rect.height / 2 - 42,
              width: 60,
              height: 84,
            };
          }
        }

        if (!startRect) {
          startRect = {
            x: tableRect.width / 2 - 30,
            y: isMe ? tableRect.height - 100 : 16,
            width: 60,
            height: 84,
          };
        }

        const endX = discardRect ? discardRect.left - tableRect.left : tableRect.width / 2 - 40;
        const endY = discardRect ? discardRect.top - tableRect.top : tableRect.height / 2 - 56;
        const endW = discardRect ? discardRect.width : 80;
        const endH = discardRect ? discardRect.height : 112;
        const animationId = `play-${played.card}-${Date.now()}`;

        newFlying.push({
          id: animationId,
          card: played.card,
          startX: startRect.x,
          startY: startRect.y,
          startWidth: startRect.width,
          startHeight: startRect.height,
          endX,
          endY,
          endWidth: endW,
          endHeight: endH,
          startRot: 0,
          endRot: cardTilt(played.card),
          durationMs: 280,
        });

        pushTimeout(() => {
          setFlyingCards((previous) => previous.filter((card) => card.id !== animationId));
          setDiscardLanding(true);
          pushTimeout(() => setDiscardLanding(false), 240);
        }, 280);
      } else if (event.type === 'drewCard' || event.type === 'drewPenalty') {
        const drawEvent = event as unknown as { type: string; player: number; count?: number };
        const count = Math.max(1, drawEvent.count ?? 1);
        const isMe = drawEvent.player === actor;
        const startX = deckRect ? deckRect.left - tableRect.left : tableRect.width / 2 - 90;
        const startY = deckRect ? deckRect.top - tableRect.top : tableRect.height / 2 - 56;
        const startW = deckRect ? deckRect.width : 80;
        const startH = deckRect ? deckRect.height : 112;

        let endX = tableRect.width / 2 - 30;
        let endY = isMe ? tableRect.height - 100 : 16;
        let endW = 60;
        let endH = 84;

        if (isMe && handRect) {
          endX = handRect.left - tableRect.left + handRect.width / 2 - 30;
          endY = handRect.top - tableRect.top + 8;
        } else if (!isMe) {
          const seatEl = seatRefs.current.get(drawEvent.player);
          if (seatEl) {
            const rect = seatEl.getBoundingClientRect();
            endX = rect.left - tableRect.left + rect.width / 2 - 30;
            endY = rect.top - tableRect.top;
          }
        }

        for (let index = 0; index < count; index++) {
          const delayMs = index * 65;
          const animationId = `draw-${drawEvent.player}-${Date.now()}-${index}`;
          newFlying.push({
            id: animationId,
            isBack: true,
            startX,
            startY,
            startWidth: startW,
            startHeight: startH,
            endX,
            endY,
            endWidth: endW,
            endHeight: endH,
            startRot: 0,
            endRot: index % 2 === 0 ? -2 : 2,
            durationMs: 260,
            delayMs,
          });
          pushTimeout(() => {
            setFlyingCards((previous) => previous.filter((card) => card.id !== animationId));
          }, delayMs + 260);
        }
      }
    }

    if (newFlying.length > 0) setFlyingCards((previous) => [...previous, ...newFlying]);
  }, [actor, events]);

  const handleSuitSelect = (suit: Suit) => {
    if (!selectedJack) return;
    performPlay(selectedJack, suit);
    setSelectedJack(null);
  };

  return (
    <div ref={tableRef} className="mau-table">
      <div className="mau-flying-layer">
        {flyingCards.map((card) => (
          <div
            key={card.id}
            className="mau-flying-card"
            style={
              {
                '--fly-start-x': `${card.startX}px`,
                '--fly-start-y': `${card.startY}px`,
                '--fly-end-x': `${card.endX}px`,
                '--fly-end-y': `${card.endY}px`,
                '--fly-rot-start': `${card.startRot}deg`,
                '--fly-rot-end': `${card.endRot}deg`,
                animationDelay: card.delayMs ? `${card.delayMs}ms` : undefined,
                animationDuration: `${card.durationMs}ms`,
                width: card.startWidth,
                height: card.startHeight,
              } as React.CSSProperties
            }
          >
            <PlayingCard card={card.isBack ? null : card.card ?? null} deckStyle={deckStyle} />
          </div>
        ))}
      </div>

      {/* Mitspieler */}
      <div className="mau-opponents">
        {state.hands.map((hand, index) => {
          if (index === actor) return null;
          const isTurn = state.turn === index;
          const hasOne = hand.length === 1;

          return (
            <div
              key={index}
              ref={(el) => {
                if (el) seatRefs.current.set(index, el);
                else seatRefs.current.delete(index);
              }}
              className={`mau-opponent ${isTurn ? 'mau-opponent-active' : ''}`}
              title={`${seatNames[index] ?? `Platz ${index + 1}`}: ${hand.length} Karten`}
            >
              <div className="mau-opponent-hand" aria-hidden="true">
                {hand.length > 0 && (
                  <CardFan
                    count={Math.min(hand.length, OPPONENT_FAN_MAX)}
                    label=""
                    cardWidth={16}
                    arc={hand.length > 1 ? Math.min(40, hand.length * 5) : 0}
                    renderCard={() => <PlayingCard card={null} deckStyle={deckStyle} />}
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold sm:text-sm">
                  {seatNames[index] ?? `Platz ${index + 1}`}
                </p>
                <p className="text-[11px] text-white/65">{hand.length} Karten</p>
              </div>
              {hasOne && <span className="mau-badge">Mau!</span>}
            </div>
          );
        })}
      </div>

      {/* Tischmitte */}
      <div className="mau-center">
        <div className="mau-direction" data-reverse={state.direction === -1 ? 'true' : undefined}>
          <span>{state.direction === 1 ? '↻' : '↺'}</span>
          <small>{state.direction === 1 ? 'im Uhrzeigersinn' : 'gegen den Uhrzeigersinn'}</small>
        </div>

        <div className="mau-piles">
          <div ref={deckRef} className="mau-pile">
            <PlayingCard
              card={null}
              deckStyle={deckStyle}
              onClick={canDraw && isActor ? () => onMove({ type: 'draw' }) : undefined}
              className={canDraw && isActor ? 'mau-pile-clickable' : ''}
            />
            <span>
              {canDraw && isActor
                ? state.pendingDraw > 0
                  ? `+${state.pendingDraw} ziehen`
                  : 'Karte ziehen'
                : `Talon (${state.stock.length})`}
            </span>
          </div>

          <div
            ref={discardRef}
            data-drop-target="discard"
            className={`mau-pile mau-discard ${dragState.isDragging && dragState.targetId === 'discard' ? 'mau-drag-over' : ''} ${
              discardLanding ? 'mau-card-landing' : ''
            }`}
          >
            <div style={{ transform: `rotate(${topTilt}deg)` }} className="mau-top-card">
              {topDiscard ? <PlayingCard card={topDiscard} deckStyle={deckStyle} /> : null}
            </div>
            <span>Ablage</span>
          </div>

          <div className="mau-suit">
            <SuitIcon suit={state.activeSuit} style={deckStyle} className="h-7 w-7" />
            <span>{suitLabel(deckStyle, state.activeSuit)}</span>
            <small>{state.pendingDraw > 0 ? `+${state.pendingDraw} offen` : 'aktuelle Farbe'}</small>
          </div>
        </div>

        {state.lastAction && <div className="mau-last-action">{state.lastAction.text}</div>}
        {state.pendingDraw > 0 && (
          <div className="mau-penalty">
            {nextSeat === actor
              ? `Du musst ${state.pendingDraw} Karten ziehen oder mit einer 7 weiterreichen.`
              : `${seatNames[nextSeat] ?? `Platz ${nextSeat + 1}`} muss ${state.pendingDraw} Karten ziehen oder eine 7 legen.`}
          </div>
        )}
      </div>

      {/* Eigene Hand */}
      <div ref={handRef} className="mau-hand-area">
        <div className="mau-actions">
          {canPass && isActor ? (
            <button type="button" className="mau-button mau-button-muted" onClick={() => onMove({ type: 'pass' })}>
              Passen
            </button>
          ) : canDraw && isActor ? (
            <button
              type="button"
              className={`mau-button ${playMoves.length === 0 ? 'mau-button-warn' : 'mau-button-muted'}`}
              onClick={() => onMove({ type: 'draw' })}
            >
              {state.pendingDraw > 0 ? `${state.pendingDraw} Strafkarten ziehen` : 'Karte ziehen'}
            </button>
          ) : (
            <span />
          )}

          {myHand.length === 2 && isActor && state.options.mauCall === 'on' && (
            <button
              type="button"
              className={`mau-call ${callMauToggled ? 'mau-call-active' : ''}`}
              onClick={() => setCallMauToggled((value) => !value)}
            >
              {callMauToggled ? '✓ Mau! gerufen' : 'Mau! rufen'}
            </button>
          )}

          {canCallMau && (
            <button
              type="button"
              className="mau-call mau-call-active"
              onClick={() => onMove({ type: 'callMau' })}
            >
              📣 Mau! rufen
            </button>
          )}
        </div>

        <div className="mau-hand">
          <CardFan
            count={myHand.length}
            label="Deine Handkarten"
            cardWidth={handCardWidth}
            minStep={(width) => width * HAND_MIN_VISIBLE}
            rowOverlap={0.55}
            keyOf={(index) => myHand[index]!}
            renderCard={(index) => {
              const card = myHand[index]!;
              const isPlayable = playableCardIds.has(card);
              const isDragged = dragState.isDragging && dragState.item === card;
              const isSnapping = dragState.snapping && dragState.item === card;
              const dragStyle: React.CSSProperties = isDragged
                ? {
                    transform: `translate3d(${dragState.delta.x}px, ${dragState.delta.y}px, 0) scale(1.08) rotate(2deg)`,
                    zIndex: 60,
                    pointerEvents: 'none',
                  }
                : isSnapping
                  ? { transform: 'translate3d(0, 0, 0)', zIndex: 60 }
                  : {};

              return (
                <div
                  ref={(el) => {
                    if (el) cardRefs.current.set(card, el);
                    else cardRefs.current.delete(card);
                  }}
                  className={`mau-hand-card ${isDragged ? 'mau-card-dragging' : ''} ${
                    isSnapping ? 'mau-card-snapping' : ''
                  }`}
                  style={dragStyle}
                  {...(isPlayable && isActor ? bindDrag(card) : {})}
                >
                  <PlayingCard
                    card={card}
                    deckStyle={deckStyle}
                    highlight={isPlayable ? 'hint' : null}
                    onClick={() => !dragState.isDragging && handleCardClick(card)}
                  />
                </div>
              );
            }}
          />
        </div>
      </div>

      {/* Wunschfarbe */}
      {selectedJack && (
        <div className="mau-modal-backdrop" role="dialog" aria-modal="true" aria-label="Wunschfarbe wählen">
          <div className="mau-modal">
            <h3>Welche Farbe wünschst du dir?</h3>
            <div className="mau-suit-grid">
              {(['C', 'D', 'H', 'S'] as const).map((suit) => (
                <button
                  key={suit}
                  type="button"
                  onClick={() => handleSuitSelect(suit)}
                  className="mau-suit-choice"
                  style={{ borderColor: SUIT_COLORS[suit] }}
                >
                  <SuitIcon suit={suit} style={deckStyle} className="h-9 w-9" />
                  <span>{suitLabel(deckStyle, suit)}</span>
                </button>
              ))}
            </div>
            <button type="button" className="mau-cancel" onClick={() => setSelectedJack(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const gameUi: GameUi<MauMauState, MauMauMove> = {
  Board: MauMauBoard,
  SeatSymbol: ({ seat, className }) => (
    <span className={className}>{SEAT_SYMBOLS[Number(seat) % SEAT_SYMBOLS.length]}</span>
  ),
  seatLabel: (seat) => `Platz ${Number(seat) + 1}`,
  seatDetail: (view, seat) => {
    const count = view.hands[Number(seat)]?.length ?? 0;
    return `${count} ${count === 1 ? 'Karte (Mau!)' : 'Karten'}`;
  },
  sounds: {
    cardPlayed: 'karte-legen',
    drewCard: 'karte-ziehen',
    drewPenalty: 'strafe-ziehen',
    calledMau: 'ruf-mau',
    caughtMau: 'zweifeln',
    skip: 'aussetzen',
    reverse: 'richtungswechsel',
    wishSuit: 'ansage',
    extraTurn: 'karte-legen',
  },
};


