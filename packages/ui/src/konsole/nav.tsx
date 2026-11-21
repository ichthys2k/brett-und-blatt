import { useEffect, useState, type ReactNode } from 'react';
import { splitMode } from './logic';

/** Fenstergröße, aktualisiert bei Größenänderung und Drehen. */
export function useViewportSize(): { width: number; height: number } {
  const read = () => (typeof window === 'undefined' ? { width: 1280, height: 800 } : { width: window.innerWidth, height: window.innerHeight });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const update = () => setSize(read());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return size;
}

export interface KnsSubTab {
  id: string;
  label: ReactNode;
  href: string;
}

/** Unterreiter (#636): zweite Navigationsebene, waagrecht rollend; der aktive trägt `aria-current`. */
export function KnsSubTabs({ tabs, current, label = 'Unterreiter', className = '' }: { tabs: readonly KnsSubTab[]; current: string | null; label?: string; className?: string }) {
  return (
    <nav className={`kns-subtabs ${className}`.trim()} aria-label={label}>
      {tabs.map((tab) => (
        <a key={tab.id} href={tab.href} className="kns-subtab" aria-current={tab.id === current ? 'page' : undefined} data-kns-id={`sub:${tab.id}`}>
          {tab.label}
        </a>
      ))}
    </nav>
  );
}

export interface KnsSplitNavItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
}

export interface KnsSplitProps {
  nav: readonly KnsSplitNavItem[];
  current: string;
  onSelect: (id: string) => void;
  /** Vorleser-Name der Kategorienliste. */
  label?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Kategorien und Inhalt (#636): im breiten Querformat Kategorien links, sonst als rollende Chip-Zeile über dem
 * Inhalt (`splitMode`).
 */
export function KnsSplit({ nav, current, onSelect, label = 'Kategorien', className = '', children }: KnsSplitProps) {
  const { width, height } = useViewportSize();
  const mode = splitMode(width, height);
  return (
    <div className={`kns-split ${className}`.trim()} data-mode={mode}>
      <nav className="kns-split-nav" aria-label={label}>
        {nav.map((item) => (
          <button key={item.id} type="button" className="kns-split-tab" aria-current={item.id === current ? 'true' : undefined} data-kns-id={`cat:${item.id}`} onClick={() => onSelect(item.id)}>
            {item.icon && (
              <span className="kns-split-icon" aria-hidden="true">
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="kns-split-body">{children}</div>
    </div>
  );
}
