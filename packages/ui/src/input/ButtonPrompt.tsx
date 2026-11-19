import { useInputSource } from './InputContext';

export interface PromptItem {
  key: string;
  label: string;
}

const DEFAULT_PROMPTS: readonly PromptItem[] = [
  { key: 'A', label: 'Auswählen' },
  { key: 'B', label: 'Zurück' },
  { key: 'X', label: 'Großansicht' },
  { key: 'LB/RB', label: 'Bereich' },
  { key: '☰', label: 'Menü' },
];

export interface ButtonPromptProps {
  items?: readonly PromptItem[];
  className?: string;
}

/**
 * Zeigt kompakte Controller-Tastenhinweise, sobald zuletzt ein Gamepad genutzt wurde.
 * Bei Maus- oder Touch-Bedienung bleibt die Leiste unsichtbar.
 */
export function ButtonPrompt({ items = DEFAULT_PROMPTS, className = '' }: ButtonPromptProps) {
  const { inputSource, connectedGamepads } = useInputSource();
  if (inputSource !== 'gamepad' && connectedGamepads === 0) return null;
  if (inputSource !== 'gamepad') return null;

  return (
    <div className={`bub-prompt-bar ${className}`} aria-hidden="true">
      {items.map((item) => (
        <span key={`${item.key}-${item.label}`} className="bub-prompt-item">
          <kbd className="bub-prompt-key">{item.key}</kbd>
          <span className="bub-prompt-label">{item.label}</span>
        </span>
      ))}
    </div>
  );
}
