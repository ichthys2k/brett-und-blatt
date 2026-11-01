import { Die3D, useRollCounter, type BoardProps, type GameUi } from '@brett-und-blatt/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import { CARD_TEXT, FAMILIES, FAMILY_COLORS, FAMILY_ICONS, FIELD_COUNT, FIELD_ICONS, FIELD_NAMES, GUILDS, NEWS_TEXT, SEASONS, guildOf, priceOf, type CardId, type NewsId } from '../board';
import { buildCost, isLegal, isTradable, redeemCost, rentOf, worth, type MarketMove, type MarketView } from '../rules';
import './styles.css';

type Props = BoardProps<MarketView, MarketMove>;

/** Zeile und Spalte (1–10) eines Feldes: Start unten rechts, im Uhrzeigersinn. */
function cellOf(field: number): { row: number; col: number } {
  if (field <= 9) return { row: 10, col: 10 - field };
  if (field <= 18) return { row: 10 - (field - 9), col: 1 };
  if (field <= 27) return { row: 1, col: 1 + (field - 18) };
  return { row: 1 + (field - 27), col: 10 };
}

const isCorner = (field: number) => field % 9 === 0;

/** Karren ziehen Feld für Feld; in den Kerker und zum Stadttor springen sie direkt. */
function useCartPositions(target: number[], events: GameEvent[]): number[] {
  const [shown, setShown] = useState(target);
  const jump = events.some((e) => e.type === 'jailed' || (e.type === 'moved' && e.from === -1));
  useEffect(() => {
    if (jump) {
      setShown(target);
      return;
    }
    if (target.every((pos, i) => pos === shown[i])) return;
    const id = window.setTimeout(() => {
      setShown((now) => now.map((pos, i) => (pos === target[i] ? pos : (pos + 1) % FIELD_COUNT)));
    }, 130);
    return () => window.clearTimeout(id);
  }, [target.join(','), shown.join(','), jump]);
  return shown;
}

function describeEvent(event: GameEvent, name: (seat: SeatId) => string): string | null {
  const seat = event.seat as SeatId;
  const field = FIELD_NAMES[event.field as number];
  switch (event.type) {
    case 'rolled':
      return `${name(seat)} würfelt ${(event.a as number) + (event.b as number)}.`;
    case 'bought':
      return `${name(seat)} kauft ${field} für ${event.price} 🥨.`;
    case 'ware':
      return `${name(seat)} zahlt ${event.amount} 🥨 Ware an ${name(event.owner as SeatId)}.`;
    case 'built':
      return `${name(seat)} baut auf ${field}.`;
    case 'goMoney':
      return `${name(seat)} bekommt ${event.amount} 🥨 Marktgeld.`;
    case 'jailed':
      return `${name(seat)} muss in den Kerker. Der Hofnarr erzählt einen Witz.`;
    case 'freed':
      return `${name(seat)} verlässt den Kerker.`;
    case 'card':
      return event.card ? `${name(seat)}: ${CARD_TEXT[event.card as CardId].title}. ${CARD_TEXT[event.card as CardId].text}.` : `${name(seat)} behält eine Karte verdeckt.`;
    case 'news':
      return `Der Ausrufer verkündet: ${NEWS_TEXT[event.news as NewsId].title}!`;
    case 'traded':
      return `${name(seat)} und ${name(event.to as SeatId)} handeln.`;
    case 'refused':
      return `${name(event.to as SeatId)} lehnt ab.`;
    case 'partnered':
      return `Zunftpartnerschaft bei den ${GUILDS[event.guild as number]!.name}n!`;
    case 'debt':
      return `${name(seat)} hilft aus: ${event.amount} 🥨 Schuldschein.`;
    case 'auction':
      return `${field} wird versteigert.`;
    case 'resigned':
      return `${name(seat)} gibt auf.`;
    default:
      return null;
  }
}

const levelMark = (level: number) => (level === 2 ? '🏛️' : level === 1 ? '🔨' : '');

function fieldInfo(view: MarketView, field: number, name: (seat: SeatId) => string) {
  const g = guildOf(field);
  const owner = view.owner[field]!;
  return { g, owner, ownerName: owner >= 0 ? name(owner) : null, rent: rentOf(view, field) };
}

function FieldSheet({ view, field, name, onClose }: { view: MarketView; field: number; name: (seat: SeatId) => string; onClose(): void }) {
  const { g, ownerName, rent } = fieldInfo(view, field, name);
  const guild = g !== null && g >= 0 ? GUILDS[g]! : null;
  return (
    <div className="mkt-sheet" onClick={onClose}>
      <div className="mkt-sheet-card" onClick={(e) => e.stopPropagation()}>
        <h3>
          {FIELD_ICONS[field]} {FIELD_NAMES[field]}
        </h3>
        {g !== null ? (
          <>
            <div>{guild ? `Zunft der ${guild.name}` : 'Gemeinschaftsbetrieb'} · Preis {priceOf(field)} 🥨</div>
            {guild ? (
              <div>
                Ware: {guild.ware[0]} (ganze Zunft {guild.ware[0] * 2}) · Werkstatt {guild.ware[1]} · Zunfthaus {guild.ware[2]} · Bauen je {guild.build} 🥨
              </div>
            ) : (
              <div>Ware: 2 🥨 je Gemeinschaftsbetrieb des Besitzers</div>
            )}
            <div>{ownerName ? `Besitzer: ${ownerName}${view.mortgaged[field] ? ' (verpfändet)' : ''} · Ware jetzt ${rent} 🥨` : 'Noch frei'}</div>
          </>
        ) : (
          <div>{SPECIAL[field] ?? 'Sonderfeld'}</div>
        )}
        <button type="button" className="mkt-btn" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}

const SPECIAL: Record<number, string> = {
  0: 'Start. Wer vorbeizieht, bekommt Marktgeld.',
  2: 'Ausruferkarte ziehen.',
  4: '10 % der Kasse an das Kloster, mindestens 2 Brezeln.',
  9: 'Nur zu Besuch, außer man wurde hineingeführt.',
  11: 'Kräutergarten: +2 Brezeln.',
  16: 'Ausruferkarte ziehen.',
  18: '+2 Brezeln; alle dürfen einmal handeln.',
  20: 'Audienz beim König: 4 Brezeln Hofsold oder ein Bau zum halben Preis.',
  24: 'Ausruferkarte ziehen.',
  27: 'Die Wache führt dich in den Kerker, ohne Marktgeld.',
  29: 'Kräuter sammeln: +1 Brezel.',
  32: 'Ausruferkarte ziehen.',
  33: '4 Brezeln an die Stadt.',
  35: 'Markttag: einen freien Betrieb irgendwo zum Listenpreis kaufen.',
};

function ManageSheet({ view, seat, legalMoves, onMove, onClose }: { view: MarketView; seat: SeatId; legalMoves: MarketMove[]; onMove(m: MarketMove): void; onClose(): void }) {
  const has = (type: MarketMove['type'], field: number) => legalMoves.some((m) => m.type === type && 'field' in m && m.field === field);
  const fields = Array.from({ length: FIELD_COUNT }, (_, f) => f).filter((f) => view.owner[f] === seat);
  const asks = legalMoves.filter((m): m is Extract<MarketMove, { type: 'askPartner' }> => m.type === 'askPartner');
  return (
    <div className="mkt-sheet" onClick={onClose}>
      <div className="mkt-sheet-card" onClick={(e) => e.stopPropagation()}>
        <h3>📜 Deine Betriebe</h3>
        {fields.length === 0 && <div>Du hast noch keine Betriebe.</div>}
        {fields.map((f) => {
          const g = guildOf(f)!;
          return (
            <div key={f} className="mkt-row">
              <span>
                <span className="mkt-swatch" style={{ background: g >= 0 ? GUILDS[g]!.color : '#a8a29e' }} />
                {FIELD_NAMES[f]} {levelMark(view.level[f]!)} {view.mortgaged[f] && '(verpfändet)'}
              </span>
              <span className="mkt-actions">
                {has('build', f) && (
                  <button type="button" className="mkt-btn" onClick={() => onMove({ type: 'build', field: f })}>
                    Bauen ({buildCost(view, g)})
                  </button>
                )}
                {has('sellBuild', f) && (
                  <button type="button" className="mkt-btn" onClick={() => onMove({ type: 'sellBuild', field: f })}>
                    Bau verkaufen
                  </button>
                )}
                {has('mortgage', f) && (
                  <button type="button" className="mkt-btn" onClick={() => onMove({ type: 'mortgage', field: f })}>
                    Verpfänden (+{Math.ceil(priceOf(f) / 2)})
                  </button>
                )}
                {has('redeem', f) && (
                  <button type="button" className="mkt-btn" onClick={() => onMove({ type: 'redeem', field: f })}>
                    Auslösen ({redeemCost(f)})
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {asks.map((m) => (
          <button key={m.guild} type="button" className="mkt-btn" onClick={() => { onMove(m); onClose(); }}>
            🤝 Partnerschaft bei den {GUILDS[m.guild]!.name}n anbieten
          </button>
        ))}
        <button type="button" className="mkt-btn mkt-btn-main" onClick={onClose}>
          Fertig
        </button>
      </div>
    </div>
  );
}

function TradeSheet({ view, seat, name, onMove, onClose }: { view: MarketView; seat: SeatId; name: (seat: SeatId) => string; onMove(m: MarketMove): void; onClose(): void }) {
  const others = view.players.flatMap((p, i) => (i === seat || p.gone ? [] : [i]));
  const [to, setTo] = useState(others[0]!);
  const [give, setGive] = useState<number[]>([]);
  const [take, setTake] = useState<number[]>([]);
  const [pay, setPay] = useState(0);
  const list = (owner: SeatId) => Array.from({ length: FIELD_COUNT }, (_, f) => f).filter((f) => view.owner[f] === owner && isTradable(view, f));
  const toggle = (items: number[], f: number) => (items.includes(f) ? items.filter((x) => x !== f) : [...items, f]);
  const move: MarketMove = { type: 'offer', to, give, take, pay };
  const ok = isLegal(view, seat, move);
  const column = (title: string, owner: SeatId, chosen: number[], set: (v: number[]) => void) => (
    <div>
      <strong>{title}</strong>
      {list(owner).length === 0 && <div>Nichts zu handeln.</div>}
      {list(owner).map((f) => (
        <label key={f} className="mkt-check">
          <input type="checkbox" checked={chosen.includes(f)} onChange={() => set(toggle(chosen, f))} />
          {FIELD_NAMES[f]} ({priceOf(f)})
        </label>
      ))}
    </div>
  );
  return (
    <div className="mkt-sheet" onClick={onClose}>
      <div className="mkt-sheet-card" onClick={(e) => e.stopPropagation()}>
        <h3>🤝 Handel anbieten</h3>
        <div className="mkt-actions">
          {others.map((seatId) => (
            <button key={seatId} type="button" className={`mkt-btn ${seatId === to ? 'mkt-btn-main' : ''}`} onClick={() => { setTo(seatId); setTake([]); }}>
              {name(seatId)}
            </button>
          ))}
        </div>
        <div className="mkt-trade-cols">
          {column('Du gibst', seat, give, setGive)}
          {column(`${name(to)} gibt`, to, take, setTake)}
        </div>
        <div className="mkt-row">
          <span>{pay >= 0 ? `Du zahlst ${pay} 🥨` : `Du bekommst ${-pay} 🥨`}</span>
          <span className="mkt-actions">
            <button type="button" className="mkt-btn" aria-label="Weniger zahlen" onClick={() => setPay(pay - 1)}>
              −
            </button>
            <button type="button" className="mkt-btn" aria-label="Mehr zahlen" onClick={() => setPay(pay + 1)}>
              +
            </button>
          </span>
        </div>
        <div className="mkt-actions">
          <button type="button" className="mkt-btn mkt-btn-main" disabled={!ok} onClick={() => { onMove(move); onClose(); }}>
            Angebot machen
          </button>
          <button type="button" className="mkt-btn" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

function offerText(view: MarketView, name: (seat: SeatId) => string): string {
  const offer = view.offer!;
  const names = (fields: number[]) => fields.map((f) => FIELD_NAMES[f]).join(', ');
  const give = [offer.give.length ? names(offer.give) : '', offer.pay > 0 ? `${offer.pay} 🥨` : ''].filter(Boolean).join(' und ') || 'nichts';
  const take = [offer.take.length ? names(offer.take) : '', offer.pay < 0 ? `${-offer.pay} 🥨` : ''].filter(Boolean).join(' und ') || 'nichts';
  return `${name(offer.from)} bietet ${give} und möchte dafür ${take}.`;
}

function Actions({ view, seat, legalMoves, hint, onMove, name, openManage, openTrade }: { view: MarketView; seat: SeatId | null; legalMoves: MarketMove[]; hint: MarketMove | null; onMove(m: MarketMove): void; name: (s: SeatId) => string; openManage(): void; openTrade(): void }) {
  const has = (type: MarketMove['type']) => legalMoves.some((m) => m.type === type);
  const hinted = (m: MarketMove) => (hint && JSON.stringify(hint) === JSON.stringify(m) ? ' mkt-btn-hint' : '');
  const btn = (m: MarketMove, label: string, main = false) => (
    <button key={label} type="button" className={`mkt-btn${main ? ' mkt-btn-main' : ''}${hinted(m)}`} onClick={() => onMove(m)}>
      {label}
    </button>
  );
  const [sealed, setSealed] = useState(0);
  if (seat === null || legalMoves.length === 0) return null;
  const canTrade = view.options.trade && !view.offerUsed;
  const tools = (
    <>
      <button type="button" className="mkt-btn" onClick={openManage}>
        📜 Betriebe
      </button>
      {canTrade && (
        <button type="button" className="mkt-btn" onClick={openTrade}>
          🤝 Handeln
        </button>
      )}
    </>
  );
  switch (view.phase) {
    case 'roll':
      return (
        <div className="mkt-actions">
          {btn({ type: 'roll' }, view.players[seat]!.jailTurns >= 0 ? '🎲 Auf Pasch würfeln' : '🎲 Würfeln', true)}
          {has('payBail') && btn({ type: 'payBail' }, 'Kaution zahlen (5)')}
          {has('usePardon') && btn({ type: 'usePardon' }, 'Freibrief nutzen')}
          {tools}
        </div>
      );
    case 'end':
      return (
        <div className="mkt-actions">
          {btn({ type: 'endTurn' }, 'Zug beenden', true)}
          {tools}
        </div>
      );
    case 'buy':
      return (
        <div className="mkt-panel">
          <div className="mkt-panel-title">
            {FIELD_NAMES[view.field!]} kaufen? ({priceOf(view.field!)} 🥨)
          </div>
          <div className="mkt-actions">
            {has('buy') && btn({ type: 'buy' }, 'Kaufen', true)}
            {btn({ type: 'decline' }, 'Versteigern')}
            <button type="button" className="mkt-btn" onClick={openManage}>
              📜 Betriebe
            </button>
          </div>
        </div>
      );
    case 'auction':
      return (
        <div className="mkt-actions">
          {has('bid') && btn({ type: 'bid' }, `${view.auction!.bid + 1} 🥨 bieten`, true)}
          {btn({ type: 'fold' }, 'Aussteigen')}
        </div>
      );
    case 'sealed':
      return (
        <div className="mkt-panel">
          <div className="mkt-panel-title">Dein verdecktes Gebot für {FIELD_NAMES[view.sealed!.field]}</div>
          <div className="mkt-actions">
            <button type="button" className="mkt-btn" aria-label="Weniger" onClick={() => setSealed(Math.max(0, sealed - 1))}>
              −
            </button>
            <strong>{sealed} 🥨</strong>
            <button type="button" className="mkt-btn" aria-label="Mehr" onClick={() => setSealed(Math.min(view.players[seat]!.cash, sealed + 1))}>
              +
            </button>
            {btn({ type: 'sealedBid', amount: sealed }, 'Abgeben', true)}
          </div>
        </div>
      );
    case 'errand':
      return (
        <div className="mkt-panel">
          <div className="mkt-panel-title">Botengang</div>
          <div className="mkt-actions">
            {btn({ type: 'errand', choice: 'cash' }, '+2 🥨', true)}
            {([1, 2, 3] as const).map((n) => btn({ type: 'errand', choice: n }, `${n} weiter`))}
          </div>
        </div>
      );
    case 'audience':
      return (
        <div className="mkt-panel">
          <div className="mkt-panel-title">Audienz beim König</div>
          <div className="mkt-actions">
            {btn({ type: 'audience', build: null }, '4 🥨 Hofsold', true)}
            {legalMoves.flatMap((m) => (m.type === 'audience' && m.build !== null ? [btn(m, `Bauen: ${FIELD_NAMES[m.build]}`)] : []))}
          </div>
        </div>
      );
    case 'well':
      return (
        <div className="mkt-panel">
          <div className="mkt-panel-title">Markttag: Tippe einen freien Betrieb an.</div>
          <div className="mkt-actions">{btn({ type: 'well', field: null }, 'Nichts kaufen')}</div>
        </div>
      );
    case 'fair':
      return (
        <div className="mkt-panel">
          <div className="mkt-panel-title">Du darfst jetzt einmal handeln.</div>
          <div className="mkt-actions">
            <button type="button" className="mkt-btn" onClick={openTrade}>
              🤝 Handeln
            </button>
            {btn({ type: 'pass' }, 'Nicht handeln', true)}
          </div>
        </div>
      );
    case 'reply':
      return (
        <div className="mkt-panel">
          <div className="mkt-panel-title">{view.offer ? offerText(view, name) : `${name(view.partnerOffer!.from)} bietet eine Partnerschaft bei den ${GUILDS[view.partnerOffer!.guild]!.name}n an.`}</div>
          <div className="mkt-actions">
            {btn({ type: 'accept' }, 'Annehmen', true)}
            {btn({ type: 'reject' }, 'Ablehnen')}
          </div>
        </div>
      );
    default:
      return null;
  }
}

function Board({ view, legalMoves, onMove, events, viewer, seatNames, hint }: Props) {
  const name = (seat: SeatId) => seatNames[seat] ?? `Familie ${FAMILIES[seat]}`;
  const seat = typeof viewer === 'number' ? viewer : null;
  const [sheet, setSheet] = useState<'manage' | 'trade' | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const seen = useRef<GameEvent[] | null>(null);
  const rollKey = useRollCounter(events);

  useEffect(() => {
    if (seen.current === events) return;
    seen.current = events;
    const lines = events.flatMap((e) => describeEvent(e, name) ?? []);
    if (lines.length > 0) setLog((old) => [...lines.reverse(), ...old].slice(0, 6));
  }, [events]);

  const carts = useCartPositions(view.players.map((p) => p.pos), events);
  const wellChoices = useMemo(() => new Set(legalMoves.flatMap((m) => (m.type === 'well' && m.field !== null ? [m.field] : []))), [legalMoves]);
  const year = Math.floor(view.round / 8) + 1;
  const season = SEASONS[Math.floor(view.round / 2) % 4];

  const tapField = (field: number) => {
    if (wellChoices.has(field)) onMove({ type: 'well', field });
    else setDetail(field);
  };

  const ranks = view.players
    .map((p, i) => ({ seat: i, gone: p.gone, worth: worth(view, i) }))
    .filter((r) => !r.gone)
    .sort((a, b) => b.worth - a.worth);

  return (
    <div className="mkt-root">
      <div className="mkt-board">
        {Array.from({ length: FIELD_COUNT }, (_, field) => {
          const { row, col } = cellOf(field);
          const g = guildOf(field);
          const owner = view.owner[field]!;
          return (
            <button
              key={field}
              type="button"
              className="mkt-field"
              style={{ gridRow: row, gridColumn: col }}
              data-corner={isCorner(field) || undefined}
              data-mortgaged={view.mortgaged[field] || undefined}
              data-pick={wellChoices.has(field) || undefined}
              aria-label={`${FIELD_NAMES[field]}${owner >= 0 ? `, gehört ${name(owner)}` : g !== null ? ', frei' : ''}`}
              onClick={() => tapField(field)}
            >
              {g !== null && <span className="mkt-strip" style={{ background: g >= 0 ? GUILDS[g]!.color : '#a8a29e' }} />}
              <span className="mkt-icon" aria-hidden="true">
                {FIELD_ICONS[field]}
              </span>
              {g !== null && owner < 0 && <span className="mkt-price">{priceOf(field)}</span>}
              {view.level[field]! > 0 && <span className="mkt-levels">{levelMark(view.level[field]!)}</span>}
              {owner >= 0 && <span className="mkt-owner" style={{ '--mkt-owner': FAMILY_COLORS[owner] } as React.CSSProperties} />}
            </button>
          );
        })}

        <div className="mkt-center">
          <div className="mkt-season">
            <span>
              {season}, Jahr {year} von {view.options.years}
            </span>
            <span>
              Runde {Math.min(view.round + 1, view.rounds)} / {view.rounds}
            </span>
          </div>
          {view.news && (
            <div className="mkt-news">
              <strong>📣 {NEWS_TEXT[view.news].title}</strong>
              {NEWS_TEXT[view.news].text}
            </div>
          )}
          {view.dice && (
            <div className="mkt-dice" aria-label={`Gewürfelt: ${view.dice[0]} und ${view.dice[1]}`}>
              <div className="mkt-die">
                <Die3D value={view.dice[0]} rollKey={rollKey} className="mkt-die3d" />
              </div>
              <div className="mkt-die">
                <Die3D value={view.dice[1]} rollKey={rollKey} delayMs={45} className="mkt-die3d" />
              </div>
            </div>
          )}
          {view.auction && (
            <div className="mkt-panel">
              <div className="mkt-panel-title">🔨 Versteigerung: {FIELD_NAMES[view.auction.field]} (Liste {priceOf(view.auction.field)})</div>
              <div>{view.auction.leader !== null ? `Höchstes Gebot: ${view.auction.bid} 🥨 von ${name(view.auction.leader)}` : 'Noch kein Gebot'}</div>
            </div>
          )}
          <Actions view={view} seat={seat} legalMoves={legalMoves} hint={hint} onMove={onMove} name={name} openManage={() => setSheet('manage')} openTrade={() => setSheet('trade')} />
          <div className="mkt-ranks" aria-label="Vermögen">
            {ranks.map((r) => (
              <span key={r.seat}>
                {FAMILY_ICONS[r.seat]} {r.worth}
              </span>
            ))}
          </div>
          <ul className="mkt-log" aria-live="polite">
            {log.map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="mkt-carts">
          {carts.map((pos, s) => {
            if (view.players[s]!.gone) return null;
            const { row, col } = cellOf(pos);
            // Mehrere Karren auf einem Feld stehen leicht versetzt.
            const dx = ((s % 3) - 1) * 2.4;
            const dy = (s > 2 ? 1 : -1) * 1.6;
            return (
              <span
                key={s}
                className="mkt-cart"
                data-active={view.turn === s || undefined}
                style={{ left: `${(col - 0.5) * 10 + dx}%`, top: `${(row - 0.5) * 10 + dy}%`, '--mkt-cart': FAMILY_COLORS[s] } as React.CSSProperties}
                aria-hidden="true"
              >
                {FAMILY_ICONS[s]}
              </span>
            );
          })}
        </div>
      </div>

      {detail !== null && <FieldSheet view={view} field={detail} name={name} onClose={() => setDetail(null)} />}
      {sheet === 'manage' && seat !== null && <ManageSheet view={view} seat={seat} legalMoves={legalMoves} onMove={onMove} onClose={() => setSheet(null)} />}
      {sheet === 'trade' && seat !== null && <TradeSheet view={view} seat={seat} name={name} onMove={onMove} onClose={() => setSheet(null)} />}
    </div>
  );
}

export const gameUi: GameUi<MarketView, MarketMove> = {
  Board,
  SeatSymbol: ({ seat, className = '' }) => <span className={className}>{FAMILY_ICONS[seat] ?? '🥨'}</span>,
  seatLabel: (seat) => `Familie ${FAMILIES[seat] ?? seat + 1}`,
  seatDetail: (view, seat) => {
    const p = view.players[seat];
    if (!p) return null;
    return p.gone ? 'hat aufgegeben' : `${p.cash} 🥨${p.jailTurns >= 0 ? ' · Kerker' : ''}`;
  },
  seatScore: (view, seat) => (view.players[seat]?.gone ? null : worth(view, seat)),
  sounds: {
    rolled: 'wuerfeln',
    bought: 'fs-kauf',
    built: 'mauer-stein',
    ware: 'fs-auszahlung',
    goMoney: 'punkte-sammeln',
    news: 'ansage-glocke',
    card: 'karte-umdrehen',
    jailed: 'steuer-nimmt',
    partnered: 'nh-wappen-stempel',
    traded: 'karten-tausch',
    bid: 'poker-chips-bet',
  },
};
