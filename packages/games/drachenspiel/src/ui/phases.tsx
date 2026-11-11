import { useState } from 'react';
import { CARDS_DB } from '../cards';
import { DECK_THEMES, DECK_THEME_IDS } from '../decks';
import { HOUSE_POWERS } from '../powers';
import { decodeDeck } from '../deckcode';
import type { DeckThemeId, DrachenspielMove, DrachenspielView, HiddenPlayerView } from '../types';
import { DeckManager } from './DeckBuilder';
import { CardFace } from './parts';
import { getCardFullTitle, getCardTraits } from './traits';
import { championImage } from './champions';

/** Deckwahl: eigene Komponente, damit jede Phase ihre eigenen Hooks hat. */
export function DeckSelection({
  view,
  me,
  oppTheme,
  onMove,
  timed,
}: {
  view: DrachenspielView;
  me: HiddenPlayerView;
  oppTheme?: DeckThemeId | 'mixed' | null;
  onMove: (move: DrachenspielMove) => void;
  timed: boolean;
}) {
  const [own, setOwn] = useState(false);
  const themeAttr = oppTheme && oppTheme !== 'mixed' ? oppTheme : undefined;
  if (!me.deckTheme && own) {
    return (
      <div className="ds-phase-overlay ds-phase-top" data-theme={themeAttr}>
        <h2 className="ds-phase-title">Eigene Decks</h2>
        {timed && (
          <p className="ds-phase-subtitle" role="status">
            ⏳ Die Uhr läuft, nach Ablauf wird ein Deck für dich gewählt. In Ruhe bauen geht vor der Partie unter „🃏 Meine Decks“.
          </p>
        )}
        <DeckManager
          onPlay={(code) => {
            const deck = decodeDeck(code);
            if (deck) onMove({ type: 'chooseDeck', deck: deck.house, code });
          }}
          onClose={() => setOwn(false)}
        />
      </div>
    );
  }
  if (!me.deckTheme) {
    return (
      <div className="ds-phase-overlay" data-theme={themeAttr}>
        <h2 className="ds-phase-title">Wähle dein Themendeck</h2>
        <p className="ds-phase-subtitle">
          {view.options.spells === 'off' ? 'Jedes Deck enthält 30 Tierkarten mit besonderen Stärken.' : 'Jedes Deck enthält 30 Karten: 24 Tiere und 6 Zauber.'}
        </p>
        <button type="button" className="ds-btn" onClick={() => setOwn(true)}>
          🃏 Eigenes Deck, Vorschläge, Deck-Code
        </button>
        <div className="ds-deck-grid">
          {DECK_THEME_IDS.map((themeId) => {
            const theme = DECK_THEMES[themeId];
            const img = championImage(themeId);
            return (
              <div
                key={themeId}
                className="ds-deck-choice"
                onClick={() => onMove({ type: 'chooseDeck', deck: themeId })}
                role="button"
                tabIndex={0}
              >
                {img ? (
                  <img src={img} alt={theme.houseName} className="ds-deck-champion" width={72} height={96} loading="lazy" />
                ) : (
                  <span className="ds-deck-emoji">{theme.emoji}</span>
                )}
                <span className="ds-deck-name">{theme.houseName}</span>
                <span className="ds-deck-sub">{theme.emoji} {theme.name}</span>
                <span className="ds-deck-desc">{theme.description}</span>
                <span className="ds-deck-power">
                  {HOUSE_POWERS[themeId].emoji} <strong>{HOUSE_POWERS[themeId].name}:</strong> {HOUSE_POWERS[themeId].text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="ds-phase-overlay" data-theme={themeAttr}>
      <h2 className="ds-phase-title">Deck gewählt!</h2>
      <p className="ds-phase-subtitle">Warte auf deinen Mitspieler...</p>
    </div>
  );
}

export function MulliganPhase({
  me,
  oppTheme,
  onMove,
}: {
  me: HiddenPlayerView;
  oppTheme?: DeckThemeId | 'mixed' | null;
  onMove: (move: DrachenspielMove) => void;
}) {
  const [mulliganDiscard, setMulliganDiscard] = useState<Set<number>>(new Set());
  const themeAttr = oppTheme && oppTheme !== 'mixed' ? oppTheme : undefined;

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
      <div className="ds-phase-overlay" data-theme={themeAttr}>
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
                className={`ds-card ds-mulligan-card ${def.isSpell ? 'ds-card-spell' : ''} ${isDiscarded ? 'discarded' : ''}`}
                onClick={() => toggleDiscard(idx)}
                role="button"
                tabIndex={0}
                aria-label={`${def.name}, Kosten ${def.cost}${cardTraits.length > 0 ? ` [${cardTraits.map((t) => t.name).join(', ')}]` : ''}`}
                title={getCardFullTitle(def)}
              >
                <CardFace def={def} />
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
    <div className="ds-phase-overlay" data-theme={themeAttr}>
      <h2 className="ds-phase-title">Startkarten gewählt!</h2>
      <p className="ds-phase-subtitle">Warte auf den Start der Partie...</p>
    </div>
  );
}
