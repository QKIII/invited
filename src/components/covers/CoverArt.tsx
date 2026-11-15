import React, { useId } from 'react';
import type { CoverLayout } from '@/types/invite';

export function CoverArt({
  coverPresetId,
  customCoverUrl,
  layout,
  title,
  accentColor,
  className = '',
}: {
  coverPresetId: string;
  customCoverUrl?: string;
  layout: CoverLayout;
  title?: string;
  accentColor?: string;
  className?: string;
}): React.JSX.Element | null {
  const uid = useId().replace(/:/g, '');

  if (layout === 'none') {
    return null;
  }

  const aspectClass = layout === 'banner' ? 'aspect-[16/9] w-full' : 'aspect-square w-full';
  const containerClass = `relative overflow-hidden rounded-2xl border border-white/10 shadow-lg ${aspectClass} ${className}`.trim();

  if (customCoverUrl && customCoverUrl.trim().length > 0) {
    return (
      <div className={containerClass} data-cover-preset="custom">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={customCoverUrl}
          alt={title ? `${title} cover artwork` : 'Event cover artwork'}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const bgId = `bg-${uid}`;
  const glowId = `glow-${uid}`;
  const accentId = `acc-${uid}`;
  const accent = accentColor || '#34d399';

  const renderArtwork = () => {
    switch (coverPresetId) {
      case 'christmas-evergreen':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#071a12" />
                <stop offset="55%" stopColor="#0f2d20" />
                <stop offset="100%" stopColor="#1b3c2b" />
              </linearGradient>
              <radialGradient id={glowId} cx="50%" cy="46%" r="48%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.38" />
                <stop offset="55%" stopColor="#fb7185" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#071a12" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <rect width="800" height="800" fill={`url(#${glowId})`} />
            {/* Minimalist geometric evergreen tree centered in y=200..600 */}
            <polygon points="400,215 305,360 495,360" fill="#174d35" />
            <polygon points="400,290 270,455 530,455" fill="#14422d" />
            <polygon points="400,365 235,555 565,555" fill="#103725" />
            <rect x="382" y="555" width="36" height="44" rx="4" fill="#5c3a21" />
            {/* Star topper */}
            <polygon
              points="400,190 407,210 428,210 411,222 417,242 400,230 383,242 389,222 372,210 393,210"
              fill="#fde047"
            />
            {/* Warm ornaments */}
            <circle cx="368" cy="335" r="10" fill="#fb7185" />
            <circle cx="432" cy="340" r="9" fill="#fde047" />
            <circle cx="342" cy="422" r="11" fill="#fde047" />
            <circle cx="410" cy="410" r="10" fill="#f43f5e" />
            <circle cx="465" cy="434" r="9" fill="#f8fafc" />
            <circle cx="310" cy="515" r="12" fill="#fb7185" />
            <circle cx="385" cy="500" r="11" fill="#fde047" />
            <circle cx="458" cy="522" r="11" fill="#fb7185" />
            <circle cx="512" cy="534" r="9" fill="#fde047" />
            {/* Ambient snow */}
            <circle cx="170" cy="240" r="3" fill="#ffffff" opacity="0.5" />
            <circle cx="620" cy="270" r="3.5" fill="#ffffff" opacity="0.6" />
            <circle cx="215" cy="460" r="2.5" fill="#ffffff" opacity="0.4" />
            <circle cx="645" cy="480" r="3" fill="#ffffff" opacity="0.5" />
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
              <radialGradient id={glowId} cx="50%" cy="35%" r="50%">
                <stop offset="0%" stopColor="#fde68a" stopOpacity="0.62" />
                <stop offset="40%" stopColor="#f5c451" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#070a1c" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <rect width="800" height="800" fill={`url(#${glowId})`} />
            {/* Sanctuary arches */}
            <path
              d="M250,610 L250,415 A150,150 0 0,1 550,415 L550,610"
              fill="none"
              stroke="#f5c451"
              strokeOpacity="0.28"
              strokeWidth="2.5"
            />
            <path
              d="M300,610 L300,435 A100,100 0 0,1 500,435 L500,610"
              fill="none"
              stroke="#fde68a"
              strokeOpacity="0.2"
              strokeWidth="1.5"
            />
            {/* Radiant Star of Bethlehem */}
            <line x1="400" y1="190" x2="400" y2="535" stroke="#fde68a" strokeWidth="2.5" opacity="0.7" />
            <line x1="275" y1="315" x2="525" y2="315" stroke="#fde68a" strokeWidth="2.5" opacity="0.7" />
            <line x1="330" y1="245" x2="470" y2="385" stroke="#f5c451" strokeWidth="1.5" opacity="0.45" />
            <line x1="470" y1="245" x2="330" y2="385" stroke="#f5c451" strokeWidth="1.5" opacity="0.45" />
            <polygon
              points="400,255 414,301 460,315 414,329 400,375 386,329 340,315 386,301"
              fill="#fef3c7"
            />
            {/* Subtle distant hills & candlelight glow */}
            <path d="M0,565 Q240,515 440,560 T800,545 L800,800 L0,800 Z" fill="#0b0f26" />
            <circle cx="400" cy="542" r="24" fill="#fbbf24" opacity="0.25" />
            <ellipse cx="400" cy="542" rx="6" ry="12" fill="#fde68a" />
            <rect x="394" y="556" width="12" height="32" rx="3" fill="#fcfaf2" opacity="0.9" />
          </>
        );

      case 'snowy-pines':
        return (
          <>
            <defs>
              <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0b192e" />
                <stop offset="65%" stopColor="#173257" />
                <stop offset="100%" stopColor="#264b7a" />
              </linearGradient>
              <radialGradient id={glowId} cx="72%" cy="30%" r="35%">
                <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0b192e" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="800" height="800" fill={`url(#${bgId})`} />
            <rect width="800" height="800" fill={`url(#${glowId})`} />
            <circle cx="575" cy="270" r="44" fill="#f0f9ff" opacity="0.9" />
            {/* Snow-dusted pine hills */}
            <path d="M0,515 Q210,455 430,520 T800,490 L800,800 L0,800 Z" fill="#1b3a63" />
            <path d="M0,565 Q280,520 520,565 T800,550 L800,800 L0,800 Z" fill="#dbeafe" opacity="0.88" />
            {/* Pines */}
            <polygon points="210,330 140,520 280,520" fill="#0f2847" />
            <polygon points="210,330 175,425 245,425" fill="#e0f2fe" opacity="0.7" />
            <polygon points="315,375 260,535 370,535" fill="#133154" />
            <polygon points="315,375 288,450 342,450" fill="#e0f2fe" opacity="0.65" />
            {/* Cozy cabin */}
            <rect x="470" y="455" width="120" height="90" fill="#1f2937" />
            <polygon points="452,458 530,398 608,458" fill="#f8fafc" />
            <rect x="512" y="485" width="36" height="36" rx="4" fill="#fbbf24" />
            {/* Snowfall specks */}
            <circle cx="140" cy="240" r="4" fill="#ffffff" opacity="0.75" />
            <circle cx="380" cy="260" r="3" fill="#ffffff" opacity="0.65" />
            <circle cx="670" cy="350" r="4" fill="#ffffff" opacity="0.7" />
            <circle cx="445" cy="295" r="2.5" fill="#ffffff" opacity="0.55" />
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
    </div>
  );
}
