import React from 'react';
import { getProfileAvatarSpec } from '@/lib/client/deviceProfile';

interface GuestAvatarProps {
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<GuestAvatarProps['size']>, string> = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-10 w-10 text-sm',
};

const FALLBACK_SWATCHES: Array<{ bg: string; fg: string }> = [
  { bg: '#bae6fd', fg: '#0f172a' },
  { bg: '#bbf7d0', fg: '#0f172a' },
  { bg: '#fde68a', fg: '#0f172a' },
  { bg: '#fbcfe8', fg: '#0f172a' },
  { bg: '#ddd6fe', fg: '#0f172a' },
  { bg: '#fed7aa', fg: '#0f172a' },
];

export function GuestAvatar({
  name = '',
  size = 'sm',
  className = '',
}: GuestAvatarProps) {
  const { slot, initials } = getProfileAvatarSpec(name);
  const fallback = FALLBACK_SWATCHES[(slot - 1) % FALLBACK_SWATCHES.length];

  return (
    <span
      aria-hidden="true"
      data-avatar-slot={slot}
      data-avatar-initials={initials}
      className={`invite-avatar inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight ring-1 ring-inset ring-white/20 select-none ${SIZE_CLASSES[size]} ${className}`.trim()}
      style={
        {
          '--theme-avatar-bg': `var(--theme-avatar-${slot}-bg, ${fallback.bg})`,
          '--theme-avatar-fg': `var(--theme-avatar-${slot}-fg, ${fallback.fg})`,
          backgroundColor: 'var(--theme-avatar-bg)',
          color: 'var(--theme-avatar-fg)',
        } as React.CSSProperties
      }
    >
      {initials}
    </span>
  );
}
