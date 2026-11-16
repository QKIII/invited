'use client';

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Calendar, MapPin, Pause, Play } from 'lucide-react';
import { CoverArt } from '@/components/covers/CoverArt';
import { AmbientBackdrop } from '@/components/effects/AmbientBackdrop';
import { InviteIcon } from '@/components/icons/InviteIcons';
import { GuestAvatar } from '@/components/invite/GuestAvatar';
import { RecentEventsDialog } from '@/components/studio/RecentEventsDialog';
import { getBrowserTimeZone } from '@/components/studio/dateTimeUtils';
import { saveStudioDraft } from '@/lib/client/recentEvents';
import { useThemeViewportSync } from '@/lib/client/useThemeViewportSync';
import {
  EXAMPLE_EVENT_PROMPTS,
  parseEventPrompt,
  type ParsedEventDraft,
} from '@/lib/nlp/parseEventPrompt';
import {
  EFFECT_OPTIONS,
  FONT_PAIRINGS,
  THEME_PRESETS,
  getThemePreset,
  resolveThemeCssVars,
} from '@/lib/themes/presets';
import type {
  AmbientEffectId,
  FontPairingId,
  InviteStyleConfig,
} from '@/types/invite';

export type HomeStage = 'hero' | 'prompt';

interface HomeLandingClientProps {
  initialStage?: HomeStage;
}

const CREATE_DRAFT_KEY = 'invited_create_draft_v1';

const HERO_LINES = ['Invites', 'people want to open.'] as const;
const HERO_HEADLINE = HERO_LINES.join(' ');
const HERO_SUBTITLE =
  'Describe your gathering, make the style yours, and share one link for instant RSVPs.';

interface HeroCharToken {
  char: string;
  globalIndex: number;
}

interface HeroWordToken {
  word: string;
  chars: HeroCharToken[];
}

interface HeroLineToken {
  lineText: string;
  words: HeroWordToken[];
}

const { HERO_LINE_TOKENS, HERO_CHAR_COUNT } = (() => {
  let cursor = 0;
  const lines: HeroLineToken[] = HERO_LINES.map((lineText) => ({
    lineText,
    words: lineText.split(' ').map((word) => ({
      word,
      chars: Array.from(word).map((char) => ({
        char,
        globalIndex: cursor++,
      })),
    })),
  }));
  return { HERO_LINE_TOKENS: lines, HERO_CHAR_COUNT: cursor };
})();

const { SUBTITLE_WORDS, SUBTITLE_CHAR_COUNT } = (() => {
  let cursor = 0;
  const words: HeroWordToken[] = HERO_SUBTITLE.split(' ').map((word) => ({
    word,
    chars: Array.from(word).map((char) => ({
      char,
      globalIndex: cursor++,
    })),
  }));
  return { SUBTITLE_WORDS: words, SUBTITLE_CHAR_COUNT: cursor };
})();

/**
 * Raised-cosine ease-in-out timing curve for the character wave:
 * starts deliberately slow (~72ms), speeds up through the middle (~16ms),
 * and decelerates smoothly at the end (~72ms).
 */
export function getHeroStepDelayMs(stepIndex: number, totalSteps: number): number {
  const progress = totalSteps <= 1 ? 0.5 : stepIndex / (totalSteps - 1);
  const easeWeight = 0.5 * (1 + Math.cos(2 * Math.PI * progress));
  return Math.round(16 + 56 * easeWeight);
}

/**
 * Faster ease-in-out sweep for the longer subtitle so it morphs one character at a time
 * noticeably more quickly than the headline (~5ms..21ms per character).
 */
export function getSubtitleStepDelayMs(stepIndex: number, totalSteps: number): number {
  const progress = totalSteps <= 1 ? 0.5 : stepIndex / (totalSteps - 1);
  const easeWeight = 0.5 * (1 + Math.cos(2 * Math.PI * progress));
  return Math.round(5 + 16 * easeWeight);
}

const BODY_FONT_VARS: Record<FontPairingId, string> = FONT_PAIRINGS.reduce(
  (acc, item) => {
    acc[item.id] = item.bodyVar;
    return acc;
  },
  {} as Record<FontPairingId, string>,
);

const FONT_OPTICAL_TUNING: Record<
  FontPairingId,
  { fontVar: string; fallbackSizeEm: string; tracking: string }
> = {
  'editorial-serif': {
    fontVar: 'var(--font-editorial-serif), Georgia, serif',
    fallbackSizeEm: '1.08em',
    tracking: '-0.015em',
  },
  'modern-sans': {
    fontVar: 'var(--font-modern-sans), system-ui, -apple-system, sans-serif',
    fallbackSizeEm: '0.96em',
    tracking: '-0.025em',
  },
  'expressive-display': {
    fontVar: 'var(--font-expressive-display), Georgia, serif',
    fallbackSizeEm: '0.97em',
    tracking: '-0.02em',
  },
  'sacred-classic': {
    fontVar: 'var(--font-sacred-classic), Georgia, serif',
    fallbackSizeEm: '1.1em',
    tracking: '-0.01em',
  },
  'playful-rounded': {
    fontVar: 'var(--font-playful-rounded), system-ui, -apple-system, sans-serif',
    fallbackSizeEm: '0.95em',
    tracking: '-0.015em',
  },
  'studio-mono': {
    fontVar: 'var(--font-studio-mono), ui-monospace, SFMono-Regular, monospace',
    fallbackSizeEm: '0.82em',
    tracking: '-0.04em',
  },
  'y2k-display': {
    fontVar: 'var(--font-y2k-display), var(--font-modern-sans), sans-serif',
    fallbackSizeEm: '0.85em',
    tracking: '-0.03em',
  },
};

const CURATED_SHOWCASE_SPECS: Array<{
  themeId: string;
  effectId: AmbientEffectId;
  fontId: FontPairingId;
}> = [
  { themeId: 'aurora-midnight', effectId: 'aurora', fontId: 'editorial-serif' },
  { themeId: 'y2k-chrome', effectId: 'liquid-chrome', fontId: 'y2k-display' },
  { themeId: 'candlelit-dinner', effectId: 'warm-bokeh', fontId: 'expressive-display' },
  { themeId: 'winter-snowfall', effectId: 'snowfall', fontId: 'modern-sans' },
  { themeId: 'sunset-disco', effectId: 'disco-prism', fontId: 'sacred-classic' },
  { themeId: 'cozy-christmas', effectId: 'christmas-lights', fontId: 'playful-rounded' },
  { themeId: 'neon-arcade', effectId: 'cyber-grid', fontId: 'studio-mono' },
  { themeId: 'electric-quantum', effectId: 'prism-gradient', fontId: 'y2k-display' },
  { themeId: 'new-years-eve', effectId: 'champagne-sparkle', fontId: 'editorial-serif' },
  { themeId: 'valentines-rose', effectId: 'floating-hearts', fontId: 'sacred-classic' },
  { themeId: 'birthday-confetti', effectId: 'confetti', fontId: 'playful-rounded' },
  { themeId: 'fourth-of-july', effectId: 'fireworks', fontId: 'expressive-display' },
  { themeId: 'sacred-nativity', effectId: 'starlight-radiance', fontId: 'sacred-classic' },
  { themeId: 'spooky-halloween', effectId: 'halloween-bats', fontId: 'y2k-display' },
  { themeId: 'warm-thanksgiving', effectId: 'autumn-leaves', fontId: 'expressive-display' },
  { themeId: 'st-patricks-emerald', effectId: 'fireflies', fontId: 'editorial-serif' },
  { themeId: 'spring-easter-garden', effectId: 'botanical-petals', fontId: 'sacred-classic' },
  { themeId: 'summer-cookout', effectId: 'water-caustics', fontId: 'playful-rounded' },
  { themeId: 'baby-shower-cloud', effectId: 'lullaby-stars', fontId: 'modern-sans' },
  { themeId: 'bridal-atelier', effectId: 'stained-glass', fontId: 'editorial-serif' },
  { themeId: 'risograph-zine', effectId: 'paper-lanterns', fontId: 'studio-mono' },
  { themeId: 'minimal-paper', effectId: 'twilight-clouds', fontId: 'modern-sans' },
  { themeId: 'electric-quantum', effectId: 'lava-lamp', fontId: 'playful-rounded' },
  { themeId: 'minimal-paper', effectId: 'rain-glass', fontId: 'editorial-serif' },
  { themeId: 'aurora-midnight', effectId: 'shooting-stars', fontId: 'studio-mono' },
];

export const HERO_SHOWCASE_CYCLE: InviteStyleConfig[] = (() => {
  const seenThemes = new Set<string>();
  const seenEffects = new Set<AmbientEffectId>();
  const seenFonts = new Set<FontPairingId>();

  const result: InviteStyleConfig[] = CURATED_SHOWCASE_SPECS.map((spec) => {
    const preset = getThemePreset(spec.themeId);
    seenThemes.add(preset.id);
    seenEffects.add(spec.effectId);
    seenFonts.add(spec.fontId);
    return {
      themeId: preset.id,
      fontId: spec.fontId,
      effectId: spec.effectId,
      coverPresetId: preset.defaultCoverPresetId,
      coverLayout: 'banner',
      cardStyle: 'glass',
      colorMode: preset.colorMode,
    };
  });

  // Guarantee forward compatibility if new presets, effects, or fonts are added later
  const remainingAnimated = EFFECT_OPTIONS.filter(
    (opt) => opt.animated && !seenEffects.has(opt.id),
  );
  const remainingThemes = THEME_PRESETS.filter((t) => !seenThemes.has(t.id));
  const remainingFonts = FONT_PAIRINGS.filter((f) => !seenFonts.has(f.id));
  const extraCount = Math.max(
    remainingAnimated.length,
    remainingThemes.length,
    remainingFonts.length,
  );

  for (let i = 0; i < extraCount; i += 1) {
    const theme = remainingThemes[i] ?? THEME_PRESETS[i % THEME_PRESETS.length];
    const effect =
      remainingAnimated[i]?.id ??
      EFFECT_OPTIONS.filter((e) => e.animated)[i % 25]?.id ??
      'aurora';
    const font =
      remainingFonts[i]?.id ?? FONT_PAIRINGS[i % FONT_PAIRINGS.length].id;
    result.push({
      themeId: theme.id,
      fontId: font,
      effectId: effect,
      coverPresetId: theme.defaultCoverPresetId,
      coverLayout: 'banner',
      cardStyle: theme.defaultCardStyle ?? 'glass',
      colorMode: theme.colorMode,
    });
  }

  return result;
})();

const PROMPT_CYCLE_TEXTS: string[] = [
  'Patio taco night this Friday at 7pm at 42 Maple St hosted by Ivan',
  EXAMPLE_EVENT_PROMPTS[0].prompt,
  'Y2K rooftop disco afterparty Saturday at 9pm',
  'Candlelit dinner party Friday at 7:30pm at Nora’s Loft',
  'Sunday pancake brunch at 11am at Sunny Kitchen hosted by Clara',
  'Lakeside campfire & s’mores Saturday at 8pm',
];

const CYCLING_PROMPT_EXAMPLES: Array<{ prompt: string; style: InviteStyleConfig }> =
  PROMPT_CYCLE_TEXTS.map((prompt) => {
    const parsed = parseEventPrompt(prompt, new Date('2026-11-16T12:00:00Z'), 'UTC');
    return {
      prompt,
      style: {
        ...parsed.style,
        cardStyle: 'glass',
      },
    };
  });

function formatLiveWhen(draft: ParsedEventDraft): string {
  const showDate = Boolean(draft.hasExplicitDate);
  const showTime = Boolean(draft.hasExplicitTime);
  if (!showDate && !showTime) return '';

  try {
    const start = new Date(draft.startIso);
    const datePart = showDate
      ? new Intl.DateTimeFormat('en-US', {
          timeZone: draft.timeZone,
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }).format(start)
      : '';
    const timePart = showTime
      ? new Intl.DateTimeFormat('en-US', {
          timeZone: draft.timeZone,
          hour: 'numeric',
          minute: '2-digit',
        }).format(start)
      : '';
    const endPart =
      showTime && draft.endIso
        ? new Intl.DateTimeFormat('en-US', {
            timeZone: draft.timeZone,
            hour: 'numeric',
            minute: '2-digit',
          }).format(new Date(draft.endIso))
        : '';

    if (showDate && !showTime) return datePart;
    if (!showDate && showTime) return endPart ? `${timePart} – ${endPart}` : timePart;
    return endPart
      ? `${datePart}, ${timePart} – ${endPart}`
      : `${datePart} at ${timePart}`;
  } catch {
    return '';
  }
}

interface ShowcaseState {
  index: number;
  prevFontId: FontPairingId;
  activeFontId: FontPairingId;
  waveGeneration: number;
}

export function HomeLandingClient({ initialStage = 'hero' }: HomeLandingClientProps) {
  const router = useRouter();
  const [stage, setStage] = useState<HomeStage>(initialStage);
  const [promptText, setPromptText] = useState('');
  const deferredPromptText = useDeferredValue(promptText);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);

  const [showcasePaused, setShowcasePaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [promptExampleIndex, setPromptExampleIndex] = useState(0);
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);
  const [showcase, setShowcase] = useState<ShowcaseState>({
    index: 0,
    prevFontId: HERO_SHOWCASE_CYCLE[0].fontId,
    activeFontId: HERO_SHOWCASE_CYCLE[0].fontId,
    waveGeneration: 0,
  });
  const [morphedCharCount, setMorphedCharCount] = useState<number>(HERO_CHAR_COUNT);
  const [subtitleMorphedCount, setSubtitleMorphedCount] = useState<number>(
    SUBTITLE_CHAR_COUNT,
  );

  const heroHeadingRef = useRef<HTMLHeadingElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const lastCompositionEndAtRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CREATE_DRAFT_KEY);
      if (raw && raw.trim().length > 2) {
        queueMicrotask(() => setHasSavedDraft(true));
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setPrefersReducedMotion(mq.matches);
    queueMicrotask(syncPreference);
    mq.addEventListener?.('change', syncPreference);
    return () => {
      mq.removeEventListener?.('change', syncPreference);
    };
  }, []);

  // Keep prompt card centered inside the visible above-keyboard viewport on iOS & Android
  useEffect(() => {
    if (stage !== 'prompt' || typeof window === 'undefined' || !window.visualViewport) {
      queueMicrotask(() => setVisualViewportHeight(null));
      return;
    }
    const vv = window.visualViewport;
    const syncHeight = () => {
      setVisualViewportHeight(Math.round(vv.height));
    };
    syncHeight();
    vv.addEventListener('resize', syncHeight);
    vv.addEventListener('scroll', syncHeight);
    return () => {
      vv.removeEventListener('resize', syncHeight);
      vv.removeEventListener('scroll', syncHeight);
    };
  }, [stage]);

  const advanceShowcase = useCallback(() => {
    setMorphedCharCount(prefersReducedMotion ? HERO_CHAR_COUNT : 0);
    setSubtitleMorphedCount(prefersReducedMotion ? SUBTITLE_CHAR_COUNT : 0);
    setShowcase((prev) => {
      const nextIndex = (prev.index + 1) % HERO_SHOWCASE_CYCLE.length;
      const nextStyle = HERO_SHOWCASE_CYCLE[nextIndex];
      return {
        index: nextIndex,
        prevFontId: prev.activeFontId,
        activeFontId: nextStyle.fontId,
        waveGeneration: prev.waveGeneration + 1,
      };
    });
  }, [prefersReducedMotion]);

  // Auto-cycle hero showcase across themes, holding comfortably on each theme (~6.5s)
  useEffect(() => {
    if (stage !== 'hero' || showcasePaused || prefersReducedMotion) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      advanceShowcase();
    }, 6500);
    return () => {
      window.clearInterval(id);
    };
  }, [stage, showcasePaused, prefersReducedMotion, advanceShowcase]);

  // Sweep headline & subtitle typography one character at a time on ease-in-out curves
  useEffect(() => {
    if (showcase.waveGeneration === 0) return;
    if (prefersReducedMotion) {
      queueMicrotask(() => {
        setMorphedCharCount(HERO_CHAR_COUNT);
        setSubtitleMorphedCount(SUBTITLE_CHAR_COUNT);
      });
      return;
    }

    let headStep = 0;
    let headTimerId = 0;
    let subStep = 0;
    let subTimerId = 0;
    let cancelled = false;

    const scheduleHeadline = () => {
      if (cancelled || headStep >= HERO_CHAR_COUNT) return;
      const delayMs = getHeroStepDelayMs(headStep, HERO_CHAR_COUNT);
      headTimerId = window.setTimeout(() => {
        if (cancelled) return;
        headStep += 1;
        setMorphedCharCount(headStep);
        if (headStep < HERO_CHAR_COUNT) {
          scheduleHeadline();
        }
      }, delayMs);
    };

    const scheduleSubtitle = () => {
      if (cancelled || subStep >= SUBTITLE_CHAR_COUNT) return;
      const delayMs = getSubtitleStepDelayMs(subStep, SUBTITLE_CHAR_COUNT);
      subTimerId = window.setTimeout(() => {
        if (cancelled) return;
        subStep += 1;
        setSubtitleMorphedCount(subStep);
        if (subStep < SUBTITLE_CHAR_COUNT) {
          scheduleSubtitle();
        }
      }, delayMs);
    };

    scheduleHeadline();
    scheduleSubtitle();

    return () => {
      cancelled = true;
      window.clearTimeout(headTimerId);
      window.clearTimeout(subTimerId);
    };
  }, [showcase.waveGeneration, prefersReducedMotion]);

  // Cycle prefilled prompt examples and animate the theme to match while input is empty
  useEffect(() => {
    if (stage !== 'prompt' || promptText.trim().length > 0 || prefersReducedMotion) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setPromptExampleIndex((i) => (i + 1) % CYCLING_PROMPT_EXAMPLES.length);
    }, 4800);
    return () => {
      window.clearInterval(id);
    };
  }, [stage, promptText, prefersReducedMotion]);

  const activeCyclingExample = CYCLING_PROMPT_EXAMPLES[promptExampleIndex];

  const parsedDraft = useMemo(() => {
    const trimmed = deferredPromptText.trim();
    if (!trimmed) return null;
    return parseEventPrompt(trimmed, new Date(), getBrowserTimeZone());
  }, [deferredPromptText]);

  const activeStyle = useMemo<InviteStyleConfig>(() => {
    if (stage === 'hero') {
      return HERO_SHOWCASE_CYCLE[showcase.index];
    }
    if (parsedDraft) {
      return parsedDraft.style;
    }
    return activeCyclingExample.style;
  }, [stage, showcase.index, parsedDraft, activeCyclingExample]);

  const activePreset = useMemo(
    () => getThemePreset(activeStyle.themeId),
    [activeStyle.themeId],
  );

  const themeVars = useMemo(() => resolveThemeCssVars(activeStyle), [activeStyle]);
  const backdropMode =
    themeVars['--theme-backdrop-mode'] === 'light' ? 'light' : 'dark';

  useThemeViewportSync(themeVars['--theme-page-bg'], backdropMode);

  function transitionToStage(nextStage: HomeStage) {
    if (nextStage === stage) return;

    const focusTarget = () => {
      if (nextStage === 'prompt') {
        promptInputRef.current?.focus();
      } else {
        heroHeadingRef.current?.focus();
      }
    };

    setStage(nextStage);
    window.requestAnimationFrame(focusTarget);
  }

  function handlePromptChange(nextValue: string) {
    setPromptText(nextValue);
  }

  function handleStartInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = promptText.trim();
    if (!trimmed) return;
    const submitDraft =
      parsedDraft ?? parseEventPrompt(trimmed, new Date(), getBrowserTimeZone());
    try {
      window.localStorage.removeItem(CREATE_DRAFT_KEY);
    } catch {
      // Ignore storage access errors
    }
    saveStudioDraft(submitDraft);
    router.push('/create');
  }

  const whenLabel = parsedDraft ? formatLiveWhen(parsedDraft) : '';

  return (
    <div
      style={{
        ...(themeVars as React.CSSProperties),
        color: 'var(--theme-text-primary)',
        fontFamily: 'var(--font-ui-body), var(--font-sans), sans-serif',
        ...(stage === 'prompt' && visualViewportHeight
          ? { minHeight: `${visualViewportHeight}px`, height: `${visualViewportHeight}px` }
          : {}),
      }}
      className="home-theme-root min-h-dvh relative overflow-x-hidden flex flex-col"
    >
      <AmbientBackdrop
        fixedViewport
        effectId={activeStyle.effectId}
        pageBg={themeVars['--theme-page-bg']}
        accentColor={themeVars['--theme-accent']}
        secondaryColor={themeVars['--theme-cta-end']}
        colorMode={backdropMode}
        turbulence={stage === 'prompt' ? 0.24 : 0}
        className="z-0"
      />

      {/* Lightweight GPU-composited gradient aura behind composer card */}
      <div
        aria-hidden="true"
        data-testid="nlp-turbulence-aura"
        data-turbulence-active={Boolean(parsedDraft) ? 'true' : 'false'}
        className="pointer-events-none fixed inset-0 z-[1] flex items-center justify-center transition-opacity duration-500"
        style={{ opacity: stage === 'prompt' ? 0.88 : 0.52 }}
      >
        <div
          className="h-[min(78vw,560px)] w-[min(92vw,620px)] rounded-full transition-transform duration-700"
          style={{
            background:
              'radial-gradient(circle at 28% 32%, color-mix(in srgb, var(--theme-cta-start) 53%, transparent), transparent 62%), radial-gradient(circle at 74% 68%, color-mix(in srgb, var(--theme-cta-end) 47%, transparent), transparent 66%), radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--theme-accent) 34%, transparent), transparent 74%)',
            filter: 'blur(38px)',
            transform: parsedDraft ? 'scale(1.04)' : 'scale(1)',
          }}
        />
      </div>

      {/* Quiet Top Bar */}
      <header className="relative z-10 app-top-bar min-h-12 w-full max-w-[600px] mx-auto flex items-center justify-between gap-2">
        <Link
          href="/"
          className="theme-pill-btn inline-flex items-center gap-2 text-sm font-semibold tracking-tight hover:opacity-80 shrink-0"
          style={{ color: 'var(--theme-outer-text)' }}
        >
          <InviteIcon name="brand" className="h-4 w-4" />
          <span>invited</span>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          {stage === 'hero' ? (
            <button
              type="button"
              data-testid="hero-pause-btn"
              onClick={() => setShowcasePaused((p) => !p)}
              aria-label={
                showcasePaused ? 'Play theme showcase' : 'Pause theme showcase'
              }
              className="hero-pause-btn theme-pill-btn h-8 w-8 inline-flex items-center justify-center rounded-full border backdrop-blur-md hover:opacity-90 active:scale-95 cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-outer-pill-bg)',
                borderColor: 'var(--theme-outer-pill-border)',
                color: 'var(--theme-outer-text)',
              }}
            >
              {showcasePaused ? (
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setRecentOpen(true)}
            className="theme-pill-btn h-8 inline-flex items-center gap-1.5 rounded-full border px-3 text-xs font-medium backdrop-blur-md hover:opacity-90 cursor-pointer shrink-0"
            style={{
              backgroundColor: 'var(--theme-outer-pill-bg)',
              borderColor: 'var(--theme-outer-pill-border)',
              color: 'var(--theme-outer-text)',
            }}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>My Invites</span>
          </button>
        </div>
      </header>

      <main
        className={`relative z-10 flex-1 flex items-center justify-center px-3.5 sm:px-4 ${
          stage === 'prompt' ? 'py-3 sm:py-10' : 'py-6 sm:py-12'
        }`}
      >
        <div className="w-full max-w-[540px]">
          {stage === 'hero' ? (
            <section
              data-testid="home-hero-card"
              data-showcase-theme={activePreset.id}
              data-showcase-effect={activeStyle.effectId}
              data-showcase-font={showcase.activeFontId}
              aria-labelledby="home-hero-heading"
              className="invite-glass-card rounded-3xl border px-6 py-8 sm:px-10 sm:py-10 text-center space-y-5 sm:space-y-6"
            >
              {/* Block 1 & Block 2 */}
              <div className="space-y-3.5">
                <h1
                  id="home-hero-heading"
                  ref={heroHeadingRef}
                  tabIndex={-1}
                  aria-label={HERO_HEADLINE}
                  className="font-bold text-center outline-none"
                  style={{
                    fontSize: 'clamp(1.52rem, 1.02rem + 2.55vw, 2.9rem)',
                  }}
                >
                  {HERO_LINE_TOKENS.map((line, lineIdx) => (
                    <React.Fragment key={lineIdx}>
                      <span
                        data-testid={`hero-line-${lineIdx + 1}`}
                        aria-hidden="true"
                        className="hero-headline-line"
                      >
                        {line.words.map((wordToken, wordIdx) => (
                          <React.Fragment key={wordIdx}>
                            {wordToken.chars.map((token, charIdx) => {
                              const isMorphed = token.globalIndex < morphedCharCount;
                              const glyphFont = isMorphed
                                ? showcase.activeFontId
                                : showcase.prevFontId;
                              const tuning = FONT_OPTICAL_TUNING[glyphFont];
                              return (
                                <span
                                  key={`${lineIdx}-${wordIdx}-${charIdx}-${isMorphed ? showcase.waveGeneration : 0}`}
                                  data-char-index={token.globalIndex}
                                  data-char-font={glyphFont}
                                  data-wave-active={
                                    isMorphed && showcase.waveGeneration > 0
                                      ? 'true'
                                      : undefined
                                  }
                                  className="hero-char-glyph"
                                  style={
                                    {
                                      fontFamily: tuning.fontVar,
                                      letterSpacing: tuning.tracking,
                                      '--glyph-fallback-size': tuning.fallbackSizeEm,
                                    } as React.CSSProperties
                                  }
                                >
                                  {token.char}
                                </span>
                              );
                            })}
                            {wordIdx < line.words.length - 1 ? ' ' : null}
                          </React.Fragment>
                        ))}
                      </span>
                      {lineIdx < HERO_LINE_TOKENS.length - 1 ? (
                        <span className="sr-only"> </span>
                      ) : null}
                    </React.Fragment>
                  ))}
                </h1>

                <p
                  data-testid="home-hero-subtitle"
                  aria-label={HERO_SUBTITLE}
                  className="text-[15px] sm:text-[17px] leading-relaxed max-w-[36ch] mx-auto"
                  style={{
                    color: 'var(--theme-text-muted)',
                    textWrap: 'pretty',
                  }}
                >
                  {SUBTITLE_WORDS.map((wordToken, wordIdx) => (
                    <React.Fragment key={wordIdx}>
                      <span aria-hidden="true" className="inline-block whitespace-nowrap">
                        {wordToken.chars.map((token, charIdx) => {
                          const isMorphed = token.globalIndex < subtitleMorphedCount;
                          const glyphFont = isMorphed
                            ? showcase.activeFontId
                            : showcase.prevFontId;
                          return (
                            <span
                              key={`${wordIdx}-${charIdx}-${isMorphed ? showcase.waveGeneration : 0}`}
                              data-sub-char-index={token.globalIndex}
                              data-sub-char-font={glyphFont}
                              data-wave-active={
                                isMorphed && showcase.waveGeneration > 0 ? 'true' : undefined
                              }
                              className="hero-subtitle-glyph"
                              style={{
                                fontFamily: BODY_FONT_VARS[glyphFont],
                              }}
                            >
                              {token.char}
                            </span>
                          );
                        })}
                      </span>
                      {wordIdx < SUBTITLE_WORDS.length - 1 ? (
                        <span aria-hidden="true"> </span>
                      ) : null}
                    </React.Fragment>
                  ))}
                </p>
              </div>

              {/* Primary CTA */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  data-testid="home-create-invite-btn"
                  onClick={() => transitionToStage('prompt')}
                  className="invite-cta-btn w-full sm:w-auto sm:min-w-[230px] min-h-[50px] inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold shadow-xl hover:opacity-95 active:scale-[0.98] cursor-pointer"
                >
                  <span>Create an invite</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>

                {hasSavedDraft ? (
                  <div>
                    <Link
                      href="/create"
                      data-testid="home-saved-draft-link"
                      className="inline-block text-xs font-medium underline underline-offset-4 opacity-75 hover:opacity-100 transition"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      Continue saved draft
                    </Link>
                  </div>
                ) : null}
              </div>

              {/* Block 3: Clean trust note below the CTA without a hairline */}
              <p
                data-testid="home-hero-footnote"
                className="text-[11px] sm:text-xs font-medium tracking-wide opacity-85 whitespace-nowrap"
                style={{
                  color: 'var(--theme-text-muted)',
                  fontFamily:
                    'var(--font-studio-mono), var(--font-ui-body), sans-serif',
                }}
              >
                No signup or downloads
              </p>
            </section>
          ) : (
            <section
              data-testid="prompt-starter-card"
              data-prompt-theme={activePreset.id}
              aria-labelledby="prompt-starter-heading"
              className="stage-card-enter invite-glass-card rounded-3xl border p-4 sm:p-6 space-y-3"
            >
              <div className="flex items-center justify-start gap-2">
                <button
                  type="button"
                  data-testid="prompt-back-btn"
                  onClick={() => transitionToStage('hero')}
                  className="theme-surface-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium hover:opacity-90 active:scale-[0.98] cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Back</span>
                </button>
              </div>

              <form onSubmit={handleStartInvite} className="space-y-2.5 sm:space-y-3">
                {/* Headline remains in DOM when preview takes top slot */}
                {parsedDraft ? (
                  <h1 id="prompt-starter-heading" className="sr-only">
                    What&apos;s your event?
                  </h1>
                ) : (
                  <div className="space-y-1">
                    <h1
                      id="prompt-starter-heading"
                      className="text-lg sm:text-2xl font-bold tracking-tight"
                      style={{
                        fontFamily:
                          'var(--font-invite-display), var(--font-invite-body), sans-serif',
                      }}
                    >
                      What&apos;s your event?
                    </h1>
                    <p
                      className="text-xs sm:text-sm"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      Type what, when, and where to watch your invite build live.
                    </p>
                  </div>
                )}

                {/* 1. Compact live invite preview OVER TOP of input field */}
                <div
                  className="invite-grid-expand"
                  data-open={parsedDraft ? 'true' : 'false'}
                >
                  <div>
                    {parsedDraft ? (
                      <div
                        data-testid="live-nlp-preview"
                        className="w-full max-w-[300px] sm:max-w-[340px] mx-auto rounded-2xl border overflow-hidden shadow-lg transition-all duration-300"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          borderColor: 'var(--theme-border)',
                        }}
                      >
                        <div className="h-20 sm:h-24 w-full overflow-hidden">
                          <CoverArt
                            flushTop
                            coverPresetId={parsedDraft.style.coverPresetId}
                            layout="banner"
                            title={parsedDraft.title}
                            accentColor={themeVars['--theme-accent']}
                            className="h-full w-full !aspect-auto"
                          />
                        </div>

                        <div className="px-3.5 py-2.5 space-y-1">
                          <p
                            className="text-sm sm:text-[15px] font-bold leading-snug"
                            style={{
                              fontFamily:
                                'var(--font-invite-display), var(--font-invite-body), sans-serif',
                            }}
                          >
                            {parsedDraft.title}
                          </p>

                          {whenLabel ||
                          parsedDraft.locationName ||
                          parsedDraft.virtualUrl ||
                          parsedDraft.hostName ? (
                            <div
                              className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]"
                              style={{ color: 'var(--theme-text-muted)' }}
                            >
                              {whenLabel ? (
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                                  <span>{whenLabel}</span>
                                </span>
                              ) : null}
                              {parsedDraft.locationName || parsedDraft.virtualUrl ? (
                                <span className="inline-flex items-center gap-1 min-w-0">
                                  <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                                  <span className="truncate max-w-[130px]">
                                    {parsedDraft.locationName || 'Online link'}
                                  </span>
                                </span>
                              ) : null}
                              {parsedDraft.hostName ? (
                                <span className="inline-flex items-center gap-1 min-w-0">
                                  <GuestAvatar name={parsedDraft.hostName} size="xs" />
                                  <span className="truncate max-w-[96px]">
                                    {parsedDraft.hostName}
                                  </span>
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* 2. Compact input field positioned directly below preview */}
                <label htmlFor="nlp-prompt-textarea" className="sr-only">
                  Describe your event
                </label>
                <div className="prompt-input-wrap relative">
                  <textarea
                    ref={promptInputRef}
                    id="nlp-prompt-textarea"
                    data-testid="nlp-prompt-input"
                    rows={2}
                    enterKeyHint="go"
                    value={promptText}
                    onCompositionEnd={(e) => {
                      lastCompositionEndAtRef.current = e.timeStamp;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (
                          e.nativeEvent.isComposing ||
                          e.nativeEvent.keyCode === 229 ||
                          (lastCompositionEndAtRef.current !== null &&
                            Math.abs(e.timeStamp - lastCompositionEndAtRef.current) < 50)
                        ) {
                          return;
                        }
                        if (promptText.trim()) {
                          e.currentTarget.form?.requestSubmit();
                        }
                      }
                    }}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    placeholder={activeCyclingExample.prompt}
                    className="theme-prompt-input w-full min-h-[60px] max-h-[108px] rounded-2xl border px-3.5 py-2.5 text-base leading-snug resize-none"
                  />
                  {!promptText ? (
                    <span
                      key={promptExampleIndex}
                      data-testid="cycling-prompt-placeholder"
                      aria-hidden="true"
                      className="prompt-placeholder-fade pointer-events-none absolute inset-0 px-3.5 py-2.5 text-base leading-snug overflow-hidden opacity-75"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      {activeCyclingExample.prompt}
                    </span>
                  ) : null}
                </div>

                {/* 3. Full-width primary action */}
                <div className="pt-0.5">
                  <button
                    type="submit"
                    data-testid="start-invite-btn"
                    disabled={!promptText.trim()}
                    className="invite-cta-btn w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm sm:text-base font-semibold shadow-xl hover:opacity-95 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  >
                    <span>Start invite</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </main>

      <RecentEventsDialog open={recentOpen} onClose={() => setRecentOpen(false)} />
    </div>
  );
}
