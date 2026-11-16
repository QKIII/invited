import React from 'react';

export type InviteIconName =
  | 'brand'
  | 'aurora'
  | 'snowflake'
  | 'pine'
  | 'star'
  | 'pumpkin'
  | 'leaf'
  | 'firework'
  | 'champagne'
  | 'rose'
  | 'clover'
  | 'tulip'
  | 'sun'
  | 'cloud'
  | 'rings'
  | 'cake'
  | 'candle'
  | 'arch'
  | 'wave'
  | 'confetti'
  | 'heart'
  | 'still'
  | 'rain'
  | 'illustrated'
  | 'painted'
  | 'graphic'
  | 'pencil'
  | 'pattern';

export function InviteIcon({
  name,
  className = 'h-4 w-4',
}: {
  name: InviteIconName;
  className?: string;
}): React.JSX.Element {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    className,
  };

  switch (name) {
    case 'brand':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="3.5" />
          <path d="M4.5 7.5 12 13l7.5-5.5" />
        </svg>
      );

    case 'aurora':
      return (
        <svg {...common}>
          <path d="M3 16c3.5-5 6.5-8 9-8s4.5 4 9-1" />
          <path d="M3 11.5c3-3.5 6-5.5 9-5.5s5 3.5 9-.5" opacity="0.65" />
          <path d="M4 19h16" />
        </svg>
      );

    case 'snowflake':
      return (
        <svg {...common}>
          <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5 4.2 16.5" />
          <path d="M9.5 5 12 7.5 14.5 5M9.5 19 12 16.5l2.5 2.5" />
        </svg>
      );

    case 'pine':
      return (
        <svg {...common}>
          <path d="M12 3 6.5 10.5h3.2L5 17h14l-4.7-6.5h3.2L12 3Z" />
          <path d="M12 17v4M9 21h6" />
        </svg>
      );

    case 'star':
      return (
        <svg {...common}>
          <path d="M12 2.5v19M5.5 12h13" />
          <path d="M12 6.5 13.8 10.2 17.5 12 13.8 13.8 12 17.5 10.2 13.8 6.5 12l3.7-1.8Z" />
        </svg>
      );

    case 'pumpkin':
      return (
        <svg {...common}>
          <path d="M12 6c0-2 1-3 2.5-3.5" />
          <ellipse cx="12" cy="13.5" rx="7.5" ry="6" />
          <ellipse cx="12" cy="13.5" rx="3.2" ry="6" />
        </svg>
      );

    case 'leaf':
      return (
        <svg {...common}>
          <path d="M5 19c8 0 14-5.5 14-14-8.5 0-14 6-14 14Z" />
          <path d="M5 19c3.5-3.5 6.5-6.5 10-10" />
        </svg>
      );

    case 'firework':
      return (
        <svg {...common}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <path d="M5.6 5.6 8.5 8.5M15.5 15.5l2.9 2.9M18.4 5.6l-2.9 2.9M8.5 15.5l-2.9 2.9" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );

    case 'champagne':
      return (
        <svg {...common}>
          <path d="M7.5 4h6l-.8 5.2a2.5 2.5 0 0 1-4.4 0L7.5 4Z" />
          <path d="M10.5 11.7V19M8 19h5" />
          <path d="M16.5 5.5v2M15.5 6.5h2M18 11v1.5" />
        </svg>
      );

    case 'rose':
      return (
        <svg {...common}>
          <path d="M12 14c-3.5 0-5.5-2.2-5.5-5 0-2 1.4-4 3.5-4.5 1-.2 2 .3 2 .3s1-.5 2-.3c2.1.5 3.5 2.5 3.5 4.5 0 2.8-2 5-5.5 5Z" />
          <path d="M10 9.5a2 2 0 1 0 4 0" />
          <path d="M12 14v7M12 17.5c2 0 3.5-1 4-2.5" />
        </svg>
      );

    case 'clover':
      return (
        <svg {...common}>
          <circle cx="9.2" cy="8.8" r="3" />
          <circle cx="14.8" cy="8.8" r="3" />
          <circle cx="9.2" cy="14" r="3" />
          <circle cx="14.8" cy="14" r="3" />
          <path d="M12 16.5c0 2.2.8 3.5 2.5 4.5" />
        </svg>
      );

    case 'tulip':
      return (
        <svg {...common}>
          <path d="M7 6c0 4.2 2 7 5 7s5-2.8 5-7l-2.5 2L12 5 9.5 8 7 6Z" />
          <path d="M12 13v8M12 18c-2.5 0-4-1.2-4.5-3M12 18c2.5 0 4-1.2 4.5-3" />
        </svg>
      );

    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
        </svg>
      );

    case 'cloud':
      return (
        <svg {...common}>
          <path d="M7.5 18h9.2a3.8 3.8 0 0 0 .4-7.6A5 5 0 0 0 7.4 9.5 3.6 3.6 0 0 0 7.5 18Z" />
          <path d="M9.5 5.5v2M8.5 6.5h2" />
        </svg>
      );

    case 'rings':
      return (
        <svg {...common}>
          <circle cx="9.5" cy="13.5" r="4.5" />
          <circle cx="14.8" cy="11.5" r="4.5" />
        </svg>
      );

    case 'cake':
      return (
        <svg {...common}>
          <rect x="4.5" y="13.5" width="15" height="6.5" rx="2" />
          <path d="M6.5 13.5v-2.5a1.5 1.5 0 0 1 1.5-1.5h8a1.5 1.5 0 0 1 1.5 1.5v2.5" />
          <path d="M12 9.5V7M12 4.8c.7.7.7 1.7 0 2.2-.7-.5-.7-1.5 0-2.2Z" />
        </svg>
      );

    case 'candle':
      return (
        <svg {...common}>
          <rect x="9.5" y="11" width="5" height="9" rx="1.5" />
          <path d="M12 11V9" />
          <path d="M12 4.2c1.4 1.7 1.4 3.5 0 4.6-1.4-1.1-1.4-2.9 0-4.6Z" />
          <path d="M7 20h10" />
        </svg>
      );

    case 'arch':
      return (
        <svg {...common}>
          <path d="M5.5 20V11a6.5 6.5 0 0 1 13 0v9" />
          <path d="M9.5 20v-7.5a2.5 2.5 0 0 1 5 0V20" />
          <path d="M4 20h16" />
        </svg>
      );

    case 'wave':
      return (
        <svg {...common}>
          <path d="M3 9c2.5-2 4.5-2 7 0s4.5 2 7 0 2.5-1.5 4 0" />
          <path d="M3 15c2.5-2 4.5-2 7 0s4.5 2 7 0 2.5-1.5 4 0" />
        </svg>
      );

    case 'confetti':
      return (
        <svg {...common}>
          <path d="M5 19 9 9l6 6-10 4Z" />
          <path d="M14 5.5c1-1.2 2.5-1.2 3.5 0" />
          <path d="M18 11.5c1.5-.5 2.5.5 2.5 2" />
          <path d="M11 4.5v1.5" />
        </svg>
      );

    case 'heart':
      return (
        <svg {...common}>
          <path d="M12 19.5s-6.5-4.3-8.2-8A4.7 4.7 0 0 1 12 6.8a4.7 4.7 0 0 1 8.2 4.7c-1.7 3.7-8.2 8-8.2 8Z" />
        </svg>
      );

    case 'still':
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="4" />
        </svg>
      );

    case 'rain':
      return (
        <svg {...common}>
          <path d="M7.5 14h9a3.5 3.5 0 0 0 .4-7A4.8 4.8 0 0 0 7.6 6a3.4 3.4 0 0 0-.1 8Z" />
          <path d="m9 17-1 3M13 17l-1 3M17 17l-1 3" />
        </svg>
      );

    case 'pencil':
      return (
        <svg {...common}>
          <path d="M16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1 1-4Z" />
          <path d="m14.5 6.5 3 3" />
        </svg>
      );

    case 'pattern':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
          <circle cx="16.8" cy="7.2" r="3.2" />
          <circle cx="7.2" cy="16.8" r="3.2" />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
        </svg>
      );

    case 'illustrated':
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="14" rx="3" />
          <path d="m4.5 16 4.5-4.5 3.5 3.5 3-3 4 4" />
          <circle cx="9" cy="9.5" r="1.3" />
        </svg>
      );

    case 'painted':
      return (
        <svg {...common}>
          <path d="M18.5 4.5 10 13c-1.2.2-2.2 1.2-2.4 2.4-.2 1.5-1.1 2.4-2.6 2.6.8 1.2 2.4 1.8 4 1.3 1.8-.5 3-1.8 3.2-3.5L20.5 7.5a1.5 1.5 0 0 0-2-3Z" />
        </svg>
      );

    case 'graphic':
    default:
      return (
        <svg {...common}>
          <circle cx="9" cy="14" r="4.5" />
          <path d="m14 5 5.5 9.5h-11L14 5Z" />
        </svg>
      );
  }
}

export const REACTION_OPTIONS: Array<{
  key: '🎉' | '❤️' | '🍽️' | '👏' | '🥂' | '🔥';
  label: string;
}> = [
  { key: '🎉', label: 'Celebrate' },
  { key: '❤️', label: 'Love' },
  { key: '🍽️', label: 'Food' },
  { key: '👏', label: 'Cheer' },
  { key: '🥂', label: 'Cheers' },
  { key: '🔥', label: 'Excited' },
];

export const DEFAULT_WALL_REACTIONS: Array<'🎉' | '❤️' | '🍽️' | '👏'> = [
  '🎉',
  '❤️',
  '🍽️',
  '👏',
];

export function getReactionLabel(key: string): string {
  return REACTION_OPTIONS.find((item) => item.key === key)?.label ?? 'React';
}

export function ReactionIcon({
  reactionKey,
  className = 'h-3.5 w-3.5',
}: {
  reactionKey: string;
  className?: string;
}): React.JSX.Element {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.85,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    className,
  };

  switch (reactionKey) {
    case '🎉':
      return <InviteIcon name="confetti" className={className} />;
    case '❤️':
      return <InviteIcon name="heart" className={className} />;
    case '🥂':
      return <InviteIcon name="champagne" className={className} />;
    case '🍽️':
      return (
        <svg {...common}>
          <path d="M4 13h16" />
          <path d="M5.5 13a6.5 6.5 0 0 1 13 0" />
          <path d="M12 6.5V5" />
          <path d="M6.5 16.5h11" />
        </svg>
      );
    case '🔥':
      return (
        <svg {...common}>
          <path d="M12.5 3.5c1 3-2 4.5-2 7.5 0 1.4.9 2.5 2.2 2.5 1.5 0 2.3-1.4 2-3 2.3 1.4 3.8 3.6 3.8 6a6.5 6.5 0 1 1-13 0c0-4 3.5-7 7-13Z" />
        </svg>
      );
    case '👏':
    default:
      return (
        <svg {...common}>
          <path d="M12 4v2.5M6.5 6.5l1.5 1.5M17.5 6.5 16 8" />
          <path d="M8.5 14.5 12 10l4 4.5a3.2 3.2 0 0 1-4.5 4.5l-3-2.5a1.5 1.5 0 0 1 0-2Z" />
        </svg>
      );
  }
}
