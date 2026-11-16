import type { InviteIconName } from '@/components/icons/InviteIcons';
import type {
  AmbientEffectId,
  CardSurfaceStyle,
  FontPairingId,
  InviteStyleConfig,
} from '@/types/invite';
import {
  ensureReadableAccentOnSurface,
  hexToRgb,
  isValidHex,
  mixHex,
  normalizeHex,
  pickAccessibleForeground,
  relativeLuminance,
  shiftHexHue,
} from './contrast';

export type CoverStyleGroup =
  | 'hand-drawn'
  | 'vector'
  | 'pencil'
  | 'oil-paint'
  | 'pattern';

export interface ThemePreset {
  id: string;
  name: string;
  category: 'expressive' | 'ambient' | 'holiday' | 'milestone' | 'editorial';
  icon: InviteIconName;
  description: string;
  colorMode: 'dark' | 'light';
  surfaceBg: string;
  pageBg: string;
  cardBg: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  ctaStart: string;
  ctaEnd: string;
  border: string;
  defaultFontId: FontPairingId;
  defaultEffectId: AmbientEffectId;
  defaultCoverPresetId: string;
  defaultCardStyle?: CardSurfaceStyle;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'aurora-midnight',
    name: 'Northern Lights',
    category: 'ambient',
    icon: 'aurora',
    description: 'Deep night sky with soft green and blue northern lights.',
    colorMode: 'dark',
    pageBg: '#070b14',
    surfaceBg: '#0d1322',
    cardBg: '#121a2e',
    textPrimary: '#f8fafc',
    textMuted: '#a3b3cf',
    accent: '#34d399',
    ctaStart: '#10b981',
    ctaEnd: '#0ea5e9',
    border: '#253352',
    defaultFontId: 'modern-sans',
    defaultEffectId: 'aurora',
    defaultCoverPresetId: 'oil-starry-aurora',
  },
  {
    id: 'winter-snowfall',
    name: 'Frosty Winter',
    category: 'holiday',
    icon: 'snowflake',
    description: 'Crisp white invite card over a deep winter night sky with gentle snow.',
    colorMode: 'light',
    pageBg: '#082556',
    surfaceBg: '#f8fafc',
    cardBg: '#ffffff',
    textPrimary: '#0f172a',
    textMuted: '#475569',
    accent: '#0369a1',
    ctaStart: '#0369a1',
    ctaEnd: '#1d4ed8',
    border: '#cbd5e1',
    defaultFontId: 'modern-sans',
    defaultEffectId: 'snowfall',
    defaultCoverPresetId: 'handdrawn-pelican-holiday',
  },
  {
    id: 'cozy-christmas',
    name: 'Cozy Christmas',
    category: 'holiday',
    icon: 'pine',
    description: 'Evergreen pine, warm candlelight gold, and festive string lights.',
    colorMode: 'dark',
    pageBg: '#071610',
    surfaceBg: '#0d241b',
    cardBg: '#133024',
    textPrimary: '#faf7f0',
    textMuted: '#b7cec2',
    accent: '#fb7185',
    ctaStart: '#e11d48',
    ctaEnd: '#b91c1c',
    border: '#25503d',
    defaultFontId: 'expressive-display',
    defaultEffectId: 'christmas-lights',
    defaultCoverPresetId: 'handdrawn-cozy-tree',
  },
  {
    id: 'sacred-nativity',
    name: 'Sacred Starlight',
    category: 'holiday',
    icon: 'star',
    description: 'Deep evening blue, warm gold candlelight, and classic serif type.',
    colorMode: 'dark',
    pageBg: '#080c1f',
    surfaceBg: '#101635',
    cardBg: '#161e45',
    textPrimary: '#fcfaf2',
    textMuted: '#c2c7e3',
    accent: '#f5c451',
    ctaStart: '#f59e0b',
    ctaEnd: '#d97706',
    border: '#2c376a',
    defaultFontId: 'sacred-classic',
    defaultEffectId: 'starlight-radiance',
    defaultCoverPresetId: 'pencil-sacred-star',
  },
  {
    id: 'spooky-halloween',
    name: 'Halloween Night',
    category: 'holiday',
    icon: 'pumpkin',
    description: 'Dark twilight plum with warm pumpkin orange and drifting bats.',
    colorMode: 'dark',
    pageBg: '#100818',
    surfaceBg: '#190e26',
    cardBg: '#231435',
    textPrimary: '#faf5ff',
    textMuted: '#cab5e3',
    accent: '#fb923c',
    ctaStart: '#ea580c',
    ctaEnd: '#9333ea',
    border: '#3f285e',
    defaultFontId: 'expressive-display',
    defaultEffectId: 'halloween-bats',
    defaultCoverPresetId: 'handdrawn-pumpkin-cats',
  },
  {
    id: 'warm-thanksgiving',
    name: 'Autumn Harvest',
    category: 'holiday',
    icon: 'leaf',
    description: 'Warm espresso brown, golden amber, and falling autumn leaves.',
    colorMode: 'dark',
    pageBg: '#180e09',
    surfaceBg: '#24160f',
    cardBg: '#301e15',
    textPrimary: '#fdf8f3',
    textMuted: '#d8bfb0',
    accent: '#f59e0b',
    ctaStart: '#d97706',
    ctaEnd: '#9a3412',
    border: '#4f3527',
    defaultFontId: 'expressive-display',
    defaultEffectId: 'autumn-leaves',
    defaultCoverPresetId: 'pencil-autumn-acorns',
  },
  {
    id: 'fourth-of-july',
    name: 'Fourth of July',
    category: 'holiday',
    icon: 'firework',
    description: 'Midnight navy with festive red, gold, and blue fireworks.',
    colorMode: 'dark',
    pageBg: '#070f23',
    surfaceBg: '#0e1936',
    cardBg: '#15244b',
    textPrimary: '#f8fafc',
    textMuted: '#b0c3e8',
    accent: '#ff6b7a',
    ctaStart: '#e11d48',
    ctaEnd: '#2563eb',
    border: '#2b417a',
    defaultFontId: 'expressive-display',
    defaultEffectId: 'fireworks',
    defaultCoverPresetId: 'handdrawn-harbor-boats',
  },
  {
    id: 'new-years-eve',
    name: 'Midnight Toast',
    category: 'holiday',
    icon: 'champagne',
    description: 'Warm charcoal with champagne gold and subtle rising sparkles.',
    colorMode: 'dark',
    pageBg: '#09090d',
    surfaceBg: '#121218',
    cardBg: '#1b1b24',
    textPrimary: '#fafafa',
    textMuted: '#babac9',
    accent: '#f4ce6a',
    ctaStart: '#eab308',
    ctaEnd: '#ca8a04',
    border: '#323244',
    defaultFontId: 'editorial-serif',
    defaultEffectId: 'champagne-sparkle',
    defaultCoverPresetId: 'vector-champagne-coupes',
  },
  {
    id: 'valentines-rose',
    name: 'Velvet Rose',
    category: 'holiday',
    icon: 'rose',
    description: 'Deep burgundy wine with soft rose highlights and drifting hearts.',
    colorMode: 'dark',
    pageBg: '#1a0a11',
    surfaceBg: '#28101b',
    cardBg: '#361625',
    textPrimary: '#fff5f7',
    textMuted: '#e0bac7',
    accent: '#fb7185',
    ctaStart: '#f43f5e',
    ctaEnd: '#be185d',
    border: '#59283e',
    defaultFontId: 'editorial-serif',
    defaultEffectId: 'floating-hearts',
    defaultCoverPresetId: 'pencil-wedding-bouquet',
  },
  {
    id: 'st-patricks-emerald',
    name: 'Emerald Green',
    category: 'holiday',
    icon: 'clover',
    description: 'Rich forest greens paired with warm gold bokeh.',
    colorMode: 'dark',
    pageBg: '#06170f',
    surfaceBg: '#0b2519',
    cardBg: '#113424',
    textPrimary: '#f2fbf6',
    textMuted: '#aad3be',
    accent: '#4ade80',
    ctaStart: '#059669',
    ctaEnd: '#15803d',
    border: '#23553e',
    defaultFontId: 'expressive-display',
    defaultEffectId: 'warm-bokeh',
    defaultCoverPresetId: 'pattern-botanical-toile',
  },
  {
    id: 'spring-easter-garden',
    name: 'Spring Garden',
    category: 'holiday',
    icon: 'tulip',
    description: 'Light cream and sage green with soft drifting petals.',
    colorMode: 'light',
    pageBg: '#e8f1e6',
    surfaceBg: '#f9fcf8',
    cardBg: '#ffffff',
    textPrimary: '#122116',
    textMuted: '#425948',
    accent: '#2c6b4a',
    ctaStart: '#166534',
    ctaEnd: '#0f766e',
    border: '#cfe0d2',
    defaultFontId: 'sacred-classic',
    defaultEffectId: 'botanical-petals',
    defaultCoverPresetId: 'easter-botanical',
  },
  {
    id: 'summer-cookout',
    name: 'Summer Cookout',
    category: 'holiday',
    icon: 'sun',
    description: 'Sunny warm cream for backyard barbecues and patio hangs.',
    colorMode: 'light',
    pageBg: '#fef3e0',
    surfaceBg: '#fffaf2',
    cardBg: '#ffffff',
    textPrimary: '#152033',
    textMuted: '#48566e',
    accent: '#c8372d',
    ctaStart: '#dc2626',
    ctaEnd: '#d97706',
    border: '#e6dbc5',
    defaultFontId: 'playful-rounded',
    defaultEffectId: 'confetti',
    defaultCoverPresetId: 'handdrawn-backyard-bbq',
  },
  {
    id: 'baby-shower-cloud',
    name: 'Soft Cloud',
    category: 'milestone',
    icon: 'cloud',
    description: 'Soft sky blue and cream with gentle twinkling stars.',
    colorMode: 'light',
    pageBg: '#edf4f9',
    surfaceBg: '#f8fbfe',
    cardBg: '#ffffff',
    textPrimary: '#192334',
    textMuted: '#495870',
    accent: '#346888',
    ctaStart: '#0369a1',
    ctaEnd: '#4f46e5',
    border: '#dbe6f0',
    defaultFontId: 'playful-rounded',
    defaultEffectId: 'lullaby-stars',
    defaultCoverPresetId: 'pencil-baby-bunny',
  },
  {
    id: 'bridal-atelier',
    name: 'Wedding & Bridal',
    category: 'milestone',
    icon: 'rings',
    description: 'Warm ivory paper, soft bronze, and timeless serif lettering.',
    colorMode: 'light',
    pageBg: '#f3ece2',
    surfaceBg: '#fcfaf7',
    cardBg: '#ffffff',
    textPrimary: '#1c1917',
    textMuted: '#564f4a',
    accent: '#855736',
    ctaStart: '#855736',
    ctaEnd: '#573722',
    border: '#e2dad0',
    defaultFontId: 'editorial-serif',
    defaultEffectId: 'botanical-petals',
    defaultCoverPresetId: 'bridal-pearls',
  },
  {
    id: 'birthday-confetti',
    name: 'Birthday Party',
    category: 'milestone',
    icon: 'cake',
    description: 'Rich plum backdrop with bright coral accents and celebration confetti.',
    colorMode: 'dark',
    pageBg: '#110a22',
    surfaceBg: '#1a1034',
    cardBg: '#231645',
    textPrimary: '#faf8ff',
    textMuted: '#c6b7eb',
    accent: '#ff7096',
    ctaStart: '#ec4899',
    ctaEnd: '#8b5cf6',
    border: '#3e2b73',
    defaultFontId: 'playful-rounded',
    defaultEffectId: 'confetti',
    defaultCoverPresetId: 'handdrawn-birthday-table',
  },
  {
    id: 'candlelit-dinner',
    name: 'Candlelit Dinner',
    category: 'editorial',
    icon: 'candle',
    description: 'Deep warm espresso with terracotta glow and soft candlelight bokeh.',
    colorMode: 'dark',
    pageBg: '#13100e',
    surfaceBg: '#1d1815',
    cardBg: '#27201c',
    textPrimary: '#faf6f2',
    textMuted: '#cbbcb2',
    accent: '#ed9464',
    ctaStart: '#c2410c',
    ctaEnd: '#b45309',
    border: '#453a32',
    defaultFontId: 'editorial-serif',
    defaultEffectId: 'warm-bokeh',
    defaultCoverPresetId: 'oil-candlelight-wine',
  },
  {
    id: 'minimal-paper',
    name: 'Clean Paper',
    category: 'editorial',
    icon: 'arch',
    description: 'Crisp off-white card with quiet, clean typography.',
    colorMode: 'light',
    pageBg: '#eceef1',
    surfaceBg: '#f9fafb',
    cardBg: '#ffffff',
    textPrimary: '#111827',
    textMuted: '#4b5563',
    accent: '#18181b',
    ctaStart: '#18181b',
    ctaEnd: '#334155',
    border: '#e4e4e7',
    defaultFontId: 'modern-sans',
    defaultEffectId: 'none',
    defaultCoverPresetId: 'vector-minimal-arch',
  },
  {
    id: 'electric-quantum',
    name: 'Late Night',
    category: 'ambient',
    icon: 'wave',
    description: 'Deep indigo and drifting color waves for hangouts and late nights.',
    colorMode: 'dark',
    pageBg: '#09081a',
    surfaceBg: '#110f2f',
    cardBg: '#181542',
    textPrimary: '#f8f7ff',
    textMuted: '#b7b4e8',
    accent: '#c084fc',
    ctaStart: '#7c3aed',
    ctaEnd: '#db2777',
    border: '#332d75',
    defaultFontId: 'modern-sans',
    defaultEffectId: 'prism-gradient',
    defaultCoverPresetId: 'handdrawn-pizza-games',
    defaultCardStyle: 'glass',
  },
  {
    id: 'y2k-chrome',
    name: 'Y2K Chrome',
    category: 'expressive',
    icon: 'champagne',
    description: 'Iridescent chrome waves, neon pink, and electric blue glass.',
    colorMode: 'dark',
    pageBg: '#0b0624',
    surfaceBg: '#160d3d',
    cardBg: '#1d124d',
    textPrimary: '#fdf4ff',
    textMuted: '#e2c5ff',
    accent: '#ff5ce1',
    ctaStart: '#ff3cac',
    ctaEnd: '#00d2ff',
    border: '#7c5cff',
    defaultFontId: 'y2k-display',
    defaultEffectId: 'liquid-chrome',
    defaultCoverPresetId: 'vector-starburst-night',
    defaultCardStyle: 'y2k',
  },
  {
    id: 'neon-arcade',
    name: 'Cyber Glow',
    category: 'expressive',
    icon: 'firework',
    description: 'High-contrast synth grid and lime-cyan glass for parties.',
    colorMode: 'dark',
    pageBg: '#040914',
    surfaceBg: '#0a1324',
    cardBg: '#0f1b33',
    textPrimary: '#f0fdf4',
    textMuted: '#a8bbd4',
    accent: '#a3e635',
    ctaStart: '#84cc16',
    ctaEnd: '#06b6d4',
    border: '#2563eb',
    defaultFontId: 'y2k-display',
    defaultEffectId: 'cyber-grid',
    defaultCoverPresetId: 'vector-mountain-moon',
    defaultCardStyle: 'clear',
  },
  {
    id: 'sunset-disco',
    name: 'Sunset Club',
    category: 'expressive',
    icon: 'sun',
    description: 'Warm tangerine and magenta mesh over translucent plum glass.',
    colorMode: 'dark',
    pageBg: '#1c0817',
    surfaceBg: '#2b0d24',
    cardBg: '#38122f',
    textPrimary: '#fff1f2',
    textMuted: '#fbcfe8',
    accent: '#fb923c',
    ctaStart: '#f97316',
    ctaEnd: '#ec4899',
    border: '#7a2962',
    defaultFontId: 'expressive-display',
    defaultEffectId: 'prism-gradient',
    defaultCoverPresetId: 'vector-paper-cutouts',
    defaultCardStyle: 'glass',
  },
  {
    id: 'risograph-zine',
    name: 'Indie Zine',
    category: 'expressive',
    icon: 'arch',
    description: 'Cream paper grain with bold cobalt and crimson print ink.',
    colorMode: 'light',
    pageBg: '#efe6d5',
    surfaceBg: '#f7f1e6',
    cardBg: '#fcf9f2',
    textPrimary: '#172554',
    textMuted: '#3b4f7c',
    accent: '#dc2626',
    ctaStart: '#1d4ed8',
    ctaEnd: '#dc2626',
    border: '#1d4ed8',
    defaultFontId: 'studio-mono',
    defaultEffectId: 'static-grain',
    defaultCoverPresetId: 'pattern-retro-checker',
    defaultCardStyle: 'solid',
  },
];

export const CTA_PRESETS: Array<{
  id: string;
  name: string;
  startHex: string;
  endHex: string;
  mode: 'gradient' | 'solid';
}> = [
  { id: 'glacier-sapphire', name: 'Ocean Blue', startHex: '#0369a1', endHex: '#1d4ed8', mode: 'gradient' },
  { id: 'cranberry-holly', name: 'Holly Berry', startHex: '#e11d48', endHex: '#b91c1c', mode: 'gradient' },
  { id: 'champagne-gold', name: 'Warm Gold', startHex: '#eab308', endHex: '#d97706', mode: 'gradient' },
  { id: 'northern-emerald', name: 'Forest Green', startHex: '#059669', endHex: '#0d9488', mode: 'gradient' },
  { id: 'sunset-coral', name: 'Sunset Coral', startHex: '#ea580c', endHex: '#be123c', mode: 'gradient' },
  { id: 'twilight-plum', name: 'Evening Plum', startHex: '#ec4899', endHex: '#7c3aed', mode: 'gradient' },
  { id: 'botanical-sage', name: 'Garden Sage', startHex: '#166534', endHex: '#0f766e', mode: 'gradient' },
  { id: 'classic-ink', name: 'Classic Ink', startHex: '#0f172a', endHex: '#334155', mode: 'solid' },
];

export const FONT_PAIRINGS: Array<{
  id: FontPairingId;
  name: string;
  sample: string;
  headingVar: string;
  bodyVar: string;
}> = [
  {
    id: 'editorial-serif',
    name: 'Classic Serif',
    sample: 'Dinner around the table at 7',
    headingVar: 'var(--font-editorial-serif), Georgia, serif',
    bodyVar: 'var(--font-ui-body), system-ui, -apple-system, sans-serif',
  },
  {
    id: 'modern-sans',
    name: 'Clean Sans',
    sample: 'Rooftop drinks & sunset hangouts',
    headingVar: 'var(--font-modern-sans), system-ui, -apple-system, sans-serif',
    bodyVar: 'var(--font-modern-sans), var(--font-ui-body), system-ui, sans-serif',
  },
  {
    id: 'expressive-display',
    name: 'Warm Display',
    sample: 'Holiday Feast & Hot Cider',
    headingVar: 'var(--font-expressive-display), Georgia, serif',
    bodyVar: 'var(--font-ui-body), system-ui, -apple-system, sans-serif',
  },
  {
    id: 'sacred-classic',
    name: 'Book Serif',
    sample: 'Candlelight Evening & Music',
    headingVar: 'var(--font-sacred-classic), Georgia, serif',
    bodyVar: 'var(--font-ui-body), system-ui, -apple-system, sans-serif',
  },
  {
    id: 'playful-rounded',
    name: 'Soft Rounded',
    sample: "Emma's Baby Shower & Brunch!",
    headingVar: 'var(--font-playful-rounded), system-ui, -apple-system, sans-serif',
    bodyVar: 'var(--font-playful-rounded), var(--font-ui-body), system-ui, sans-serif',
  },
  {
    id: 'studio-mono',
    name: 'Typewriter',
    sample: 'Friday night vinyl & pizza at 8',
    headingVar: 'var(--font-studio-mono), ui-monospace, SFMono-Regular, monospace',
    bodyVar: 'var(--font-ui-body), system-ui, -apple-system, sans-serif',
  },
  {
    id: 'y2k-display',
    name: 'Bold Display',
    sample: 'Y2K ROOFTOP AFTERPARTY',
    headingVar: 'var(--font-y2k-display), var(--font-modern-sans), sans-serif',
    bodyVar: 'var(--font-ui-body), system-ui, -apple-system, sans-serif',
  },
];

export type EffectCategory = 'animated' | 'static';

export const EFFECT_OPTIONS: Array<{
  id: AmbientEffectId;
  name: string;
  animated: boolean;
  category: EffectCategory;
  icon: InviteIconName;
}> = [
  { id: 'prism-gradient', name: 'Color Waves', animated: true, category: 'animated', icon: 'wave' },
  { id: 'aurora', name: 'Northern Lights', animated: true, category: 'animated', icon: 'aurora' },
  { id: 'liquid-chrome', name: 'Y2K Chrome', animated: true, category: 'animated', icon: 'champagne' },
  { id: 'cyber-grid', name: 'Neon Horizon', animated: true, category: 'animated', icon: 'firework' },
  { id: 'snowfall', name: 'Snowfall', animated: true, category: 'animated', icon: 'snowflake' },
  { id: 'rain-glass', name: 'Gentle Rain', animated: true, category: 'animated', icon: 'rain' },
  { id: 'christmas-lights', name: 'String Lights', animated: true, category: 'animated', icon: 'pine' },
  { id: 'starlight-radiance', name: 'Starlight', animated: true, category: 'animated', icon: 'star' },
  { id: 'warm-bokeh', name: 'Golden Bokeh', animated: true, category: 'animated', icon: 'candle' },
  { id: 'lullaby-stars', name: 'Night Stars', animated: true, category: 'animated', icon: 'cloud' },
  { id: 'fireworks', name: 'Fireworks', animated: true, category: 'animated', icon: 'firework' },
  { id: 'confetti', name: 'Confetti', animated: true, category: 'animated', icon: 'confetti' },
  { id: 'botanical-petals', name: 'Flower Petals', animated: true, category: 'animated', icon: 'tulip' },
  { id: 'autumn-leaves', name: 'Autumn Leaves', animated: true, category: 'animated', icon: 'leaf' },
  { id: 'floating-hearts', name: 'Floating Hearts', animated: true, category: 'animated', icon: 'heart' },
  { id: 'champagne-sparkle', name: 'Sparkles', animated: true, category: 'animated', icon: 'champagne' },
  { id: 'halloween-bats', name: 'Night Bats', animated: true, category: 'animated', icon: 'pumpkin' },
  { id: 'static-glow', name: 'Soft Glow', animated: false, category: 'static', icon: 'sun' },
  { id: 'static-grain', name: 'Paper Grain', animated: false, category: 'static', icon: 'arch' },
  { id: 'none', name: 'Solid Color', animated: false, category: 'static', icon: 'still' },
];

export const COVER_PRESETS: Array<{
  id: string;
  name: string;
  category: string;
  styleGroup: CoverStyleGroup;
  icon: InviteIconName;
  imageUrl?: string;
}> = [
  // 8 Hand-drawn Digital (Flat 2D Storybook)
  {
    id: 'handdrawn-pelican-holiday',
    name: 'Pelican Holiday',
    category: 'Holiday',
    styleGroup: 'hand-drawn',
    icon: 'snowflake',
    imageUrl: '/covers/handdrawn-pelican-holiday.jpg',
  },
  {
    id: 'handdrawn-cozy-tree',
    name: 'Cozy Tree & Cat',
    category: 'Holiday',
    styleGroup: 'hand-drawn',
    icon: 'pine',
    imageUrl: '/covers/handdrawn-cozy-tree.jpg',
  },
  {
    id: 'handdrawn-snowy-cabin',
    name: 'Winter Fox Cabin',
    category: 'Holiday',
    styleGroup: 'hand-drawn',
    icon: 'snowflake',
    imageUrl: '/covers/handdrawn-snowy-cabin.jpg',
  },
  {
    id: 'handdrawn-pizza-games',
    name: 'Pizza & Games',
    category: 'Evening',
    styleGroup: 'hand-drawn',
    icon: 'confetti',
    imageUrl: '/covers/handdrawn-pizza-games.jpg',
  },
  {
    id: 'handdrawn-backyard-bbq',
    name: 'Backyard Cookout',
    category: 'Seasonal',
    styleGroup: 'hand-drawn',
    icon: 'sun',
    imageUrl: '/covers/handdrawn-backyard-bbq.jpg',
  },
  {
    id: 'handdrawn-birthday-table',
    name: 'Birthday Table',
    category: 'Celebration',
    styleGroup: 'hand-drawn',
    icon: 'cake',
    imageUrl: '/covers/handdrawn-birthday-table.jpg',
  },
  {
    id: 'handdrawn-pumpkin-cats',
    name: 'Pumpkin Steps',
    category: 'Holiday',
    styleGroup: 'hand-drawn',
    icon: 'pumpkin',
    imageUrl: '/covers/handdrawn-pumpkin-cats.jpg',
  },
  {
    id: 'handdrawn-harbor-boats',
    name: 'Paper Sailboats',
    category: 'Holiday',
    styleGroup: 'hand-drawn',
    icon: 'firework',
    imageUrl: '/covers/handdrawn-harbor-boats.jpg',
  },

  // 8 Minimal Vector (Google Image Generated Graphic Posters)
  {
    id: 'vector-paper-cutouts',
    name: 'Paper Cutouts',
    category: 'Celebration',
    styleGroup: 'vector',
    icon: 'confetti',
    imageUrl: '/covers/vector-paper-cutouts.jpg',
  },
  {
    id: 'vector-minimal-arch',
    name: 'Terracotta Arch',
    category: 'Classic',
    styleGroup: 'vector',
    icon: 'arch',
    imageUrl: '/covers/vector-minimal-arch.jpg',
  },
  {
    id: 'vector-champagne-coupes',
    name: 'Champagne Coupes',
    category: 'Evening',
    styleGroup: 'vector',
    icon: 'champagne',
    imageUrl: '/covers/vector-champagne-coupes.jpg',
  },
  {
    id: 'vector-mountain-moon',
    name: 'Cyber Peaks',
    category: 'Evening',
    styleGroup: 'vector',
    icon: 'cloud',
    imageUrl: '/covers/vector-mountain-moon.jpg',
  },
  {
    id: 'vector-citrus-sun',
    name: 'Sun & Waves',
    category: 'Seasonal',
    styleGroup: 'vector',
    icon: 'sun',
    imageUrl: '/covers/vector-citrus-sun.jpg',
  },
  {
    id: 'vector-birthday-candles',
    name: 'Minimal Cake',
    category: 'Celebration',
    styleGroup: 'vector',
    icon: 'cake',
    imageUrl: '/covers/vector-birthday-candles.jpg',
  },
  {
    id: 'vector-starburst-night',
    name: 'Chrome Starburst',
    category: 'Holiday',
    styleGroup: 'vector',
    icon: 'firework',
    imageUrl: '/covers/vector-starburst-night.jpg',
  },
  {
    id: 'vector-sacred-arch',
    name: 'Golden Chapel',
    category: 'Holiday',
    styleGroup: 'vector',
    icon: 'star',
    imageUrl: '/covers/vector-sacred-arch.jpg',
  },

  // 8 Pencil & Colored Pencil Sketches
  {
    id: 'pencil-dinner-table',
    name: 'Supper Sketch',
    category: 'Evening',
    styleGroup: 'pencil',
    icon: 'candle',
    imageUrl: '/covers/pencil-dinner-table.jpg',
  },
  {
    id: 'pencil-wildflower-meadow',
    name: 'Wildflower Study',
    category: 'Seasonal',
    styleGroup: 'pencil',
    icon: 'tulip',
    imageUrl: '/covers/pencil-wildflower-meadow.jpg',
  },
  {
    id: 'pencil-christmas-holly',
    name: 'Pine & Holly',
    category: 'Holiday',
    styleGroup: 'pencil',
    icon: 'pine',
    imageUrl: '/covers/pencil-christmas-holly.jpg',
  },
  {
    id: 'pencil-sacred-star',
    name: 'Starlight Hills',
    category: 'Holiday',
    styleGroup: 'pencil',
    icon: 'star',
    imageUrl: '/covers/pencil-sacred-star.jpg',
  },
  {
    id: 'pencil-cafe-croissant',
    name: 'Morning Cafe',
    category: 'Celebration',
    styleGroup: 'pencil',
    icon: 'candle',
    imageUrl: '/covers/pencil-cafe-croissant.jpg',
  },
  {
    id: 'pencil-autumn-acorns',
    name: 'Harvest Botanical',
    category: 'Holiday',
    styleGroup: 'pencil',
    icon: 'leaf',
    imageUrl: '/covers/pencil-autumn-acorns.jpg',
  },
  {
    id: 'pencil-baby-bunny',
    name: 'Sleeping Bunny',
    category: 'Celebration',
    styleGroup: 'pencil',
    icon: 'cloud',
    imageUrl: '/covers/pencil-baby-bunny.jpg',
  },
  {
    id: 'pencil-wedding-bouquet',
    name: 'Rose Bouquet',
    category: 'Classic',
    styleGroup: 'pencil',
    icon: 'rings',
    imageUrl: '/covers/pencil-wedding-bouquet.jpg',
  },

  // 8 Oil Paint & Watercolor
  {
    id: 'oil-starry-aurora',
    name: 'Swirling Aurora',
    category: 'Evening',
    styleGroup: 'oil-paint',
    icon: 'aurora',
    imageUrl: '/covers/oil-starry-aurora.jpg',
  },
  {
    id: 'oil-citrus-grove',
    name: 'Lemon Terrace',
    category: 'Seasonal',
    styleGroup: 'oil-paint',
    icon: 'sun',
    imageUrl: '/covers/oil-citrus-grove.jpg',
  },
  {
    id: 'oil-candlelight-wine',
    name: 'Candle & Wine',
    category: 'Evening',
    styleGroup: 'oil-paint',
    icon: 'candle',
    imageUrl: '/covers/oil-candlelight-wine.jpg',
  },
  {
    id: 'oil-sunflower-field',
    name: 'Sunflowers',
    category: 'Seasonal',
    styleGroup: 'oil-paint',
    icon: 'sun',
    imageUrl: '/covers/oil-sunflower-field.jpg',
  },
  {
    id: 'oil-coastal-sunset',
    name: 'Coastal Dusk',
    category: 'Evening',
    styleGroup: 'oil-paint',
    icon: 'wave',
    imageUrl: '/covers/oil-coastal-sunset.jpg',
  },
  {
    id: 'easter-botanical',
    name: 'Garden Watercolor',
    category: 'Seasonal',
    styleGroup: 'oil-paint',
    icon: 'tulip',
    imageUrl: '/covers/garden-brunch.jpg',
  },
  {
    id: 'bridal-pearls',
    name: 'White Peonies',
    category: 'Celebration',
    styleGroup: 'oil-paint',
    icon: 'rings',
    imageUrl: '/covers/painted-white-peonies.jpg',
  },
  {
    id: 'baby-cloud',
    name: 'Pastel Meadow',
    category: 'Celebration',
    styleGroup: 'oil-paint',
    icon: 'cloud',
    imageUrl: '/covers/painted-pastel-meadow.jpg',
  },

  // 8 Seamless Patterns
  {
    id: 'pattern-citrus-grove',
    name: 'Citrus Tile',
    category: 'Seasonal',
    styleGroup: 'pattern',
    icon: 'pattern',
  },
  {
    id: 'pattern-winter-fairisle',
    name: 'Fair Isle Knit',
    category: 'Holiday',
    styleGroup: 'pattern',
    icon: 'pine',
  },
  {
    id: 'pattern-botanical-toile',
    name: 'Block-Print Floral',
    category: 'Seasonal',
    styleGroup: 'pattern',
    icon: 'tulip',
  },
  {
    id: 'pattern-gingham-picnic',
    name: 'Picnic Gingham',
    category: 'Seasonal',
    styleGroup: 'pattern',
    icon: 'sun',
  },
  {
    id: 'pattern-terrazzo-confetti',
    name: 'Terrazzo Chips',
    category: 'Celebration',
    styleGroup: 'pattern',
    icon: 'confetti',
  },
  {
    id: 'pattern-celestial-stars',
    name: 'Celestial Wallpaper',
    category: 'Evening',
    styleGroup: 'pattern',
    icon: 'star',
  },
  {
    id: 'pattern-retro-checker',
    name: 'Pastel Checker',
    category: 'Celebration',
    styleGroup: 'pattern',
    icon: 'pattern',
  },
  {
    id: 'pattern-autumn-plaid',
    name: 'Warm Plaid',
    category: 'Holiday',
    styleGroup: 'pattern',
    icon: 'leaf',
  },
];

export function getCoverPreset(id: string) {
  return COVER_PRESETS.find((preset) => preset.id === id);
}

export function getThemePreset(id: string): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0];
}

export function resolveThemeCssVars(style: InviteStyleConfig): Record<string, string> {
  const preset = getThemePreset(style.themeId);
  const customSurface = normalizeHex(style.customSurfaceHex);

  let colorMode: 'dark' | 'light' = style.colorMode ?? preset.colorMode;
  let pageBg = preset.pageBg;
  let surfaceBg = preset.surfaceBg;
  let cardBg = preset.cardBg;
  let textPrimary = preset.textPrimary;
  let textMuted = preset.textMuted;
  let border = preset.border;

  if (customSurface) {
    const isDarkSurface = relativeLuminance(customSurface) < 0.25;
    colorMode = isDarkSurface ? 'dark' : 'light';
    surfaceBg = customSurface;
    pageBg = isDarkSurface
      ? mixHex(customSurface, '#04060b', 0.35)
      : mixHex(customSurface, '#e8e8ec', 0.3);
    cardBg = isDarkSurface
      ? mixHex(customSurface, '#ffffff', 0.05)
      : '#ffffff';
    textPrimary = isDarkSurface ? '#f8fafc' : '#0b0f19';
    textMuted = isDarkSurface
      ? mixHex(cardBg, '#f8fafc', 0.7)
      : mixHex(cardBg, '#0b0f19', 0.68);
    border = isDarkSurface
      ? mixHex(cardBg, '#ffffff', 0.16)
      : mixHex(cardBg, '#0b0f19', 0.14);
  } else if (style.colorMode && style.colorMode !== preset.colorMode) {
    if (style.colorMode === 'light') {
      surfaceBg = '#f8fafc';
      cardBg = '#ffffff';
      textPrimary = '#111827';
      textMuted = '#4b5563';
      border = '#e4e4e7';
      if (relativeLuminance(pageBg) >= 0.35) {
        pageBg = '#f1f5f9';
      }
    } else {
      pageBg = '#090b12';
      surfaceBg = '#101421';
      cardBg = '#161b2c';
      textPrimary = '#f8fafc';
      textMuted = '#a7b3cc';
      border = '#29334d';
    }
  }

  const rawAccent = isValidHex(style.customAccentHex)
    ? (normalizeHex(style.customAccentHex) as string)
    : preset.accent;
  const accent = ensureReadableAccentOnSurface(rawAccent, cardBg, 3);
  const onAccent = pickAccessibleForeground(accent);

  const ctaMode = style.ctaStyle ?? 'gradient';
  const rawCtaStart = isValidHex(style.customAccentHex)
    ? (normalizeHex(style.customAccentHex) as string)
    : preset.ctaStart;
  const rawCtaEnd = isValidHex(style.customCtaEndHex)
    ? (normalizeHex(style.customCtaEndHex) as string)
    : isValidHex(style.customAccentHex) && !style.customCtaEndHex
      ? mixHex(rawCtaStart, '#0f172a', 0.24)
      : preset.ctaEnd;

  const ctaStart = rawCtaStart;
  const ctaEnd = ctaMode === 'solid' ? ctaStart : rawCtaEnd;
  const ctaMid = mixHex(ctaStart, ctaEnd, 0.5);
  const ctaText = pickAccessibleForeground(ctaMid);
  const ctaBg =
    ctaMode === 'solid'
      ? ctaStart
      : `linear-gradient(135deg, ${ctaStart} 0%, ${ctaEnd} 100%)`;

  // 6 harmonious theme-derived profile icon palette slots (strict WCAG >= 4.5 contrast)
  const avatarMixBase = colorMode === 'dark' ? '#e2e8f0' : '#ffffff';
  const buildAvatarPair = (rawHex: string) => {
    const fg = pickAccessibleForeground(rawHex);
    const bg = ensureReadableAccentOnSurface(rawHex, fg, 4.5);
    return { bg, fg: pickAccessibleForeground(bg) };
  };
  const av1 = buildAvatarPair(mixHex(accent, cardBg, 0.14));
  const av2 = buildAvatarPair(mixHex(ctaEnd, avatarMixBase, 0.22));
  const av3 = buildAvatarPair(mixHex(shiftHexHue(accent, 34), avatarMixBase, 0.18));
  const av4 = buildAvatarPair(mixHex(shiftHexHue(accent, -34), avatarMixBase, 0.18));
  const av5 = buildAvatarPair(mixHex(ctaStart, cardBg, 0.16));
  const av6 = buildAvatarPair(mixHex(shiftHexHue(ctaEnd, 54), avatarMixBase, 0.24));

  const font =
    FONT_PAIRINGS.find((item) => item.id === style.fontId) ?? FONT_PAIRINGS[0];
  const cardRgb = hexToRgb(cardBg);
  const glassRgb = hexToRgb(mixHex(cardBg, '#ffffff', 0.05));
  const cardStyle: CardSurfaceStyle = style.cardStyle ?? preset.defaultCardStyle ?? 'glass';

  let cardSurfaceAlpha = colorMode === 'light' ? 0.74 : 0.62;
  let cardBlur = 'blur(24px) saturate(175%)';
  let glassBlurPx = '24px';
  let glassSatPct = '175%';
  let cardShadow =
    '0 24px 60px -15px rgba(0, 0, 0, 0.36), inset 0 1px 0 0 rgba(255, 255, 255, 0.18)';
  let cardSpecular =
    colorMode === 'light' ? 'rgba(255, 255, 255, 0.72)' : 'rgba(255, 255, 255, 0.18)';

  if (cardStyle === 'clear') {
    cardSurfaceAlpha = colorMode === 'light' ? 0.58 : 0.44;
    cardBlur = 'blur(28px) saturate(190%)';
    glassBlurPx = '28px';
    glassSatPct = '190%';
    cardShadow =
      '0 22px 54px -14px rgba(0, 0, 0, 0.32), inset 0 1px 0 0 rgba(255, 255, 255, 0.28)';
  } else if (cardStyle === 'solid') {
    cardSurfaceAlpha = colorMode === 'light' ? 0.98 : 0.95;
    cardBlur = 'none';
    glassBlurPx = '0px';
    glassSatPct = '100%';
    cardShadow = '0 20px 50px -12px rgba(0, 0, 0, 0.34)';
  } else if (cardStyle === 'y2k') {
    cardSurfaceAlpha = colorMode === 'light' ? 0.72 : 0.54;
    cardBlur = 'blur(24px) saturate(195%)';
    glassBlurPx = '24px';
    glassSatPct = '195%';
    cardSpecular = 'rgba(255, 255, 255, 0.42)';
    cardShadow = `0 22px 60px -10px ${ctaStart}44, 0 0 0 1px rgba(255, 255, 255, 0.24), inset 0 1.5px 0 0 rgba(255, 255, 255, 0.45)`;
  }

  const cardSurface = `rgba(${cardRgb.r}, ${cardRgb.g}, ${cardRgb.b}, ${cardSurfaceAlpha})`;
  const cardSolid =
    colorMode === 'light'
      ? `rgba(${cardRgb.r}, ${cardRgb.g}, ${cardRgb.b}, 0.96)`
      : `rgba(${cardRgb.r}, ${cardRgb.g}, ${cardRgb.b}, 0.93)`;
  const stickyBg =
    colorMode === 'light'
      ? `rgba(${cardRgb.r}, ${cardRgb.g}, ${cardRgb.b}, 0.84)`
      : `rgba(${cardRgb.r}, ${cardRgb.g}, ${cardRgb.b}, 0.76)`;
  const glassBg =
    colorMode === 'light'
      ? 'rgba(255, 255, 255, 0.84)'
      : `rgba(${glassRgb.r}, ${glassRgb.g}, ${glassRgb.b}, 0.68)`;
  const hairline =
    colorMode === 'light' ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.16)';
  const backdropMode = relativeLuminance(pageBg) < 0.35 ? 'dark' : 'light';
  const outerText = backdropMode === 'dark' ? '#f8fafc' : '#0f172a';
  const outerMuted =
    backdropMode === 'dark' ? 'rgba(241, 245, 249, 0.8)' : 'rgba(15, 23, 42, 0.72)';
  const outerPillBg =
    backdropMode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.07)';
  const outerPillBorder =
    backdropMode === 'dark' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(15, 23, 42, 0.16)';

  return {
    '--theme-page-bg': pageBg,
    '--theme-surface-bg': surfaceBg,
    '--theme-card-bg': cardBg,
    '--theme-card-surface': cardSurface,
    '--theme-card-blur': cardBlur,
    '--theme-glass-blur': glassBlurPx,
    '--theme-glass-sat': glassSatPct,
    '--theme-card-shadow': cardShadow,
    '--theme-card-specular': cardSpecular,
    '--theme-card-solid': cardSolid,
    '--theme-sticky-bg': stickyBg,
    '--theme-glass-bg': glassBg,
    '--theme-hairline': hairline,
    '--theme-backdrop-mode': backdropMode,
    '--theme-outer-text': outerText,
    '--theme-outer-muted': outerMuted,
    '--theme-outer-pill-bg': outerPillBg,
    '--theme-outer-pill-border': outerPillBorder,
    '--theme-text-primary': textPrimary,
    '--theme-text-muted': textMuted,
    '--theme-accent': accent,
    '--theme-on-accent': onAccent,
    '--theme-cta-start': ctaStart,
    '--theme-cta-end': ctaEnd,
    '--theme-cta-mid': ctaMid,
    '--theme-cta-bg': ctaBg,
    '--theme-cta-text': ctaText,
    '--theme-avatar-1-bg': av1.bg,
    '--theme-avatar-1-fg': av1.fg,
    '--theme-avatar-2-bg': av2.bg,
    '--theme-avatar-2-fg': av2.fg,
    '--theme-avatar-3-bg': av3.bg,
    '--theme-avatar-3-fg': av3.fg,
    '--theme-avatar-4-bg': av4.bg,
    '--theme-avatar-4-fg': av4.fg,
    '--theme-avatar-5-bg': av5.bg,
    '--theme-avatar-5-fg': av5.fg,
    '--theme-avatar-6-bg': av6.bg,
    '--theme-avatar-6-fg': av6.fg,
    '--theme-border': border,
    '--theme-font-heading': font.headingVar,
    '--theme-font-body': font.bodyVar,
    '--font-invite-display': font.headingVar,
    '--font-invite-body': font.bodyVar,
    '--theme-color-scheme': colorMode,
  };
}
