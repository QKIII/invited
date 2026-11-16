'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  CardSurfaceStyle,
  FontPairingId,
  InviteStyleConfig,
} from '@/types/invite';

export type HomeStage = 'hero' | 'prompt';

interface HomeLandingClientProps {
  initialStage?: HomeStage;
}

const CREATE_DRAFT_KEY = 'invited_create_draft_v1';

const HERO_HEADLINE = 'Invites people actually want to open.';

interface HeroCharToken {
  char: string;
  globalIndex: number;
}

interface HeroWordToken {
  word: string;
  chars: HeroCharToken[];
}

const { HERO_WORDS, HERO_CHAR_COUNT } = (() => {
  let cursor = 0;
  const words: HeroWordToken[] = HERO_HEADLINE.split(' ').map((word) => ({
    word,
    chars: Array.from(word).map((char) => ({
      char,
      globalIndex: cursor++,
    })),
  }));
  return { HERO_WORDS: words, HERO_CHAR_COUNT: cursor };
})();

const FONT_OPTICAL_TUNING: Record<
  FontPairingId,
  { fontVar: string; sizeEm: string; tracking: string }
> = {
  'editorial-serif': {
    fontVar: 'var(--font-editorial-serif), Georgia, serif',
    sizeEm: '1.08em',
    tracking: '-0.015em',
  },
  'modern-sans': {
    fontVar: 'var(--font-modern-sans), system-ui, -apple-system, sans-serif',
    sizeEm: '0.96em',
    tracking: '-0.025em',
  },
  'expressive-display': {
    fontVar: 'var(--font-expressive-display), Georgia, serif',
    sizeEm: '0.97em',
    tracking: '-0.02em',
  },
  'sacred-classic': {
    fontVar: 'var(--font-sacred-classic), Georgia, serif',
    sizeEm: '1.1em',
    tracking: '-0.01em',
  },
  'playful-rounded': {
    fontVar: 'var(--font-playful-rounded), system-ui, -apple-system, sans-serif',
    sizeEm: '0.95em',
    tracking: '-0.015em',
  },
  'studio-mono': {
    fontVar: 'var(--font-studio-mono), ui-monospace, SFMono-Regular, monospace',
    sizeEm: '0.82em',
    tracking: '-0.04em',
  },
  'y2k-display': {
    fontVar: 'var(--font-y2k-display), var(--font-modern-sans), sans-serif',
    sizeEm: '0.85em',
    tracking: '-0.03em',
  },
};

const CURATED_SHOWCASE_SPECS: Array<{
  themeId: string;
  effectId: AmbientEffectId;
  fontId: FontPairingId;
  cardStyle?: CardSurfaceStyle;
}> = [
  { themeId: 'aurora-midnight', effectId: 'aurora', fontId: 'editorial-serif', cardStyle: 'glass' },
  { themeId: 'y2k-chrome', effectId: 'liquid-chrome', fontId: 'y2k-display', cardStyle: 'y2k' },
  { themeId: 'candlelit-dinner', effectId: 'warm-bokeh', fontId: 'expressive-display', cardStyle: 'glass' },
  { themeId: 'winter-snowfall', effectId: 'snowfall', fontId: 'modern-sans', cardStyle: 'glass' },
  { themeId: 'sunset-disco', effectId: 'disco-prism', fontId: 'sacred-classic', cardStyle: 'clear' },
  { themeId: 'cozy-christmas', effectId: 'christmas-lights', fontId: 'playful-rounded', cardStyle: 'glass' },
  { themeId: 'neon-arcade', effectId: 'cyber-grid', fontId: 'studio-mono', cardStyle: 'clear' },
  { themeId: 'electric-quantum', effectId: 'prism-gradient', fontId: 'y2k-display', cardStyle: 'glass' },
  { themeId: 'new-years-eve', effectId: 'champagne-sparkle', fontId: 'editorial-serif', cardStyle: 'glass' },
  { themeId: 'valentines-rose', effectId: 'floating-hearts', fontId: 'sacred-classic', cardStyle: 'glass' },
  { themeId: 'birthday-confetti', effectId: 'confetti', fontId: 'playful-rounded', cardStyle: 'glass' },
  { themeId: 'fourth-of-july', effectId: 'fireworks', fontId: 'expressive-display', cardStyle: 'glass' },
  { themeId: 'sacred-nativity', effectId: 'starlight-radiance', fontId: 'sacred-classic', cardStyle: 'glass' },
  { themeId: 'spooky-halloween', effectId: 'halloween-bats', fontId: 'y2k-display', cardStyle: 'glass' },
  { themeId: 'warm-thanksgiving', effectId: 'autumn-leaves', fontId: 'expressive-display', cardStyle: 'glass' },
  { themeId: 'st-patricks-emerald', effectId: 'fireflies', fontId: 'editorial-serif', cardStyle: 'glass' },
  { themeId: 'spring-easter-garden', effectId: 'botanical-petals', fontId: 'sacred-classic', cardStyle: 'glass' },
  { themeId: 'summer-cookout', effectId: 'water-caustics', fontId: 'playful-rounded', cardStyle: 'glass' },
  { themeId: 'baby-shower-cloud', effectId: 'lullaby-stars', fontId: 'modern-sans', cardStyle: 'glass' },
  { themeId: 'bridal-atelier', effectId: 'stained-glass', fontId: 'editorial-serif', cardStyle: 'glass' },
  { themeId: 'risograph-zine', effectId: 'paper-lanterns', fontId: 'studio-mono', cardStyle: 'clear' },
  { themeId: 'minimal-paper', effectId: 'twilight-clouds', fontId: 'modern-sans', cardStyle: 'glass' },
  { themeId: 'electric-quantum', effectId: 'lava-lamp', fontId: 'playful-rounded', cardStyle: 'glass' },
  { themeId: 'minimal-paper', effectId: 'rain-glass', fontId: 'editorial-serif', cardStyle: 'glass' },
  { themeId: 'aurora-midnight', effectId: 'shooting-stars', fontId: 'studio-mono', cardStyle: 'glass' },
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
      cardStyle: spec.cardStyle ?? preset.defaultCardStyle ?? 'glass',
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

const DEFAULT_PROMPT_STYLE: InviteStyleConfig = {
  ...HERO_SHOWCASE_CYCLE[0],
  themeId: 'aurora-midnight',
  effectId: 'aurora',
  coverPresetId: getThemePreset('aurora-midnight').defaultCoverPresetId,
  colorMode: getThemePreset('aurora-midnight').colorMode,
};

const STARTER_SUGGESTIONS = [
  EXAMPLE_EVENT_PROMPTS[0],
  {
    label: 'Patio taco night',
    prompt: 'Patio taco night this Friday at 7pm at 42 Maple St hosted by Ivan',
  },
  {
    label: 'Pancake brunch',
    prompt: 'Sunday pancake brunch at 11am at Sunny Kitchen hosted by Clara',
  },
];

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
  const [isActivelyTyping, setIsActivelyTyping] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);

  const [showcasePaused, setShowcasePaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [showcase, setShowcase] = useState<ShowcaseState>({
    index: 0,
    prevFontId: HERO_SHOWCASE_CYCLE[0].fontId,
    activeFontId: HERO_SHOWCASE_CYCLE[0].fontId,
    waveGeneration: 0,
  });
  const [morphedCharCount, setMorphedCharCount] = useState<number>(HERO_CHAR_COUNT);

  const heroHeadingRef = useRef<HTMLHeadingElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<number | null>(null);
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

  useEffect(() => {
    return () => {
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  const advanceShowcase = useCallback(() => {
    setMorphedCharCount(prefersReducedMotion ? HERO_CHAR_COUNT : 0);
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

  // Auto-cycle hero showcase across themes, animated backgrounds, and typography waves
  useEffect(() => {
    if (stage !== 'hero' || showcasePaused || prefersReducedMotion) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      advanceShowcase();
    }, 3800);
    return () => {
      window.clearInterval(id);
    };
  }, [stage, showcasePaused, prefersReducedMotion, advanceShowcase]);

  // Sweep typography one character at a time on each transition
  useEffect(() => {
    if (showcase.waveGeneration === 0) return;
    if (prefersReducedMotion) {
      queueMicrotask(() => setMorphedCharCount(HERO_CHAR_COUNT));
      return;
    }
    const id = window.setInterval(() => {
      setMorphedCharCount((count) => {
        if (count >= HERO_CHAR_COUNT) {
          window.clearInterval(id);
          return HERO_CHAR_COUNT;
        }
        const next = count + 1;
        if (next >= HERO_CHAR_COUNT) {
          window.clearInterval(id);
        }
        return next;
      });
    }, 22);
    return () => {
      window.clearInterval(id);
    };
  }, [showcase.waveGeneration, prefersReducedMotion]);

  useEffect(() => {
    const el = promptInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 60), 108)}px`;
  }, [promptText, stage]);

  const parsedDraft = useMemo(() => {
    const trimmed = promptText.trim();
    if (!trimmed) return null;
    return parseEventPrompt(trimmed, new Date(), getBrowserTimeZone());
  }, [promptText]);

  const activeStyle = useMemo<InviteStyleConfig>(() => {
    if (stage === 'hero') {
      return HERO_SHOWCASE_CYCLE[showcase.index];
    }
    if (parsedDraft) {
      return parsedDraft.style;
    }
    return DEFAULT_PROMPT_STYLE;
  }, [stage, showcase.index, parsedDraft]);

  const activePreset = useMemo(
    () => getThemePreset(activeStyle.themeId),
    [activeStyle.themeId],
  );

  const themeVars = useMemo(() => resolveThemeCssVars(activeStyle), [activeStyle]);
  const backdropMode =
    themeVars['--theme-backdrop-mode'] === 'light' ? 'light' : 'dark';

  useThemeViewportSync(themeVars['--theme-page-bg'], backdropMode);

  const turbulenceStrength = useMemo(() => {
    if (isActivelyTyping) return 0.92;
    if (parsedDraft) return 0.36;
    if (stage === 'prompt') return 0.14;
    return 0;
  }, [isActivelyTyping, parsedDraft, stage]);

  const displacementScale = isActivelyTyping ? 44 : parsedDraft ? 22 : 10;
  const turbulenceFreq = isActivelyTyping ? '0.022 0.028' : '0.014 0.019';

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
    setIsActivelyTyping(true);
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = window.setTimeout(() => {
      setIsActivelyTyping(false);
    }, 650);
  }

  function handleStartInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!parsedDraft) return;
    try {
      window.localStorage.removeItem(CREATE_DRAFT_KEY);
    } catch {
      // Ignore storage access errors
    }
    saveStudioDraft(parsedDraft);
    router.push('/create');
  }

  const whenLabel = parsedDraft ? formatLiveWhen(parsedDraft) : '';

  return (
    <div
      style={{
        ...(themeVars as React.CSSProperties),
        backgroundColor: 'var(--theme-page-bg)',
        color: 'var(--theme-text-primary)',
        fontFamily: 'var(--font-invite-body), var(--font-sans), sans-serif',
      }}
      className="min-h-dvh relative overflow-x-hidden flex flex-col transition-colors duration-700"
    >
      {/* Inline SVG turbulence displacement filter for frosted aura modulation during live NLP generation */}
      <svg className="sr-only" aria-hidden="true" width="0" height="0">
        <defs>
          <filter
            id="nlp-turbulence-displacement"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency={turbulenceFreq}
              numOctaves={2}
              seed={11}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={displacementScale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <AmbientBackdrop
        fixedViewport
        effectId={activeStyle.effectId}
        pageBg={themeVars['--theme-page-bg']}
        accentColor={themeVars['--theme-accent']}
        secondaryColor={themeVars['--theme-cta-end']}
        colorMode={backdropMode}
        turbulence={turbulenceStrength}
        className="z-0"
      />

      {/* Reactive frosted gradient turbulence aura behind composer card */}
      <div
        aria-hidden="true"
        data-testid="nlp-turbulence-aura"
        data-turbulence-active={isActivelyTyping || Boolean(parsedDraft) ? 'true' : 'false'}
        className="pointer-events-none fixed inset-0 z-[1] flex items-center justify-center transition-opacity duration-500"
        style={{ opacity: stage === 'prompt' ? 0.92 : 0.52 }}
      >
        <div
          className="h-[min(78vw,560px)] w-[min(92vw,620px)] rounded-full transition-all duration-700"
          style={{
            background: `radial-gradient(circle at 28% 32%, ${themeVars['--theme-cta-start']}88, transparent 62%), radial-gradient(circle at 74% 68%, ${themeVars['--theme-cta-end']}77, transparent 66%), radial-gradient(circle at 50% 50%, ${themeVars['--theme-accent']}55, transparent 74%)`,
            filter: 'url(#nlp-turbulence-displacement) blur(42px)',
            transform: isActivelyTyping ? 'scale(1.07)' : 'scale(1)',
          }}
        />
      </div>

      {/* Quiet Top Bar */}
      <header className="relative z-10 app-top-bar h-12 w-full max-w-[600px] mx-auto flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight hover:opacity-80 transition shrink-0"
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
              className="hero-pause-btn h-8 w-8 inline-flex items-center justify-center rounded-full border backdrop-blur-md transition hover:opacity-90 active:scale-95 cursor-pointer"
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
            className="h-8 inline-flex items-center gap-1.5 rounded-full border px-3 text-xs font-medium backdrop-blur-md transition hover:opacity-90 cursor-pointer shrink-0"
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
        className={`relative z-10 flex-1 flex justify-center px-3.5 sm:px-4 ${
          stage === 'prompt'
            ? 'items-start pt-2 pb-4 sm:items-center sm:py-10'
            : 'items-center py-6 sm:py-12'
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
                  className="font-bold leading-[1.16] text-center outline-none min-h-[4.6rem] sm:min-h-[5.4rem]"
                  style={{
                    fontSize: 'clamp(1.75rem, 1.3rem + 2.1vw, 2.55rem)',
                    textWrap: 'balance',
                  }}
                >
                  {HERO_WORDS.map((wordToken, wordIdx) => (
                    <React.Fragment key={wordIdx}>
                      <span
                        aria-hidden="true"
                        className="inline-block whitespace-nowrap"
                      >
                        {wordToken.chars.map((token, charIdx) => {
                          const isMorphed = token.globalIndex < morphedCharCount;
                          const glyphFont = isMorphed
                            ? showcase.activeFontId
                            : showcase.prevFontId;
                          const tuning = FONT_OPTICAL_TUNING[glyphFont];
                          return (
                            <span
                              key={`${wordIdx}-${charIdx}-${isMorphed ? showcase.waveGeneration : 0}`}
                              data-char-index={token.globalIndex}
                              data-char-font={glyphFont}
                              data-wave-active={
                                isMorphed && showcase.waveGeneration > 0
                                  ? 'true'
                                  : undefined
                              }
                              className="hero-char-glyph"
                              style={{
                                fontFamily: tuning.fontVar,
                                fontSize: tuning.sizeEm,
                                letterSpacing: tuning.tracking,
                              }}
                            >
                              {token.char}
                            </span>
                          );
                        })}
                      </span>
                      {wordIdx < HERO_WORDS.length - 1 ? (
                        <span aria-hidden="true"> </span>
                      ) : null}
                    </React.Fragment>
                  ))}
                </h1>

                <p
                  data-testid="home-hero-subtitle"
                  className="text-sm sm:text-base leading-relaxed max-w-[36ch] mx-auto"
                  style={{
                    color: 'var(--theme-text-muted)',
                    textWrap: 'pretty',
                  }}
                >
                  Describe your gathering, make the style yours, and share one link for
                  instant RSVPs.
                </p>
              </div>

              {/* Primary CTA */}
              <div className="space-y-2.5 pt-0.5">
                <button
                  type="button"
                  data-testid="home-create-invite-btn"
                  onClick={() => transitionToStage('prompt')}
                  className="invite-cta-btn w-full sm:w-auto sm:min-w-[230px] min-h-[50px] inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold shadow-xl transition hover:opacity-95 active:scale-[0.98] cursor-pointer"
                >
                  <span>Create an invite</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>

                {hasSavedDraft ? (
                  <div>
                    <Link
                      href="/create"
                      className="inline-block text-xs font-medium underline underline-offset-4 opacity-75 hover:opacity-100 transition"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      Continue saved draft
                    </Link>
                  </div>
                ) : null}
              </div>

              {/* Block 3: Standalone single-line footer block */}
              <p
                data-testid="home-hero-footnote"
                className="pt-3.5 border-t text-[11px] sm:text-xs font-medium tracking-wide opacity-90"
                style={{
                  borderColor: 'var(--theme-hairline)',
                  color: 'var(--theme-text-muted)',
                  fontFamily:
                    'var(--font-studio-mono), var(--font-ui-body), sans-serif',
                }}
              >
                No sign-ups · No app downloads
              </p>
            </section>
          ) : (
            <section
              data-testid="prompt-starter-card"
              aria-labelledby="prompt-starter-heading"
              className="stage-card-enter invite-glass-card rounded-3xl border p-4 sm:p-6 space-y-3"
            >
              <div className="flex items-center justify-start gap-2">
                <button
                  type="button"
                  onClick={() => transitionToStage('hero')}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-85 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-hairline)',
                    color: 'var(--theme-text-muted)',
                  }}
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
                      if (parsedDraft) {
                        e.currentTarget.form?.requestSubmit();
                      }
                    }
                  }}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="Example: Patio taco night this Friday at 7pm at 42 Maple St hosted by Ivan"
                  className="w-full min-h-[60px] max-h-[108px] rounded-2xl border px-3.5 py-2.5 text-base leading-snug outline-none focus:ring-2 resize-none transition-colors duration-200"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                />

                {!promptText.trim() ? (
                  <div className="starter-chip-list flex flex-wrap gap-1.5">
                    {STARTER_SUGGESTIONS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handlePromptChange(item.prompt)}
                        className="starter-chip rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-90 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          borderColor: 'var(--theme-hairline)',
                          color: 'var(--theme-text-muted)',
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* 3. Single-row action bar */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="submit"
                    data-testid="start-invite-btn"
                    disabled={!parsedDraft}
                    className="invite-cta-btn flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm sm:text-base font-semibold shadow-xl transition hover:opacity-95 active:scale-[0.98] disabled:opacity-45 cursor-pointer"
                  >
                    <span>Start invite</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <Link
                    href="/create?blank=1"
                    data-testid="skip-to-blank-btn"
                    className="shrink-0 min-h-[44px] inline-flex items-center justify-center rounded-full border px-3.5 py-2.5 text-xs sm:text-sm font-medium transition hover:opacity-90"
                    style={{
                      borderColor: 'var(--theme-hairline)',
                      color: 'var(--theme-text-muted)',
                    }}
                  >
                    Start blank
                  </Link>
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
