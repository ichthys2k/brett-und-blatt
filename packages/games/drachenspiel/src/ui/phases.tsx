import { useState } from 'react';
import { CARDS_DB } from '../cards';
import { DECK_THEMES, DECK_THEME_IDS } from '../decks';
import type { DrachenspielMove, DrachenspielView, HiddenPlayerView } from '../types';
import { CardFace } from './parts';
import { getCardFullTitle, getCardTraits } from './traits';

/** Deckwahl: eigene Komponente, damit jede Phase ihre eigenen Hooks hat. */
export function DeckSelection({ view, me, onMove }: { view: DrachenspielView; me: HiddenPlayerView; onMove: (move: DrachenspielMove) => void }) {
  if (!me.deckTheme) {
    return (
      <div className="ds-phase-overlay">
        <h2 className="ds-phase-title">Wähle dein Themendeck</h2>
        <p className="ds-phase-subtitle">
          {view.options.spells === 'off' ? 'Jedes Deck enthält 30 Tierkarten mit besonderen Stärken.' : 'Jedes Deck enthält 30 Karten: 24 Tiere und 6 Zauber.'}
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

export function MulliganPhase({ me, onMove }: { me: HiddenPlayerView; onMove: (move: DrachenspielMove) => void }) {
  const [mulliganDiscard, setMulliganDiscard] = useState<Set<number>>(new Set());

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
    <div className="ds-phase-overlay">
      <h2 className="ds-phase-title">Startkarten gewählt!</h2>
      <p className="ds-phase-subtitle">Warte auf den Start der Partie...</p>
    </div>
  );
}
