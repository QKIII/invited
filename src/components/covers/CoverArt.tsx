import React, { useId } from 'react';
import { getCoverPreset } from '@/lib/themes/presets';
import type { CoverLayout } from '@/types/invite';

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

  const presetImageUrl = getCoverPreset(coverPresetId)?.imageUrl;
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
          src={effectiveImageUrl}
          width={960}
          height={540}
          alt={title ? `${title} cover artwork` : 'Event cover artwork'}
          className="h-full w-full object-cover"
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
  const glowId = `glow-${uid}`;
  const accentId = `acc-${uid}`;
  const curveId = `curve-${uid}`;
  const shadowId = `shd-${uid}`;
  const gridBlueId = `gblue-${uid}`;
  const gridTealId = `gteal-${uid}`;
  const dotsDarkId = `dotsd-${uid}`;
  const dotsWhiteId = `dotsw-${uid}`;
  const stripesRedId = `strr-${uid}`;
  const accent = accentColor || '#34d399';

  const renderArtwork = () => {
    switch (coverPresetId) {
      case 'you-are-invited':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fdf6df" />
                <stop offset="100%" stopColor="#fae9c0" />
              </linearGradient>
              <filter id={shadowId} x="-15%" y="-15%" width="135%" height="135%">
                <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#7c5b2b" floodOpacity="0.22" />
              </filter>
              <pattern id={gridBlueId} width="32" height="32" patternUnits="userSpaceOnUse">
                <rect width="32" height="32" fill="#0ea5e9" />
                <path d="M32 0 L0 0 0 32" fill="none" stroke="#bae6fd" strokeWidth="1.5" opacity="0.55" />
              </pattern>
              <pattern id={gridTealId} width="32" height="32" patternUnits="userSpaceOnUse">
                <rect width="32" height="32" fill="#06b6d4" />
                <path d="M32 0 L0 0 0 32" fill="none" stroke="#a5f3fc" strokeWidth="1.5" opacity="0.55" />
              </pattern>
              <pattern id={dotsDarkId} width="26" height="26" patternUnits="userSpaceOnUse">
                <rect width="26" height="26" fill="#f59e0b" />
                <circle cx="13" cy="13" r="4.5" fill="#18181b" />
              </pattern>
              <pattern id={dotsWhiteId} width="24" height="24" patternUnits="userSpaceOnUse">
                <rect width="24" height="24" fill="#ea580c" />
                <circle cx="12" cy="12" r="4" fill="#ffffff" />
              </pattern>
              <pattern id={stripesRedId} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
                <rect width="22" height="22" fill="#dc2626" />
                <rect width="10" height="22" fill="#fb7185" opacity="0.7" />
              </pattern>
              <path id={curveId} d="M 110 380 Q 250 285 400 375 T 690 455" />
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />

            {/* Top-left speckled loop ribbon */}
            <path
              d="M-10,120 C85,30 175,90 140,185 C105,275 -20,255 -10,120 Z"
              fill="#f1f5f9"
              stroke="#1e293b"
              strokeWidth="4"
              strokeDasharray="2 18"
              strokeLinecap="round"
              filter={`url(#${shadowId})`}
            />

            {/* Top-center orange polka splat */}
            <path
              d="M210,-20 C245,85 335,95 385,-10 Z"
              fill={`url(#${dotsWhiteId})`}
              filter={`url(#${shadowId})`}
            />

            {/* Blue grid zig-zag arrow */}
            <path
              d="M365,190 L460,85 L430,50 L545,-10 L570,125 L535,95 L420,220 Z"
              fill={`url(#${gridBlueId})`}
              filter={`url(#${shadowId})`}
            />

            {/* Top-right golden amber wave */}
            <path
              d="M620,165 C600,85 690,25 810,55 L810,165 C725,180 650,210 620,165 Z"
              fill="#f59e0b"
              filter={`url(#${shadowId})`}
            />

            {/* Red outline loop heart */}
            <path
              d="M555,275 C540,220 470,220 485,280 C500,340 565,375 565,375 C565,375 625,315 625,260 C625,215 570,225 555,275 Z"
              fill="none"
              stroke="#dc2626"
              strokeWidth="18"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#${shadowId})`}
            />

            {/* Striped red tilted heart */}
            <g transform="rotate(-14 275 520)" filter={`url(#${shadowId})`}>
              <path
                d="M275,585 C200,530 185,445 235,425 C265,412 280,445 280,460 C280,445 305,412 335,425 C385,445 355,530 275,585 Z"
                fill={`url(#${stripesRedId})`}
              />
            </g>

            {/* Bottom-left cyan polka splat */}
            <path
              d="M-15,535 C75,510 120,575 110,645 C100,705 20,700 -15,675 Z"
              fill="#0284c7"
              filter={`url(#${shadowId})`}
            />
            <circle cx="48" cy="595" r="7" fill="#e0f2fe" />
            <circle cx="82" cy="615" r="6" fill="#e0f2fe" />
            <circle cx="38" cy="642" r="6" fill="#e0f2fe" />

            {/* Bottom polka starburst */}
            <path
              d="M175,650 L215,705 L275,710 L245,765 L270,815 L110,815 L125,755 L95,705 Z"
              fill={`url(#${dotsDarkId})`}
              filter={`url(#${shadowId})`}
            />

            {/* Bottom-center golden arrow up */}
            <path
              d="M410,615 L495,690 L455,695 L470,815 L370,815 L360,695 L325,690 Z"
              fill="#fbbf24"
              stroke="#f59e0b"
              strokeWidth="4"
              filter={`url(#${shadowId})`}
            />

            {/* Bottom-right turquoise organic blob */}
            <path
              d="M575,670 C625,605 745,620 765,705 C780,770 725,815 635,815 C565,815 530,730 575,670 Z"
              fill={`url(#${gridTealId})`}
              filter={`url(#${shadowId})`}
            />

            {/* Balanced playful centerpiece */}
            <circle cx="400" cy="390" r="64" fill="#fbbf24" filter={`url(#${shadowId})`} />
            <circle cx="400" cy="390" r="34" fill="#0284c7" />
          </>
        );

      case 'graphic-citrus-waves':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff7ed" />
                <stop offset="55%" stopColor="#fed7aa" />
                <stop offset="100%" stopColor="#fdba74" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <circle cx="400" cy="320" r="135" fill="#fb923c" />
            <circle cx="400" cy="320" r="95" fill="#facc15" opacity="0.92" />
            <path d="M0,455 Q200,405 400,455 T800,455 L800,800 L0,800 Z" fill="#0284c7" opacity="0.86" />
            <path d="M0,530 Q200,480 400,530 T800,530 L800,800 L0,800 Z" fill="#0369a1" />
            <path d="M0,610 Q200,565 400,610 T800,610 L800,800 L0,800 Z" fill="#0c4a6e" opacity="0.88" />
          </>
        );

      case 'graphic-moon-clouds':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="55%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#312e81" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <circle cx="515" cy="255" r="78" fill="#fef08a" />
            <circle cx="548" cy="240" r="66" fill="#1e293b" />
            <circle cx="205" cy="215" r="5" fill="#ffffff" opacity="0.8" />
            <circle cx="325" cy="180" r="4" fill="#fde68a" opacity="0.85" />
            <circle cx="660" cy="195" r="4.5" fill="#ffffff" opacity="0.7" />
            <g fill="#f8fafc" opacity="0.9">
              <circle cx="255" cy="510" r="95" />
              <circle cx="385" cy="465" r="125" />
              <circle cx="535" cy="515" r="100" />
              <rect x="140" y="500" width="520" height="140" rx="70" />
            </g>
          </>
        );

      case 'graphic-terracotta-vase':
        return (
          <>
            <rect width="800" height="800" fill="#f7efe5" />
            <path d="M210,690 L210,360 A190,190 0 0,1 590,360 L590,690 Z" fill="#efe2d2" />
            <ellipse cx="400" cy="480" rx="88" ry="118" fill="#c2593f" />
            <rect x="366" y="345" width="68" height="44" rx="12" fill="#a8432b" />
            <path d="M400,345 C365,260 305,225 275,205 C330,205 375,245 400,320 Z" fill="#4f6d52" />
            <path d="M400,345 C435,255 495,220 530,195 C475,205 425,245 400,320 Z" fill="#688869" />
            <circle cx="330" cy="260" r="22" fill="#e9b872" />
            <circle cx="475" cy="250" r="18" fill="#d97757" />
          </>
        );

      case 'graphic-midnight-stars':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#070913" />
                <stop offset="100%" stopColor="#171f3b" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <circle cx="400" cy="400" r="215" fill="none" stroke="#93c5fd" strokeOpacity="0.22" strokeWidth="2" />
            <circle cx="400" cy="400" r="145" fill="none" stroke="#fde68a" strokeOpacity="0.32" strokeWidth="2" />
            <polygon points="400,255 418,350 515,370 418,390 400,485 382,390 285,370 382,350" fill="#fef3c7" />
            <circle cx="245" cy="270" r="6" fill="#93c5fd" />
            <circle cx="565" cy="260" r="6" fill="#fde68a" />
            <circle cx="550" cy="525" r="5" fill="#93c5fd" />
            <circle cx="255" cy="520" r="5" fill="#fde68a" />
            <line x1="245" y1="270" x2="400" y2="370" stroke="#93c5fd" strokeOpacity="0.35" strokeWidth="2" />
            <line x1="565" y1="260" x2="400" y2="370" stroke="#fde68a" strokeOpacity="0.35" strokeWidth="2" />
            <line x1="550" y1="525" x2="400" y2="370" stroke="#93c5fd" strokeOpacity="0.35" strokeWidth="2" />
          </>
        );

      case 'christmas-evergreen':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#082016" />
                <stop offset="55%" stopColor="#113828" />
                <stop offset="100%" stopColor="#1e4d37" />
              </linearGradient>
              <radialGradient id={glowId} cx="50%" cy="46%" r="54%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
                <stop offset="52%" stopColor="#fb7185" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#082016" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <rect width="800" height="800" fill={`url(#${glowId})`} />
            {/* Soft snow ground */}
            <path d="M0,625 Q400,585 800,625 L800,800 L0,800 Z" fill="#0d291d" />
            {/* Full-scale evergreen layers */}
            <polygon points="400,155 265,355 535,355" fill="#1b5e3f" />
            <polygon points="400,245 215,475 585,475" fill="#175237" />
            <polygon points="400,340 165,610 635,610" fill="#12422c" />
            <rect x="372" y="610" width="56" height="58" rx="6" fill="#6b4226" />
            {/* Golden garland arcs */}
            <path d="M315,315 Q400,350 485,315" fill="none" stroke="#fde047" strokeWidth="4" opacity="0.65" />
            <path d="M265,425 Q400,468 535,425" fill="none" stroke="#fde047" strokeWidth="4.5" opacity="0.65" />
            <path d="M210,545 Q400,595 590,545" fill="none" stroke="#fde047" strokeWidth="5" opacity="0.65" />
            {/* Star topper */}
            <circle cx="400" cy="145" r="54" fill="#fde047" opacity="0.22" />
            <polygon
              points="400,108 411,134 440,136 417,154 425,182 400,165 375,182 383,154 360,136 389,134"
              fill="#fef08a"
            />
            {/* Warm glowing ornaments */}
            <circle cx="355" cy="308" r="13" fill="#fb7185" />
            <circle cx="445" cy="316" r="12" fill="#fde047" />
            <circle cx="318" cy="422" r="14" fill="#fde047" />
            <circle cx="405" cy="405" r="13" fill="#f43f5e" />
            <circle cx="485" cy="435" r="12" fill="#f8fafc" />
            <circle cx="275" cy="542" r="15" fill="#fb7185" />
            <circle cx="378" cy="522" r="14" fill="#fde047" />
            <circle cx="475" cy="552" r="14" fill="#fb7185" />
            <circle cx="552" cy="566" r="12" fill="#fde047" />
            {/* Wrapped gifts */}
            <rect x="275" y="618" width="66" height="54" rx="8" fill="#e11d48" />
            <rect x="303" y="618" width="10" height="54" fill="#fde047" />
            <rect x="460" y="626" width="58" height="46" rx="8" fill="#fbbf24" />
            <rect x="484" y="626" width="10" height="46" fill="#be123c" />
            {/* Snowfall */}
            <circle cx="145" cy="195" r="5" fill="#ffffff" opacity="0.65" />
            <circle cx="655" cy="220" r="6" fill="#ffffff" opacity="0.7" />
            <circle cx="185" cy="445" r="4" fill="#ffffff" opacity="0.5" />
            <circle cx="670" cy="465" r="5" fill="#ffffff" opacity="0.55" />
          </>
        );

      case 'sacred-star':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#070a1c" />
                <stop offset="60%" stopColor="#12183b" />
                <stop offset="100%" stopColor="#1e2554" />
              </linearGradient>
              <radialGradient id={glowId} cx="50%" cy="32%" r="54%">
                <stop offset="0%" stopColor="#fde68a" stopOpacity="0.68" />
                <stop offset="42%" stopColor="#f5c451" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#070a1c" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <rect width="800" height="800" fill={`url(#${glowId})`} />
            {/* Sanctuary arches */}
            <path
              d="M190,645 L190,395 A210,210 0 0,1 610,395 L610,645"
              fill="none"
              stroke="#f5c451"
              strokeOpacity="0.34"
              strokeWidth="3"
            />
            <path
              d="M255,645 L255,420 A145,145 0 0,1 545,420 L545,645"
              fill="none"
              stroke="#fde68a"
              strokeOpacity="0.22"
              strokeWidth="2"
            />
            {/* Radiant Star of Bethlehem */}
            <line x1="400" y1="125" x2="400" y2="545" stroke="#fde68a" strokeWidth="3.5" opacity="0.82" />
            <line x1="230" y1="295" x2="570" y2="295" stroke="#fde68a" strokeWidth="3.5" opacity="0.82" />
            <line x1="295" y1="190" x2="505" y2="400" stroke="#f5c451" strokeWidth="2" opacity="0.55" />
            <line x1="505" y1="190" x2="295" y2="400" stroke="#f5c451" strokeWidth="2" opacity="0.55" />
            <polygon
              points="400,218 419,276 477,295 419,314 400,372 381,314 323,295 381,276"
              fill="#fef3c7"
            />
            {/* Hills & glowing taper candle */}
            <path d="M0,585 Q240,525 440,575 T800,560 L800,800 L0,800 Z" fill="#0b0f26" />
            <circle cx="400" cy="540" r="34" fill="#fbbf24" opacity="0.28" />
            <ellipse cx="400" cy="540" rx="8" ry="16" fill="#fde68a" />
            <rect x="392" y="558" width="16" height="44" rx="4" fill="#fcfaf2" opacity="0.94" />
          </>
        );

      case 'snowy-pines':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#082252" />
                <stop offset="60%" stopColor="#123a7d" />
                <stop offset="100%" stopColor="#1f53a6" />
              </linearGradient>
              <radialGradient id={glowId} cx="72%" cy="28%" r="42%">
                <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.48" />
                <stop offset="100%" stopColor="#082252" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <rect width="800" height="800" fill={`url(#${glowId})`} />
            <circle cx="575" cy="235" r="56" fill="#f0f9ff" opacity="0.92" />
            {/* Snow-dusted pine hills */}
            <path d="M0,510 Q210,445 430,515 T800,485 L800,800 L0,800 Z" fill="#174587" />
            <path d="M0,575 Q280,525 520,575 T800,560 L800,800 L0,800 Z" fill="#e0f2fe" opacity="0.92" />
            {/* Pines */}
            <polygon points="185,295 100,530 270,530" fill="#0d2852" />
            <polygon points="185,295 142,415 228,415" fill="#e0f2fe" opacity="0.78" />
            <polygon points="305,355 240,550 370,550" fill="#113366" />
            <polygon points="305,355 272,445 338,445" fill="#e0f2fe" opacity="0.72" />
            {/* Cozy illuminated cabin */}
            <rect x="465" y="455" width="150" height="108" rx="4" fill="#1e293b" />
            <polygon points="442,458 540,382 638,458" fill="#f8fafc" />
            <rect x="515" y="488" width="50" height="44" rx="6" fill="#fbbf24" />
            {/* Bokeh snowfall */}
            <circle cx="140" cy="195" r="12" fill="#ffffff" opacity="0.22" />
            <circle cx="380" cy="235" r="5" fill="#ffffff" opacity="0.75" />
            <circle cx="675" cy="345" r="14" fill="#ffffff" opacity="0.2" />
            <circle cx="445" cy="285" r="4" fill="#ffffff" opacity="0.65" />
            <circle cx="240" cy="220" r="4.5" fill="#ffffff" opacity="0.6" />
          </>
        );

      case 'halloween-pumpkin':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#12071d" />
                <stop offset="60%" stopColor="#26123f" />
                <stop offset="100%" stopColor="#3d1a4b" />
              </linearGradient>
              <radialGradient id={glowId} cx="50%" cy="56%" r="45%">
                <stop offset="0%" stopColor="#fb923c" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#12071d" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <rect width="800" height="800" fill={`url(#${glowId})`} />
            {/* Full harvest moon */}
            <circle cx="570" cy="280" r="68" fill="#fed7aa" opacity="0.88" />
            <circle cx="595" cy="268" r="56" fill="#231039" />
            {/* Silhouetted bats */}
            <path d="M220,275 Q245,250 265,270 Q285,250 310,275 Q285,280 265,292 Q245,280 220,275 Z" fill="#0c0414" />
            <path d="M350,235 Q366,220 380,232 Q394,220 410,235 Q394,238 380,246 Q366,238 350,235 Z" fill="#0c0414" />
            {/* Ground & Glowing Jack-o'-lantern */}
            <path d="M0,555 Q400,515 800,555 L800,800 L0,800 Z" fill="#0e0518" />
            <rect x="387" y="365" width="26" height="40" rx="6" fill="#4d7c0f" />
            <ellipse cx="348" cy="468" rx="68" ry="86" fill="#ea580c" />
            <ellipse cx="452" cy="468" rx="68" ry="86" fill="#ea580c" />
            <ellipse cx="400" cy="468" rx="58" ry="90" fill="#f97316" />
            {/* Carved face */}
            <polygon points="355,445 385,445 370,420" fill="#fef08a" />
            <polygon points="415,445 445,445 430,420" fill="#fef08a" />
            <path d="M348,488 Q400,528 452,488 L438,508 L420,496 L400,514 L380,496 L362,508 Z" fill="#fef08a" />
          </>
        );

      case 'autumn-harvest':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1e110a" />
                <stop offset="55%" stopColor="#3c1e12" />
                <stop offset="100%" stopColor="#592c17" />
              </linearGradient>
              <radialGradient id={glowId} cx="50%" cy="48%" r="48%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#1e110a" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <rect width="800" height="800" fill={`url(#${glowId})`} />
            {/* Warm botanical harvest arch & autumn leaves */}
            <circle cx="400" cy="400" r="145" fill="none" stroke="#f59e0b" strokeOpacity="0.35" strokeWidth="2" />
            <path d="M400,250 C445,295 450,365 400,410 C350,365 355,295 400,250 Z" fill="#f59e0b" opacity="0.88" />
            <path d="M275,345 C330,340 375,380 390,435 C335,435 285,395 275,345 Z" fill="#ea580c" opacity="0.85" />
            <path d="M525,345 C470,340 425,380 410,435 C465,435 515,395 525,345 Z" fill="#dc2626" opacity="0.82" />
            <path d="M315,500 C350,455 390,445 400,440 C405,495 360,525 315,500 Z" fill="#fbbf24" opacity="0.82" />
            <path d="M485,500 C450,455 410,445 400,440 C395,495 440,525 485,500 Z" fill="#d97706" opacity="0.88" />
            <rect x="396" y="410" width="8" height="145" rx="4" fill="#fde68a" opacity="0.65" />
          </>
        );

      case 'july-fireworks':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#050b1c" />
                <stop offset="65%" stopColor="#0f1f47" />
                <stop offset="100%" stopColor="#1b3169" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            {/* Twin celebratory starburst fireworks */}
            {[
              { cx: 310, cy: 360, r: 120, color: '#ff6b7a' },
              { cx: 515, cy: 310, r: 95, color: '#fde047' },
              { cx: 440, cy: 485, r: 72, color: '#93c5fd' },
            ].map((burst, bIdx) => (
              <g key={bIdx}>
                <circle cx={burst.cx} cy={burst.cy} r={burst.r * 0.6} fill={burst.color} opacity="0.14" />
                {Array.from({ length: 16 }, (_, i) => {
                  const angle = (i / 16) * Math.PI * 2;
                  const x2 = burst.cx + Math.cos(angle) * burst.r;
                  const y2 = burst.cy + Math.sin(angle) * burst.r;
                  const x1 = burst.cx + Math.cos(angle) * 18;
                  const y1 = burst.cy + Math.sin(angle) * 18;
                  return (
                    <g key={i}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={i % 2 === 0 ? burst.color : '#ffffff'}
                        strokeWidth="3"
                        strokeLinecap="round"
                        opacity="0.85"
                      />
                      <circle cx={x2} cy={y2} r="4" fill="#ffffff" />
                    </g>
                  );
                })}
              </g>
            ))}
          </>
        );

      case 'champagne-toast':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#09090d" />
                <stop offset="55%" stopColor="#181822" />
                <stop offset="100%" stopColor="#262118" />
              </linearGradient>
              <radialGradient id={glowId} cx="50%" cy="46%" r="48%">
                <stop offset="0%" stopColor="#f4ce6a" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#09090d" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <rect width="800" height="800" fill={`url(#${glowId})`} />
            {/* Art deco radiating arcs */}
            <circle cx="400" cy="400" r="175" fill="none" stroke="#f4ce6a" strokeOpacity="0.22" strokeWidth="1.5" />
            <circle cx="400" cy="400" r="135" fill="none" stroke="#f4ce6a" strokeOpacity="0.32" strokeWidth="1.5" />
            {/* Twin clinking coupe silhouettes */}
            <g transform="translate(345,405) rotate(-14)">
              <path d="M-48,-55 L48,-55 C45,-5 22,12 0,12 C-22,12 -45,-5 -48,-55 Z" fill="#fde68a" opacity="0.88" />
              <line x1="0" y1="12" x2="0" y2="108" stroke="#f4ce6a" strokeWidth="5" />
              <line x1="-26" y1="108" x2="26" y2="108" stroke="#f4ce6a" strokeWidth="5" strokeLinecap="round" />
            </g>
            <g transform="translate(455,405) rotate(14)">
              <path d="M-48,-55 L48,-55 C45,-5 22,12 0,12 C-22,12 -45,-5 -48,-55 Z" fill="#fef3c7" opacity="0.88" />
              <line x1="0" y1="12" x2="0" y2="108" stroke="#f4ce6a" strokeWidth="5" />
              <line x1="-26" y1="108" x2="26" y2="108" stroke="#f4ce6a" strokeWidth="5" strokeLinecap="round" />
            </g>
            {/* Bubbles & starburst */}
            <circle cx="400" cy="275" r="7" fill="#fef08a" />
            <circle cx="378" cy="245" r="4.5" fill="#ffffff" />
            <circle cx="424" cy="252" r="5" fill="#fde68a" />
            <circle cx="402" cy="222" r="3.5" fill="#ffffff" />
          </>
        );

      case 'velvet-roses':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1e0a14" />
                <stop offset="60%" stopColor="#3b1326" />
                <stop offset="100%" stopColor="#521933" />
              </linearGradient>
              <radialGradient id={glowId} cx="50%" cy="48%" r="48%">
                <stop offset="0%" stopColor="#fb7185" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#1e0a14" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <rect width="800" height="800" fill={`url(#${glowId})`} />
            {/* Botanical rose medallion */}
            <circle cx="400" cy="400" r="140" fill="none" stroke="#fda4af" strokeOpacity="0.32" strokeWidth="2" />
            <circle cx="400" cy="400" r="88" fill="#be123c" opacity="0.72" />
            <circle cx="386" cy="390" r="58" fill="#e11d48" opacity="0.82" />
            <circle cx="412" cy="408" r="44" fill="#fb7185" opacity="0.85" />
            <path d="M400,445 C375,425 362,400 378,382 C390,368 400,382 400,392 C400,382 410,368 422,382 C438,400 425,425 400,445 Z" fill="#fff1f2" />
          </>
        );

      case 'clover-emerald':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#051810" />
                <stop offset="60%" stopColor="#0c3624" />
                <stop offset="100%" stopColor="#155237" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <circle cx="400" cy="400" r="155" fill="none" stroke="#facc15" strokeOpacity="0.32" strokeWidth="2.5" />
            {/* Four-leaf clover */}
            <circle cx="362" cy="355" r="52" fill="#4ade80" opacity="0.9" />
            <circle cx="438" cy="355" r="52" fill="#22c55e" opacity="0.9" />
            <circle cx="362" cy="432" r="52" fill="#22c55e" opacity="0.9" />
            <circle cx="438" cy="432" r="52" fill="#4ade80" opacity="0.9" />
            <path d="M400,432 Q408,515 445,565" fill="none" stroke="#4ade80" strokeWidth="14" strokeLinecap="round" />
            <circle cx="400" cy="394" r="14" fill="#fef08a" />
          </>
        );

      case 'easter-botanical':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#eef5ec" />
                <stop offset="100%" stopColor="#d9ead6" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <path
              d="M270,585 L270,390 A130,130 0 0,1 530,390 L530,585 Z"
              fill="#ffffff"
              opacity="0.85"
            />
            <circle cx="400" cy="380" r="85" fill="#bbf7d0" opacity="0.55" />
            {/* Blossoms */}
            {[
              { cx: 315, cy: 330, c: '#f9a8d4' },
              { cx: 485, cy: 335, c: '#fde047' },
              { cx: 400, cy: 265, c: '#fbcfe8' },
              { cx: 345, cy: 465, c: '#86efac' },
              { cx: 455, cy: 465, c: '#f9a8d4' },
            ].map((b, i) => (
              <circle key={i} cx={b.cx} cy={b.cy} r="30" fill={b.c} opacity="0.85" />
            ))}
            <ellipse cx="400" cy="395" rx="48" ry="64" fill="#fef9c3" stroke="#2c6b4a" strokeWidth="3" />
          </>
        );

      case 'summer-citrus':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="65%" stopColor="#fde68a" />
                <stop offset="100%" stopColor="#bae6fd" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            {/* Warm sun */}
            <circle cx="400" cy="370" r="115" fill="#fb923c" />
            <circle cx="400" cy="370" r="88" fill="#facc15" />
            {/* Ocean horizon & playful stripes */}
            <path d="M0,485 Q200,455 400,485 T800,485 L800,800 L0,800 Z" fill="#0284c7" opacity="0.82" />
            <path d="M0,535 Q200,505 400,535 T800,535 L800,800 L0,800 Z" fill="#0369a1" opacity="0.9" />
          </>
        );

      case 'baby-cloud':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fdfbf6" />
                <stop offset="55%" stopColor="#eef6fc" />
                <stop offset="100%" stopColor="#e5f0f8" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            {/* Crescent moon & hanging stars */}
            <circle cx="485" cy="295" r="50" fill="#fde047" />
            <circle cx="508" cy="285" r="42" fill="#eef6fc" />
            <line x1="295" y1="190" x2="295" y2="310" stroke="#93c5fd" strokeWidth="2.5" />
            <polygon points="295,295 302,315 322,320 302,325 295,345 288,325 268,320 288,315" fill="#fbbf24" />
            {/* Soft clouds */}
            <g fill="#ffffff">
              <circle cx="320" cy="465" r="68" />
              <circle cx="405" cy="435" r="84" />
              <circle cx="495" cy="470" r="64" />
              <rect x="270" y="455" width="275" height="80" rx="40" />
            </g>
          </>
        );

      case 'bridal-pearls':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fbf8f3" />
                <stop offset="100%" stopColor="#efe7db" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <circle cx="400" cy="400" r="150" fill="none" stroke="#855736" strokeOpacity="0.45" strokeWidth="2" />
            <circle cx="400" cy="400" r="134" fill="none" stroke="#855736" strokeOpacity="0.22" strokeWidth="1" />
            {/* Luminous pearl accents around botanical wreath */}
            {Array.from({ length: 12 }, (_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const cx = 400 + Math.cos(angle) * 150;
              const cy = 400 + Math.sin(angle) * 150;
              return <circle key={i} cx={cx} cy={cy} r={i % 2 === 0 ? 8 : 5} fill="#ffffff" stroke="#d6c8b8" strokeWidth="2" />;
            })}
            <path d="M350,400 Q400,340 450,400 Q400,460 350,400 Z" fill="#e7dcd0" opacity="0.7" />
          </>
        );

      case 'birthday-cake':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#160c30" />
                <stop offset="55%" stopColor="#2c1759" />
                <stop offset="100%" stopColor="#4c1d6e" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            {/* Tiered cake silhouette */}
            <rect x="280" y="455" width="240" height="90" rx="14" fill="#ff7096" />
            <rect x="320" y="380" width="160" height="75" rx="12" fill="#f472b6" />
            {/* Candles & flames */}
            {[360, 400, 440].map((cx, i) => (
              <g key={i}>
                <rect x={cx - 5} y="325" width="10" height="55" rx="4" fill="#fef08a" />
                <ellipse cx={cx} cy="308" rx="7" ry="13" fill="#fbbf24" />
                <ellipse cx={cx} cy="311" rx="3.5" ry="7" fill="#ffffff" />
              </g>
            ))}
            {/* Confetti accents */}
            <rect x="210" y="275" width="22" height="10" rx="3" transform="rotate(28 210 275)" fill="#34d399" />
            <rect x="575" y="295" width="22" height="10" rx="3" transform="rotate(-24 575 295)" fill="#60a5fa" />
            <circle cx="245" cy="400" r="8" fill="#fde047" />
            <circle cx="555" cy="410" r="8" fill="#ff7096" />
          </>
        );

      case 'candlelit-table':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14100e" />
                <stop offset="65%" stopColor="#261d18" />
                <stop offset="100%" stopColor="#382921" />
              </linearGradient>
              <radialGradient id={glowId} cx="50%" cy="38%" r="45%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#14100e" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <rect width="800" height="800" fill={`url(#${glowId})`} />
            {/* Taper candles */}
            {[
              { x: 350, top: 320 },
              { x: 450, top: 355 },
            ].map((c, i) => (
              <g key={i}>
                <circle cx={c.x} cy={c.top - 22} r="36" fill="#fbbf24" opacity="0.2" />
                <ellipse cx={c.x} cy={c.top - 22} rx="8" ry="18" fill="#fde68a" />
                <rect x={c.x - 10} y={c.top} width="20" height={540 - c.top} rx="4" fill="#faf6f2" />
                <rect x={c.x - 24} y="540" width="48" height="12" rx="4" fill="#d97706" />
              </g>
            ))}
          </>
        );

      case 'gallery-monolith':
        return (
          <>
            <rect width="800" height="800" fill="#f4f4f5" />
            <rect x="160" y="210" width="480" height="380" fill="#ffffff" stroke="#d4d4d8" strokeWidth="2" />
            <path d="M295,550 L295,380 A105,105 0 0,1 505,380 L505,550 Z" fill="#18181b" />
            <circle cx="400" cy="365" r="38" fill="#f4f4f5" />
          </>
        );

      case 'quantum-prism':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#09071c" />
                <stop offset="50%" stopColor="#1c124f" />
                <stop offset="100%" stopColor="#3b0764" />
              </linearGradient>
              <linearGradient id={accentId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <polygon points="400,205 565,495 235,495" fill="none" stroke={`url(#${accentId})`} strokeWidth="5" />
            <polygon points="400,265 515,470 285,470" fill={`url(#${accentId})`} opacity="0.22" />
            <line x1="150" y1="435" x2="400" y2="335" stroke="#ffffff" strokeWidth="2.5" opacity="0.7" />
            <line x1="400" y1="335" x2="660" y2="410" stroke="#c084fc" strokeWidth="4" opacity="0.8" />
            <line x1="400" y1="335" x2="660" y2="455" stroke="#38bdf8" strokeWidth="4" opacity="0.8" />
          </>
        );

      case 'aurora-ridge':
      default:
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#050a14" />
                <stop offset="55%" stopColor="#0b172a" />
                <stop offset="100%" stopColor="#12213d" />
              </linearGradient>
              <linearGradient id={accentId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={accent} stopOpacity="0.8" />
                <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            {/* Flowing aurora arc */}
            <path
              d="M0,335 Q200,220 410,305 T800,255 L800,385 Q580,435 385,360 T0,430 Z"
              fill={`url(#${accentId})`}
              opacity="0.58"
            />
            <path
              d="M0,385 Q240,285 450,350 T800,315 L800,440 L0,470 Z"
              fill={accent}
              opacity="0.22"
            />
            {/* Mountain ridge silhouettes */}
            <polygon points="0,585 190,415 365,535 535,385 800,565 800,800 0,800" fill="#070e1c" />
            <polygon points="85,610 290,460 470,585 650,455 800,590 800,800 0,800" fill="#040812" />
            {/* Starfield */}
            <circle cx="160" cy="240" r="2.5" fill="#ffffff" opacity="0.7" />
            <circle cx="315" cy="215" r="2" fill="#ffffff" opacity="0.6" />
            <circle cx="520" cy="230" r="3" fill="#ffffff" opacity="0.8" />
            <circle cx="660" cy="260" r="2" fill="#ffffff" opacity="0.65" />
          </>
        );
    }
  };

  return (
    <div className={containerClass} data-cover-preset={coverPresetId}>
      <svg
        viewBox="0 0 800 800"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="img"
        aria-label={title ? `${title} cover art` : 'Event cover artwork'}
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
