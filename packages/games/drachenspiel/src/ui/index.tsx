import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import { usePointerDrag, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { CARDS_DB, STAR_CARD } from '../cards';
import { DECK_THEMES, DECK_THEME_IDS } from '../decks';
import type { DeckThemeId, DrachenspielMove, DrachenspielView, Minion, SpellTarget } from '../types';
import { playCreatureAudio } from './audio';
import { getCardFullTitle, getCardTraits, getMinionFullTitle, getMinionTraits, type TraitInfo } from './traits';
import './styles.css';

const LABELS = ['Blau', 'Rot'];

type DrachenDragItem =
  | { kind: 'card'; handIndex: number }
  | { kind: 'minion'; minionId: string };

function TraitBadge({ trait, isOpponent }: { trait: TraitInfo; isOpponent?: boolean }) {
  return (
    <span
      className={`ds-trait-badge ${isOpponent ? 'ds-trait-opponent' : ''}`}
      title={trait.fullTitle}
      aria-label={`${trait.name}: ${trait.description}`}
    >
      <span className="ds-trait-emoji">{trait.emoji}</span>
      <span className="ds-trait-tooltip" role="tooltip">
        <strong className="ds-trait-tooltip-title">
          {trait.emoji} {trait.name}
        </strong>
        <span className="ds-trait-tooltip-desc">{trait.description}</span>
      </span>
    </span>
  );
}

function MinionView({
  minion,
  isOwner,
  canAttack,
  isSelected,
  isTargetable,
  attackAnim,
  attackVector,
  damageAmount,
  healAmount,
  isDying,
  isImpacted,
  onClick,
  onPointerDown,
  dropTarget,
  dropActive,
  isDragged,
  isSnapping,
  dragTransform,
  elementRef,
}: {
  minion: Minion;
  isOwner: boolean;
  canAttack: boolean;
  isSelected: boolean;
  isTargetable: boolean;
  attackAnim?: 'up' | 'down' | null;
  attackVector?: { dx: number; dy: number } | null;
  damageAmount?: number | null;
  healAmount?: number | null;
  isDying?: boolean;
  isImpacted?: boolean;
  onClick: () => void;
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
  dropTarget?: string;
  dropActive?: boolean;
  isDragged?: boolean;
  isSnapping?: boolean;
  dragTransform?: string;
  elementRef?: (el: HTMLElement | null) => void;
}) {
  const traits = getMinionTraits(minion);
  const isAttacking = Boolean(attackVector || attackAnim);
  const isTargetHit = !isAttacking && (damageAmount || isImpacted);

  const classes = [
    'ds-minion',
    canAttack && !isAttacking && 'can-attack',
    isSelected && !isAttacking && 'selected',
    isTargetable && 'targetable',
    attackAnim === 'up' && 'ds-attacking-up',
    attackAnim === 'down' && 'ds-attacking-down',
    attackVector && 'ds-attacking',
    isTargetHit && 'bub-animate-shake ds-hit-impact',
    isDying && 'ds-minion-dying',
    minion.taunt && 'taunt',
    minion.bubble && 'bubble',
    minion.stealth && 'stealth',
    isDragged && 'bub-dragging',
    isSnapping && 'bub-snapping',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={elementRef}
      className={classes}
      onClick={isDying ? undefined : onClick}
      onPointerDown={isDying ? undefined : onPointerDown}
      style={{
        ...(attackVector
          ? ({
              '--atk-dx': `${attackVector.dx}px`,
              '--atk-dy': `${attackVector.dy}px`,
            } as CSSProperties)
          : {}),
        transform: isAttacking ? undefined : dragTransform,
        position: isDragged || isAttacking ? 'relative' : undefined,
        zIndex: isDragged ? 1000 : isAttacking ? 60 : undefined,
        touchAction: canAttack ? 'none' : undefined,
      }}
      data-drop-target={isDying ? undefined : dropTarget}
      data-drop-active={dropActive ? 'true' : undefined}
      role={isDying ? undefined : 'button'}
      tabIndex={isDying ? undefined : 0}
      aria-label={`${minion.name}, Angriff ${minion.attack}, Leben ${minion.health}${traits.length > 0 ? ` [${traits.map((t) => t.name).join(', ')}]` : ''}`}
      title={getMinionFullTitle(minion)}
    >
      {damageAmount !== null && damageAmount !== undefined && (
        <span className="bub-floating-badge ds-damage-badge">-{damageAmount}</span>
      )}
      {healAmount !== null && healAmount !== undefined && (
        <span className="bub-floating-badge ds-heal-badge">+{healAmount}</span>
      )}
      <div className="ds-minion-icons">
        {traits.map((trait) => (
          <TraitBadge key={trait.id} trait={trait} isOpponent={!isOwner} />
        ))}
      </div>
      <div className="ds-minion-emoji">{minion.emoji}</div>
      <div className="ds-minion-name">{minion.name}</div>
      <div className="ds-minion-stats">
        <span className="ds-stat-atk">{minion.attack}</span>
        <span className="ds-stat-hp">{minion.health}</span>
      </div>
    </div>
  );
}

function Board({
  view,
  legalMoves,
  onMove,
  viewer,
  seatNames,
  events,
}: BoardProps<DrachenspielView, DrachenspielMove>) {
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  /** Handkarte eines Zaubers mit Ziel, der gerade auf sein Ziel wartet. */
  const [selectedSpell, setSelectedSpell] = useState<number | null>(null);
  const [mulliganDiscard, setMulliganDiscard] = useState<Set<number>>(new Set());
  const [effects, setEffects] = useState<
    Array<{
      type: 'damage' | 'heal';
      targetKind: 'hero' | 'minion';
      targetId?: string;
      targetSeat?: SeatId;
      amount: number;
    }>
  >([]);
  const [attacking, setAttacking] = useState<Map<string, { dx: number; dy: number }>>(new Map());
  const [impactedIds, setImpactedIds] = useState<Set<string>>(new Set());
  const [dyingMinions, setDyingMinions] = useState<Array<{ minion: Minion; seat: SeatId; originalIndex: number }>>([]);

  const seenEventsRef = useRef<GameEvent[] | null>(null);
  const minionElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const heroElsRef = useRef<Map<SeatId, HTMLElement>>(new Map());
  const prevViewRef = useRef<DrachenspielView>(view);
  const prevEventsRef = useRef<GameEvent[] | null>(null);
  const animationTimerRef = useRef<number | null>(null);
  const viewRef = useRef<DrachenspielView>(view);
  viewRef.current = view;
  const dyingMinionsRef = useRef(dyingMinions);
  dyingMinionsRef.current = dyingMinions;

  // Synchrones Festhalten von Minions, die in diesem Zug besiegt wurden
  if (events !== prevEventsRef.current) {
    prevEventsRef.current = events;
    const prevView = prevViewRef.current;
    if (events && events.length > 0 && prevView) {
      const deadEvents = events.filter((e) => e.type === 'minionLeft') as Array<
        GameEvent & { minionId: string; name: string }
      >;
      if (deadEvents.length > 0) {
        const nextDying: Array<{ minion: Minion; seat: SeatId; originalIndex: number }> = [];
        for (const de of deadEvents) {
          for (const seat of [0, 1] as SeatId[]) {
            const idx = prevView.players[seat].board.findIndex((m) => m.id === de.minionId);
            if (idx !== -1) {
              const m = prevView.players[seat].board[idx];
              if (!nextDying.some((d) => d.minion.id === m.id)) {
                nextDying.push({ minion: m, seat, originalIndex: idx });
              }
            }
          }
        }
        if (nextDying.length > 0) {
          setDyingMinions(nextDying);
        }
      }
    }
  }

  // Determine active viewer seat (default to player 0 if spectator)
  const mySeat: SeatId = typeof viewer === 'number' ? viewer : 0;
  const oppSeat: SeatId = (1 - mySeat) as SeatId;

  const me = view.players[mySeat];
  const opp = view.players[oppSeat];

  const isMyTurn = view.phase === 'play' && view.activeSeat === mySeat;

  // Deck Selection Phase
  if (view.phase === 'deckSelection') {
    if (!me.deckTheme) {
      return (
        <div className="ds-phase-overlay">
          <h2 className="ds-phase-title">Wähle dein Themendeck</h2>
          <p className="ds-phase-subtitle">
            Jedes Deck enthält 30 ausgewogene Tierkarten mit besonderen Stärken.
          </p>
          <div className="ds-deck-grid">
            {DECK_THEME_IDS.map((themeId) => {
              const theme = DECK_THEMES[themeId];
              return (
                <div
                  key={themeId}
                  className="ds-deck-choice"
                  onClick={() => onMove({ type: 'chooseDeck', deck: themeId })}
                  role="button"
                  tabIndex={0}
                >
                  <span className="ds-deck-emoji">{theme.emoji}</span>
                  <span className="ds-deck-name">{theme.name}</span>
                  <span className="ds-deck-desc">{theme.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div className="ds-phase-overlay">
        <h2 className="ds-phase-title">Deck gewählt!</h2>
        <p className="ds-phase-subtitle">Warte auf deinen Mitspieler...</p>
      </div>
    );
  }

  // Mulligan Phase
  if (view.phase === 'mulligan') {
    if (!me.mulliganDone && me.hand) {
      const toggleDiscard = (idx: number) => {
        setMulliganDiscard((prev) => {
          const next = new Set(prev);
          if (next.has(idx)) next.delete(idx);
          else next.add(idx);
          return next;
        });
      };

      return (
        <div className="ds-phase-overlay">
          <h2 className="ds-phase-title">Startkarten tauschen</h2>
          <p className="ds-phase-subtitle">
            Tippe auf Karten, die du abwerfen möchtest, um neue aus dem Deck zu ziehen.
          </p>
          <div className="ds-mulligan-row">
            {me.hand.map((card, idx) => {
              const def = CARDS_DB[card.defId];
              if (!def) return null;
              const isDiscarded = mulliganDiscard.has(idx);
              const cardTraits = getCardTraits(def);
              return (
                <div
                  key={card.uid}
                  className={`ds-card ds-mulligan-card ${isDiscarded ? 'discarded' : ''}`}
                  onClick={() => toggleDiscard(idx)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${def.name}, Kosten ${def.cost}${cardTraits.length > 0 ? ` [${cardTraits.map((t) => t.name).join(', ')}]` : ''}`}
                  title={getCardFullTitle(def)}
                >
                  <div className="ds-card-top">
                    <span className="ds-card-cost">{def.cost}</span>
                    <div className="ds-card-traits">
                      {cardTraits.map((trait) => (
                        <TraitBadge key={trait.id} trait={trait} />
                      ))}
                    </div>
                  </div>
                  <div className="ds-card-center">
                    <span className="ds-card-emoji">{def.emoji}</span>
                    <span className="ds-card-name">{def.name}</span>
                  </div>
                  <div className="ds-minion-stats">
                    <span className="ds-stat-atk">{def.attack}</span>
                    <span className="ds-stat-hp">{def.health}</span>
                  </div>
                  {isDiscarded && <span className="ds-mulligan-cross">❌</span>}
                </div>
              );
            })}
          </div>
          <button
            className="ds-btn"
            onClick={() => {
              onMove({
                type: 'mulligan',
                discardIndices: Array.from(mulliganDiscard),
              });
            }}
          >
            {mulliganDiscard.size === 0 ? 'Alle Karten behalten' : 'Gewählte Karten tauschen'}
          </button>
        </div>
      );
    }
    return (
      <div className="ds-phase-overlay">
        <h2 className="ds-phase-title">Startkarten gewählt!</h2>
        <p className="ds-phase-subtitle">Warte auf den Start der Partie...</p>
      </div>
    );
  }

  // Play Phase
  useEffect(() => {
    prevViewRef.current = view;
  }, [view]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (seenEventsRef.current === events) return;
    seenEventsRef.current = events;
    if (!events || events.length === 0) return;

    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }

    const currentView = viewRef.current;
    const currentMe = currentView.players[mySeat];
    const currentOpp = currentView.players[oppSeat];

    const newEffects: typeof effects = [];
    const newAttacking = new Map<string, { dx: number; dy: number }>();
    const newImpacted = new Set<string>();

    for (const e of events) {
      if (e.type === 'cardPlayed') {
        const played = e as unknown as { card: { defId: string }; minion?: Minion };
        const def = CARDS_DB[played.card.defId];
        if (def && !def.isSpell) {
          playCreatureAudio(def.name, 'play', def.sound);
        }
      } else if (e.type === 'attack') {
        const atk = e as unknown as {
          attackerId: string;
          target: { kind: 'minion'; id: string } | { kind: 'hero' };
        };
        const attackerId = atk.attackerId;
        const target = atk.target;

        const isFromMe =
          currentMe.board.some((m) => m.id === attackerId) ||
          dyingMinionsRef.current.some((d) => d.seat === mySeat && d.minion.id === attackerId);

        const targetSeat = (isFromMe ? oppSeat : mySeat) as SeatId;

        // Positionen im DOM messen
        const attackerEl = minionElsRef.current.get(attackerId);
        let targetEl: HTMLElement | undefined;
        if (target.kind === 'minion') {
          targetEl = minionElsRef.current.get(target.id);
          newImpacted.add(target.id);
        } else {
          targetEl = heroElsRef.current.get(targetSeat);
          newImpacted.add(`hero-${targetSeat}`);
        }

        let vector = { dx: 0, dy: isFromMe ? -140 : 140 };
        if (attackerEl && targetEl) {
          // Temporär transform & transition neutralisieren, um den tatsächlichen Home-Slot zu messen
          const prevAtkTransform = attackerEl.style.transform;
          const prevAtkTransition = attackerEl.style.transition;
          attackerEl.style.transform = 'none';
          attackerEl.style.transition = 'none';
          const aRect = attackerEl.getBoundingClientRect();
          attackerEl.style.transform = prevAtkTransform;
          attackerEl.style.transition = prevAtkTransition;

          const prevTgtTransform = targetEl.style.transform;
          const prevTgtTransition = targetEl.style.transition;
          targetEl.style.transform = 'none';
          targetEl.style.transition = 'none';
          const tRect = targetEl.getBoundingClientRect();
          targetEl.style.transform = prevTgtTransform;
          targetEl.style.transition = prevTgtTransition;

          const ax = aRect.left + aRect.width / 2;
          const ay = aRect.top + aRect.height / 2;
          const tx = tRect.left + tRect.width / 2;
          const ty = tRect.top + tRect.height / 2;
          const dx = Math.round(tx - ax);
          const dy = Math.round(ty - ay);

          // Mindestabstands-Prüfung: Falls fast identisch gemessen, nutze verlässlichen Richtungs-Fallback
          if (Math.hypot(dx, dy) < 20) {
            vector = { dx: 0, dy: isFromMe ? -140 : 140 };
          } else {
            vector = { dx, dy };
          }
        }

        newAttacking.set(attackerId, vector);

        const minion =
          currentMe.board.find((m) => m.id === attackerId) ??
          currentOpp.board.find((m) => m.id === attackerId) ??
          dyingMinionsRef.current.find((d) => d.minion.id === attackerId)?.minion;

        if (minion) {
          playCreatureAudio(minion.name, 'attack', minion.sound);
        }
      } else if (e.type === 'minionLeft') {
        const left = e as unknown as { minionId: string; name: string };
        playCreatureAudio(left.name, 'death');
      } else if (e.type === 'damage') {
        const dmg = e as unknown as {
          targetType: 'hero' | 'minion';
          targetSeat?: SeatId;
          targetId?: string;
          amount: number;
        };
        newEffects.push({
          type: 'damage',
          targetKind: dmg.targetType,
          targetSeat: dmg.targetSeat,
          targetId: dmg.targetId,
          amount: dmg.amount,
        });
        if (dmg.targetType === 'minion' && dmg.targetId) {
          newImpacted.add(dmg.targetId);
        } else if (dmg.targetType === 'hero' && dmg.targetSeat !== undefined) {
          newImpacted.add(`hero-${dmg.targetSeat}`);
        }
      } else if (e.type === 'heal') {
        const heal = e as unknown as {
          targetType: 'hero' | 'minion';
          targetSeat?: SeatId;
          targetId?: string;
          amount: number;
        };
        newEffects.push({
          type: 'heal',
          targetKind: heal.targetType,
          targetSeat: heal.targetSeat,
          targetId: heal.targetId,
          amount: heal.amount,
        });
      } else if (e.type === 'bubblePopped') {
        const pop = e as unknown as { minionId: string };
        newImpacted.add(pop.minionId);
      }
    }

    if (newEffects.length > 0 || newAttacking.size > 0 || newImpacted.size > 0) {
      setEffects(newEffects);
      setAttacking(newAttacking);
      setImpactedIds(newImpacted);
      animationTimerRef.current = window.setTimeout(() => {
        setEffects([]);
        setAttacking(new Map());
        setImpactedIds(new Set());
        setDyingMinions([]);
        animationTimerRef.current = null;
      }, 620);
    }
  }, [events, mySeat, oppSeat]);

  const oppHeroDmg = effects.find((e) => e.targetKind === 'hero' && e.targetSeat === oppSeat && e.type === 'damage')?.amount;
  const oppHeroHeal = effects.find((e) => e.targetKind === 'hero' && e.targetSeat === oppSeat && e.type === 'heal')?.amount;
  const myHeroDmg = effects.find((e) => e.targetKind === 'hero' && e.targetSeat === mySeat && e.type === 'damage')?.amount;
  const myHeroHeal = effects.find((e) => e.targetKind === 'hero' && e.targetSeat === mySeat && e.type === 'heal')?.amount;

  const { dragState, bindDrag } = usePointerDrag<DrachenDragItem>({
    threshold: 6,
    onDrop: (item, targetId) => {
      if (!targetId) return false;
      if (item.kind === 'card') {
        const def = CARDS_DB[me.hand?.[item.handIndex]?.defId ?? ''];
        if (def?.spell && def.targeting !== 'none') {
          // Zauber mit Ziel: aufs Ziel ziehen.
          const move = legalMoves.find(
            (m) =>
              m.type === 'playCard' &&
              m.handIndex === item.handIndex &&
              m.target !== undefined &&
              (targetId === 'enemy-hero' ? m.target.kind === 'hero' : m.target.kind === 'minion' && `minion-${m.target.id}` === targetId),
          );
          if (move) {
            onMove(move);
            setSelectedSpell(null);
            return true;
          }
          return false;
        }
        if (targetId === 'battlefield') {
          onMove({ type: 'playCard', handIndex: item.handIndex });
          return true;
        }
      } else if (item.kind === 'minion') {
        if (targetId === 'enemy-hero') {
          const move = legalMoves.find(
            (m) => m.type === 'attack' && m.attackerId === item.minionId && m.target.kind === 'hero',
          );
          if (move) {
            onMove(move);
            return true;
          }
        } else if (targetId.startsWith('minion-')) {
          const targetMinionId = targetId.slice('minion-'.length);
          const move = legalMoves.find(
            (m) =>
              m.type === 'attack' &&
              m.attackerId === item.minionId &&
              m.target.kind === 'minion' &&
              m.target.id === targetMinionId,
          );
          if (move) {
            onMove(move);
            return true;
          }
        }
      }
      return false;
    },
  });

  const draggedMinionId =
    dragState.isDragging && dragState.item?.kind === 'minion' ? dragState.item.minionId : null;
  const effectiveAttackerId = draggedMinionId ?? selectedAttackerId;

  // Check legal attack targets for currently selected or dragged attacker
  const validAttacks = effectiveAttackerId
    ? legalMoves.filter((m) => m.type === 'attack' && m.attackerId === effectiveAttackerId)
    : [];

  // Zauber mit Ziel: ausgewählt oder gerade gezogen.
  const draggedCardIdx = dragState.isDragging && dragState.item?.kind === 'card' ? dragState.item.handIndex : null;
  const activeSpellIdx = draggedCardIdx ?? selectedSpell;
  const activeSpellDef = activeSpellIdx !== null ? CARDS_DB[me.hand?.[activeSpellIdx]?.defId ?? ''] : undefined;
  const spellMoves =
    activeSpellIdx !== null && activeSpellDef?.spell
      ? legalMoves.filter((m) => m.type === 'playCard' && m.handIndex === activeSpellIdx && m.target !== undefined)
      : [];
  const spellTargetsHero = spellMoves.some((m) => m.type === 'playCard' && m.target?.kind === 'hero');
  const spellTargetIds = new Set(
    spellMoves.flatMap((m) => (m.type === 'playCard' && m.target?.kind === 'minion' ? [m.target.id] : [])),
  );
  const castOn = (target: SpellTarget) => {
    const move = spellMoves.find(
      (m) => m.type === 'playCard' && m.target && (target.kind === 'hero' ? m.target.kind === 'hero' : m.target.kind === 'minion' && m.target.id === target.id),
    );
    if (!move) return false;
    onMove(move);
    setSelectedSpell(null);
    return true;
  };

  const canTargetHero = validAttacks.some((m) => m.type === 'attack' && m.target.kind === 'hero') || spellTargetsHero;
  const targetableMinionIds = new Set(
    validAttacks
      .filter((m) => m.type === 'attack' && m.target.kind === 'minion')
      .map((m) => (m.type === 'attack' && m.target.kind === 'minion' ? m.target.id : '')),
  );

  const playableCardIndices = new Set(
    legalMoves.filter((m) => m.type === 'playCard').map((m) => (m as { handIndex: number }).handIndex),
  );

  const handleMinionClick = (minion: Minion, isOwner: boolean) => {
    if (selectedSpell !== null && spellTargetIds.has(minion.id)) {
      castOn({ kind: 'minion', id: minion.id });
      return;
    }
    if (isOwner) {
      if (minion.canAttack && !minion.hasAttacked) {
        setSelectedAttackerId((prev) => (prev === minion.id ? null : minion.id));
      }
      playCreatureAudio(minion.name, 'easterEgg', minion.sound);
    } else {
      if (selectedAttackerId && targetableMinionIds.has(minion.id)) {
        onMove({
          type: 'attack',
          attackerId: selectedAttackerId,
          target: { kind: 'minion', id: minion.id },
        });
        setSelectedAttackerId(null);
      } else {
        playCreatureAudio(minion.name, 'easterEgg', minion.sound);
      }
    }
  };

  const handleHeroClick = () => {
    if (selectedSpell !== null && spellTargetsHero) {
      castOn({ kind: 'hero' });
      return;
    }
    if (selectedAttackerId && canTargetHero) {
      onMove({
        type: 'attack',
        attackerId: selectedAttackerId,
        target: { kind: 'hero' },
      });
      setSelectedAttackerId(null);
    }
  };

  const canPlayOrAttack = playableCardIndices.size > 0 || me.board.some((m) => m.canAttack && !m.hasAttacked);

  const myDying = dyingMinions.filter((d) => d.seat === mySeat);
  const myDisplayMinions: Array<{ minion: Minion; isDying: boolean }> = me.board.map((m) => ({
    minion: m,
    isDying: false,
  }));
  for (const d of myDying) {
    if (!myDisplayMinions.some((item) => item.minion.id === d.minion.id)) {
      const idx = Math.min(d.originalIndex, myDisplayMinions.length);
      myDisplayMinions.splice(idx, 0, { minion: d.minion, isDying: true });
    }
  }

  const oppDying = dyingMinions.filter((d) => d.seat === oppSeat);
  const oppDisplayMinions: Array<{ minion: Minion; isDying: boolean }> = opp.board.map((m) => ({
    minion: m,
    isDying: false,
  }));
  for (const d of oppDying) {
    if (!oppDisplayMinions.some((item) => item.minion.id === d.minion.id)) {
      const idx = Math.min(d.originalIndex, oppDisplayMinions.length);
      oppDisplayMinions.splice(idx, 0, { minion: d.minion, isDying: true });
    }
  }

  return (
    <div className="ds-arena">
      {/* Opponent Zone */}
      <div className="ds-opponent-zone">
        <div
          ref={(el) => {
            if (el) heroElsRef.current.set(oppSeat, el);
            else heroElsRef.current.delete(oppSeat);
          }}
          className={`ds-hero-card ${canTargetHero ? 'targetable' : ''} ${oppHeroDmg || impactedIds.has(`hero-${oppSeat}`) ? 'bub-animate-shake ds-hit-impact' : ''}`}
          onClick={handleHeroClick}
          role={canTargetHero ? 'button' : undefined}
          tabIndex={canTargetHero ? 0 : undefined}
          title={canTargetHero ? 'Gegnerischen Helden angreifen!' : undefined}
          style={{ position: 'relative' }}
          data-drop-target="enemy-hero"
          data-drop-active={dragState.isDragging && dragState.targetId === 'enemy-hero' && canTargetHero ? 'true' : undefined}
          data-hero-seat={oppSeat}
        >
          {oppHeroDmg !== undefined && (
            <span className="bub-floating-badge ds-damage-badge">-{oppHeroDmg}</span>
          )}
          {oppHeroHeal !== undefined && (
            <span className="bub-floating-badge ds-heal-badge">+{oppHeroHeal}</span>
          )}
          <span className="ds-hero-avatar">{oppSeat === 0 ? '🐉' : '🐲'}</span>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
              {seatNames[oppSeat] ?? LABELS[oppSeat]}
            </div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
              <span className="ds-badge ds-badge-hp">❤️ {opp.health}</span>
              <span className="ds-badge ds-badge-mana">💧 {opp.mana}/{opp.maxMana}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <span className="ds-badge ds-badge-deck">🎴 {opp.handCount}</span>
          <span className="ds-badge ds-badge-deck">📚 {opp.deckCount}</span>
        </div>
      </div>

      {/* Boards */}
      <div className="ds-board-container">
        {/* Enemy Board */}
        <div className={`ds-board-row ${oppDisplayMinions.length === 0 ? 'empty-hint' : ''}`}>
          {oppDisplayMinions.length === 0 ? (
            <span>Keine gegnerischen Tiere auf dem Feld</span>
          ) : (
            oppDisplayMinions.map((item) => {
              const m = item.minion;
              const dmg = effects.find((e) => e.targetKind === 'minion' && e.targetId === m.id && e.type === 'damage')?.amount;
              const heal = effects.find((e) => e.targetKind === 'minion' && e.targetId === m.id && e.type === 'heal')?.amount;
              const atkVector = attacking.get(m.id);
              const isTargetable = !item.isDying && (targetableMinionIds.has(m.id) || spellTargetIds.has(m.id));
              const isImpacted = impactedIds.has(m.id);
              return (
                <MinionView
                  key={m.id}
                  minion={m}
                  isOwner={false}
                  canAttack={false}
                  isSelected={false}
                  isTargetable={isTargetable}
                  attackVector={atkVector}
                  damageAmount={dmg}
                  healAmount={heal}
                  isDying={item.isDying}
                  isImpacted={isImpacted}
                  onClick={() => !item.isDying && handleMinionClick(m, false)}
                  dropTarget={!item.isDying ? `minion-${m.id}` : undefined}
                  dropActive={!item.isDying && dragState.isDragging && dragState.targetId === `minion-${m.id}` && isTargetable}
                  elementRef={(el) => {
                    if (el) minionElsRef.current.set(m.id, el);
                    else minionElsRef.current.delete(m.id);
                  }}
                />
              );
            })
          )}
        </div>

        {/* Player Board */}
        <div
          className={`ds-board-row ${myDisplayMinions.length === 0 ? 'empty-hint' : ''}`}
          data-drop-target="battlefield"
          data-drop-active={dragState.isDragging && dragState.targetId === 'battlefield' && dragState.item?.kind === 'card' ? 'true' : undefined}
        >
          {myDisplayMinions.length === 0 ? (
            <span>Spiele Tiere aus deiner Hand aus</span>
          ) : (
            myDisplayMinions.map((item) => {
              const m = item.minion;
              const dmg = effects.find((e) => e.targetKind === 'minion' && e.targetId === m.id && e.type === 'damage')?.amount;
              const heal = effects.find((e) => e.targetKind === 'minion' && e.targetId === m.id && e.type === 'heal')?.amount;
              const atkVector = attacking.get(m.id);
              const canAttack = !item.isDying && isMyTurn && m.canAttack && !m.hasAttacked;
              const isMinionDragged = !item.isDying && (dragState.isDragging || dragState.snapping) && dragState.item?.kind === 'minion' && dragState.item.minionId === m.id;
              const dragTransform = isMinionDragged ? `translate3d(${dragState.delta.x}px, ${dragState.delta.y}px, 0)` : undefined;
              const minionDragBind = canAttack ? bindDrag({ kind: 'minion', minionId: m.id }) : undefined;
              const isImpacted = impactedIds.has(m.id);
              return (
                <MinionView
                  key={m.id}
                  minion={m}
                  isOwner={true}
                  canAttack={canAttack}
                  isSelected={!item.isDying && (selectedAttackerId === m.id || draggedMinionId === m.id)}
                  isTargetable={!item.isDying && spellTargetIds.has(m.id)}
                  attackVector={atkVector}
                  damageAmount={dmg}
                  healAmount={heal}
                  isDying={item.isDying}
                  isImpacted={isImpacted}
                  onClick={() => !item.isDying && handleMinionClick(m, true)}
                  onPointerDown={minionDragBind?.onPointerDown}
                  dropTarget={!item.isDying && spellTargetIds.has(m.id) ? `minion-${m.id}` : undefined}
                  dropActive={!item.isDying && dragState.isDragging && dragState.targetId === `minion-${m.id}` && spellTargetIds.has(m.id)}
                  isDragged={isMinionDragged}
                  isSnapping={dragState.snapping && isMinionDragged}
                  dragTransform={dragTransform}
                  elementRef={(el) => {
                    if (el) minionElsRef.current.set(m.id, el);
                    else minionElsRef.current.delete(m.id);
                  }}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Player Actions & Hero Bar */}
      <div className="ds-player-zone">
        <div
          ref={(el) => {
            if (el) heroElsRef.current.set(mySeat, el);
            else heroElsRef.current.delete(mySeat);
          }}
          className={`ds-hero-card ${myHeroDmg || impactedIds.has(`hero-${mySeat}`) ? 'bub-animate-shake ds-hit-impact' : ''}`}
          style={{ position: 'relative' }}
          data-hero-seat={mySeat}
        >
          {myHeroDmg !== undefined && (
            <span className="bub-floating-badge ds-damage-badge">-{myHeroDmg}</span>
          )}
          {myHeroHeal !== undefined && (
            <span className="bub-floating-badge ds-heal-badge">+{myHeroHeal}</span>
          )}
          <span className="ds-hero-avatar">{mySeat === 0 ? '🐉' : '🐲'}</span>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
              {seatNames[mySeat] ?? LABELS[mySeat]}
            </div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
              <span className="ds-badge ds-badge-hp">❤️ {me.health}</span>
              <span className="ds-badge ds-badge-mana">💧 {me.mana}/{me.maxMana}</span>
            </div>
          </div>
        </div>

        <div className="ds-actions">
          <span className="ds-badge ds-badge-deck">📚 {me.deckCount}</span>
          <button
            className={`ds-btn ds-btn-endturn ${isMyTurn && !canPlayOrAttack ? 'sparkle' : ''}`}
            disabled={!isMyTurn}
            onClick={() => {
              onMove({ type: 'endTurn' });
              setSelectedAttackerId(null);
              setSelectedSpell(null);
            }}
          >
            {isMyTurn ? 'Zug beenden 💎' : 'Warten...'}
          </button>
        </div>
      </div>

      {selectedSpell !== null && activeSpellDef?.spell && (
        <div className="ds-spell-hint" role="status">
          {activeSpellDef.emoji} {activeSpellDef.name}: Wähle ein Ziel – {activeSpellDef.text}
          <button type="button" className="ds-btn" onClick={() => setSelectedSpell(null)}>
            Abbrechen
          </button>
        </div>
      )}

      {/* Player Hand */}
      <div className="ds-hand">
        {me.hand?.map((card, idx) => {
          const def = CARDS_DB[card.defId];
          if (!def) return null;
          const isPlayable = isMyTurn && playableCardIndices.has(idx);
          const isCardDragged = (dragState.isDragging || dragState.snapping) && dragState.item?.kind === 'card' && dragState.item.handIndex === idx;
          const cardDragTransform = isCardDragged ? `translate3d(${dragState.delta.x}px, ${dragState.delta.y}px, 0)` : undefined;
          const cardDragBind = isPlayable ? bindDrag({ kind: 'card', handIndex: idx }) : undefined;

          const cardTraits = getCardTraits(def);

          return (
            <div
              key={card.uid}
              className={`ds-card bub-animate-deal ${def.spell ? 'ds-card-spell' : ''} ${selectedSpell === idx ? 'ds-card-selected' : ''} ${isPlayable ? 'playable' : ''} ${isCardDragged ? 'bub-dragging' : ''} ${dragState.snapping && isCardDragged ? 'bub-snapping' : ''}`}
              style={{
                animationDelay: `${idx * 40}ms`,
                transform: cardDragTransform,
                position: isCardDragged ? 'relative' : undefined,
                zIndex: isCardDragged ? 1000 : undefined,
                touchAction: isPlayable ? 'none' : undefined,
              }}
              onClick={() => {
                if (!isPlayable) return;
                if (def.spell && def.targeting !== 'none') {
                  // Zauber mit Ziel: erst auswählen, dann Ziel antippen.
                  setSelectedAttackerId(null);
                  setSelectedSpell((prev) => (prev === idx ? null : idx));
                  return;
                }
                onMove({ type: 'playCard', handIndex: idx });
              }}
              onPointerDown={cardDragBind?.onPointerDown}
              role={isPlayable ? 'button' : undefined}
              tabIndex={isPlayable ? 0 : undefined}
              aria-label={`${def.name}, Kosten ${def.cost}${cardTraits.length > 0 ? ` [${cardTraits.map((t) => t.name).join(', ')}]` : ''}`}
              title={getCardFullTitle(def)}
            >
              <div className="ds-card-top">
                <span className="ds-card-cost">{def.cost}</span>
                <div className="ds-card-traits">
                  {cardTraits.map((trait) => (
                    <TraitBadge key={trait.id} trait={trait} />
                  ))}
                </div>
              </div>
              <div className="ds-card-center">
                <span className="ds-card-emoji">{def.emoji}</span>
                <span className="ds-card-name">{def.name}</span>
              </div>
              {def.spell && <span className="ds-card-spelltext">{def.text}</span>}
              {!def.isSpell && (
                <div className="ds-minion-stats">
                  <span className="ds-stat-atk">{def.attack}</span>
                  <span className="ds-stat-hp">{def.health}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeatSymbol({ seat, className = '' }: { seat: SeatId; className?: string }) {
  return <span className={className}>{seat === 0 ? '🐉' : '🐲'}</span>;
}

export const gameUi: GameUi<DrachenspielView, DrachenspielMove> = {
  Board,
  SeatSymbol,
  sounds: {
    cardDrawn: 'drachen-karte-ziehen',
    cardPlayed: 'drachen-karte-legen',
    attack: 'drachen-angriff',
    damage: (event) => ('targetType' in event && event.targetType === 'hero' ? 'drachen-schaden-held' : 'drachen-schaden-tier'),
    minionLeft: 'leben-weg',
    bubblePopped: 'stein-heraus',
    starPlayed: 'stapel-fertig',
    spellCast: 'stapel-fertig',
    mulliganDone: 'mischen',
  },
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const p = view.players[seat];
    if (!p) return null;
    return `❤️ ${p.health} | 💧 ${p.mana}/${p.maxMana}`;
  },
};

