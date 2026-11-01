import { useMemo, useState } from 'react';
import { CARDS_DB } from '../cards';
import { DECK_SIZE, encodeDeck } from '../deckcode';
import { DECK_THEMES, DECK_THEME_IDS } from '../decks';
import {
  ARENA_LOSSES,
  ARENA_WINS,
  arenaFoe,
  arenaHouses,
  arenaOffer,
  arenaOver,
  BOOK_TASKS,
  lootOffer,
  recordPlay,
  runDeckCode,
  startArena,
  startRun,
  takeLoot,
  taskDone,
  treasureOffer,
  unlockedRewards,
} from '../modes/progress';
import { LESSONS, lessonOf, RUN_FOES, TREASURES } from '../modes/scenarios';
import { HOUSE_POWERS } from '../powers';
import type { DeckThemeId, DrachenspielView } from '../types';
import { currentBook, updateBook, useBook } from './deckStore';
import { CardFace, CardZoom, type ZoomItem } from './parts';
import { getCardFullTitle } from './traits';
import { useLongPress } from './useLongPress';

const HUB_PATH = '#/neu/drachenspiel?solo=1';
const newSeed = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

function fightPath(params: Record<string, string>): string {
  return `#/neu/drachenspiel?${new URLSearchParams({ deckSelection: 'code', mulligan: 'off', gegner: 'bot', autostart: '1', ...params }).toString()}`;
}
const lessonPath = (id: string) => fightPath({ scenario: `lesson-${id}` });

/** Jede Partie auf diesem Gerät bekommt eine Kennung, damit sie nur einmal zählt. */
export function prepareOptions(options: Record<string, string>): Record<string, string> {
  return { ...options, playId: newSeed() };
}

const customPlays = new Set<string>();
export function markCustomDeck(playId: string | undefined): void {
  if (playId && playId !== 'none') customPlays.add(playId);
}

/** Zählt die beendete Partie und nennt den nächsten Schritt; mehrfacher Aufruf zählt nicht doppelt. */
export function endAction(view: DrachenspielView): { label: string; path: string } | null {
  const playId = view.options.playId;
  const scenario = view.options.scenario && view.options.scenario !== 'none' ? view.options.scenario : '';
  if (playId && playId !== 'none') {
    const me = view.players[0];
    const won = view.players[1].health <= 0 && me.health > 0;
    const theme = me.deckTheme;
    updateBook((book) =>
      recordPlay(book, {
        playId,
        scenario,
        won,
        house: theme && theme !== 'mixed' ? theme : null,
        custom: customPlays.has(playId) && !scenario,
        now: Date.now(),
      }),
    );
  }
  if (!scenario) return null;
  const [kind, a] = scenario.split('-');
  if (kind === 'lesson') {
    const done = currentBook().lessons.includes(a ?? '');
    const at = LESSONS.findIndex((lesson) => lesson.id === a);
    const next = LESSONS[at + 1];
    if (!done) return { label: 'Noch einmal', path: lessonPath(a ?? '') };
    return next ? { label: `Weiter: ${next.title}`, path: lessonPath(next.id) } : { label: 'Zum Solo-Bereich', path: HUB_PATH };
  }
  return { label: kind === 'run' ? 'Zur Wanderschaft' : 'Zum Turnier', path: HUB_PATH };
}

export function useCosmetics(): { frame: string | null; crest: string | null } {
  const book = useBook();
  return { frame: book.frame, crest: book.crest };
}

export function currentCrest(crest: string | null): string | undefined {
  return BOOK_TASKS.find((task) => task.reward.kind === 'crest' && task.reward.id === crest)?.reward.emoji;
}

/** Hinweise im Kampf: Lektionen führen Schritt für Schritt, die Wanderschaft nennt die Sonderregel. */
export function ScenarioTip({ options }: { options: Record<string, string> }) {
  const [at, setAt] = useState(0);
  const [closed, setClosed] = useState(false);
  const tips = useMemo(() => {
    const lesson = lessonOf(options);
    if (lesson) return lesson.tips.map((tip) => `${lesson.title}: ${tip}`);
    const [kind, index] = (options.scenario ?? '').split('-');
    const foe = kind === 'run' ? RUN_FOES[Number(index)] : undefined;
    return foe ? [`${foe.emoji} ${foe.name}: ${foe.rule}`] : [];
  }, [options]);
  if (closed || tips.length === 0) return null;
  const last = at >= tips.length - 1;
  return (
    <div className="ds-tip" role="status">
      <span>{tips[at]}</span>
      <div className="ds-tip-actions">
        <button type="button" className="ds-btn" onClick={() => (last ? setClosed(true) : setAt(at + 1))}>
          {last ? 'Los' : `Weiter (${at + 1}/${tips.length})`}
        </button>
      </div>
    </div>
  );
}

function HousePicker({ houses, onPick }: { houses: DeckThemeId[]; onPick: (house: DeckThemeId) => void }) {
  return (
    <div className="ds-deck-grid">
      {houses.map((id) => (
        <button key={id} type="button" className="ds-deck-choice" onClick={() => onPick(id)}>
          <span className="ds-deck-emoji">{DECK_THEMES[id].emoji}</span>
          <span className="ds-deck-name">{DECK_THEMES[id].name}</span>
          <span className="ds-deck-power">
            {HOUSE_POWERS[id].emoji} <strong>{HOUSE_POWERS[id].name}:</strong> {HOUSE_POWERS[id].text}
          </span>
        </button>
      ))}
    </div>
  );
}

function Lessons() {
  const book = useBook();
  return (
    <section className="ds-deck-row">
      <strong>🎓 Übungsweg</strong>
      <p className="ds-builder-hint">Sieben kurze Kämpfe, jeder zeigt genau eine Sache.</p>
      {LESSONS.map((lesson) => (
        <a key={lesson.id} className="ds-builder-row" href={lessonPath(lesson.id)}>
          <span>
            {book.lessons.includes(lesson.id) ? '✅' : '▶️'} {lesson.title}
          </span>
        </a>
      ))}
    </section>
  );
}

function Wanderschaft() {
  const { run } = useBook();
  const [choosing, setChoosing] = useState(false);
  const [treasure, setTreasure] = useState<string | null>(null);

  if (!run || run.over || choosing) {
    return (
      <section className="ds-deck-row">
        <strong>🗺️ Wanderschaft</strong>
        <p className="ds-builder-hint">Acht Gegner durch das Königreich, jeder mit eigener Sonderregel. Nach jedem Sieg wächst dein Deck, eine Niederlage beendet den Lauf.</p>
        {run?.over && !choosing && <p>{run.over === 'won' ? '👑 Geschafft! König Nobel ist besiegt.' : `Dein Lauf endete bei ${RUN_FOES[run.fight]?.name ?? 'einem Gegner'}.`}</p>}
        {choosing ? (
          <HousePicker
            houses={DECK_THEME_IDS}
            onPick={(house) => {
              updateBook((book) => ({ ...book, run: startRun(house, newSeed()), updatedAt: Date.now() }));
              setChoosing(false);
            }}
          />
        ) : (
          <button type="button" className="ds-btn ds-btn-endturn" onClick={() => setChoosing(true)}>
            Neue Wanderschaft
          </button>
        )}
      </section>
    );
  }

  const map = (
    <div className="ds-run-map">
      {RUN_FOES.map((foe, index) => (
        <div key={foe.name} className="ds-run-stop" data-state={index < run.fight ? 'done' : index === run.fight ? 'now' : 'later'} title={foe.rule}>
          <span className="ds-run-emoji">{index < run.fight ? '✅' : foe.emoji}</span>
          {foe.name}
        </div>
      ))}
    </div>
  );

  if (run.awaitingLoot) {
    const offer = lootOffer(run);
    const treasures = treasureOffer(run);
    const needTreasure = treasures.length > 0 && !treasure;
    return (
      <section className="ds-deck-row">
        <strong>🎁 Beute</strong>
        {map}
        {treasures.length > 0 && <p className="ds-builder-hint">Wähle zuerst einen Schatz, er gilt für den Rest des Laufs:</p>}
        {treasures.map((t) => (
          <button key={t.id} type="button" className={`ds-builder-row ${treasure === t.id ? 'ds-tab-on' : ''}`} aria-pressed={treasure === t.id} onClick={() => setTreasure(t.id)}>
            <span>
              {t.emoji} {t.name}: {t.text}
            </span>
          </button>
        ))}
        <p className="ds-builder-hint">Wähle ein Kartenbündel für dein Deck:</p>
        {offer.map((bundle, index) => (
          <button
            key={bundle.join()}
            type="button"
            className="ds-builder-row"
            disabled={needTreasure}
            onClick={() => {
              updateBook((book) => (book.run ? { ...book, run: takeLoot(book.run, index, treasure), updatedAt: Date.now() } : book));
              setTreasure(null);
            }}
          >
            <span>{bundle.map((id) => `${CARDS_DB[id]?.emoji} ${CARDS_DB[id]?.name}`).join(' · ')}</span>
          </button>
        ))}
      </section>
    );
  }

  const foe = RUN_FOES[run.fight]!;
  const treasures = run.treasures.map((id) => TREASURES.find((t) => t.id === id)).filter(Boolean);
  return (
    <section className="ds-deck-row">
      <strong>
        🗺️ Wanderschaft mit {DECK_THEMES[run.house].emoji} {DECK_THEMES[run.house].name}
      </strong>
      {map}
      <p>
        Nächster Gegner: {foe.emoji} <strong>{foe.name}</strong>. {foe.rule}
      </p>
      <p className="ds-builder-hint">
        Dein Deck: {run.cards.length} Karten{treasures.length > 0 ? ` · Schätze: ${treasures.map((t) => t!.emoji).join(' ')}` : ''}
      </p>
      <div className="ds-builder-actions">
        <a className="ds-btn ds-btn-endturn" href={fightPath({ scenario: `run-${run.fight}`, deckCode: runDeckCode(run), ...(run.treasures.length > 0 ? { treasures: run.treasures.join(',') } : {}) })}>
          Kämpfen
        </a>
        <button type="button" className="ds-btn" onClick={() => updateBook((book) => ({ ...book, run: null, updatedAt: Date.now() }))}>
          Lauf aufgeben
        </button>
      </div>
    </section>
  );
}

function Turnier() {
  const { arena } = useBook();
  const [zoom, setZoom] = useState<ZoomItem | null>(null);
  const longPress = useLongPress<ZoomItem>(setZoom);
  const begin = (
    <button type="button" className="ds-btn ds-btn-endturn" onClick={() => updateBook((book) => ({ ...book, arena: startArena(newSeed()), updatedAt: Date.now() }))}>
      Neues Turnier
    </button>
  );
  if (!arena) {
    return (
      <section className="ds-deck-row">
        <strong>🏇 Turnier</strong>
        <p className="ds-builder-hint">
          Du baust dein Deck aus je drei angebotenen Karten und kämpfst, bis du {ARENA_WINS} Siege oder {ARENA_LOSSES} Niederlagen hast. Kostenlos, so oft du magst.
        </p>
        {begin}
      </section>
    );
  }
  if (!arena.house) {
    return (
      <section className="ds-deck-row">
        <strong>🏇 Turnier: Haus wählen</strong>
        <HousePicker houses={arenaHouses(arena)} onPick={(house) => updateBook((book) => (book.arena ? { ...book, arena: { ...book.arena, house }, updatedAt: Date.now() } : book))} />
      </section>
    );
  }
  if (arena.cards.length < DECK_SIZE) {
    return (
      <section className="ds-deck-row">
        <strong>
          🏇 Karte {arena.cards.length + 1} von {DECK_SIZE}
        </strong>
        <p className="ds-builder-hint">Tippe eine an, lange drücken zeigt sie groß.</p>
        <div className="ds-draft-row">
          {arenaOffer(arena).map((id) => {
            const def = CARDS_DB[id]!;
            const item: ZoomItem = { kind: 'card', defId: id };
            return (
              <button
                key={id}
                type="button"
                data-rarity={def.rarity}
                className={`ds-card ds-builder-card ${def.isSpell ? 'ds-card-spell' : ''}`}
                title={getCardFullTitle(def)}
                aria-label={`${def.name}, Kosten ${def.cost}`}
                onClick={() => updateBook((book) => (book.arena ? { ...book, arena: { ...book.arena, cards: [...book.arena.cards, id] }, updatedAt: Date.now() } : book))}
                onContextMenu={(event) => longPress.contextMenu(event, item)}
                onPointerDown={(event) => longPress.start(event, item)}
              >
                <CardFace def={def} />
              </button>
            );
          })}
        </div>
        {zoom && <CardZoom item={zoom} onClose={() => setZoom(null)} />}
      </section>
    );
  }
  const over = arenaOver(arena);
  return (
    <section className="ds-deck-row">
      <strong>
        🏇 Turnier: {arena.wins} {arena.wins === 1 ? 'Sieg' : 'Siege'}, {arena.losses} {arena.losses === 1 ? 'Niederlage' : 'Niederlagen'}
      </strong>
      {over ? (
        <>
          <p>{arena.wins >= ARENA_WINS ? '🏆 Turniersieg!' : 'Das Turnier ist vorbei. Gut gekämpft!'}</p>
          {begin}
        </>
      ) : (
        <a className="ds-btn ds-btn-endturn" href={fightPath({ scenario: `arena-${arena.wins}-${arenaFoe(arena)}`, deckCode: encodeDeck(arena.house, arena.cards) })}>
          Nächster Kampf gegen {DECK_THEMES[arenaFoe(arena)].emoji} {DECK_THEMES[arenaFoe(arena)].name}
        </a>
      )}
    </section>
  );
}

function Turnierbuch() {
  const book = useBook();
  const rewards = unlockedRewards(book);
  const choose = (kind: 'frame' | 'crest', id: string | null) => updateBook((b) => ({ ...b, [kind]: id, updatedAt: Date.now() }));
  return (
    <section className="ds-deck-row">
      <strong>📖 Turnierbuch</strong>
      <p className="ds-builder-hint">Aufgaben in fester Reihenfolge. Als Belohnung gibt es nur Kartenrahmen und Wappen, sie ändern nichts am Spiel.</p>
      {BOOK_TASKS.map((task) => {
        const [have, need] = task.progress(book);
        const done = taskDone(task, book);
        return (
          <div key={task.id}>
            <span>
              {done ? '✅' : '⬜'} {task.text} ({Math.min(have, need)}/{need}) → {task.reward.emoji} {task.reward.name}
            </span>
            <div className="ds-progress" role="progressbar" aria-valuemin={0} aria-valuemax={need} aria-valuenow={Math.min(have, need)} aria-label={task.text}>
              <div className="ds-progress-fill" style={{ width: `${Math.min(100, (100 * have) / need)}%` }} />
            </div>
          </div>
        );
      })}
      {rewards.length > 0 && (
        <div className="ds-builder-actions">
          {rewards.map((reward) => {
            const active = book[reward.kind] === reward.id;
            return (
              <button key={reward.id} type="button" className={`ds-badge ds-info-badge ${active ? 'ds-tab-on' : ''}`} aria-pressed={active} onClick={() => choose(reward.kind, active ? null : reward.id)}>
                {reward.emoji} {reward.name}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Der Solo-Bereich: Jeder Kampf ist eine gewöhnliche Partie, der Stand liegt auf dem Gerät und in der Sicherung. */
export function SoloHub({ onClose }: { onClose: () => void }) {
  return (
    <div className="ds-builder">
      <Lessons />
      <Wanderschaft />
      <Turnier />
      <Turnierbuch />
      <button type="button" className="ds-btn" onClick={onClose}>
        Schließen
      </button>
    </div>
  );
}
