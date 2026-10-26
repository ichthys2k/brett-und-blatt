import type { Options } from '@brett-und-blatt/engine';
import { useEffect, useState } from 'react';
import { BOSS_LIST, DECKS, DREAMS, NAILS, SPELLS, TOOLS } from '../content';
import { CHALLENGES, DROPS_FOR_WIN, DROPS_PER_DUEL, DROPS_PER_LEVEL } from '../drops';
import { MODS, RARITY_INFO } from '../mods';
import type { Rarity } from '../types';
import { ATELIER_BOX_PRICE, boxOdds, CARD_BACKS, THEMES, UNLOCK_KIND_NAMES, UNLOCKABLES, unlockLabel, type CosmeticDef, type Unlockable, type UnlockKind } from '../unlocks';
import { buy, buyBox, equip, exportCode, importCode, useProgress, type AlbumKind } from './progress';
import { formatNumber } from './texts';

type Tab = 'atelier' | 'album' | 'save';

function unlockText(u: Unlockable): string {
  if (u.kind === 'mod') return `${MODS[u.key]!.text} · ${RARITY_INFO[MODS[u.key]!.rarity].name}`;
  if (u.kind === 'deck') return DECKS.find((d) => d.key === u.key)!.text;
  if (u.kind === 'tool') return TOOLS[u.key]!.text;
  const list: CosmeticDef[] = u.kind === 'back' ? CARD_BACKS : THEMES;
  return `${list.find((c) => c.key === u.key)!.text} (nur Schmuck)`;
}

/** Atelier-Lieferung: wackelt, reißt auf, zeigt den Fund. */
function AtelierBox({ onDone }: { onDone: () => void }) {
  const progress = useProgress();
  const [stage, setStage] = useState<number | null>(null);
  const [found, setFound] = useState<Unlockable | null>(null);
  const unlocked = new Set(progress.unlocked);
  const odds = boxOdds(unlocked);
  const open = () => {
    const item = buyBox();
    if (!item) return;
    setFound(item);
    setStage(0);
  };
  useEffect(() => {
    if (stage === null || stage >= 2) return;
    const id = window.setTimeout(() => setStage((s) => (s === null ? s : s + 1)), stage === 0 ? 800 : 450);
    return () => window.clearTimeout(id);
  }, [stage]);

  if (stage !== null && found) {
    if (stage < 2)
      return (
        <button type="button" className="cs-panel cs-center cs-delivery" onClick={() => setStage(2)} aria-label="Auspacken">
          <span className={`cs-box ${stage === 0 ? 'cs-wobble' : 'cs-tear'}`} aria-hidden="true">
            📦
          </span>
          <span className="cs-title">Atelier-Lieferung kommt an …</span>
          <span className="cs-muted">Tippen zum Auspacken</span>
        </button>
      );
    const label = unlockLabel(found);
    return (
      <div className="cs-panel cs-center">
        <span className="cs-tile cs-flip cs-special cs-found">
          <span className="cs-tile-emoji" aria-hidden="true">
            {label.emoji}
          </span>
          <span className="cs-tile-title">{label.name}</span>
        </span>
        <p>
          <strong>Neu im Atelier:</strong> {label.name} ({UNLOCK_KIND_NAMES[found.kind]})
        </p>
        <p className="cs-muted">{unlockText(found)}</p>
        <button
          type="button"
          className="cs-btn cs-btn-primary"
          onClick={() => {
            setStage(null);
            setFound(null);
            onDone();
          }}
        >
          Schön!
        </button>
      </div>
    );
  }

  return (
    <div className="cs-panel">
      <div className="cs-shop-head">
        <strong>📦 Atelier-Lieferung</strong>
        <span className="cs-muted">{ATELIER_BOX_PRICE} 💧</span>
      </div>
      <p className="cs-small-text">Enthält eine zufällige Sache, die du noch nicht hast – nie etwas doppelt. Alles lässt sich unten auch gezielt freischalten.</p>
      {odds.length > 0 ? (
        <p className="cs-muted cs-small-text">Quoten: {odds.map((o) => `${UNLOCK_KIND_NAMES[o.kind]} ${o.percent.toLocaleString('de-DE')} %`).join(' · ')} (jede Sache gleich wahrscheinlich)</p>
      ) : (
        <p className="cs-muted cs-small-text">Du hast schon alles freigeschaltet.</p>
      )}
      <button type="button" className="cs-btn cs-btn-primary" disabled={odds.length === 0 || progress.drops < ATELIER_BOX_PRICE} onClick={open}>
        Auspacken ({ATELIER_BOX_PRICE} 💧)
      </button>
    </div>
  );
}

function AtelierShop() {
  const progress = useProgress();
  const [, setTick] = useState(0);
  const kinds: UnlockKind[] = ['mod', 'deck', 'tool', 'back', 'theme'];
  const owned = new Set(progress.unlocked);
  return (
    <>
      <AtelierBox onDone={() => setTick((t) => t + 1)} />
      <p className="cs-muted cs-small-text">
        Farbtropfen gibt es nur fürs Spielen: {DROPS_PER_LEVEL} 💧 je geschafftes Level, {DROPS_FOR_WIN} 💧 für einen gewonnenen Lauf, {DROPS_PER_DUEL} 💧 je gewonnenes Duell und einmalig für
        Herausforderungen (siehe Album). Freischaltungen erweitern den Zufallspool deiner Läufe; online spielen alle mit der Grundausstattung, außer die Raumleitung wählt „Alles“.
      </p>
      {kinds.map((kind) => {
        const items = UNLOCKABLES.filter((u) => u.kind === kind);
        const cosmetic = kind === 'back' || kind === 'theme';
        const free = kind === 'back' ? CARD_BACKS[0]! : kind === 'theme' ? THEMES[0]! : null;
        return (
          <section key={kind} className="cs-panel">
            <strong>
              {UNLOCK_KIND_NAMES[kind]} ({items.filter((u) => owned.has(u.id)).length}/{items.length})
            </strong>
            <ul className="cs-unlocks">
              {free && (
                <li>
                  <span aria-hidden="true">{free.emoji}</span>
                  <span>
                    <strong>{free.name}</strong> <span className="cs-muted">{free.text}</span>
                  </span>
                  <EquipButton kind={kind as 'back' | 'theme'} itemKey={free.key} active={progress[kind as 'back' | 'theme'] === free.key} />
                </li>
              )}
              {items.map((u) => {
                const label = unlockLabel(u);
                const have = owned.has(u.id);
                return (
                  <li key={u.id} className={have ? '' : 'cs-locked'}>
                    <span aria-hidden="true">{label.emoji}</span>
                    <span>
                      <strong>{label.name}</strong> <span className="cs-muted">{unlockText(u)}</span>
                    </span>
                    {have ? (
                      cosmetic ? (
                        <EquipButton kind={kind as 'back' | 'theme'} itemKey={u.key} active={progress[kind as 'back' | 'theme'] === u.key} />
                      ) : (
                        <span className="cs-muted">✓ frei</span>
                      )
                    ) : (
                      <button type="button" className="cs-btn" disabled={progress.drops < u.price} onClick={() => buy(u.id)} aria-label={`${label.name} für ${u.price} Farbtropfen freischalten`}>
                        🔓 {u.price} 💧
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function EquipButton({ kind, itemKey, active }: { kind: 'back' | 'theme'; itemKey: string; active: boolean }) {
  return active ? (
    <span className="cs-muted">✓ angelegt</span>
  ) : (
    <button type="button" className="cs-btn" onClick={() => equip(kind, itemKey)}>
      Anlegen
    </button>
  );
}

const ALBUM_PAGES: {
  kind: AlbumKind;
  title: string;
  items: {
    key: string;
    emoji: string;
    name: string;
    text: string;
    tone?: string;
  }[];
}[] = [
  {
    kind: 'mod',
    title: 'Mods',
    items: (['common', 'uncommon', 'rare', 'legendary'] as Rarity[]).flatMap((rarity) =>
      Object.values(MODS)
        .filter((m) => m.rarity === rarity)
        .map((m) => ({
          key: m.key,
          emoji: m.emoji,
          name: m.name,
          text: m.text + (m.multi ? ' (nur zu mehreren)' : ''),
          tone: `cs-t-${rarity}`,
        })),
    ),
  },
  {
    kind: 'spell',
    title: 'Zauberkarten',
    items: Object.entries(SPELLS).map(([key, d]) => ({
      key,
      emoji: d.emoji,
      name: d.name,
      text: d.text,
      tone: 'cs-t-spell',
    })),
  },
  {
    kind: 'nail',
    title: 'Nagelstudio',
    items: Object.entries(NAILS).map(([key, d]) => ({
      key,
      emoji: d.emoji,
      name: d.name,
      text: '',
      tone: 'cs-t-nail',
    })),
  },
  {
    kind: 'dream',
    title: 'Traumkarten',
    items: Object.entries(DREAMS).map(([key, d]) => ({
      key,
      emoji: d.emoji,
      name: d.name,
      text: d.text,
      tone: 'cs-t-dream',
    })),
  },
  {
    kind: 'tool',
    title: 'Werkzeuge',
    items: Object.values(TOOLS).map((d) => ({
      key: d.key,
      emoji: d.emoji,
      name: d.name,
      text: d.text,
      tone: 'cs-t-tool',
    })),
  },
  {
    kind: 'boss',
    title: 'Bosse',
    items: BOSS_LIST.map((d) => ({
      key: d.key,
      emoji: d.emoji,
      name: d.name,
      text: d.text,
    })),
  },
  {
    kind: 'deck',
    title: 'Kartensätze',
    items: DECKS.map((d) => ({
      key: d.key,
      emoji: d.emoji,
      name: d.name,
      text: d.text,
    })),
  },
];

function Album() {
  const progress = useProgress();
  const [open, setOpen] = useState<string | null>(null);
  const done = new Set(progress.done);
  return (
    <>
      <section className="cs-panel">
        <strong>📊 Bestwerte</strong>
        <p className="cs-small-text">
          {progress.stats.runs} Partien · {progress.stats.wins} gewonnen · höchstes Level {progress.stats.bestLevel} · beste Hand {formatNumber(progress.stats.bestHand)} Punkte · {progress.earned} 💧
          verdient
        </p>
      </section>
      {ALBUM_PAGES.map((page) => {
        const found = new Set(progress.album[page.kind]);
        return (
          <details key={page.kind} className="cs-panel cs-album-page">
            <summary>
              <strong>
                {page.title} ({page.items.filter((i) => found.has(i.key)).length}/{page.items.length})
              </strong>
            </summary>
            <div className="cs-album">
              {page.items.map((item) =>
                found.has(item.key) ? (
                  <button
                    key={item.key}
                    type="button"
                    className={`cs-tile ${item.tone ?? ''} ${open === `${page.kind}:${item.key}` ? 'cs-selected' : ''}`}
                    onClick={() => setOpen(open === `${page.kind}:${item.key}` ? null : `${page.kind}:${item.key}`)}
                  >
                    <span className="cs-tile-emoji" aria-hidden="true">
                      {item.emoji}
                    </span>
                    <span className="cs-tile-title">{item.name}</span>
                  </button>
                ) : (
                  <span key={item.key} className="cs-tile cs-facedown" aria-label="noch nicht entdeckt">
                    ❔
                  </span>
                ),
              )}
            </div>
            {open?.startsWith(`${page.kind}:`) &&
              (() => {
                const item = page.items.find((i) => `${page.kind}:${i.key}` === open);
                return item?.text ? (
                  <p className="cs-small-text">
                    {item.emoji} <strong>{item.name}:</strong> {item.text}
                  </p>
                ) : null;
              })()}
          </details>
        );
      })}
      <section className="cs-panel">
        <strong>
          🎯 Herausforderungen ({CHALLENGES.filter((c) => done.has(c.id)).length}/{CHALLENGES.length})
        </strong>
        <ul className="cs-unlocks">
          {CHALLENGES.map((c) => (
            <li key={c.id} className={done.has(c.id) ? '' : 'cs-locked'}>
              <span aria-hidden="true">{done.has(c.id) ? '✅' : '⬜'}</span>
              <span>{c.label}</span>
              <span className="cs-muted">+{c.amount} 💧</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function SaveTab() {
  const [code] = useState(() => exportCode());
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <>
      <section className="cs-panel">
        <strong>📤 Sichern</strong>
        <p className="cs-small-text">Dein Fortschritt liegt nur auf diesem Gerät. Mit diesem Text nimmst du ihn auf ein anderes Gerät mit.</p>
        <textarea className="cs-code" readOnly value={code} rows={3} onFocus={(e) => e.currentTarget.select()} aria-label="Sicherungs-Text" />
        <button
          type="button"
          className="cs-btn"
          onClick={() => {
            navigator.clipboard?.writeText(code).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          {copied ? '✓ Kopiert' : 'Kopieren'}
        </button>
      </section>
      <section className="cs-panel">
        <strong>📥 Übernehmen</strong>
        <p className="cs-small-text">Ersetzt den Fortschritt auf diesem Gerät durch den eingefügten Stand.</p>
        <textarea className="cs-code" value={input} rows={3} onChange={(e) => setInput(e.target.value)} placeholder="FS1:…" aria-label="Sicherungs-Text einfügen" />
        <button
          type="button"
          className="cs-btn cs-btn-primary"
          disabled={!input.trim()}
          onClick={() => setMessage(importCode(input) ? 'Übernommen.' : 'Der Text passt nicht – bitte vollständig einfügen.')}
        >
          Übernehmen
        </button>
        {message && <p className="cs-small-text">{message}</p>}
      </section>
    </>
  );
}

/** Atelier, Album und Sichern als Fenster über allem. */
export function Atelier({ onClose, start = 'atelier' }: { onClose: () => void; start?: Tab }) {
  const progress = useProgress();
  const [tab, setTab] = useState<Tab>(start);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="cs-modal" role="dialog" aria-modal="true" aria-label="Atelier">
      <div className="cs-modal-inner">
        <div className="cs-info-head">
          <strong className="cs-title">🎨 Atelier</strong>
          <span className="cs-drops" aria-label={`${progress.drops} Farbtropfen`}>
            💧 {progress.drops}
          </span>
          <button type="button" className="cs-x" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="cs-tabs" role="tablist">
          {(
            [
              ['atelier', '🛍️ Freischalten'],
              ['album', '📖 Album'],
              ['save', '💾 Sichern'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`cs-tab ${tab === id ? 'cs-tab-on' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="cs-modal-body">
          {tab === 'atelier' && <AtelierShop />}
          {tab === 'album' && <Album />}
          {tab === 'save' && <SaveTab />}
        </div>
      </div>
    </div>
  );
}

/** Abschnitt in der Einrichtung: Farbtropfen, Atelier, Hinweis auf gesperrte Kartensätze. */
export function SetupExtra({ options }: { options: Options; seats: number }) {
  const progress = useProgress();
  const [open, setOpen] = useState(false);
  const deck = DECKS.find((d) => d.key === options.deck);
  const deckLocked = options.pool !== 'all' && !!deck && UNLOCKABLES.some((u) => u.id === `deck:${deck.key}`) && !(options.pool === 'mine' && progress.unlocked.includes(`deck:${deck.key}`));
  return (
    <section className="cs-setup">
      <h2 className="cs-setup-title">🎨 Atelier</h2>
      <p>
        Du hast <strong>💧 {progress.drops} Farbtropfen</strong>. Damit schaltest du neue Mods, Werkzeuge, Kartensätze und Schmuck frei.
      </p>
      {deckLocked && <p className="cs-warn">🔒 Der {deck!.name} ist noch gesperrt – du spielst mit dem Standard-Satz. Schalte ihn im Atelier frei oder wähle bei „Freischaltungen“ „Alles“.</p>}
      <button type="button" className="cs-btn" onClick={() => setOpen(true)}>
        Atelier und Album öffnen
      </button>
      {open && <Atelier onClose={() => setOpen(false)} />}
    </section>
  );
}
