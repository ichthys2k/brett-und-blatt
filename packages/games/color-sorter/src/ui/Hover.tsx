import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Inhalt der Sprechblase, die beim Überfahren einer Karte oder Kachel erscheint. */
export interface Tip {
  emoji?: string;
  title: string;
  lines: string[];
}

/** Aus einem Beschreibungstext (Teile durch „ · “ getrennt) werden einzelne Zeilen. */
export function tipFrom(d: { emoji?: string; title: string; text: string }, extra: string[] = []): Tip {
  return { emoji: d.emoji, title: d.title, lines: [...d.text.split(' · ').filter(Boolean), ...extra] };
}

interface HoverApi {
  show: (tip: Tip, el: HTMLElement) => void;
  hide: () => void;
}

const HoverContext = createContext<HoverApi | null>(null);

const SHOW_DELAY_MS = 120;

/** Eine einzige Sprechblase für alle Karten: erscheint bei der Maus nach kurzer Verzögerung und bei Tastaturfokus. */
export function HoverProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ tip: Tip; rect: DOMRect } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const api = useMemo<HoverApi>(
    () => ({
      show(tip, el) {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setState({ tip, rect: el.getBoundingClientRect() }), SHOW_DELAY_MS);
      },
      hide() {
        window.clearTimeout(timer.current);
        setState(null);
      },
    }),
    [],
  );
  useEffect(() => {
    const off = () => api.hide();
    window.addEventListener('scroll', off, true);
    window.addEventListener('blur', off);
    return () => {
      window.removeEventListener('scroll', off, true);
      window.removeEventListener('blur', off);
      window.clearTimeout(timer.current);
    };
  }, [api]);
  return (
    <HoverContext.Provider value={api}>
      {children}
      {state && typeof document !== 'undefined' && createPortal(<Bubble tip={state.tip} rect={state.rect} />, document.body)}
    </HoverContext.Provider>
  );
}

function Bubble({ tip, rect }: { tip: Tip; rect: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    const above = rect.top - height - 10;
    el.style.left = `${left}px`;
    el.style.top = `${above >= 8 ? above : Math.min(rect.bottom + 10, window.innerHeight - height - 8)}px`;
    el.style.visibility = 'visible';
  }, [rect, tip]);
  return (
    <div ref={ref} className="cs-tip" role="tooltip" style={{ visibility: 'hidden' }}>
      <strong className="cs-tip-title">
        {tip.emoji && <span aria-hidden="true">{tip.emoji} </span>}
        {tip.title}
      </strong>
      {tip.lines.map((line, i) => (
        <span key={i} className="cs-tip-line">
          {line}
        </span>
      ))}
    </div>
  );
}

export type ExtraProps = HTMLAttributes<HTMLElement> & { [data: `data-${string}`]: string | undefined };

/**
 * Eigenschaften, die ein Element für die Sprechblase braucht, verbunden mit weiteren (z. B. Ziehen).
 * Berührung zeigt die Blase nicht (dort gibt es die Info-Box); beim Drücken verschwindet sie.
 */
export function useTipProps(tip: Tip | undefined, extra: ExtraProps = {}): ExtraProps {
  const api = useContext(HoverContext);
  if (!tip || !api) return extra;
  return {
    ...extra,
    onPointerEnter: (e) => {
      extra.onPointerEnter?.(e);
      if (e.pointerType === 'mouse') api.show(tip, e.currentTarget);
    },
    onPointerLeave: (e) => {
      extra.onPointerLeave?.(e);
      api.hide();
    },
    onPointerDown: (e) => {
      api.hide();
      extra.onPointerDown?.(e);
    },
    onFocus: (e) => {
      extra.onFocus?.(e);
      if (e.currentTarget.matches(':focus-visible')) api.show(tip, e.currentTarget);
    },
    onBlur: (e) => {
      extra.onBlur?.(e);
      api.hide();
    },
  };
}
