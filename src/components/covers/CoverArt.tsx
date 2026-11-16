import React, { useId } from 'react';
import { getCoverPreset } from '@/lib/themes/presets';
import type { CoverLayout } from '@/types/invite';

const LEGACY_COVER_FALLBACK_IMAGES: Record<string, string> = {
  'snowy-pines': '/covers/handdrawn-snowy-cabin.jpg',
  'christmas-evergreen': '/covers/handdrawn-cozy-tree.jpg',
  'autumn-harvest': '/covers/pencil-autumn-acorns.jpg',
  'candlelit-table': '/covers/oil-candlelight-wine.jpg',
  'aurora-ridge': '/covers/oil-starry-aurora.jpg',
  'illustrated-rooftop': '/covers/handdrawn-pizza-games.jpg',
  'illustrated-cookout': '/covers/handdrawn-backyard-bbq.jpg',
  'illustrated-autumn-porch': '/covers/handdrawn-pumpkin-cats.jpg',
  'illustrated-fireworks-harbor': '/covers/handdrawn-harbor-boats.jpg',
  'illustrated-game-night': '/covers/handdrawn-pizza-games.jpg',
  'illustrated-bonfire': '/covers/oil-coastal-sunset.jpg',
  'illustrated-morning-cafe': '/covers/pencil-cafe-croissant.jpg',
  'illustrated-cinema': '/covers/handdrawn-harbor-boats.jpg',
  'painted-citrus-table': '/covers/oil-citrus-grove.jpg',
  'painted-midnight-toast': '/covers/oil-candlelight-wine.jpg',
  'painted-tuscan-vineyard': '/covers/oil-candlelight-wine.jpg',
  'painted-holiday-wreath': '/covers/pencil-christmas-holly.jpg',
  'painted-spring-blossoms': '/covers/pencil-wildflower-meadow.jpg',
  'painted-terracotta-dusk': '/covers/oil-coastal-sunset.jpg',
};

export function CoverArt({
  coverPresetId,
  customCoverUrl,
  layout,
  title,
  accentColor,
  flushTop = false,
  className = '',
  children,
}: {
  coverPresetId: string;
  customCoverUrl?: string;
  layout: CoverLayout;
  title?: string;
  accentColor?: string;
  flushTop?: boolean;
  className?: string;
  children?: React.ReactNode;
}): React.JSX.Element | null {
  const uid = useId().replace(/:/g, '');

  if (layout === 'none') {
    return null;
  }

  const aspectClass =
    layout === 'banner'
      ? flushTop
        ? 'aspect-[2/1] w-full'
        : 'aspect-[16/9] w-full'
      : 'aspect-square w-full';
  const frameClass = flushTop
    ? 'relative overflow-hidden'
    : 'relative overflow-hidden rounded-2xl border border-white/15 shadow-xl';
  const containerClass = `${frameClass} ${aspectClass} ${className}`.trim();

  const presetImageUrl =
    getCoverPreset(coverPresetId)?.imageUrl ?? LEGACY_COVER_FALLBACK_IMAGES[coverPresetId];
  const effectiveImageUrl =
    customCoverUrl && customCoverUrl.trim().length > 0
      ? customCoverUrl.trim()
      : presetImageUrl;

  if (effectiveImageUrl) {
    return (
      <div
        className={containerClass}
        data-cover-preset={customCoverUrl ? 'custom' : coverPresetId}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={effectiveImageUrl}
          src={effectiveImageUrl}
          width={960}
          height={540}
          alt={title ? `${title} cover artwork` : 'Event cover artwork'}
          className="h-full w-full object-cover invite-cover-img"
        />
        {children ? (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-3 z-10">
            <div className="pointer-events-auto">{children}</div>
          </div>
        ) : null}
      </div>
    );
  }

  const bgId = `bg-${uid}`;
  const patId = `pat-${uid}`;
  const patAltId = `pat2-${uid}`;
  const glowId = `glow-${uid}`;
  const accent = accentColor || '#34d399';

  const renderArtwork = () => {
    switch (coverPresetId) {
      /* ---------------- 8 MINIMAL VECTOR COVERS ---------------- */
      case 'vector-paper-cutouts':
      case 'you-are-invited':
        return (
          <>
            <rect width="800" height="450" fill="#fbf5ea" />
            {/* Matisse-inspired bold organic paper cutouts */}
            <circle cx="150" cy="110" r="68" fill="#f59e0b" />
            <path d="M58,280 C95,180 220,175 245,275 C190,320 110,335 58,280 Z" fill="#0284c7" />
            <path
              d="M395,70 C435,120 420,195 365,240 C345,180 350,120 395,70 Z"
              fill="#e11d48"
            />
            <path
              d="M405,245 C465,205 555,215 585,295 C525,335 445,320 405,245 Z"
              fill="#0d9488"
            />
            <path
              d="M645,85 C725,95 765,175 725,245 C655,225 615,155 645,85 Z"
              fill="#fb7185"
            />
            <path
              d="M275,325 C315,275 385,280 410,340 C375,390 305,385 275,325 Z"
              fill="#1d4ed8"
            />
            <circle cx="660" cy="345" r="46" fill="#f97316" />
            <circle cx="515" cy="120" r="22" fill="#18181b" />
          </>
        );

      case 'vector-minimal-arch':
      case 'gallery-monolith':
      case 'graphic-terracotta-vase':
        return (
          <>
            <rect width="800" height="450" fill="#f4eee5" />
            <rect x="64" y="42" width="672" height="366" rx="18" fill="#faf7f2" stroke="#dfd4c5" strokeWidth="2" />
            <path d="M270,408 L270,225 A130,130 0 0,1 530,225 L530,408 Z" fill="#c2593f" />
            <path d="M325,408 L325,250 A75,75 0 0,1 475,250 L475,408 Z" fill="#e8b87d" />
            <circle cx="400" cy="175" r="36" fill="#faf7f2" />
            <path d="M230,365 Q280,295 335,330" fill="none" stroke="#3f5a43" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="265" cy="312" rx="16" ry="26" transform="rotate(-24 265 312)" fill="#4f6d52" />
            <ellipse cx="536" cy="292" rx="14" ry="24" transform="rotate(28 536 292)" fill="#688869" />
          </>
        );

      case 'vector-champagne-coupes':
      case 'champagne-toast':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#090a10" />
                <stop offset="100%" stopColor="#1b1826" />
              </linearGradient>
            </defs>
            <rect width="800" height="450" fill={`url(#${bgId})`} />
            <circle cx="400" cy="225" r="158" fill="none" stroke="#f5d076" strokeOpacity="0.24" strokeWidth="1.5" />
            <g transform="translate(345,235) rotate(-12)">
              <path d="M-54,-65 L54,-65 C50,-8 24,14 0,14 C-24,14 -50,-8 -54,-65 Z" fill="#fde68a" opacity="0.92" />
              <line x1="0" y1="14" x2="0" y2="112" stroke="#f4ce6a" strokeWidth="4.5" />
              <line x1="-28" y1="112" x2="28" y2="112" stroke="#f4ce6a" strokeWidth="4.5" strokeLinecap="round" />
            </g>
            <g transform="translate(455,235) rotate(12)">
              <path d="M-54,-65 L54,-65 C50,-8 24,14 0,14 C-24,14 -50,-8 -54,-65 Z" fill="#fef3c7" opacity="0.92" />
              <line x1="0" y1="14" x2="0" y2="112" stroke="#f4ce6a" strokeWidth="4.5" />
              <line x1="-28" y1="112" x2="28" y2="112" stroke="#f4ce6a" strokeWidth="4.5" strokeLinecap="round" />
            </g>
            <circle cx="400" cy="112" r="6" fill="#fef08a" />
            <circle cx="378" cy="84" r="4" fill="#ffffff" />
            <circle cx="424" cy="90" r="4.5" fill="#fde68a" />
          </>
        );

      case 'vector-mountain-moon':
      case 'graphic-moon-clouds':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0e1b33" />
                <stop offset="100%" stopColor="#1b3556" />
              </linearGradient>
            </defs>
            <rect width="800" height="450" fill={`url(#${bgId})`} />
            <circle cx="585" cy="120" r="48" fill="#fef3c7" />
            <circle cx="604" cy="110" r="40" fill="#122442" />
            <circle cx="170" cy="95" r="4" fill="#e0f2fe" opacity="0.8" />
            <circle cx="290" cy="70" r="3" fill="#fde68a" opacity="0.85" />
            <circle cx="420" cy="108" r="3.5" fill="#ffffff" opacity="0.7" />
            <polygon points="80,450 265,205 445,450" fill="#23486f" />
            <polygon points="295,450 510,185 735,450" fill="#173352" />
            <polygon points="-40,450 140,260 315,450" fill="#0f233b" />
            <polygon points="565,450 705,275 845,450" fill="#0f233b" />
          </>
        );

      case 'vector-citrus-sun':
      case 'graphic-citrus-waves':
      case 'summer-citrus':
        return (
          <>
            <rect width="800" height="450" fill="#fff3de" />
            <circle cx="400" cy="195" r="108" fill="#fb923c" />
            <circle cx="400" cy="195" r="76" fill="#facc15" />
            <path d="M0,255 Q200,210 400,255 T800,255 L800,450 L0,450 Z" fill="#0ea5e9" />
            <path d="M0,315 Q200,275 400,315 T800,315 L800,450 L0,450 Z" fill="#0284c7" />
            <path d="M0,375 Q200,340 400,375 T800,375 L800,450 L0,450 Z" fill="#0369a1" />
          </>
        );

      case 'vector-birthday-candles':
      case 'birthday-cake':
        return (
          <>
            <rect width="800" height="450" fill="#f2ecff" />
            <circle cx="130" cy="110" r="10" fill="#f472b6" />
            <circle cx="675" cy="125" r="12" fill="#34d399" />
            <rect x="195" y="185" width="22" height="10" rx="5" transform="rotate(-20 195 185)" fill="#fbbf24" />
            <rect x="595" y="210" width="22" height="10" rx="5" transform="rotate(24 595 210)" fill="#38bdf8" />
            {/* Minimal color-block cake */}
            <rect x="260" y="265" width="280" height="110" rx="18" fill="#fb7185" />
            <rect x="305" y="195" width="190" height="72" rx="14" fill="#f472b6" />
            {[345, 400, 455].map((cx, idx) => (
              <g key={idx}>
                <rect x={cx - 7} y="135" width="14" height="60" rx="6" fill={idx === 1 ? '#fde047' : '#ffffff'} />
                <ellipse cx={cx} cy="112" rx="8" ry="15" fill="#fb923c" />
              </g>
            ))}
          </>
        );

      case 'vector-starburst-night':
      case 'graphic-midnight-stars':
      case 'july-fireworks':
        return (
          <>
            <rect width="800" height="450" fill="#0b132b" />
            {[
              { cx: 235, cy: 190, r: 96, color: '#fb7185' },
              { cx: 435, cy: 150, r: 80, color: '#fde047' },
              { cx: 615, cy: 235, r: 88, color: '#38bdf8' },
            ].map((burst, bIdx) => (
              <g key={bIdx}>
                {Array.from({ length: 14 }, (_, i) => {
                  const angle = (i / 14) * Math.PI * 2;
                  const x1 = burst.cx + Math.cos(angle) * 16;
                  const y1 = burst.cy + Math.sin(angle) * 16;
                  const x2 = burst.cx + Math.cos(angle) * burst.r;
                  const y2 = burst.cy + Math.sin(angle) * burst.r;
                  return (
                    <g key={i}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={i % 2 === 0 ? burst.color : '#ffffff'}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                      <circle cx={x2} cy={y2} r="4.5" fill={burst.color} />
                    </g>
                  );
                })}
              </g>
            ))}
          </>
        );

      case 'vector-sacred-arch':
      case 'sacred-star':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#080c1f" />
                <stop offset="100%" stopColor="#171f45" />
              </linearGradient>
              <radialGradient id={glowId} cx="50%" cy="32%" r="45%">
                <stop offset="0%" stopColor="#fde68a" stopOpacity="0.48" />
                <stop offset="100%" stopColor="#080c1f" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="450" fill={`url(#${bgId})`} />
            <rect width="800" height="450" fill={`url(#${glowId})`} />
            <path d="M235,450 L235,235 A165,165 0 0,1 565,235 L565,450" fill="none" stroke="#f5c451" strokeOpacity="0.38" strokeWidth="2.5" />
            <line x1="400" y1="68" x2="400" y2="232" stroke="#fde68a" strokeWidth="3" />
            <line x1="318" y1="150" x2="482" y2="150" stroke="#fde68a" strokeWidth="3" />
            <polygon points="400,105 412,138 445,150 412,162 400,195 388,162 355,150 388,138" fill="#fef3c7" />
            <rect x="392" y="300" width="16" height="82" rx="4" fill="#fafaf2" />
            <ellipse cx="400" cy="284" rx="7" ry="13" fill="#fde68a" />
          </>
        );

      /* ---------------- 8 SEAMLESS PATTERN COVERS ---------------- */
      case 'pattern-citrus-grove':
        return (
          <>
            <defs>
              <pattern id={patId} width="120" height="120" patternUnits="userSpaceOnUse">
                <rect width="120" height="120" fill="#fdfaf2" />
                <path d="M60,8 L112,60 L60,112 L8,60 Z" fill="none" stroke="#1d4ed8" strokeWidth="1.5" strokeOpacity="0.22" />
                <ellipse cx="60" cy="60" rx="22" ry="16" transform="rotate(-18 60 60)" fill="#facc15" />
                <ellipse cx="78" cy="44" rx="12" ry="5.5" transform="rotate(-38 78 44)" fill="#15803d" />
                <circle cx="15" cy="15" r="4" fill="#0284c7" opacity="0.45" />
                <circle cx="105" cy="105" r="4" fill="#0284c7" opacity="0.45" />
              </pattern>
            </defs>
            <rect width="800" height="450" fill={`url(#${patId})`} />
          </>
        );

      case 'pattern-winter-fairisle':
        return (
          <>
            <defs>
              <pattern id={patId} width="96" height="120" patternUnits="userSpaceOnUse">
                <rect width="96" height="120" fill="#123524" />
                <rect x="0" y="24" width="96" height="24" fill="#b91c1c" />
                <polygon points="24,8 36,24 12,24" fill="#fef3c7" />
                <polygon points="72,8 84,24 60,24" fill="#fef3c7" />
                <polygon points="48,54 58,74 38,74" fill="#34d399" opacity="0.8" />
                <circle cx="24" cy="36" r="4" fill="#fef3c7" />
                <circle cx="72" cy="36" r="4" fill="#fef3c7" />
                <rect x="0" y="88" width="96" height="12" fill="#e11d48" opacity="0.85" />
                <circle cx="16" cy="94" r="3" fill="#ffffff" />
                <circle cx="48" cy="94" r="3" fill="#ffffff" />
                <circle cx="80" cy="94" r="3" fill="#ffffff" />
              </pattern>
            </defs>
            <rect width="800" height="450" fill={`url(#${patId})`} />
          </>
        );

      case 'pattern-botanical-toile':
        return (
          <>
            <defs>
              <pattern id={patId} width="128" height="128" patternUnits="userSpaceOnUse">
                <rect width="128" height="128" fill="#eef5ec" />
                <path d="M36,92 C36,68 48,48 64,34 C80,48 92,68 92,92" fill="none" stroke="#2c6b4a" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="64" cy="32" r="11" fill="#f9a8d4" />
                <circle cx="64" cy="32" r="4.5" fill="#fde047" />
                <ellipse cx="44" cy="64" rx="11" ry="5" transform="rotate(-32 44 64)" fill="#4d8b65" />
                <ellipse cx="84" cy="64" rx="11" ry="5" transform="rotate(32 84 64)" fill="#4d8b65" />
                <circle cx="16" cy="112" r="4.5" fill="#a7f3d0" />
              </pattern>
            </defs>
            <rect width="800" height="450" fill={`url(#${patId})`} />
          </>
        );

      case 'pattern-gingham-picnic':
        return (
          <>
            <defs>
              <pattern id={patId} width="80" height="80" patternUnits="userSpaceOnUse">
                <rect width="80" height="80" fill="#fff7f5" />
                <rect x="0" y="0" width="40" height="80" fill="#e11d48" opacity="0.22" />
                <rect x="0" y="0" width="80" height="40" fill="#e11d48" opacity="0.22" />
              </pattern>
            </defs>
            <rect width="800" height="450" fill={`url(#${patId})`} />
          </>
        );

      case 'pattern-terrazzo-confetti':
        return (
          <>
            <defs>
              <pattern id={patId} width="140" height="140" patternUnits="userSpaceOnUse">
                <rect width="140" height="140" fill="#f7f2ea" />
                <polygon points="22,26 42,18 36,42" fill="#e11d48" opacity="0.82" />
                <polygon points="88,24 114,32 98,52" fill="#f59e0b" opacity="0.85" />
                <polygon points="48,76 74,68 78,94 52,98" fill="#0d9488" opacity="0.8" />
                <polygon points="104,92 128,108 106,124" fill="#1d4ed8" opacity="0.78" />
                <polygon points="18,104 34,96 32,122" fill="#fb7185" opacity="0.8" />
                <circle cx="72" cy="36" r="5" fill="#334155" opacity="0.7" />
              </pattern>
            </defs>
            <rect width="800" height="450" fill={`url(#${patId})`} />
          </>
        );

      case 'pattern-celestial-stars':
        return (
          <>
            <defs>
              <pattern id={patId} width="120" height="120" patternUnits="userSpaceOnUse">
                <rect width="120" height="120" fill="#0c1229" />
                <circle cx="34" cy="36" r="14" fill="#f5c451" />
                <circle cx="40" cy="32" r="12" fill="#0c1229" />
                <polygon points="88,68 92,80 104,84 92,88 88,100 84,88 72,84 84,80" fill="#fde68a" />
                <circle cx="88" cy="24" r="2.5" fill="#93c5fd" opacity="0.8" />
                <circle cx="24" cy="96" r="2.5" fill="#fde68a" opacity="0.7" />
              </pattern>
            </defs>
            <rect width="800" height="450" fill={`url(#${patId})`} />
          </>
        );

      case 'pattern-retro-checker':
        return (
          <>
            <defs>
              <pattern id={patId} width="96" height="96" patternUnits="userSpaceOnUse">
                <rect width="96" height="96" fill="#fef3c7" />
                <rect x="0" y="0" width="48" height="48" fill="#a78bfa" />
                <rect x="48" y="48" width="48" height="48" fill="#a78bfa" />
                <circle cx="24" cy="24" r="7" fill="#fef3c7" opacity="0.85" />
                <circle cx="72" cy="72" r="7" fill="#fef3c7" opacity="0.85" />
              </pattern>
            </defs>
            <rect width="800" height="450" fill={`url(#${patId})`} />
          </>
        );

      case 'pattern-autumn-plaid':
        return (
          <>
            <defs>
              <pattern id={patId} width="100" height="100" patternUnits="userSpaceOnUse">
                <rect width="100" height="100" fill="#3a1c12" />
                <rect x="0" y="18" width="100" height="22" fill="#d97706" opacity="0.45" />
                <rect x="18" y="0" width="22" height="100" fill="#d97706" opacity="0.45" />
                <rect x="0" y="64" width="100" height="8" fill="#fbbf24" opacity="0.5" />
                <rect x="64" y="0" width="8" height="100" fill="#fbbf24" opacity="0.5" />
              </pattern>
            </defs>
            <rect width="800" height="450" fill={`url(#${patId})`} />
          </>
        );

      /* ---------------- LEGACY COMPATIBILITY FALLBACKS ---------------- */
      default:
        return (
          <>
            <defs>
              <pattern id={patAltId} width="120" height="120" patternUnits="userSpaceOnUse">
                <rect width="120" height="120" fill="#0e172c" />
                <circle cx="60" cy="60" r="24" fill={accent} opacity="0.22" />
              </pattern>
            </defs>
            <rect width="800" height="450" fill={`url(#${patAltId})`} />
          </>
        );
    }
  };

  return (
    <div className={containerClass} data-cover-preset={coverPresetId}>
      <svg
        viewBox="0 0 800 450"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="img"
        aria-label={title ? `${title} cover artwork` : 'Event cover artwork'}
      >
        {renderArtwork()}
      </svg>
      {children ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-3 z-10">
          <div className="pointer-events-auto">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
