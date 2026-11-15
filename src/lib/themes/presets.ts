import type { AmbientEffectId, FontPairingId, InviteStyleConfig } from '@/types/invite';
import {
  ensureReadableAccentOnSurface,
  hexToRgb,
  isValidHex,
  mixHex,
  normalizeHex,
  pickAccessibleForeground,
  relativeLuminance,
} from './contrast';

export interface ThemePreset {
  id: string;
  name: string;
  category: 'ambient' | 'holiday' | 'milestone' | 'editorial';
  emoji: string;
  description: string;
  colorMode: 'dark' | 'light';
  surfaceBg: string;
  pageBg: string;
  cardBg: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  border: string;
  defaultFontId: FontPairingId;
  defaultEffectId: AmbientEffectId;
  defaultCoverPresetId: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'aurora-midnight',
    name: 'Aurora Borealis',
    category: 'ambient',
    emoji: '🌌',
    description: 'Deep nocturnal canvas with drifting emerald and cyan northern lights.',
    colorMode: 'dark',
    pageBg: '#070b14',
    surfaceBg: '#0d1322',
    cardBg: '#121a2e',
    textPrimary: '#f8fafc',
    textMuted: '#a3b3cf',
    accent: '#34d399',
    border: '#253352',
    defaultFontId: 'modern-sans',
    defaultEffectId: 'aurora',
    defaultCoverPresetId: 'aurora-ridge',
  },
  {
    id: 'winter-snowfall',
    name: 'Frosty Winter',
    category: 'holiday',
    emoji: '❄️',
    description: 'Royal winter night blue with soft snowfall bokeh and crisp icy clarity.',
    colorMode: 'dark',
    pageBg: '#082556',
    surfaceBg: '#0c316e',
    cardBg: '#113a7d',
    textPrimary: '#f8fbff',
    textMuted: '#bdd5fa',
    accent: '#7dd3fc',
    border: '#2c5ba8',
    defaultFontId: 'modern-sans',
    defaultEffectId: 'snowfall',
    defaultCoverPresetId: 'you-are-invited',
  },
  {
    id: 'cozy-christmas',
    name: 'Cozy Christmas',
    category: 'holiday',
    emoji: '🎄',
    description: 'Evergreen pine, warm candlelight gold, and glowing festive string lights.',
    colorMode: 'dark',
    pageBg: '#071610',
    surfaceBg: '#0d241b',
    cardBg: '#133024',
    textPrimary: '#faf7f0',
    textMuted: '#b7cec2',
    accent: '#fb7185',
    border: '#25503d',
    defaultFontId: 'expressive-display',
    defaultEffectId: 'christmas-lights',
    defaultCoverPresetId: 'christmas-evergreen',
  },
  {
    id: 'sacred-nativity',
    name: 'Sacred Starlight',
    category: 'holiday',
    emoji: '✨',
    description: 'Reverent midnight indigo, golden Star of Bethlehem rays, and classic serif grace.',
    colorMode: 'dark',
    pageBg: '#080c1f',
    surfaceBg: '#101635',
    cardBg: '#161e45',
    textPrimary: '#fcfaf2',
    textMuted: '#c2c7e3',
    accent: '#f5c451',
    border: '#2c376a',
    defaultFontId: 'sacred-classic',
    defaultEffectId: 'starlight-radiance',
    defaultCoverPresetId: 'sacred-star',
  },
  {
    id: 'spooky-halloween',
    name: 'Midnight Halloween',
    category: 'holiday',
    emoji: '🎃',
    description: 'Obsidian plum twilight with glowing pumpkin amber and drifting bats.',
    colorMode: 'dark',
    pageBg: '#100818',
    surfaceBg: '#190e26',
    cardBg: '#231435',
    textPrimary: '#faf5ff',
    textMuted: '#cab5e3',
    accent: '#fb923c',
    border: '#3f285e',
    defaultFontId: 'expressive-display',
    defaultEffectId: 'halloween-bats',
    defaultCoverPresetId: 'halloween-pumpkin',
  },
  {
    id: 'warm-thanksgiving',
    name: 'Autumn Harvest',
    category: 'holiday',
    emoji: '🍂',
    description: 'Rich espresso umber, burnt harvest amber, and gently tumbling autumn leaves.',
    colorMode: 'dark',
    pageBg: '#180e09',
    surfaceBg: '#24160f',
    cardBg: '#301e15',
    textPrimary: '#fdf8f3',
    textMuted: '#d8bfb0',
    accent: '#f59e0b',
    border: '#4f3527',
    defaultFontId: 'expressive-display',
    defaultEffectId: 'autumn-leaves',
    defaultCoverPresetId: 'autumn-harvest',
  },
  {
    id: 'fourth-of-july',
    name: 'Fourth of July',
    category: 'holiday',
    emoji: '🎆',
    description: 'Starlit midnight navy with celebratory crimson and gold firework bursts.',
    colorMode: 'dark',
    pageBg: '#070f23',
    surfaceBg: '#0e1936',
    cardBg: '#15244b',
    textPrimary: '#f8fafc',
    textMuted: '#b0c3e8',
    accent: '#ff6b7a',
    border: '#2b417a',
    defaultFontId: 'expressive-display',
    defaultEffectId: 'fireworks',
    defaultCoverPresetId: 'july-fireworks',
  },
  {
    id: 'new-years-eve',
    name: 'Midnight Champagne',
    category: 'holiday',
    emoji: '🥂',
    description: 'Sleek obsidian velvet illuminated by rising golden champagne effervescence.',
    colorMode: 'dark',
    pageBg: '#09090d',
    surfaceBg: '#121218',
    cardBg: '#1b1b24',
    textPrimary: '#fafafa',
    textMuted: '#babac9',
    accent: '#f4ce6a',
    border: '#323244',
    defaultFontId: 'editorial-serif',
    defaultEffectId: 'champagne-sparkle',
    defaultCoverPresetId: 'champagne-toast',
  },
  {
    id: 'valentines-rose',
    name: 'Velvet Rose',
    category: 'holiday',
    emoji: '🌹',
    description: 'Romantic burgundy wine with warm rose accents and drifting hearts.',
    colorMode: 'dark',
    pageBg: '#1a0a11',
    surfaceBg: '#28101b',
    cardBg: '#361625',
    textPrimary: '#fff5f7',
    textMuted: '#e0bac7',
    accent: '#fb7185',
    border: '#59283e',
    defaultFontId: 'editorial-serif',
    defaultEffectId: 'floating-hearts',
    defaultCoverPresetId: 'velvet-roses',
  },
  {
    id: 'st-patricks-emerald',
    name: 'Emerald Clover',
    category: 'holiday',
    emoji: '☘️',
    description: 'Deep Irish shamrock greens paired with warm brushed brass radiance.',
    colorMode: 'dark',
    pageBg: '#06170f',
    surfaceBg: '#0b2519',
    cardBg: '#113424',
    textPrimary: '#f2fbf6',
    textMuted: '#aad3be',
    accent: '#4ade80',
    border: '#23553e',
    defaultFontId: 'expressive-display',
    defaultEffectId: 'warm-bokeh',
    defaultCoverPresetId: 'clover-emerald',
  },
  {
    id: 'spring-easter-garden',
    name: 'Spring & Easter Garden',
    category: 'holiday',
    emoji: '🌷',
    description: 'Airy botanical ivory and sage garden palette with drifting spring petals.',
    colorMode: 'light',
    pageBg: '#f3f7f2',
    surfaceBg: '#ffffff',
    cardBg: '#ffffff',
    textPrimary: '#122116',
    textMuted: '#425948',
    accent: '#2c6b4a',
    border: '#cfe0d2',
    defaultFontId: 'sacred-classic',
    defaultEffectId: 'botanical-petals',
    defaultCoverPresetId: 'easter-botanical',
  },
  {
    id: 'summer-cookout',
    name: 'Summer Cookout',
    category: 'holiday',
    emoji: '☀️',
    description: 'Sun-drenched warm cream editorial palette for backyard BBQs and long weekends.',
    colorMode: 'light',
    pageBg: '#fff8ec',
    surfaceBg: '#ffffff',
    cardBg: '#ffffff',
    textPrimary: '#152033',
    textMuted: '#48566e',
    accent: '#c8372d',
    border: '#e6dbc5',
    defaultFontId: 'playful-rounded',
    defaultEffectId: 'confetti',
    defaultCoverPresetId: 'summer-citrus',
  },
  {
    id: 'baby-shower-cloud',
    name: 'Lullaby Cloud',
    category: 'milestone',
    emoji: '☁️',
    description: 'Soft buttercream linen, serene sky tones, and gentle twinkling lullaby stars.',
    colorMode: 'light',
    pageBg: '#f9f6f0',
    surfaceBg: '#ffffff',
    cardBg: '#ffffff',
    textPrimary: '#192334',
    textMuted: '#495870',
    accent: '#346888',
    border: '#e2dcd0',
    defaultFontId: 'playful-rounded',
    defaultEffectId: 'lullaby-stars',
    defaultCoverPresetId: 'baby-cloud',
  },
  {
    id: 'bridal-atelier',
    name: 'Bridal Atelier',
    category: 'milestone',
    emoji: '🕊️',
    description: 'Warm alabaster parchment, champagne bronze, and timeless editorial serif.',
    colorMode: 'light',
    pageBg: '#f8f4ee',
    surfaceBg: '#ffffff',
    cardBg: '#ffffff',
    textPrimary: '#1c1917',
    textMuted: '#564f4a',
    accent: '#855736',
    border: '#e2dad0',
    defaultFontId: 'editorial-serif',
    defaultEffectId: 'botanical-petals',
    defaultCoverPresetId: 'bridal-pearls',
  },
  {
    id: 'birthday-confetti',
    name: 'Birthday Confetti',
    category: 'milestone',
    emoji: '🎂',
    description: 'Vibrant twilight violet with festive coral highlights and tumbling confetti.',
    colorMode: 'dark',
    pageBg: '#110a22',
    surfaceBg: '#1a1034',
    cardBg: '#231645',
    textPrimary: '#faf8ff',
    textMuted: '#c6b7eb',
    accent: '#ff7096',
    border: '#3e2b73',
    defaultFontId: 'playful-rounded',
    defaultEffectId: 'confetti',
    defaultCoverPresetId: 'birthday-cake',
  },
  {
    id: 'candlelit-dinner',
    name: 'Candlelit Dinner',
    category: 'editorial',
    emoji: '🕯️',
    description: 'Intimate espresso charcoal with warm terracotta glow and flickering bokeh.',
    colorMode: 'dark',
    pageBg: '#13100e',
    surfaceBg: '#1d1815',
    cardBg: '#27201c',
    textPrimary: '#faf6f2',
    textMuted: '#cbbcb2',
    accent: '#ed9464',
    border: '#453a32',
    defaultFontId: 'editorial-serif',
    defaultEffectId: 'warm-bokeh',
    defaultCoverPresetId: 'candlelit-table',
  },
  {
    id: 'minimal-paper',
    name: 'Minimal Paper',
    category: 'editorial',
    emoji: '🏛️',
    description: 'Crisp gallery off-white editorial card with refined hairline borders.',
    colorMode: 'light',
    pageBg: '#f4f4f5',
    surfaceBg: '#ffffff',
    cardBg: '#ffffff',
    textPrimary: '#111827',
    textMuted: '#4b5563',
    accent: '#18181b',
    border: '#e4e4e7',
    defaultFontId: 'modern-sans',
    defaultEffectId: 'none',
    defaultCoverPresetId: 'gallery-monolith',
  },
  {
    id: 'electric-quantum',
    name: 'Quantum Prism',
    category: 'ambient',
    emoji: '🔮',
    description: 'Vivid deep indigo and electric magenta-violet prism gradients.',
    colorMode: 'dark',
    pageBg: '#09081a',
    surfaceBg: '#110f2f',
    cardBg: '#181542',
    textPrimary: '#f8f7ff',
    textMuted: '#b7b4e8',
    accent: '#c084fc',
    border: '#332d75',
    defaultFontId: 'studio-mono',
    defaultEffectId: 'aurora',
    defaultCoverPresetId: 'quantum-prism',
  },
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
    name: 'Editorial Serif',
    sample: 'An intimate evening around the table',
    headingVar: 'var(--font-editorial-serif), Georgia, serif',
    bodyVar: 'var(--font-ui-body), system-ui, -apple-system, sans-serif',
  },
  {
    id: 'modern-sans',
    name: 'Modern Sans',
    sample: 'Rooftop drinks & late-night vinyl',
    headingVar: 'var(--font-modern-sans), system-ui, -apple-system, sans-serif',
    bodyVar: 'var(--font-modern-sans), var(--font-ui-body), system-ui, sans-serif',
  },
  {
    id: 'expressive-display',
    name: 'Expressive Display',
    sample: 'Holiday Feast & Hot Cider',
    headingVar: 'var(--font-expressive-display), Georgia, serif',
    bodyVar: 'var(--font-ui-body), system-ui, -apple-system, sans-serif',
  },
  {
    id: 'sacred-classic',
    name: 'Sacred Classic',
    sample: 'Candlelight Service & Carols',
    headingVar: 'var(--font-sacred-classic), Georgia, serif',
    bodyVar: 'var(--font-ui-body), system-ui, -apple-system, sans-serif',
  },
  {
    id: 'playful-rounded',
    name: 'Playful Rounded',
    sample: 'Emma’s Baby Shower & Brunch!',
    headingVar: 'var(--font-playful-rounded), system-ui, -apple-system, sans-serif',
    bodyVar: 'var(--font-playful-rounded), var(--font-ui-body), system-ui, sans-serif',
  },
  {
    id: 'studio-mono',
    name: 'Studio Mono',
    sample: 'LISTENING SESSION // 21:00',
    headingVar: 'var(--font-studio-mono), ui-monospace, SFMono-Regular, monospace',
    bodyVar: 'var(--font-ui-body), system-ui, -apple-system, sans-serif',
  },
];

export const EFFECT_OPTIONS: Array<{
  id: AmbientEffectId;
  name: string;
  emoji: string;
  description: string;
}> = [
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    emoji: '🌌',
    description: 'Slow undulating northern lights ribbons and twilight glow.',
  },
  {
    id: 'snowfall',
    name: 'Winter Snowfall',
    emoji: '❄️',
    description: 'Soft layered snowflakes drifting gently across the sky.',
  },
  {
    id: 'christmas-lights',
    name: 'Festive String Lights',
    emoji: '🎄',
    description: 'Warm glowing holiday string bulbs twinkling along the top edge.',
  },
  {
    id: 'starlight-radiance',
    name: 'Starlight Radiance',
    emoji: '✨',
    description: 'Radiant golden Star of Bethlehem beams and warm candlelight embers.',
  },
  {
    id: 'halloween-bats',
    name: 'Twilight Bats & Mist',
    emoji: '🦇',
    description: 'Silhouetted bats gliding past a luminous harvest moon mist.',
  },
  {
    id: 'autumn-leaves',
    name: 'Autumn Leaves',
    emoji: '🍂',
    description: 'Warm amber and crimson maple leaves tumbling in an autumn breeze.',
  },
  {
    id: 'fireworks',
    name: 'Celebration Fireworks',
    emoji: '🎆',
    description: 'Luminous firework bursts blooming softly across the night sky.',
  },
  {
    id: 'confetti',
    name: 'Party Confetti',
    emoji: '🎉',
    description: 'Playful celebratory confetti ribbons drifting through the air.',
  },
  {
    id: 'botanical-petals',
    name: 'Botanical Petals',
    emoji: '🌸',
    description: 'Delicate blush and ivory blossoms floating softly downward.',
  },
  {
    id: 'lullaby-stars',
    name: 'Lullaby Stars',
    emoji: '🌟',
    description: 'Gentle twinkling starlight and soft nursery dust motes.',
  },
  {
    id: 'floating-hearts',
    name: 'Floating Hearts',
    emoji: '💖',
    description: 'Translucent rose-tinted hearts drifting smoothly upward.',
  },
  {
    id: 'champagne-sparkle',
    name: 'Champagne Sparkle',
    emoji: '🥂',
    description: 'Effervescent golden bubbles and fine midnight starburst glints.',
  },
  {
    id: 'warm-bokeh',
    name: 'Candlelight Bokeh',
    emoji: '🕯️',
    description: 'Soft-focus amber and terracotta orbs pulsing like candlelight.',
  },
  {
    id: 'none',
    name: 'Calm Minimal',
    emoji: '◻️',
    description: 'Clean static atmosphere without moving particles.',
  },
];

export const COVER_PRESETS: Array<{
  id: string;
  name: string;
  category: string;
  emoji: string;
}> = [
  { id: 'you-are-invited', name: 'You Are Invited', category: 'Editorial', emoji: '💌' },
  { id: 'aurora-ridge', name: 'Northern Lights Ridge', category: 'Ambient', emoji: '🌌' },
  { id: 'snowy-pines', name: 'Snowy Pine Cabin', category: 'Holiday', emoji: '❄️' },
  { id: 'christmas-evergreen', name: 'Christmas Tree & Ornaments', category: 'Holiday', emoji: '🎄' },
  { id: 'sacred-star', name: 'Star of Bethlehem Arches', category: 'Sacred', emoji: '✨' },
  { id: 'halloween-pumpkin', name: 'Midnight Jack-o’-Lantern', category: 'Holiday', emoji: '🎃' },
  { id: 'autumn-harvest', name: 'Autumn Harvest Table', category: 'Holiday', emoji: '🍂' },
  { id: 'july-fireworks', name: 'Fourth of July Starburst', category: 'Holiday', emoji: '🎆' },
  { id: 'champagne-toast', name: 'Midnight Champagne Coupe', category: 'Holiday', emoji: '🥂' },
  { id: 'velvet-roses', name: 'Velvet Roses & Seal', category: 'Holiday', emoji: '🌹' },
  { id: 'clover-emerald', name: 'Emerald Clover Crest', category: 'Holiday', emoji: '☘️' },
  { id: 'easter-botanical', name: 'Spring Botanical Arch', category: 'Seasonal', emoji: '🌷' },
  { id: 'summer-citrus', name: 'Golden Summer Cookout', category: 'Seasonal', emoji: '☀️' },
  { id: 'baby-cloud', name: 'Lullaby Cloud & Moon', category: 'Milestone', emoji: '☁️' },
  { id: 'bridal-pearls', name: 'Pearl Botanical Wreath', category: 'Milestone', emoji: '🕊️' },
  { id: 'birthday-cake', name: 'Birthday Candles & Cake', category: 'Milestone', emoji: '🎂' },
  { id: 'candlelit-table', name: 'Candlelit Dinner Tapers', category: 'Editorial', emoji: '🕯️' },
  { id: 'gallery-monolith', name: 'Minimal Gallery Arch', category: 'Editorial', emoji: '🏛️' },
  { id: 'quantum-prism', name: 'Quantum Prism Waves', category: 'Ambient', emoji: '🔮' },
];

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
      : mixHex(customSurface, '#ffffff', 0.65);
    textPrimary = isDarkSurface ? '#f8fafc' : '#0b0f19';
    textMuted = isDarkSurface
      ? mixHex(cardBg, '#f8fafc', 0.7)
      : mixHex(cardBg, '#0b0f19', 0.68);
    border = isDarkSurface
      ? mixHex(cardBg, '#ffffff', 0.16)
      : mixHex(cardBg, '#0b0f19', 0.14);
  } else if (style.colorMode && style.colorMode !== preset.colorMode) {
    if (style.colorMode === 'light') {
      pageBg = '#f5f5f7';
      surfaceBg = '#ffffff';
      cardBg = '#ffffff';
      textPrimary = '#111827';
      textMuted = '#4b5563';
      border = '#e4e4e7';
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

  const font =
    FONT_PAIRINGS.find((item) => item.id === style.fontId) ?? FONT_PAIRINGS[0];
  const glassRgb = hexToRgb(mixHex(cardBg, '#ffffff', 0.05));
  const glassBg =
    colorMode === 'light'
      ? 'rgba(255, 255, 255, 0.86)'
      : `rgba(${glassRgb.r}, ${glassRgb.g}, ${glassRgb.b}, 0.72)`;
  const hairline =
    colorMode === 'light' ? 'rgba(15, 23, 42, 0.11)' : 'rgba(255, 255, 255, 0.14)';

  return {
    '--theme-page-bg': pageBg,
    '--theme-surface-bg': surfaceBg,
    '--theme-card-bg': cardBg,
    '--theme-glass-bg': glassBg,
    '--theme-hairline': hairline,
    '--theme-text-primary': textPrimary,
    '--theme-text-muted': textMuted,
    '--theme-accent': accent,
    '--theme-on-accent': onAccent,
    '--theme-border': border,
    '--theme-font-heading': font.headingVar,
    '--theme-font-body': font.bodyVar,
    '--theme-color-scheme': colorMode,
  };
}
