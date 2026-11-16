import React from 'react';
import { getProfileAvatarSpec } from '@/lib/client/deviceProfile';

interface GuestAvatarProps {
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<GuestAvatarProps['size']>, string> = {
  xs: 'h-5 w-5',
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-10 w-10',
};

const ICON_SIZE_CLASSES: Record<NonNullable<GuestAvatarProps['size']>, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-5 w-5',
};

const FALLBACK_SWATCHES: Array<{ bg: string; fg: string }> = [
  { bg: '#bae6fd', fg: '#0f172a' },
  { bg: '#bbf7d0', fg: '#0f172a' },
  { bg: '#fde68a', fg: '#0f172a' },
  { bg: '#fbcfe8', fg: '#0f172a' },
  { bg: '#ddd6fe', fg: '#0f172a' },
  { bg: '#fed7aa', fg: '#0f172a' },
];

function renderAvatarGlyph(iconIndex: number, className: string): React.JSX.Element {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    className,
  };

  switch (iconIndex) {
    case 0: // Luma-style smiling emblem
      return (
        <svg {...common}>
          <circle cx="9.2" cy="10" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="14.8" cy="10" r="1.2" fill="currentColor" stroke="none" />
          <path d="M8.5 14.2a4.2 4.2 0 0 0 7 0" />
        </svg>
      );
    case 1: // Friendly pelican / bird
      return (
        <svg {...common}>
          <path d="M6 16c0-4.5 2.5-8 5.5-8 1.8 0 3 1 3.3 2.5L20 11.5c-1.5 2.4-3.8 3.3-6 2.8-.6 2.2-2.4 3.7-5 3.7H6v-2Z" />
          <circle cx="11.5" cy="10.2" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case 2: // Warm mug
      return (
        <svg {...common}>
          <path d="M6 10h9v5.5a3.5 3.5 0 0 1-3.5 3.5h-2A3.5 3.5 0 0 1 6 15.5V10Z" />
          <path d="M15 11.5h1.8a2 2 0 0 1 0 4H15" />
          <path d="M9 6.5c0-1 1-1.5 1-2.5M12 6.5c0-1 1-1.5 1-2.5" />
        </svg>
      );
    case 3: // Four-point twinkle star
      return (
        <svg {...common}>
          <path
            d="M12 4.2 14 10l5.8 2-5.8 2-2 5.8-2-5.8-5.8-2L10 10l2-5.8Z"
            fill="currentColor"
            fillOpacity="0.22"
          />
        </svg>
      );
    case 4: // Sprouting botanical leaf
      return (
        <svg {...common}>
          <path d="M12 19.5V11" />
          <path d="M12 11C12 7.5 14.8 5 18.5 5c0 3.7-2.5 6.5-6.5 6Z" fill="currentColor" fillOpacity="0.2" />
          <path d="M12 14C12 11 9.5 9 6 9c0 3.3 2.3 5 6 5Z" />
        </svg>
      );
    case 5: // Crescent moon & star
      return (
        <svg {...common}>
          <path d="M15.8 15.5A6.5 6.5 0 0 1 8.5 6.2a6.5 6.5 0 1 0 9.3 9.3Z" fill="currentColor" fillOpacity="0.2" />
          <circle cx="16.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 6: // Five-petal blossom
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="6.8" r="2.2" />
          <circle cx="16.8" cy="10.4" r="2.2" />
          <circle cx="15" cy="16" r="2.2" />
          <circle cx="9" cy="16" r="2.2" />
          <circle cx="7.2" cy="10.4" r="2.2" />
        </svg>
      );
    case 7: // Paper airplane
      return (
        <svg {...common}>
          <path d="M20 5 4.5 11.2l5.6 2.1 2.2 5.7L20 5Z" />
          <path d="m10.1 13.3 4.8-4.2" />
        </svg>
      );
    case 8: // Cozy cat face
      return (
        <svg {...common}>
          <path d="M6.5 10 5.5 5.5l4 2.5h5l4-2.5L17.5 10v3.2a5.5 5.5 0 0 1-11 0V10Z" fill="currentColor" fillOpacity="0.16" />
          <circle cx="9.8" cy="12.2" r="1" fill="currentColor" stroke="none" />
          <circle cx="14.2" cy="12.2" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 9: // Citrus slice
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 4.5v15M4.5 12h15M6.8 6.8l10.4 10.4M17.2 6.8 6.8 17.2" />
        </svg>
      );
    case 10: // Little party crown
      return (
        <svg {...common}>
          <path d="M4.5 17h15l-1-8.5-4 3.5L12 6l-2.5 6-4-3.5L4.5 17Z" fill="currentColor" fillOpacity="0.2" />
        </svg>
      );
    case 11: // Music note
      return (
        <svg {...common}>
          <path d="M10 16.5V7l8-1.5V15" />
          <circle cx="7.8" cy="16.5" r="2.3" fill="currentColor" fillOpacity="0.22" />
          <circle cx="15.8" cy="15" r="2.3" fill="currentColor" fillOpacity="0.22" />
        </svg>
      );
    case 12: // Butterfly
      return (
        <svg {...common}>
          <path d="M12 8v9" />
          <path d="M12 10.5C9.5 6.5 4.8 7 4.8 11c0 2.5 2.5 4 7.2 3.2" fill="currentColor" fillOpacity="0.2" />
          <path d="M12 10.5C14.5 6.5 19.2 7 19.2 11c0 2.5-2.5 4-7.2 3.2" fill="currentColor" fillOpacity="0.2" />
        </svg>
      );
    case 13: // Warm heart
      return (
        <svg {...common}>
          <path
            d="M12 18.8s-6.2-4-7.6-7.6A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.6 4.2c-1.4 3.6-7.6 7.6-7.6 7.6Z"
            fill="currentColor"
            fillOpacity="0.25"
          />
        </svg>
      );
    case 14: // Pine evergreen
      return (
        <svg {...common}>
          <path d="M12 4.5 6.8 11.5h3L5.5 17h13l-4.3-5.5h3L12 4.5Z" fill="currentColor" fillOpacity="0.2" />
          <path d="M12 17v3" />
        </svg>
      );
    case 15: // Sunburst
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.6" fill="currentColor" fillOpacity="0.22" />
          <path d="M12 4.2v2M12 17.8v2M4.2 12h2M17.8 12h2M6.5 6.5l1.4 1.4M16.1 16.1l1.4 1.4M17.5 6.5l-1.4 1.4M7.9 16.1l-1.4 1.4" />
        </svg>
      );
  }
}

export function GuestAvatar({
  name = '',
  size = 'sm',
  className = '',
}: GuestAvatarProps) {
  const { slot, iconIndex } = getProfileAvatarSpec(name);
  const fallback = FALLBACK_SWATCHES[(slot - 1) % FALLBACK_SWATCHES.length];

  return (
    <span
      aria-hidden="true"
      data-avatar-slot={slot}
      data-avatar-icon={iconIndex}
      className={`invite-avatar inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-black/10 select-none ${SIZE_CLASSES[size]} ${className}`.trim()}
      style={
        {
          '--theme-avatar-bg': `var(--theme-avatar-${slot}-bg, ${fallback.bg})`,
          '--theme-avatar-fg': `var(--theme-avatar-${slot}-fg, ${fallback.fg})`,
          backgroundColor: 'var(--theme-avatar-bg)',
          color: 'var(--theme-avatar-fg)',
        } as React.CSSProperties
      }
    >
      {renderAvatarGlyph(iconIndex, ICON_SIZE_CLASSES[size])}
    </span>
  );
}