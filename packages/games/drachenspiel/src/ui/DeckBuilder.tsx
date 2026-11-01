import { clearSyncError, connectSync, connectWithPasskey, createPasskey, createSync, disconnectSync, formatCode, passkeySupport, scheduleSync, syncAvailable, syncLink, syncNow, takeLinkCode, useSyncState } from '@brett-und-blatt/ui/sync';
import { useEffect, useMemo, useState } from 'react';
import { renderSVG } from 'uqr';
import { CARDS_DB } from '../cards';
import { buildableCards, DECK_SIZE, decodeDeck, deckProblems, encodeDeck, fillDeck, parseDeckCode, PRESET_DECKS } from '../deckcode';
import { DECK_THEMES, DECK_THEME_IDS } from '../decks';
import { HOUSE_POWERS } from '../powers';
import { syncServerUrl } from '../server';
import type { CardDefinition, DeckThemeId } from '../types';
import { decksBlock, deleteDeck, saveDeck, useDecks, type SavedDeck } from './deckStore';
import { CardFace, CardZoom, type ZoomItem } from './parts';
import { getCardFullTitle } from './traits';
import { useLongPress } from './useLongPress';

const LOOK = [
  { id: 'all', label: 'Alle' },
  { id: 'animals', label: 'Tiere' },
  { id: 'spells', label: 'Zauber' },
  { id: 'special', label: 'Besondere' },
] as const;
type Look = (typeof LOOK)[number]['id'];

const isSpecial = (def: CardDefinition) => Boolean(def.trap || def.quest || def.building || def.dormant);

function QrCode({ text, label }: { text: string; label: string }) {
  const svg = useMemo(() => renderSVG(text, { border: 2, whiteColor: '#ffffff', blackColor: '#1f2328' }), [text]);
  return <div role="img" aria-label={label} className="ds-qr" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Baut ein Deck in zwei Schritten: Haus wählen, dann Karten antippen. */
function Builder({ start, onDone, onCancel }: { start: { id?: string; name: string; code?: string } | null; onDone: (id: string) => void; onCancel: () => void }) {
  const first = start?.code ? decodeDeck(start.code) : null;
  const [house, setHouse] = useState<DeckThemeId | null>(first?.house ?? null);
  const [cards, setCards] = useState<string[]>(first?.cardIds ?? []);
  const [name, setName] = useState(start?.name ?? '');
  const [look, setLook] = useState<Look>('all');
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState<ZoomItem | null>(null);
  const longPress = useLongPress<ZoomItem>(setZoom);

  if (!house) {
    return (
      <div className="ds-builder">
        <h2 className="ds-phase-title">Welches Haus?</h2>
        <p className="ds-phase-subtitle">Dein Deck bekommt die Hauskraft und die Karten dieses Hauses, dazu alle neutralen.</p>
        <div className="ds-deck-grid">
          {DECK_THEME_IDS.map((id) => (
            <button key={id} type="button" className="ds-deck-choice" onClick={() => setHouse(id)}>
              <span className="ds-deck-emoji">{DECK_THEMES[id].emoji}</span>
              <span className="ds-deck-name">{DECK_THEMES[id].name}</span>
              <span className="ds-deck-power">
                {HOUSE_POWERS[id].emoji} <strong>{HOUSE_POWERS[id].name}:</strong> {HOUSE_POWERS[id].text}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="ds-btn" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    );
  }

  const count = (id: string) => cards.filter((card) => card === id).length;
  const shown = buildableCards(house).filter((def) => {
    if (search && !def.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (look === 'animals') return !def.isSpell && !def.quest;
    if (look === 'spells') return Boolean(def.isSpell);
    if (look === 'special') return isSpecial(def);
    return true;
  });
  const add = (id: string) => {
    const next = [...cards, id];
    if (cards.length < DECK_SIZE && !deckProblems(house, next).some((text) => text.includes('höchstens'))) setCards(next);
  };
  const remove = (id: string) => {
    const at = cards.lastIndexOf(id);
    if (at >= 0) setCards(cards.filter((_, index) => index !== at));
  };
  const curve = [0, 0, 0, 0, 0, 0, 0];
  for (const id of cards) curve[Math.min(6, CARDS_DB[id]?.cost ?? 0)]!++;
  const ready = deckProblems(house, cards).length === 0;
  const inDeck = [...new Set(cards)].map((id) => CARDS_DB[id]!).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'de'));

  return (
    <div className="ds-builder">
      <div className="ds-builder-head">
        <input className="ds-input" value={name} maxLength={30} placeholder={`${DECK_THEMES[house].name}-Deck`} aria-label="Name des Decks" onChange={(event) => setName(event.target.value)} />
        <strong className={ready ? 'ds-builder-ready' : ''} aria-live="polite">
          {cards.length}/{DECK_SIZE}
        </strong>
      </div>
      <div className="ds-curve" role="img" aria-label={`Karten nach Kosten: ${curve.map((n, cost) => `${cost === 6 ? '6 und mehr' : cost} Mana: ${n}`).join(', ')}`}>
        {curve.map((n, cost) => (
          <div key={cost} className="ds-curve-col">
            <div className="ds-curve-bar" style={{ height: `${Math.min(100, n * 12)}%` }} />
            <span>{cost === 6 ? '6+' : cost}</span>
          </div>
        ))}
      </div>
      <div className="ds-builder-tools">
        {LOOK.map((entry) => (
          <button key={entry.id} type="button" className={`ds-badge ds-info-badge ${look === entry.id ? 'ds-tab-on' : ''}`} aria-pressed={look === entry.id} onClick={() => setLook(entry.id)}>
            {entry.label}
          </button>
        ))}
        <input className="ds-input ds-input-small" value={search} placeholder="Suchen" aria-label="Karte suchen" onChange={(event) => setSearch(event.target.value)} />
      </div>
      <p className="ds-builder-hint">Antippen legt eine Karte ins Deck, lange drücken zeigt sie groß.</p>
      <div className="ds-builder-cards">
        {shown.map((def) => {
          const n = count(def.id);
          const item: ZoomItem = { kind: 'card', defId: def.id };
          return (
            <button
              key={def.id}
              type="button"
              data-rarity={def.rarity}
              className={`ds-card ds-builder-card ${def.isSpell ? 'ds-card-spell' : ''} ${n > 0 ? 'ds-card-selected' : ''}`}
              title={getCardFullTitle(def)}
              aria-label={`${def.name}, Kosten ${def.cost}, ${n} im Deck`}
              onClick={() => add(def.id)}
              onContextMenu={(event) => longPress.contextMenu(event, item)}
              onPointerDown={(event) => longPress.start(event, item)}
              onKeyDown={(event) => {
                if (event.key === 'i') setZoom(item);
              }}
            >
              <CardFace def={def} />
              {n > 0 && <span className="ds-builder-count">×{n}</span>}
            </button>
          );
        })}
      </div>
      {inDeck.length > 0 && (
        <details className="ds-builder-list">
          <summary>Im Deck ({cards.length})</summary>
          <ul>
            {inDeck.map((def) => (
              <li key={def.id}>
                <button type="button" className="ds-builder-row" aria-label={`${def.name} aus dem Deck nehmen`} onClick={() => remove(def.id)}>
                  <span>
                    {def.cost} · {def.emoji} {def.name} ×{count(def.id)}
                  </span>
                  <span aria-hidden="true">➖</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="ds-builder-actions ds-builder-sticky">
        <button type="button" className="ds-btn" onClick={onCancel}>
          Abbrechen
        </button>
        {!ready && (
          <button type="button" className="ds-btn" onClick={() => setCards(fillDeck(house, cards, (size) => Math.floor(Math.random() * size)))}>
            🎲 Rest auffüllen
          </button>
        )}
        <button
          type="button"
          className="ds-btn ds-btn-endturn"
          disabled={!ready}
          onClick={() => onDone(saveDeck({ ...(start?.id ? { id: start.id } : {}), name: name || `${DECK_THEMES[house].name}-Deck`, code: encodeDeck(house, cards) }))}
        >
          Speichern
        </button>
      </div>
      {zoom && <CardZoom item={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

/** Code teilen: zum Kopieren oder als QR-Code, den ein anderes Gerät als Text liest. */
function ShareDeck({ deck }: { deck: SavedDeck }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="ds-share">
      <code className="ds-share-code">{deck.code}</code>
      <button
        type="button"
        className="ds-btn"
        onClick={() => {
          navigator.clipboard?.writeText(deck.code).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied ? '✓ Kopiert' : 'Code kopieren'}
      </button>
      <QrCode text={deck.code} label={`QR-Code mit dem Deck-Code von ${deck.name}`} />
    </div>
  );
}

/** Sicherung über Geräte: derselbe Code wie im Narrenhof, je Spiel ein eigener Block. */
function CloudDecks() {
  const sync = useSyncState();
  const [linkCode] = useState(() => takeLinkCode());
  const [input, setInput] = useState(linkCode ? formatCode(linkCode) : '');
  const [passkey, setPasskey] = useState<'yes' | 'maybe' | 'no'>('no');
  const [showQr, setShowQr] = useState(Boolean(linkCode));
  useEffect(() => {
    void passkeySupport().then(setPasskey);
    if (sync.code) void syncNow(decksBlock);
    return () => clearSyncError();
    // nur beim Öffnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!syncAvailable(decksBlock)) return <p className="ds-builder-hint">Ohne Spieleserver bleiben die Decks auf diesem Gerät.</p>;
  const error = sync.error && (
    <p className="ds-builder-hint" role="alert">
      {sync.error}
    </p>
  );
  if (!sync.code) {
    return (
      <details className="ds-builder-list" open={Boolean(linkCode)}>
        <summary>☁️ Decks auf anderen Geräten</summary>
        <p className="ds-builder-hint">Der Sicherungscode gilt für alle Spiele, auch ein Code aus dem Narrenhof passt. Deine Decks werden schon im Browser verschlüsselt. Kein Konto, kein Name.</p>
        <button type="button" className="ds-btn" disabled={sync.busy} onClick={() => void createSync(decksBlock)}>
          Sicherungscode anlegen
        </button>
        <input className="ds-input" value={input} placeholder="XXXX-XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-label="Sicherungscode eingeben" onChange={(event) => setInput(event.target.value)} />
        <button type="button" className="ds-btn" disabled={sync.busy || !input.trim()} onClick={() => void connectSync(decksBlock, input)}>
          Mit Code verbinden
        </button>
        {passkey !== 'no' && (
          <button type="button" className="ds-btn" disabled={sync.busy} onClick={() => void connectWithPasskey(decksBlock)}>
            🔑 Mit Passkey holen
          </button>
        )}
        {error}
      </details>
    );
  }
  return (
    <details className="ds-builder-list">
      <summary>☁️ Verbunden</summary>
      <code className="ds-share-code">{formatCode(sync.code)}</code>
      <p className="ds-builder-hint">Bewahre den Code gut auf: Ohne ihn lässt sich die Sicherung nicht öffnen, auch nicht vom Betreiber. Gelöschte Decks verschwinden auch auf den anderen Geräten.</p>
      <div className="ds-builder-actions">
        <button type="button" className="ds-btn" disabled={sync.busy} onClick={() => void syncNow(decksBlock)}>
          {sync.busy ? 'Gleiche ab …' : '🔄 Jetzt abgleichen'}
        </button>
        <button type="button" className="ds-btn" onClick={() => setShowQr((value) => !value)} aria-expanded={showQr}>
          QR-Code
        </button>
        {passkey !== 'no' && (
          <button type="button" className="ds-btn" disabled={sync.busy} onClick={() => void createPasskey(syncServerUrl)}>
            🔑 Passkey anlegen
          </button>
        )}
        <button type="button" className="ds-btn" onClick={() => disconnectSync()}>
          Gerät trennen
        </button>
      </div>
      {showQr && <QrCode text={syncLink(sync.code, 'drachenspiel')} label="QR-Code mit dem Sicherungscode" />}
      {error}
    </details>
  );
}

/**
 * Meine Decks und Vorschläge: spielen (nur in der Deckwahl), bauen, umbauen, teilen.
 * `onPlay` bekommt einen gültigen Code.
 */
export function DeckManager({ onPlay, onClose }: { onPlay?: (code: string) => void; onClose?: () => void }) {
  const decks = useDecks();
  const [editing, setEditing] = useState<{ id?: string; name: string; code?: string } | 'new' | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState(false);

  useEffect(() => {
    scheduleSync(decksBlock, 200);
  }, []);

  if (editing) return <Builder start={editing === 'new' ? null : editing} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />;

  const label = (code: string) => {
    const deck = decodeDeck(code);
    return deck ? `${DECK_THEMES[deck.house].emoji} ${DECK_THEMES[deck.house].name}` : '';
  };
  const takeCode = (save: boolean) => {
    const parsed = parseDeckCode(codeInput);
    setCodeError(!parsed);
    if (!parsed) return;
    if (save) {
      saveDeck({ name: `${DECK_THEMES[parsed.house].name}-Deck`, code: codeInput.trim() });
      setCodeInput('');
    } else onPlay?.(codeInput.trim());
  };

  return (
    <div className="ds-builder">
      <button type="button" className="ds-btn ds-btn-endturn" onClick={() => setEditing('new')}>
        🛠️ Neues Deck bauen
      </button>
      <h3 className="ds-builder-title">Meine Decks</h3>
      {decks.length === 0 && <p className="ds-builder-hint">Noch keine. Bau eins oder nimm unten einen Vorschlag als Grundlage.</p>}
      {decks.map((deck) => (
        <section key={deck.id} className="ds-deck-row">
          <strong>{deck.name}</strong>
          <span className="ds-builder-hint">{label(deck.code)}</span>
          {!parseDeckCode(deck.code) && <span className="ds-builder-hint">Stimmt nach einer Regeländerung nicht mehr, bitte umbauen.</span>}
          <div className="ds-builder-actions">
            {onPlay && (
              <button type="button" className="ds-btn ds-btn-endturn" disabled={!parseDeckCode(deck.code)} onClick={() => onPlay(deck.code)}>
                Spielen
              </button>
            )}
            <button type="button" className="ds-btn" onClick={() => setEditing(deck)}>
              Umbauen
            </button>
            <button type="button" className="ds-btn" aria-expanded={sharing === deck.id} onClick={() => setSharing(sharing === deck.id ? null : deck.id)}>
              Teilen
            </button>
            {confirming === deck.id ? (
              <button type="button" className="ds-btn" onClick={() => deleteDeck(deck.id)}>
                Wirklich löschen
              </button>
            ) : (
              <button type="button" className="ds-btn" onClick={() => setConfirming(deck.id)}>
                Löschen
              </button>
            )}
          </div>
          {sharing === deck.id && <ShareDeck deck={deck} />}
        </section>
      ))}
      <h3 className="ds-builder-title">Vorschläge</h3>
      {PRESET_DECKS.map((preset) => (
        <section key={preset.code} className="ds-deck-row">
          <strong>
            {DECK_THEMES[preset.house].emoji} {preset.name}
          </strong>
          <span className="ds-builder-hint">{preset.description}</span>
          <div className="ds-builder-actions">
            {onPlay && (
              <button type="button" className="ds-btn ds-btn-endturn" onClick={() => onPlay(preset.code)}>
                Spielen
              </button>
            )}
            <button type="button" className="ds-btn" onClick={() => setEditing({ name: preset.name, code: preset.code })}>
              Umbauen
            </button>
          </div>
        </section>
      ))}
      <h3 className="ds-builder-title">Deck-Code</h3>
      <input
        className="ds-input"
        value={codeInput}
        placeholder="Code einfügen"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        aria-label="Deck-Code einfügen"
        onChange={(event) => {
          setCodeInput(event.target.value);
          setCodeError(false);
        }}
      />
      {codeError && (
        <p className="ds-builder-hint" role="alert">
          Dieser Code ergibt kein erlaubtes Deck.
        </p>
      )}
      <div className="ds-builder-actions">
        {onPlay && (
          <button type="button" className="ds-btn" disabled={!codeInput.trim()} onClick={() => takeCode(false)}>
            Damit spielen
          </button>
        )}
        <button type="button" className="ds-btn" disabled={!codeInput.trim()} onClick={() => takeCode(true)}>
          In meine Decks
        </button>
      </div>
      <CloudDecks />
      {onClose && (
        <button type="button" className="ds-btn" onClick={onClose}>
          Schließen
        </button>
      )}
    </div>
  );
}

/** Einrichtung: Decks verwalten, ohne eine Partie zu beginnen; Deck-Code für „Vorgegebenes Deck“. */
export function SetupExtra({ options, setOption }: { options: Record<string, string>; seats: number; setOption: (id: string, value: string) => void }) {
  const [open, setOpen] = useState(() => /[?&]sicherung=/.test(typeof window === 'undefined' ? '' : window.location.hash));
  const code = options.deckCode && options.deckCode !== 'none' ? options.deckCode : '';
  const invalid = code !== '' && !parseDeckCode(code);
  const decks = useDecks();
  return (
    <div className="ds-setup-extra">
      {options.deckSelection === 'code' && (
        <>
          <label className="ds-builder-hint" htmlFor="ds-deck-code">
            Deck-Code für beide Plätze
          </label>
          <input id="ds-deck-code" className="ds-input" value={code} placeholder="Code einfügen" autoComplete="off" spellCheck={false} onChange={(event) => setOption('deckCode', event.target.value.trim() || 'none')} />
          {invalid && (
            <p className="ds-builder-hint" role="alert">
              Dieser Code ergibt kein erlaubtes Deck; es wird dann im Spiel gewählt.
            </p>
          )}
          {decks.length > 0 && (
            <div className="ds-builder-actions">
              {decks.slice(0, 6).map((deck) => (
                <button key={deck.id} type="button" className="ds-btn" onClick={() => setOption('deckCode', deck.code)}>
                  {deck.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <button type="button" className="ds-btn" onClick={() => setOpen(true)}>
        🃏 Meine Decks ({decks.length})
      </button>
      {open && (
        <div className="ds-builder-overlay" role="dialog" aria-modal="true" aria-label="Meine Decks">
          <DeckManager onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
