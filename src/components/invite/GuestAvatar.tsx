import { getAvatarAppearance } from '@/lib/client/deviceProfile';

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

export function GuestAvatar({
  name = '',
  size = 'sm',
  className = '',
}: GuestAvatarProps) {
  const { background, color, initials } = getAvatarAppearance(name);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight select-none ${SIZE_CLASSES[size]} ${className}`.trim()}
      style={{ background, color }}
    >
      {initials}
    </span>
  );
}
