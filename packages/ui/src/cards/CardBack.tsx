import type { CrestSpec } from '@brett-und-blatt/engine';
import { useId, type CSSProperties } from 'react';
import { PlayerCrest } from '../crest/PlayerCrest';
import { useCardCosmetics } from './CardCosmeticsContext';
import { isPaintedCardBack, paintedCardBackUrl, type PaintedCardBackId } from './paintedBacks';

export type CardBackId =
  | 'classic-red'
  | 'classic-blue'
  | 'tavern-oak'
  | 'bavarian-gold'
  | 'jester-velvet'
  | 'dragon-scale'
  | 'royal-crest'
  | 'custom-media'
  | PaintedCardBackId;

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type PlayerCrestData = CrestSpec;

export const DEFAULT_CREST_SPEC: CrestSpec = {
  animal: '🦁',
  colors: 'rot-gold',
  division: 'quer',
  shield: 'klassisch',
  ornaments: ['krone', 'lorbeer'],
  inRoom: true,
};

export interface CardBackProps {
  design?: CardBackId;
  crest?: CrestSpec;
  customImageUrl?: string;
  size?: CardSize;
  className?: string;
  style?: CSSProperties;
  label?: string;
}

const CREST_SIZE_BY_CARD_SIZE: Record<CardSize, number> = {
  xs: 34,
  sm: 44,
  md: 58,
  lg: 78,
  xl: 104,
};

/**
 * Eigenständige Kartenrücken-Komponente mit 8 hochwertigen Designs
 * (6 vektorbasierte Klassiker/Themen, Spielerwappen royal-crest und custom-media).
 */
export function CardBack({
  design,
  crest,
  customImageUrl,
  size,
  className = '',
  style,
  label = 'Kartenrücken',
}: CardBackProps) {
  const cosmetics = useCardCosmetics();
  const rawId = useId().replace(/:/g, '');

  const chosenDesign: CardBackId = design ?? cosmetics.cardBack ?? 'classic-red';
  const effectiveCrest = crest ?? cosmetics.crest ?? DEFAULT_CREST_SPEC;
  // Gemalte Rücken (#314) zeigen ihr Bild wie custom-media; fehlt die Datei, gilt classic-red.
  const paintedUrl = isPaintedCardBack(chosenDesign) ? paintedCardBackUrl(chosenDesign) : undefined;
  const effectiveDesign: CardBackId = isPaintedCardBack(chosenDesign) && !paintedUrl ? 'classic-red' : chosenDesign;
  const effectiveCustomImage = paintedUrl ?? customImageUrl ?? cosmetics.customImageUrl;

  const sizeClass = size ? `bub-card-size-${size}` : '';
  const classes = `bub-card-back bub-card-back--${effectiveDesign} ${sizeClass} ${className}`.trim();

  // custom-media: Bild zeigen, falls URL vorhanden; sonst eleganter Fallback auf classic-red
  if ((effectiveDesign === 'custom-media' || paintedUrl) && effectiveCustomImage) {
    return (
      <div className={classes} style={style} role="img" aria-label={label}>
        <img
          src={effectiveCustomImage}
          alt={label}
          className="bub-card-back-custom-img"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 'inherit' }}
        />
        <div
          className="bub-card-back-custom-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            border: '2px solid rgba(255,255,255,0.7)',
            borderRadius: 'inherit',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }

  const isRoyalCrest = effectiveDesign === 'royal-crest';
  const crestPixelSize = size ? CREST_SIZE_BY_CARD_SIZE[size] : 64;

  return (
    <div className={classes} style={{ position: 'relative', width: '100%', height: '100%', ...style }} role="img" aria-label={label}>
      <svg
        viewBox="0 0 250 350"
        className="bub-card-back-svg"
        style={{ display: 'block', width: '100%', height: '100%', borderRadius: 'inherit' }}
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`clip-${rawId}`}>
            <rect x="2" y="2" width="246" height="346" rx="18" />
          </clipPath>

          {/* Muster classic-red */}
          <pattern id={`pat-red-${rawId}`} width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="20" height="20" fill="#881313" />
            <path d="M0 10 L20 10 M10 0 L10 20" stroke="#b91c1c" strokeWidth="1" opacity="0.6" />
            <polygon points="10,6 14,10 10,14 6,10" fill="#ef4444" opacity="0.4" />
          </pattern>

          {/* Muster classic-blue */}
          <pattern id={`pat-blue-${rawId}`} width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="20" height="20" fill="#172554" />
            <path d="M0 10 L20 10 M10 0 L10 20" stroke="#1d4ed8" strokeWidth="1" opacity="0.6" />
            <circle cx="10" cy="10" r="3" fill="#60a5fa" opacity="0.4" />
          </pattern>

          {/* Muster jester-velvet */}
          <pattern id={`pat-jester-${rawId}`} width="24" height="28" patternUnits="userSpaceOnUse">
            <rect width="24" height="28" fill="#3b0764" />
            <polygon points="12,0 24,14 12,28 0,14" fill="#581c87" opacity="0.8" />
            <circle cx="12" cy="14" r="1.5" fill="#fde047" opacity="0.7" />
          </pattern>

          {/* Muster dragon-scale */}
          <pattern id={`pat-dragon-${rawId}`} width="24" height="20" patternUnits="userSpaceOnUse">
            <rect width="24" height="20" fill="#022c22" />
            <path d="M0 20 C6 10 18 10 24 20 Z" fill="#064e3b" stroke="#047857" strokeWidth="1" />
            <path d="M-12 10 C-6 0 6 0 12 10 Z" fill="#047857" opacity="0.6" />
            <path d="M12 10 C18 0 30 0 36 10 Z" fill="#047857" opacity="0.6" />
          </pattern>

          {/* Muster bavarian-gold */}
          <pattern id={`pat-bavarian-${rawId}`} width="30" height="20" patternUnits="userSpaceOnUse" patternTransform="skewX(-25)">
            <rect width="30" height="20" fill="#ffffff" />
            <polygon points="0,0 15,0 30,20 15,20" fill="#0284c7" />
          </pattern>

          {/* Holzmaserung tavern-oak */}
          <linearGradient id={`grad-oak-${rawId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#451a03" />
            <stop offset="50%" stopColor="#2e1002" />
            <stop offset="100%" stopColor="#3d1804" />
          </linearGradient>

          {/* Royal Crest Damast */}
          <linearGradient id={`grad-royal-${rawId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#310712" />
            <stop offset="50%" stopColor="#1a0409" />
            <stop offset="100%" stopColor="#450a17" />
          </linearGradient>
        </defs>

        <g clipPath={`url(#clip-${rawId})`}>
          {/* 1. Classic Red */}
          {effectiveDesign === 'classic-red' && (
            <>
              <rect x="2" y="2" width="246" height="346" fill={`url(#pat-red-${rawId})`} />
              <rect x="10" y="10" width="230" height="330" rx="12" fill="none" stroke="#fef3c7" strokeWidth="2.5" />
              <rect x="15" y="15" width="220" height="320" rx="9" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 2" />
              {/* Ecken-Ornamente */}
              <path d="M16 34 Q34 34 34 16" fill="none" stroke="#fef3c7" strokeWidth="2" />
              <path d="M234 34 Q216 34 216 16" fill="none" stroke="#fef3c7" strokeWidth="2" />
              <path d="M16 316 Q34 316 34 334" fill="none" stroke="#fef3c7" strokeWidth="2" />
              <path d="M234 316 Q216 316 216 334" fill="none" stroke="#fef3c7" strokeWidth="2" />
              {/* Zentrum */}
              <circle cx="125" cy="175" r="42" fill="#7f1d1d" stroke="#fef3c7" strokeWidth="2.5" />
              <circle cx="125" cy="175" r="36" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" />
              <polygon points="125,142 133,167 158,175 133,183 125,208 117,183 92,175 117,167" fill="#fef3c7" />
            </>
          )}

          {/* 2. Classic Blue */}
          {effectiveDesign === 'classic-blue' && (
            <>
              <rect x="2" y="2" width="246" height="346" fill={`url(#pat-blue-${rawId})`} />
              <rect x="10" y="10" width="230" height="330" rx="12" fill="none" stroke="#f8fafc" strokeWidth="2.5" />
              <rect x="15" y="15" width="220" height="320" rx="9" fill="none" stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 2" />
              <path d="M16 34 Q34 34 34 16" fill="none" stroke="#f8fafc" strokeWidth="2" />
              <path d="M234 34 Q216 34 216 16" fill="none" stroke="#f8fafc" strokeWidth="2" />
              <path d="M16 316 Q34 316 34 334" fill="none" stroke="#f8fafc" strokeWidth="2" />
              <path d="M234 316 Q216 316 216 334" fill="none" stroke="#f8fafc" strokeWidth="2" />
              <circle cx="125" cy="175" r="42" fill="#0f172a" stroke="#f8fafc" strokeWidth="2.5" />
              <polygon points="125,140 135,165 160,175 135,185 125,210 115,185 90,175 115,165" fill="#60a5fa" />
              <circle cx="125" cy="175" r="8" fill="#f8fafc" />
            </>
          )}

          {/* 3. Tavern Oak */}
          {effectiveDesign === 'tavern-oak' && (
            <>
              <rect x="2" y="2" width="246" height="346" fill={`url(#grad-oak-${rawId})`} />
              {/* Holzmaserungslinien */}
              <path d="M30 0 C40 120 20 230 35 350" stroke="#5c2908" strokeWidth="2" fill="none" opacity="0.4" />
              <path d="M90 0 C75 140 100 250 85 350" stroke="#230d03" strokeWidth="2.5" fill="none" opacity="0.5" />
              <path d="M160 0 C175 90 150 240 165 350" stroke="#5c2908" strokeWidth="2" fill="none" opacity="0.4" />
              <path d="M220 0 C210 160 230 270 215 350" stroke="#230d03" strokeWidth="2" fill="none" opacity="0.5" />
              <rect x="12" y="12" width="226" height="326" rx="10" fill="none" stroke="#78350f" strokeWidth="3" />
              {/* Eckbeschläge aus Bronze mit Nieten */}
              <polygon points="12,12 50,12 12,50" fill="#b45309" stroke="#d97706" strokeWidth="1.5" />
              <circle cx="22" cy="22" r="3" fill="#fef3c7" />
              <polygon points="238,12 200,12 238,50" fill="#b45309" stroke="#d97706" strokeWidth="1.5" />
              <circle cx="228" cy="22" r="3" fill="#fef3c7" />
              <polygon points="12,338 50,338 12,300" fill="#b45309" stroke="#d97706" strokeWidth="1.5" />
              <circle cx="22" cy="328" r="3" fill="#fef3c7" />
              <polygon points="238,338 200,338 238,300" fill="#b45309" stroke="#d97706" strokeWidth="1.5" />
              <circle cx="228" cy="328" r="3" fill="#fef3c7" />
              {/* Tavernen-Medaillon */}
              <circle cx="125" cy="175" r="46" fill="#1c0a02" stroke="#d97706" strokeWidth="3" />
              <circle cx="125" cy="175" r="38" fill="none" stroke="#b45309" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x="125" y="187" textAnchor="middle" fontSize="34" aria-hidden="true">
                🍺
              </text>
            </>
          )}

          {/* 4. Bavarian Gold */}
          {effectiveDesign === 'bavarian-gold' && (
            <>
              <rect x="2" y="2" width="246" height="346" fill={`url(#pat-bavarian-${rawId})`} />
              <rect x="10" y="10" width="230" height="330" rx="12" fill="none" stroke="#ca8a04" strokeWidth="4" />
              <rect x="16" y="16" width="218" height="318" rx="8" fill="none" stroke="#fde047" strokeWidth="1.5" />
              {/* Barocke Schnörkel */}
              <path d="M16 46 Q46 46 46 16" fill="none" stroke="#eab308" strokeWidth="3" />
              <path d="M234 46 Q204 46 204 16" fill="none" stroke="#eab308" strokeWidth="3" />
              <path d="M16 304 Q46 304 46 334" fill="none" stroke="#eab308" strokeWidth="3" />
              <path d="M234 304 Q204 304 204 334" fill="none" stroke="#eab308" strokeWidth="3" />
              {/* Zentrums-Wappenschild */}
              <circle cx="125" cy="175" r="44" fill="#0f172a" stroke="#facc15" strokeWidth="3" />
              <text x="125" y="186" textAnchor="middle" fontSize="30" aria-hidden="true">
                👑
              </text>
            </>
          )}

          {/* 5. Jester Velvet */}
          {effectiveDesign === 'jester-velvet' && (
            <>
              <rect x="2" y="2" width="246" height="346" fill={`url(#pat-jester-${rawId})`} />
              <rect x="10" y="10" width="230" height="330" rx="12" fill="none" stroke="#eab308" strokeWidth="3" />
              <rect x="15" y="15" width="220" height="320" rx="9" fill="none" stroke="#fde047" strokeWidth="1" strokeDasharray="3 3" />
              {/* Glöckchen in den Ecken */}
              <circle cx="28" cy="28" r="6" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              <circle cx="222" cy="28" r="6" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              <circle cx="28" cy="322" r="6" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              <circle cx="222" cy="322" r="6" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
              {/* Narren-Medaillon */}
              <circle cx="125" cy="175" r="44" fill="#2e1065" stroke="#fde047" strokeWidth="3" />
              <text x="125" y="186" textAnchor="middle" fontSize="32" aria-hidden="true">
                🎭
              </text>
            </>
          )}

          {/* 6. Dragon Scale */}
          {effectiveDesign === 'dragon-scale' && (
            <>
              <rect x="2" y="2" width="246" height="346" fill={`url(#pat-dragon-${rawId})`} />
              <rect x="10" y="10" width="230" height="330" rx="12" fill="none" stroke="#059669" strokeWidth="3" />
              <rect x="15" y="15" width="220" height="320" rx="9" fill="none" stroke="#34d399" strokeWidth="1.5" strokeDasharray="6 3" />
              {/* Drachenauge / Amulett im Zentrum */}
              <circle cx="125" cy="175" r="46" fill="#022c22" stroke="#10b981" strokeWidth="3" />
              <circle cx="125" cy="175" r="38" fill="none" stroke="#f59e0b" strokeWidth="2" />
              <text x="125" y="187" textAnchor="middle" fontSize="32" aria-hidden="true">
                🐉
              </text>
            </>
          )}

          {/* 7. Royal Crest Hintergrund */}
          {isRoyalCrest && (
            <>
              <rect x="2" y="2" width="246" height="346" fill={`url(#grad-royal-${rawId})`} />
              <rect x="10" y="10" width="230" height="330" rx="12" fill="none" stroke="#d97706" strokeWidth="3" />
              <rect x="15" y="15" width="220" height="320" rx="9" fill="none" stroke="#fde047" strokeWidth="1.5" strokeDasharray="5 3" />
              {/* Ecken-Ornamente */}
              <path d="M16 40 Q40 40 40 16" fill="none" stroke="#fde047" strokeWidth="2" />
              <path d="M234 40 Q210 40 210 16" fill="none" stroke="#fde047" strokeWidth="2" />
              <path d="M16 310 Q40 310 40 334" fill="none" stroke="#fde047" strokeWidth="2" />
              <path d="M234 310 Q210 310 210 334" fill="none" stroke="#fde047" strokeWidth="2" />
              {/* Kreis-Sockel für das Spielerwappen */}
              <circle cx="125" cy="175" r="54" fill="#180309" stroke="#f59e0b" strokeWidth="3" />
              <circle cx="125" cy="175" r="48" fill="none" stroke="#fde047" strokeWidth="1" strokeDasharray="3 3" />
            </>
          )}

          {/* Standard-Rand für alle Karten */}
          <rect x="2" y="2" width="246" height="346" rx="18" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
        </g>
      </svg>

      {/* Royal Crest wird passgenau im Zentrum gerendert */}
      {isRoyalCrest && (
        <div
          className="bub-card-back-crest"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <PlayerCrest spec={effectiveCrest} size={crestPixelSize} label="Spielerwappen" />
        </div>
      )}
    </div>
  );
}
