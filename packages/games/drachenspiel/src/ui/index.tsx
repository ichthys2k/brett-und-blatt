import type { SeatId } from '@brett-und-blatt/engine';
import type { BoardProps, GameUi } from '@brett-und-blatt/ui';
import { useState } from 'react';
import { CARDS_DB, STAR_CARD } from '../cards';
import { DECK_THEMES, DECK_THEME_IDS } from '../decks';
import type { DeckThemeId, DrachenspielMove, DrachenspielView, Minion } from '../types';
import './styles.css';

const LABELS = ['Blau', 'Rot'];

function MinionView({
  minion,
  isOwner,
  canAttack,
  isSelected,
  isTargetable,
  onClick,
}: {
  minion: Minion;
  isOwner: boolean;
  canAttack: boolean;
  isSelected: boolean;
  isTargetable: boolean;
  onClick: () => void;
}) {
  const classes = [
    'ds-minion',
    canAttack && 'can-attack',
    isSelected && 'selected',
    isTargetable && 'targetable',
    minion.taunt && 'taunt',
    minion.bubble && 'bubble',
    minion.stealth && 'stealth',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${minion.name}, Angriff ${minion.attack}, Leben ${minion.health}`}
      title={minion.quote ?? undefined}
    >
      <div className="ds-minion-icons">
        {minion.taunt && <span title="Beschützer">🛡️</span>}
        {minion.bubble && <span title="Schutzblase">🫧</span>}
        {minion.poisonous && <span title="Giftig">🧪</span>}
        {minion.stealth && <span title="Versteckt">🌙</span>}
        {minion.deathrattle && <span title="Abschied">👋</span>}
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
}: BoardProps<DrachenspielView, DrachenspielMove>) {
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  const [mulliganDiscard, setMulliganDiscard] = useState<Set<number>>(new Set());

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
              return (
                <div
                  key={card.uid}
                  className={`ds-card ds-mulligan-card ${isDiscarded ? 'discarded' : ''}`}
                  onClick={() => toggleDiscard(idx)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="ds-card-top">
                    <span className="ds-card-cost">{def.cost}</span>
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
  // Check legal attack targets for currently selected attacker
  const validAttacks = selectedAttackerId
    ? legalMoves.filter((m) => m.type === 'attack' && m.attackerId === selectedAttackerId)
    : [];

  const canTargetHero = validAttacks.some((m) => m.type === 'attack' && m.target.kind === 'hero');
  const targetableMinionIds = new Set(
    validAttacks
      .filter((m) => m.type === 'attack' && m.target.kind === 'minion')
      .map((m) => (m.type === 'attack' && m.target.kind === 'minion' ? m.target.id : '')),
  );

  const playableCardIndices = new Set(
    legalMoves.filter((m) => m.type === 'playCard').map((m) => (m as { handIndex: number }).handIndex),
  );

  const handleMinionClick = (minion: Minion, isOwner: boolean) => {
    if (isOwner) {
      if (minion.canAttack && !minion.hasAttacked) {
        setSelectedAttackerId((prev) => (prev === minion.id ? null : minion.id));
      }
    } else {
      if (selectedAttackerId && targetableMinionIds.has(minion.id)) {
        onMove({
          type: 'attack',
          attackerId: selectedAttackerId,
          target: { kind: 'minion', id: minion.id },
        });
        setSelectedAttackerId(null);
      }
    }
  };

  const handleHeroClick = () => {
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

  return (
    <div className="ds-arena">
      {/* Opponent Zone */}
      <div className="ds-opponent-zone">
        <div
          className={`ds-hero-card ${canTargetHero ? 'targetable' : ''}`}
          onClick={handleHeroClick}
          role={canTargetHero ? 'button' : undefined}
          tabIndex={canTargetHero ? 0 : undefined}
          title={canTargetHero ? 'Gegnerischen Helden angreifen!' : undefined}
        >
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
        <div className={`ds-board-row ${opp.board.length === 0 ? 'empty-hint' : ''}`}>
          {opp.board.length === 0 ? (
            <span>Keine gegnerischen Tiere auf dem Feld</span>
          ) : (
            opp.board.map((m) => (
              <MinionView
                key={m.id}
                minion={m}
                isOwner={false}
                canAttack={false}
                isSelected={false}
                isTargetable={targetableMinionIds.has(m.id)}
                onClick={() => handleMinionClick(m, false)}
              />
            ))
          )}
        </div>

        {/* Player Board */}
        <div className={`ds-board-row ${me.board.length === 0 ? 'empty-hint' : ''}`}>
          {me.board.length === 0 ? (
            <span>Spiele Tiere aus deiner Hand aus</span>
          ) : (
            me.board.map((m) => (
              <MinionView
                key={m.id}
                minion={m}
                isOwner={true}
                canAttack={isMyTurn && m.canAttack && !m.hasAttacked}
                isSelected={selectedAttackerId === m.id}
                isTargetable={false}
                onClick={() => handleMinionClick(m, true)}
              />
            ))
          )}
        </div>
      </div>

      {/* Player Actions & Hero Bar */}
      <div className="ds-player-zone">
        <div className="ds-hero-card">
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
            }}
          >
            {isMyTurn ? 'Zug beenden 💎' : 'Warten...'}
          </button>
        </div>
      </div>

      {/* Player Hand */}
      <div className="ds-hand">
        {me.hand?.map((card, idx) => {
          const def = CARDS_DB[card.defId];
          if (!def) return null;
          const isPlayable = isMyTurn && playableCardIndices.has(idx);

          return (
            <div
              key={card.uid}
              className={`ds-card ${isPlayable ? 'playable' : ''}`}
              onClick={() => {
                if (isPlayable) onMove({ type: 'playCard', handIndex: idx });
              }}
              role={isPlayable ? 'button' : undefined}
              tabIndex={isPlayable ? 0 : undefined}
              aria-label={`${def.name}, Kosten ${def.cost}`}
              title={def.quote}
            >
              <div className="ds-card-top">
                <span className="ds-card-cost">{def.cost}</span>
                {def.abilities && def.abilities.length > 0 && (
                  <span style={{ fontSize: '0.7rem' }}>
                    {def.abilities[0].type === 'taunt' && '🛡️'}
                    {def.abilities[0].type === 'rush' && '⚡'}
                    {def.abilities[0].type === 'bubble' && '🫧'}
                    {def.abilities[0].type === 'poisonous' && '🧪'}
                    {def.abilities[0].type === 'stealth' && '🌙'}
                    {def.abilities[0].type === 'battlecry' && '🎺'}
                    {def.abilities[0].type === 'deathrattle' && '👋'}
                  </span>
                )}
              </div>
              <div className="ds-card-center">
                <span className="ds-card-emoji">{def.emoji}</span>
                <span className="ds-card-name">{def.name}</span>
              </div>
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
    cardDrawn: 'karte-ziehen',
    cardPlayed: 'karte-legen',
    attack: 'stein-schlagen',
    damage: 'treffer',
    minionLeft: 'leben-weg',
    bubblePopped: 'stein-heraus',
    starPlayed: 'stapel-fertig',
    mulliganDone: 'mischen',
  },
  seatLabel: (seat) => LABELS[seat] ?? `Platz ${seat + 1}`,
  seatDetail: (view, seat) => {
    const p = view.players[seat];
    if (!p) return null;
    return `❤️ ${p.health} | 💧 ${p.mana}/${p.maxMana}`;
  },
};

