import type { ButtonHTMLAttributes } from 'react';

export type KnsButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

export interface KnsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: KnsButtonVariant;
  size?: 'm' | 'l';
}

/** Knopf der Konsole (#636): `primary` genau einmal je Ansicht, `danger` für Gefährliches, `quiet` ohne Fläche. */
export function KnsButton({ variant = 'secondary', size = 'm', className = '', type = 'button', ...rest }: KnsButtonProps) {
  const classes = ['kns-button', variant !== 'secondary' ? `kns-button-${variant}` : '', size === 'l' ? 'kns-button-l' : '', className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...rest} />;
}
