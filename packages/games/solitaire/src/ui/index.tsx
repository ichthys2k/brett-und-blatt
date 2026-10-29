import { cardRank, SUITS, type CardId, type DeckStyle, type SeatId, type Suit } from '@brett-und-blatt/engine';
import {
  PlayingCard,
  SuitShape,
  useElementSize,
  usePointerDrag,
  useSpawnAnimation,
  type BoardProps,
  type DragState,
  type GameUi,
} from '@brett-und-blatt/ui';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { isFree, rowOf, rowStart } from '../pyramid';
import { sameLoc, type Loc, type Pile, type PyramidLoc, type SolitaireMove, type SolitaireState } from '../types';
import './styles.css';

type MoveMove = Extract<SolitaireMove, { type: 'move' }>;
type Highlight = 'target' | 'hint' | null;

interface SolitaireDragItem {
  loc: Loc;
  count: number;
  card: CardId;
  cards: CardId[];
}

function locToTargetId(loc: Loc): string {
  if (loc.kind === 'waste') return 'waste';
  return `${loc.kind}-${loc.index}`;
}

interface Placed {
  key: string;
  card: CardId | null;
  x: number;
  y: number;
  onClick?: () => void;
  selected?: boolean;
  highlight?: Highlight;
  dragItem?: SolitaireDragItem;
  dropTarget?: string;
  spawnOrigin?: { x: number; y: number } | null;
  spawnDelay?: number;
  anim?: 'deal' | null;
}

interface Slot {
  key: string;
  x: number;
  y: number;
  label?: ReactNode;
  onClick?: () => void;
  highlight?: Highlight;
  badge?: string;
  dropTarget?: string;
}

const COLUMNS: Record<SolitaireState['variant'], number> = { klondike: 7, freecell: 8, spider: 10, pyramid: 7 };

function SuitLabel({ suit }: { suit: Suit }) {
  return (
    <svg viewBox="0 0 100 100" className="sol-suit" aria-hidden="true">
      <SuitShape suit={suit} x={15} y={15} size={70} />
    </svg>
  );
}

function PlacedCard({
  p,
  z,
  cardW,
  dragState,
  bindDrag,
  isDragged,
  isSnapping,
  deckStyle,
}: {
  deckStyle: DeckStyle;
  p: Placed;
  z: number;
  cardW: number;
  dragState: DragState<SolitaireDragItem>;
  bindDrag: (item: SolitaireDragItem) => {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    style?: CSSProperties;
  };
  isDragged: boolean;
  isSnapping: boolean;
}) {
  const { style: spawnStyle } = useSpawnAnimation({
    origin: p.spawnOrigin,
    target: { x: p.x, y: p.y },
    delayMs: p.spawnDelay,
  });

  const dragTransform =
    isDragged || isSnapping
      ? `translate3d(${dragState.delta.x}px, ${dragState.delta.y}px, 0)`
      : undefined;

  const dragHandlers = p.dragItem ? bindDrag(p.dragItem) : undefined;

  return (
    <span
      className={`sol-pos sol-card ${isDragged ? 'bub-dragging' : ''} ${isSnapping ? 'bub-snapping' : ''}`}
      style={{
        left: p.x,
        top: p.y,
        width: cardW,
        zIndex: isDragged ? 1000 + z : z + 1,
        transform: dragTransform,
        ...spawnStyle,
        ...dragHandlers?.style,
      }}
      data-drop-target={p.dropTarget}
      onPointerDown={dragHandlers?.onPointerDown}
    >
      <PlayingCard
        card={p.card}
        onClick={p.onClick}
        selected={p.selected}
        highlight={p.highlight ?? null}
        label={p.card === null && p.onClick ? 'Talon: Karten ziehen' : undefined}
        anim={p.anim}
        deckStyle={deckStyle}
      />
    </span>
  );
}

/**
 * Bedienung: Karten können per Drag & Drop auf gültige Ziele gezogen werden,
 * oder wie gewohnt durch Antippen (Ablage zuerst, bei mehreren Zielen Auswahl).
 */
function Board({ view, legalMoves, onMove, hint }: BoardProps<SolitaireState, SolitaireMove>) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const [selected, setSelected] = useState<{ loc: Loc; count: number } | null>(null);
  const [pyramidPick, setPyramidPick] = useState<PyramidLoc | null>(null);
  const [lastView, setLastView] = useState(view);
  if (lastView !== view) {
    setLastView(view);
    setSelected(null);
    setPyramidPick(null);
  }

  const cols = COLUMNS[view.variant];
  const gap = Math.max(3, size.width * 0.012);
  const maxCardH = view.variant === 'pyramid' ? (size.height - gap * 4) / 5.2 : size.height * 0.24;
  const cardW = Math.max(18, Math.min(110, (size.width - gap * (cols + 1)) / cols, maxCardH / 1.4));
  const cardH = cardW * 1.4;
  const colX = (i: number) => gap + i * (cardW + gap) + Math.max(0, (size.width - (gap + cols * (cardW + gap))) / 2);

  const moves = legalMoves.filter((m): m is MoveMove => m.type === 'move');
  const canDraw = legalMoves.some((m) => m.type === 'draw');
  const canRecycle = legalMoves.some((m) => m.type === 'recycle');
  const targetsOfSelection = selected ? moves.filter((m) => sameLoc(m.from, selected.loc) && m.count === selected.count).map((m) => m.to) : [];
  const isTarget = (loc: Loc) => targetsOfSelection.some((t) => sameLoc(t, loc));
  const hintMove = hint?.type === 'move' ? hint : null;
  const hintTarget = (loc: Loc): Highlight => (hintMove && sameLoc(hintMove.to, loc) ? 'hint' : isTarget(loc) ? 'target' : null);

  const { dragState, bindDrag } = usePointerDrag<SolitaireDragItem>({
    threshold: 6,
    onDrop: (item, targetId) => {
      if (!targetId) return false;
      const targetMove = moves.find(
        (m) => sameLoc(m.from, item.loc) && m.count === item.count && locToTargetId(m.to) === targetId,
      );
      if (targetMove) {
        onMove(targetMove);
        return true;
      }
      return false;
    },
  });

  const prevWasteLen = useRef(view.variant === 'klondike' ? view.waste.length : 0);
  const prevStockLen = useRef('stock' in view ? view.stock.length : 0);
  const isDeal = view.moveCount === 0;

  const justDrewKlondike = view.variant === 'klondike' && view.waste.length > prevWasteLen.current;
  prevWasteLen.current = view.variant === 'klondike' ? view.waste.length : 0;

  const justDrewSpider = view.variant === 'spider' && view.stock.length < prevStockLen.current;
  prevStockLen.current = 'stock' in view ? view.stock.length : 0;

  const tapCard = (loc: Loc, count: number) => {
    if (selected) {
      const target = moves.find((m) => sameLoc(m.from, selected.loc) && m.count === selected.count && sameLoc(m.to, loc));
      if (target) {
        onMove(target);
        return;
      }
    }
    const options = moves.filter((m) => sameLoc(m.from, loc) && m.count === count);
    if (options.length === 0) {
      setSelected(null);
      return;
    }
    const toFoundation = options.find((m) => m.to.kind === 'foundation');
    const toTableau = options.filter((m) => m.to.kind === 'tableau');
    const toCell = options.find((m) => m.to.kind === 'cell');
    const auto = toFoundation ?? (toTableau.length === 1 ? toTableau[0] : toTableau.length === 0 ? toCell : undefined);
    if (auto && !(selected && sameLoc(selected.loc, loc) && selected.count === count)) onMove(auto);
    else setSelected(selected && sameLoc(selected.loc, loc) && selected.count === count ? null : { loc, count });
  };

  const tapSlot = (loc: Loc) => {
    if (!selected) return;
    const target = moves.find((m) => sameLoc(m.from, selected.loc) && m.count === selected.count && sameLoc(m.to, loc));
    if (target) onMove(target);
    setSelected(null);
  };

  const isHintSource = (loc: Loc, count: number) => hintMove !== null && sameLoc(hintMove.from, loc) && count <= hintMove.count;
  const cardFlags = (loc: Loc, count: number) => ({
    selected: selected !== null && sameLoc(selected.loc, loc) && count <= selected.count,
    highlight: (isHintSource(loc, count) ? 'hint' : null) as Highlight,
  });

  const placed: Placed[] = [];
  const slots: Slot[] = [];
  const topY = gap;
  const tableauY = gap * 2 + cardH;

  const layPile = (pile: Pile, index: number, x: number) => {
    const loc: Loc = { kind: 'tableau', index };
    const targetId = `tableau-${index}`;
    const available = Math.max(cardH * 0.2, size.height - tableauY - cardH - gap);
    let down = cardH * 0.12;
    let up = cardH * 0.28;
    const needed = pile.down.length * down + Math.max(0, pile.up.length - 1) * up;
    if (needed > available) {
      const scale = available / needed;
      down *= scale;
      up *= scale;
    }
    slots.push({
      key: `pile-${index}`,
      x,
      y: tableauY,
      onClick: () => tapSlot(loc),
      highlight: hintTarget(loc),
      dropTarget: targetId,
    });
    pile.down.forEach((card, i) =>
      placed.push({
        key: card ?? `verdeckt-${index}-${i}`,
        card: null,
        x,
        y: tableauY + i * down,
        dropTarget: targetId,
        anim: isDeal ? 'deal' : undefined,
      }),
    );
    const asTarget = hintTarget(loc);
    pile.up.forEach((card, i) => {
      const count = pile.up.length - i;
      const runCards = pile.up.slice(i);
      const flags = cardFlags(loc, count);
      if (count === 1 && !flags.highlight && !flags.selected) flags.highlight = asTarget;
      const canDrag = moves.some((m) => sameLoc(m.from, loc) && m.count === count);
      const isNewSpiderCard = justDrewSpider && i === pile.up.length - 1;
      placed.push({
        key: card,
        card,
        x,
        y: tableauY + pile.down.length * down + i * up,
        onClick: () => tapCard(loc, count),
        dragItem: canDrag ? { loc, count, card, cards: runCards } : undefined,
        dropTarget: targetId,
        spawnOrigin: isNewSpiderCard ? { x: colX(0), y: topY } : null,
        spawnDelay: isNewSpiderCard ? index * 25 : undefined,
        anim: isDeal ? 'deal' : undefined,
        ...flags,
      });
    });
  };

  const layFoundations = (foundations: CardId[][], firstCol: number) => {
    foundations.forEach((foundation, index) => {
      const loc: Loc = { kind: 'foundation', index };
      const targetId = `foundation-${index}`;
      const x = colX(firstCol + index);
      slots.push({
        key: `ablage-${index}`,
        x,
        y: topY,
        label: <SuitLabel suit={SUITS[index] as Suit} />,
        onClick: () => tapSlot(loc),
        highlight: hintTarget(loc),
        dropTarget: targetId,
      });
      foundation.forEach((card, i) => {
        const top = i === foundation.length - 1;
        const flags: { selected?: boolean; highlight?: Highlight } = top ? cardFlags(loc, 1) : {};
        if (top && !flags.highlight && !flags.selected) flags.highlight = hintTarget(loc);
        const canDrag = top && moves.some((m) => sameLoc(m.from, loc) && m.count === 1);
        placed.push({
          key: card,
          card,
          x,
          y: topY,
          onClick: top ? () => tapCard(loc, 1) : undefined,
          dragItem: canDrag ? { loc, count: 1, card, cards: [card] } : undefined,
          dropTarget: targetId,
          ...flags,
        });
      });
    });
  };

  const stockSlot = (x: number, y: number, stockCount: number, badge?: string) => {
    const highlight: Highlight = hint && (hint.type === 'draw' || hint.type === 'recycle') ? 'hint' : null;
    if (stockCount > 0) {
      slots.push({ key: 'talon-platz', x, y });
      placed.push({ key: 'talon', card: null, x, y, onClick: canDraw ? () => onMove({ type: 'draw' }) : undefined, highlight });
      slots.push({ key: 'talon-zahl', x, y, badge: badge ?? String(stockCount) });
    } else {
      slots.push({ key: 'talon-leer', x, y, label: canRecycle ? '↻' : '', onClick: canRecycle ? () => onMove({ type: 'recycle' }) : undefined, highlight });
    }
  };

  if (view.variant === 'klondike') {
    stockSlot(colX(0), topY, view.stock.length);
    const shown = view.waste.slice(-view.draw);
    shown.forEach((card, i) => {
      const top = i === shown.length - 1;
      const loc: Loc = { kind: 'waste' };
      const canDrag = top && moves.some((m) => sameLoc(m.from, loc) && m.count === 1);
      const isNewWasteCard = justDrewKlondike && top;
      placed.push({
        key: card,
        card,
        x: colX(1) + i * cardW * 0.28,
        y: topY,
        onClick: top ? () => tapCard(loc, 1) : undefined,
        dragItem: canDrag ? { loc, count: 1, card, cards: [card] } : undefined,
        dropTarget: 'waste',
        spawnOrigin: isNewWasteCard ? { x: colX(0), y: topY } : null,
        ...(top ? cardFlags(loc, 1) : {}),
      });
    });
    layFoundations(view.foundations, 3);
    view.tableau.forEach((pile, i) => layPile(pile, i, colX(i)));
  } else if (view.variant === 'freecell') {
    view.cells.forEach((card, index) => {
      const loc: Loc = { kind: 'cell', index };
      const targetId = `cell-${index}`;
      slots.push({
        key: `zelle-${index}`,
        x: colX(index),
        y: topY,
        label: 'frei',
        onClick: () => tapSlot(loc),
        highlight: hintTarget(loc),
        dropTarget: targetId,
      });
      if (card) {
        const canDrag = moves.some((m) => sameLoc(m.from, loc) && m.count === 1);
        placed.push({
          key: card,
          card,
          x: colX(index),
          y: topY,
          onClick: () => tapCard(loc, 1),
          dragItem: canDrag ? { loc, count: 1, card, cards: [card] } : undefined,
          dropTarget: targetId,
          ...cardFlags(loc, 1),
        });
      }
    });
    layFoundations(view.foundations, 4);
    view.tableau.forEach((column, i) => layPile({ down: [], up: column }, i, colX(i)));
  } else if (view.variant === 'spider') {
    stockSlot(colX(0), topY, view.stock.length, `${view.stock.length / 10}×`);
    if (view.completed.length > 0) {
      view.completed.forEach((king, i) => placed.push({ key: `fertig-${i}`, card: king, x: colX(9) - i * cardW * 0.12, y: topY }));
    } else {
      slots.push({ key: 'fertig', x: colX(9), y: topY, label: '0/8' });
    }
    view.tableau.forEach((pile, i) => layPile(pile, i, colX(i)));
  } else {
    // Pyramide: Reihen überlappen sich zur Hälfte, darunter Talon und Ablage.
    const rowStep = cardH * 0.5;
    const centerX = size.width / 2;
    const pickOrPair = (loc: PyramidLoc, card: CardId) => {
      const pairMoves = legalMoves.filter((m): m is Extract<SolitaireMove, { type: 'pair' }> => m.type === 'pair');
      if (cardRank(card) === 13) {
        const king = pairMoves.find((m) => m.cards.length === 1 && sameLoc(m.cards[0]!, loc));
        if (king) onMove(king);
        return;
      }
      if (pyramidPick && !sameLoc(pyramidPick, loc)) {
        const pair = pairMoves.find((m) => m.cards.length === 2 && m.cards.some((c) => sameLoc(c, loc)) && m.cards.some((c) => sameLoc(c, pyramidPick)));
        if (pair) {
          onMove(pair);
          return;
        }
      }
      setPyramidPick(pyramidPick && sameLoc(pyramidPick, loc) ? null : loc);
    };
    const hintCards = hint?.type === 'pair' ? hint.cards : [];
    view.pyramid.forEach((card, index) => {
      if (!card) return;
      const row = rowOf(index);
      const i = index - rowStart(row);
      const x = centerX - ((row + 1) * cardW + row * gap) / 2 + i * (cardW + gap);
      const loc: PyramidLoc = { kind: 'pyramid', index };
      const free = isFree(view, index);
      placed.push({
        key: card,
        card,
        x,
        y: topY + row * rowStep,
        onClick: free ? () => pickOrPair(loc, card) : undefined,
        selected: pyramidPick !== null && sameLoc(pyramidPick, loc),
        highlight: hintCards.some((c) => sameLoc(c, loc)) ? 'hint' : null,
      });
    });
    const bottomY = topY + 6 * rowStep + cardH + gap * 2;
    stockSlot(centerX - cardW - gap, bottomY, view.stock.length);
    const top = view.waste.at(-1);
    slots.push({ key: 'ablage', x: centerX + gap, y: bottomY, label: '' });
    if (top) {
      const loc: PyramidLoc = { kind: 'waste' };
      placed.push({
        key: top,
        card: top,
        x: centerX + gap,
        y: bottomY,
        onClick: () => pickOrPair(loc, top),
        selected: pyramidPick?.kind === 'waste',
        highlight: hintCards.some((c) => c.kind === 'waste') ? 'hint' : null,
      });
    }
  }

  const dragTargets =
    dragState.isDragging && dragState.item
      ? moves
          .filter((m) => sameLoc(m.from, dragState.item!.loc) && m.count === dragState.item!.count)
          .map((m) => locToTargetId(m.to))
      : [];

  return (
    <div ref={ref} className="sol-table" style={{ fontSize: Math.max(10, cardW * 0.22) }}>
      {size.width > 0 && (
        <>
          {slots.map((slot) => {
            const isDragTarget = slot.dropTarget ? dragTargets.includes(slot.dropTarget) : false;
            const isDragActive = isDragTarget && dragState.targetId === slot.dropTarget;
            const highlight = isDragTarget ? 'target' : slot.highlight;
            return slot.badge ? (
              <span key={slot.key} className="sol-badge" style={{ left: slot.x + cardW * 0.62, top: slot.y - 6, zIndex: 900 }}>
                {slot.badge}
              </span>
            ) : (
              <span
                key={slot.key}
                className="sol-pos"
                style={{ left: slot.x, top: slot.y, width: cardW }}
                data-drop-target={slot.dropTarget}
                data-drop-active={isDragActive ? 'true' : undefined}
              >
                {slot.onClick ? (
                  <button
                    type="button"
                    className={`bub-slot ${highlight ? `bub-card-${highlight}` : ''}`}
                    onClick={slot.onClick}
                    aria-label="Ablageplatz"
                  >
                    {slot.label}
                  </button>
                ) : (
                  <span className={`bub-slot ${highlight ? `bub-card-${highlight}` : ''}`}>{slot.label}</span>
                )}
              </span>
            );
          })}
          {placed.map((p, z) => {
            const isDragged =
              p.card !== null && dragState.isDragging && dragState.item?.cards.includes(p.card) === true;
            const isSnapping =
              p.card !== null && dragState.snapping && dragState.item?.cards.includes(p.card) === true;
            return (
              <PlacedCard
                key={p.key}
                p={p}
                z={z}
                cardW={cardW}
                dragState={dragState}
                bindDrag={bindDrag}
                isDragged={isDragged}
                isSnapping={isSnapping}
                deckStyle={view.deckStyle ?? 'four-color'}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

function SeatSymbol({ className = '' }: { seat: SeatId; className?: string }) {
  return (
    <span className={`sol-symbol ${className}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <SuitShape suit="S" x={12} y={12} size={76} />
      </svg>
    </span>
  );
}

export const gameUi: GameUi<SolitaireState, SolitaireMove> = {
  Board,
  SeatSymbol,
  sounds: {
    moved: 'karte-legen',
    drawn: 'karte-ziehen',
    flipped: 'karte-umdrehen',
    recycled: 'mischen',
    dealt: 'mischen',
    completed: 'stapel-fertig',
    paired: 'paar',
  },
  seatLabel: () => 'Solitaire',
  seatDetail: (view) => {
    const progress =
      view.variant === 'klondike' || view.variant === 'freecell'
        ? `${view.foundations.reduce((sum, f) => sum + f.length, 0)}/52 abgelegt`
        : view.variant === 'spider'
          ? `${view.completed.length}/8 Folgen`
          : `${view.pyramid.filter((c) => c === null).length}/28 entfernt`;
    return `${view.moveCount} Züge · ${progress}`;
  },
};
