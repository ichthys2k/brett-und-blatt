import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { inspectPosition } from './inspectPosition';

/*
 * Großansicht für Karten, Plättchen und Porträts (#418): Bild, Name, Regeltext, Schlüsselwörter, Werte.
 * - Maus: nach kurzem Verweilen schwebt die Ansicht neben dem Element (nur mit feinem Zeiger und ab
 *   900 px Fensterbreite), Rechtsklick öffnet sie als Fenster.
 * - Finger: lange drücken öffnet das Fenster; der Klick danach wird geschluckt.
 * - Tastatur: Fokus zeigt die schwebende Ansicht, Taste „i“ öffnet das Fenster, Escape schließt.
 * Ein Provider zeichnet für alle Elemente darunter genau eine Ansicht.
 */

export interface InspectImage {
  /** Kleine Fassung, die sofort gezeigt wird. */
  src: string;
  /** Größere Fassung (#419); wird im Hintergrund geladen und dann eingetauscht. */
  largeSrc?: string;
  /** Breite durch Höhe, Standard 3/4. */
  aspect?: number;
  /** Rundes Medaillon (Avatare, Hofaufträge). */
  round?: boolean;
}

export interface InspectKeyword {
  emoji?: string;
  name: string;
  text: string;
}

export interface InspectStat {
  label: string;
  value: string;
  tone?: 'cost' | 'attack' | 'health' | 'default';
  /** Gegenüber dem Grundwert verstärkt (`up`) oder geschwächt (`down`). */
  change?: 'up' | 'down';
}

export interface InspectContent {
  title: string;
  /** Kleine Zeile unter dem Titel, z. B. „Vögel · selten“. */
  subtitle?: string;
  image?: InspectImage;
  /** Rückfall, wenn es kein Bild gibt oder es nicht lädt. */
  emoji?: string;
  /** Regeltext, eine Zeile je Eintrag. */
  lines?: string[];
  keywords?: InspectKeyword[];
  /** Spruch, kursiv in Anführungszeichen. */
  quote?: string;
  stats?: InspectStat[];
  footer?: ReactNode;
  /**
   * Eigene Darstellung des ganzen Inhalts (z. B. die Karte im Rahmen des Spiels, #437). Ersetzt Bild,
   * Titel, Werte und Text der Standardansicht; die übrigen Felder bleiben die Beschreibung (Titel als
   * Name des Fensters, Tests, Spiele ohne eigene Darstellung). Nur aus der Sicht, nichts Verdecktes.
   */
  body?: ReactNode;
}

/** Inhalt oder eine Funktion, die ihn erst beim Ansehen baut (spart Arbeit bei vielen Karten). */
export type InspectSource = InspectContent | (() => InspectContent | undefined) | undefined;

export type InspectExtraProps = HTMLAttributes<HTMLElement> & { [data: `data-${string}`]: string | undefined };

export interface InspectOptions {
  /** `false`: kein Aufpoppen beim Überfahren (lange drücken, Rechtsklick und „i“ bleiben). */
  hover?: boolean;
  /** Wird aufgerufen, bevor das Fenster aufgeht (z. B. ein begonnenes Ziehen abbrechen). */
  onOpen?: () => void;
}

export interface InspectApi {
  /** Eigenschaften für ein Element, das angesehen werden kann; `extra` wird zuerst aufgerufen. Kein Hook. */
  props: (source: InspectSource, extra?: InspectExtraProps, options?: InspectOptions) => InspectExtraProps;
  /** Fenster von Hand öffnen; `from` bekommt beim Schließen den Fokus zurück. */
  open: (content: InspectContent, from?: HTMLElement | null) => void;
  close: () => void;
}

export const INSPECT_HOVER_DELAY_MS = 300;
/** Ereignis am Fenster, wenn das Fenster der Großansicht aufgeht. */
export const INSPECT_OPEN_EVENT = 'bub-inspect-open';
export const INSPECT_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 8;
/** Unterhalb dieser Fensterbreite gibt es nur das Fenster, keine schwebende Ansicht. */
export const INSPECT_FLOAT_MIN_WIDTH = 900;

const NOOP_API: InspectApi = {
  props: (_source, extra = {}) => extra,
  open: () => undefined,
  close: () => undefined,
};

const InspectContext = createContext<InspectApi | null>(null);

const resolveSource = (source: InspectSource): InspectContent | undefined => (typeof source === 'function' ? source() : source);

function floatAllowed(): boolean {
  return typeof window !== 'undefined' && window.innerWidth >= INSPECT_FLOAT_MIN_WIDTH;
}

function finePointer(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false);
}

/** Die Großansicht der Elemente darunter. Mehrere Provider dürfen ineinander liegen; der innerste gilt. */
export function CardInspectProvider({ children }: { children: ReactNode }) {
  const [float, setFloat] = useState<{ content: InspectContent; rect: DOMRect } | null>(null);
  const [dialog, setDialog] = useState<{ content: InspectContent; from: HTMLElement | null } | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const stopPress = useRef<(() => void) | null>(null);
  /** Fokus kehrt nach dem Schließen zurück: dann nicht gleich wieder schweben. */
  const quietFocus = useRef(false);

  const api = useMemo<InspectApi>(() => {
    const hideFloat = () => {
      window.clearTimeout(hoverTimer.current);
      setFloat(null);
    };
    const openWith = (content: InspectContent | undefined, from: HTMLElement | null, options?: InspectOptions) => {
      if (!content) return;
      hideFloat();
      options?.onOpen?.();
      // Ein laufender Druck zum Ziehen (usePointerDrag) bricht ab, sonst spielte das Loslassen die Karte aus.
      window.dispatchEvent(new CustomEvent(INSPECT_OPEN_EVENT));
      setDialog({ content, from });
    };
    const showFloat = (source: InspectSource, el: HTMLElement, delay: number) => {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = window.setTimeout(() => {
        if (!el.isConnected) return;
        const content = resolveSource(source);
        if (content) setFloat({ content, rect: el.getBoundingClientRect() });
      }, delay);
    };
    const startPress = (event: ReactPointerEvent<HTMLElement>, source: InspectSource, options?: InspectOptions) => {
      stopPress.current?.();
      const el = event.currentTarget;
      const { clientX, clientY, pointerId } = event;
      const mine = (e: PointerEvent) => e.pointerId === pointerId;
      const stop = () => {
        window.clearTimeout(timer);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
        stopPress.current = null;
      };
      const onMove = (e: PointerEvent) => {
        if (mine(e) && Math.hypot(e.clientX - clientX, e.clientY - clientY) > MOVE_TOLERANCE_PX) stop();
      };
      const onEnd = (e: PointerEvent) => {
        if (mine(e)) stop();
      };
      const timer = window.setTimeout(() => {
        stop();
        // Der Klick nach dem Loslassen darf die Karte nicht ausspielen.
        const swallow = (click: MouseEvent) => {
          click.stopPropagation();
          click.preventDefault();
        };
        window.addEventListener('click', swallow, true);
        const release = (e: PointerEvent) => {
          if (!mine(e)) return;
          window.removeEventListener('pointerup', release);
          window.removeEventListener('pointercancel', release);
          window.setTimeout(() => window.removeEventListener('click', swallow, true), 50);
        };
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
        openWith(resolveSource(source), el, options);
      }, INSPECT_PRESS_MS);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
      stopPress.current = stop;
    };

    return {
      props(source, extra = {}, options = {}) {
        if (!source) return extra;
        return {
          ...extra,
          onPointerEnter: (e) => {
            extra.onPointerEnter?.(e);
            // e.buttons ≠ 0: Es wird gerade etwas gezogen, dann stört die Ansicht nur.
            if (e.pointerType === 'mouse' && e.buttons === 0 && options.hover !== false && finePointer() && floatAllowed()) showFloat(source, e.currentTarget, INSPECT_HOVER_DELAY_MS);
          },
          onPointerLeave: (e) => {
            extra.onPointerLeave?.(e);
            hideFloat();
          },
          onPointerDown: (e) => {
            extra.onPointerDown?.(e);
            hideFloat();
            if (e.pointerType !== 'mouse' && e.button === 0) startPress(e, source, options);
          },
          onContextMenu: (e) => {
            extra.onContextMenu?.(e);
            if (e.defaultPrevented) return;
            e.preventDefault();
            stopPress.current?.();
            openWith(resolveSource(source), e.currentTarget, options);
          },
          onFocus: (e) => {
            extra.onFocus?.(e);
            if (quietFocus.current) return;
            if (options.hover !== false && floatAllowed() && e.currentTarget.matches(':focus-visible')) showFloat(source, e.currentTarget, 0);
          },
          onBlur: (e) => {
            extra.onBlur?.(e);
            hideFloat();
          },
          onKeyDown: (e) => {
            extra.onKeyDown?.(e);
            if (e.defaultPrevented || e.key !== 'i' || e.altKey || e.ctrlKey || e.metaKey) return;
            e.preventDefault();
            openWith(resolveSource(source), e.currentTarget, options);
          },
        };
      },
      open: (content, from = null) => openWith(content, from),
      close: () => setDialog(null),
    };
  }, []);

  useEffect(() => {
    const off = () => {
      window.clearTimeout(hoverTimer.current);
      setFloat(null);
    };
    window.addEventListener('scroll', off, true);
    window.addEventListener('blur', off);
    window.addEventListener('pointerdown', off, true);
    return () => {
      window.removeEventListener('scroll', off, true);
      window.removeEventListener('blur', off);
      window.removeEventListener('pointerdown', off, true);
      window.clearTimeout(hoverTimer.current);
      stopPress.current?.();
    };
  }, []);

  const closeDialog = () => {
    const from = dialog?.from;
    setDialog(null);
    if (from?.isConnected) {
      quietFocus.current = true;
      from.focus({ preventScroll: true });
      window.setTimeout(() => (quietFocus.current = false), 0);
    }
  };

  const portal = typeof document !== 'undefined';
  return (
    <InspectContext.Provider value={api}>
      {children}
      {portal && float && !dialog && createPortal(<InspectFloat content={float.content} rect={float.rect} />, document.body)}
      {portal && dialog && createPortal(<InspectDialog content={dialog.content} onClose={closeDialog} />, document.body)}
    </InspectContext.Provider>
  );
}

/** Die Großansicht des nächsten Providers; ohne Provider tut sie nichts. */
export function useInspect(): InspectApi {
  return useContext(InspectContext) ?? NOOP_API;
}

/** Eigenschaften für ein einzelnes Element (Hook). In Listen `useInspect().props(…)` verwenden. */
export function useInspectProps(source: InspectSource, extra?: InspectExtraProps, options?: InspectOptions): InspectExtraProps {
  return useInspect().props(source, extra, options);
}

function InspectFloat({ content, rect }: { content: InspectContent; rect: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      // Maße ohne die Einblend-Skalierung (offset… statt getBoundingClientRect).
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      const spot = inspectPosition(rect, { width, height }, { width: window.innerWidth, height: window.innerHeight });
      el.style.left = `${spot.left}px`;
      el.style.top = `${spot.top}px`;
      el.dataset.side = spot.side;
      el.style.visibility = 'visible';
    };
    place();
    // Lädt das Bild nach, ändert sich die Höhe: neu ausrichten.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [rect, content]);
  return (
    <div ref={ref} className="bub-inspect-float" role="tooltip" style={{ visibility: 'hidden' }}>
      <InspectBody content={content} />
    </div>
  );
}

function InspectDialog({ content, onClose }: { content: InspectContent; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="bub-inspect-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bub-inspect-panel" role="dialog" aria-modal="true" aria-label={content.title}>
        <InspectBody content={content} onClose={onClose} closeRef={closeRef} />
      </div>
    </div>
  );
}

/** Der Inhalt der Großansicht, schwebend wie im Fenster. Ohne DOM darstellbar (Tests). */
export function InspectBody({ content, onClose, closeRef }: { content: InspectContent; onClose?: () => void; closeRef?: RefObject<HTMLButtonElement | null> }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [content.image?.src]);
  const showArt = Boolean(content.image) && !broken;
  if (content.body) {
    return (
      <div className="bub-inspect-body bub-inspect-custom">
        {content.body}
        {onClose && (
          <button ref={closeRef} type="button" className="bub-inspect-close" onClick={onClose}>
            Schließen
          </button>
        )}
      </div>
    );
  }
  return (
    <div className={`bub-inspect-body ${showArt ? 'bub-inspect-has-art' : ''}`}>
      {showArt && content.image ? (
        <InspectArt key={`${content.image.src}|${content.image.largeSrc ?? ''}`} image={content.image} onBroken={() => setBroken(true)} />
      ) : content.emoji ? (
        <span className="bub-inspect-emoji" aria-hidden="true">
          {content.emoji}
        </span>
      ) : null}
      <div className="bub-inspect-info">
        <strong className="bub-inspect-title">{content.title}</strong>
        {content.subtitle && <span className="bub-inspect-subtitle">{content.subtitle}</span>}
        {content.stats && content.stats.length > 0 && (
          <ul className="bub-inspect-stats">
            {content.stats.map((stat) => (
              <li key={stat.label} className="bub-inspect-stat" data-tone={stat.tone ?? 'default'} data-change={stat.change} aria-label={`${stat.label}: ${stat.value}`}>
                <span className="bub-inspect-stat-label" aria-hidden="true">
                  {stat.label}
                </span>
                <span className="bub-inspect-stat-value" aria-hidden="true">
                  {stat.value}
                </span>
              </li>
            ))}
          </ul>
        )}
        {content.lines && content.lines.length > 0 && (
          <div className="bub-inspect-lines">
            {content.lines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        )}
        {content.keywords && content.keywords.length > 0 && (
          <ul className="bub-inspect-keywords">
            {content.keywords.map((keyword) => (
              <li key={keyword.name}>
                <strong>
                  {keyword.emoji ? `${keyword.emoji} ` : ''}
                  {keyword.name}:
                </strong>{' '}
                {keyword.text}
              </li>
            ))}
          </ul>
        )}
        {content.quote && <p className="bub-inspect-quote">„{content.quote}“</p>}
        {content.footer}
        {onClose && (
          <button ref={closeRef} type="button" className="bub-inspect-close" onClick={onClose}>
            Schließen
          </button>
        )}
      </div>
    </div>
  );
}

/** Bild der Großansicht: erst die kleine Fassung, nach dem Laden die große; nie breiter als die Datei. */
function InspectArt({ image, onBroken }: { image: InspectImage; onBroken: () => void }) {
  const [src, setSrc] = useState(image.src);
  const [natural, setNatural] = useState<number | null>(null);
  // Ein anderes Bild bekommt einen neuen Baustein (key in InspectBody); hier wird nur die große Fassung vorgeladen.
  useEffect(() => {
    if (!image.largeSrc || typeof Image === 'undefined') return;
    let active = true;
    const large = new Image();
    large.onload = () => {
      if (active) setSrc(image.largeSrc!);
    };
    // Fehlt die große Fassung, bleibt still die kleine stehen.
    large.src = image.largeSrc;
    return () => {
      active = false;
    };
  }, [image.src, image.largeSrc]);
  const style = { '--bub-inspect-aspect': String(image.aspect ?? 3 / 4), ...(natural ? { maxWidth: `${natural}px` } : {}) } as CSSProperties;
  return (
    <img
      className={`bub-inspect-art ${image.round ? 'bub-inspect-art-round' : ''}`}
      src={src}
      alt=""
      decoding="async"
      draggable={false}
      style={style}
      // Liegt das Bild schon im Zwischenspeicher, kommt onLoad vor dem Anhängen des Handlers: dann hier messen.
      ref={(img) => {
        if (img?.complete && img.naturalWidth && natural !== img.naturalWidth) setNatural(img.naturalWidth);
      }}
      onLoad={(event) => setNatural(event.currentTarget.naturalWidth || null)}
      onError={() => (src === image.src ? onBroken() : setSrc(image.src))}
    />
  );
}
