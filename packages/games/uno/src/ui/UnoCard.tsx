import React from 'react';
import { getActiveFace, mathCardLabel } from '../rules';
import type { CardFace, UnoCard, UnoColor } from '../types';

export interface UnoCardViewProps {
  card?: UnoCard;
  face?: CardFace;
  side?: 'light' | 'dark';
  isBack?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  mathMode?: boolean;
  onClick?: () => void;
  className?: string;
}

const COLOR_MAP: Record<UnoColor, { bg: string; text: string; name: string }> = {
  red: { bg: '#dc2626', text: '#ffffff', name: 'Rot' },
  yellow: { bg: '#eab308', text: '#713f12', name: 'Gelb' },
  green: { bg: '#16a34a', text: '#ffffff', name: 'Grün' },
  blue: { bg: '#2563eb', text: '#ffffff', name: 'Blau' },
  orange: { bg: '#ea580c', text: '#ffffff', name: 'Orange' },
  teal: { bg: '#0d9488', text: '#ffffff', name: 'Petrol' },
  purple: { bg: '#9333ea', text: '#ffffff', name: 'Lila' },
  pink: { bg: '#db2777', text: '#ffffff', name: 'Rosa' },
  wild: { bg: '#18181b', text: '#ffffff', name: 'Farbe wählbar' },
};

function formatCardSymbol(face: CardFace, mathExpr: string | null): { center: React.ReactNode; corner: React.ReactNode } {
  if (mathExpr) {
    return {
      center: <span className="text-xs sm:text-sm font-black tracking-tight text-center leading-tight px-0.5">{mathExpr}</span>,
      corner: '?',
    };
  }
  if (face.animal) {
    return { center: <span className="text-3xl sm:text-4xl">{face.animal}</span>, corner: face.type };
  }

  switch (face.type) {
    case 'skip':
      return { center: <span className="text-3xl font-black">⊘</span>, corner: '⊘' };
    case 'skipAll':
      return { center: <span className="text-2xl font-black tracking-tighter">⊘⊘</span>, corner: '⊘⊘' };
    case 'reverse':
      return { center: <span className="text-3xl font-black">⇄</span>, corner: '⇄' };
    case 'draw1':
      return { center: <span className="text-2xl font-black">+1</span>, corner: '+1' };
    case 'draw2':
    case 'wildTargetDraw2':
      return { center: <span className="text-3xl font-black">+2</span>, corner: '+2' };
    case 'wildDraw4':
    case 'wildReverseDraw4':
      return { center: <span className="text-3xl font-black">+4</span>, corner: '+4' };
    case 'flipDraw5':
      return { center: <span className="text-3xl font-black">+5</span>, corner: '+5' };
    case 'draw6':
    case 'wildDraw6':
      return { center: <span className="text-3xl font-black">+6</span>, corner: '+6' };
    case 'draw10':
    case 'wildDraw10':
      return { center: <span className="text-2xl font-black">+10</span>, corner: '+10' };
    case 'flip':
      return { center: <span className="text-3xl font-black">↻</span>, corner: '↻' };
    case 'roulette':
      return { center: <span className="text-3xl">🎯</span>, corner: '🎯' };
    case 'wildSwap':
      return { center: <span className="text-3xl font-black">⇆</span>, corner: '⇆' };
    case 'wild':
      return {
        center: (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white overflow-hidden grid grid-cols-2 grid-rows-2 shadow-inner">
            <div className="bg-[#dc2626]" />
            <div className="bg-[#2563eb]" />
            <div className="bg-[#eab308]" />
            <div className="bg-[#16a34a]" />
          </div>
        ),
        corner: '★',
      };
    default:
      return { center: <span className="text-3xl sm:text-4xl font-extrabold">{face.type}</span>, corner: face.type };
  }
}

export const UnoCardView: React.FC<UnoCardViewProps> = ({
  card,
  face: faceProp,
  side = 'light',
  isBack = false,
  disabled = false,
  highlight = false,
  selected = false,
  size = 'md',
  mathMode = false,
  onClick,
  className = '',
}) => {
  const face = faceProp ?? (card ? getActiveFace(card, side) : undefined);

  const sizeClasses = {
    sm: 'w-12 h-18 text-xs',
    md: 'w-16 h-24 sm:w-20 sm:h-30 text-sm',
    lg: 'w-22 h-34 sm:w-26 sm:h-38 text-base',
  }[size];

  // Rückseite der Karte
  if (isBack || !face) {
    const isDark = side === 'dark';
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`relative select-none rounded-xl border-2 border-white/20 shadow-md flex items-center justify-center font-black transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
          isDark ? 'bg-gradient-to-br from-purple-900 to-zinc-950 text-teal-400' : 'bg-gradient-to-br from-red-600 to-zinc-900 text-yellow-300'
        } ${sizeClasses} ${
          highlight ? 'ring-2 ring-yellow-400 shadow-xl cursor-pointer hover:brightness-110' : ''
        } ${disabled ? 'opacity-70 cursor-default' : 'cursor-pointer active:scale-95'} ${className}`}
        title={onClick && !disabled ? 'Karte ziehen' : 'Nachziehstapel'}
      >
        <div className="w-4/5 h-4/5 rounded-full border border-white/30 flex items-center justify-center -rotate-12 bg-black/40 shadow-inner">
          <span className="font-extrabold tracking-tighter text-sm sm:text-base drop-shadow">Eins!</span>
        </div>
      </button>
    );
  }

  const colorInfo = COLOR_MAP[face.color] ?? COLOR_MAP.wild;
  const isWild = face.color === 'wild';
  const mathExpr = mathMode ? mathCardLabel(face.type, card?.id ?? face.type) : null;
  const symbols = formatCardSymbol(face, mathExpr);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative select-none rounded-xl border-2 transition-all duration-150 shadow-md overflow-hidden flex flex-col justify-between p-1 sm:p-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
        sizeClasses
      } ${highlight ? 'ring-2 ring-yellow-400 -translate-y-2 shadow-xl cursor-pointer hover:brightness-110' : ''} ${
        selected ? 'ring-4 ring-white -translate-y-3' : ''
      } ${disabled ? 'opacity-70 cursor-default' : 'active:scale-95'} ${className}`}
      style={{
        backgroundColor: isWild ? '#18181b' : colorInfo.bg,
        borderColor: isWild ? '#a1a1aa' : '#ffffff44',
      }}
      title={`${colorInfo.name} ${mathExpr ?? face.type}`}
    >
      {/* Obere linke Ecke */}
      <div className="text-left font-black leading-none drop-shadow-sm text-white">{symbols.corner}</div>

      {/* Mitte: Weißes Oval mit Symbol */}
      <div className="absolute inset-2 sm:inset-3 rounded-full bg-white/20 -rotate-12 flex items-center justify-center shadow-inner overflow-hidden border border-white/30 text-white drop-shadow">
        <div className="rotate-12 flex items-center justify-center">{symbols.center}</div>
      </div>

      {/* Untere rechte Ecke */}
      <div className="text-right font-black leading-none drop-shadow-sm text-white rotate-180">{symbols.corner}</div>
    </button>
  );
};
