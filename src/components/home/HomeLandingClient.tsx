'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Calendar, MapPin, Sparkles } from 'lucide-react';
import { CoverArt } from '@/components/covers/CoverArt';
import { AmbientBackdrop } from '@/components/effects/AmbientBackdrop';
import { InviteIcon } from '@/components/icons/InviteIcons';
import { GuestAvatar } from '@/components/invite/GuestAvatar';
import { RecentEventsDialog } from '@/components/studio/RecentEventsDialog';
import { getBrowserTimeZone } from '@/components/studio/dateTimeUtils';
import { saveStudioDraft } from '@/lib/client/recentEvents';
import { useThemeViewportSync } from '@/lib/client/useThemeViewportSync';
import { EXAMPLE_EVENT_PROMPTS, parseEventPrompt } from '@/lib/nlp/parseEventPrompt';
import { getThemePreset, resolveThemeCssVars } from '@/lib/themes/presets';
import type { InviteStyleConfig } from '@/types/invite';

export type HomeStage = 'hero' | 'prompt';

interface HomeLandingClientProps {
  initialStage?: HomeStage;
}

const CREATE_DRAFT_KEY = 'invited_create_draft_v1';

const DEFAULT_HERO_STYLE: InviteStyleConfig = (() => {
  const preset = getThemePreset('winter-snowfall');
  return {
    themeId: preset.id,
    fontId: preset.defaultFontId,
    effectId: 'prism-gradient',
    coverPresetId: preset.defaultCoverPresetId,
    coverLayout: 'banner',
    colorMode: preset.colorMode,
  };
})();

const STARTER_SUGGESTIONS = [
  EXAMPLE_EVENT_PROMPTS[0], // Christmas Party
  {
    label: 'Patio taco night',
    prompt: 'Patio taco night this Friday at 7pm at 42 Maple St hosted by Ivan',
  },
  {
    label: 'Pancake brunch',
    prompt: 'Sunday pancake brunch at 11am at Sunny Kitchen hosted by Clara',
  },
];

function formatLiveWhen(startIso: string, endIso: string | undefined, timeZone: string): string {
  try {
    const start = new Date(startIso);
    const datePart = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(start);
    const timePart = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(start);
    if (!endIso) return `${datePart} at ${timePart}`;
    const endPart = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(endIso));
    return `${datePart}, ${timePart} – ${endPart}`;
  } catch {
    return 'Upcoming date';
  }
}

export function HomeLandingClient({ initialStage = 'hero' }: HomeLandingClientProps) {
  const router = useRouter();
  const [stage, setStage] = useState<HomeStage>(initialStage);
  const [promptText, setPromptText] = useState('');
  const [isActivelyTyping, setIsActivelyTyping] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);

  const heroHeadingRef = useRef<HTMLHeadingElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<number | null>(null);

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
    return () => {
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const el = promptInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 88)}px`;
  }, [promptText, stage]);

  const parsedDraft = useMemo(() => {
    const trimmed = promptText.trim();
    if (!trimmed) return null;
    return parseEventPrompt(trimmed, new Date(), getBrowserTimeZone());
  }, [promptText]);

  const activeStyle = useMemo<InviteStyleConfig>(() => {
    if (parsedDraft) {
      return parsedDraft.style;
    }
    return stage === 'prompt'
      ? {
          ...DEFAULT_HERO_STYLE,
          effectId: 'aurora',
        }
      : DEFAULT_HERO_STYLE;
  }, [parsedDraft, stage]);

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

    const docWithVt = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };

    if (typeof docWithVt.startViewTransition === 'function') {
      const vt = docWithVt.startViewTransition(() => {
        flushSync(() => {
          setStage(nextStage);
        });
      });
      void vt.finished.finally(focusTarget);
    } else {
      setStage(nextStage);
      window.requestAnimationFrame(focusTarget);
    }
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

  const whenLabel = parsedDraft
    ? formatLiveWhen(parsedDraft.startIso, parsedDraft.endIso, parsedDraft.timeZone)
    : '';

  return (
    <div
      style={{
        ...(themeVars as React.CSSProperties),
        backgroundColor: 'var(--theme-page-bg)',
        color: 'var(--theme-text-primary)',
        fontFamily: 'var(--font-invite-body), var(--font-sans), sans-serif',
      }}
      className="min-h-dvh relative overflow-x-hidden flex flex-col"
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
        style={{ opacity: stage === 'prompt' ? 0.92 : 0.45 }}
      >
        <div
          className="h-[min(78vw,560px)] w-[min(92vw,620px)] rounded-full transition-all duration-500"
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
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div
          className="w-full max-w-[540px]"
          style={{ viewTransitionName: 'studio-main-card' }}
        >
          {stage === 'hero' ? (
            <section
              data-testid="home-hero-card"
              aria-labelledby="home-hero-heading"
              className="invite-glass-card rounded-3xl border p-7 sm:p-10 text-center space-y-6"
            >
              <div className="space-y-3">
                <h1
                  id="home-hero-heading"
                  ref={heroHeadingRef}
                  tabIndex={-1}
                  className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.12] outline-none"
                  style={{
                    fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
                  }}
                >
                  Invites people actually want to open.
                </h1>
                <p
                  className="text-sm sm:text-base leading-relaxed max-w-md mx-auto"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  Describe your gathering, make the style yours, and share one link for instant
                  RSVPs — no sign-ups or app downloads.
                </p>
              </div>

              <div className="space-y-3 pt-1">
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
            </section>
          ) : (
            <section
              data-testid="prompt-starter-card"
              aria-labelledby="prompt-starter-heading"
              className="invite-glass-card rounded-3xl border p-5 sm:p-7 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
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

                <span
                  data-testid="live-detected-theme-pill"
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-300"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  <InviteIcon name={activePreset.icon} className="h-3.5 w-3.5" />
                  <span>{activePreset.name}</span>
                </span>
              </div>

              <form onSubmit={handleStartInvite} className="space-y-4">
                <div className="space-y-1.5">
                  <h1
                    id="prompt-starter-heading"
                    className="text-xl sm:text-2xl font-bold tracking-tight"
                    style={{
                      fontFamily:
                        'var(--font-invite-display), var(--font-invite-body), sans-serif',
                    }}
                  >
                    Tell us about your event
                  </h1>
                  <p className="text-xs sm:text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                    Just type naturally — what, when, and where — and watch your invite build live.
                  </p>
                </div>

                <label htmlFor="nlp-prompt-textarea" className="sr-only">
                  Describe your event
                </label>
                <textarea
                  ref={promptInputRef}
                  id="nlp-prompt-textarea"
                  data-testid="nlp-prompt-input"
                  rows={3}
                  value={promptText}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="Example: Patio taco night this Friday at 7pm at 42 Maple St hosted by Ivan"
                  className="w-full rounded-2xl border px-4 py-3 text-base leading-relaxed outline-none focus:ring-2 resize-none transition-colors duration-200"
                  style={{
                    backgroundColor: 'var(--theme-surface-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text-primary)',
                  }}
                />

                {!promptText.trim() ? (
                  <div className="flex flex-wrap gap-1.5">
                    {STARTER_SUGGESTIONS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handlePromptChange(item.prompt)}
                        className="rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-90 cursor-pointer"
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

                {/* Smoothly expanding live invite preview as NLP picks up event details */}
                <div
                  className="invite-grid-expand"
                  data-open={parsedDraft ? 'true' : 'false'}
                >
                  <div>
                    {parsedDraft ? (
                      <div
                        data-testid="live-nlp-preview"
                        className="rounded-2xl border overflow-hidden mt-0.5"
                        style={{
                          backgroundColor: 'var(--theme-surface-bg)',
                          borderColor: 'var(--theme-border)',
                        }}
                      >
                        <CoverArt
                          flushTop
                          coverPresetId={parsedDraft.style.coverPresetId}
                          layout="banner"
                          title={parsedDraft.title}
                          accentColor={themeVars['--theme-accent']}
                          className="aspect-[2.3/1]"
                        />

                        <div className="p-3.5 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold"
                              style={{ color: 'var(--theme-accent)' }}
                            >
                              <Sparkles className="h-3 w-3" aria-hidden="true" />
                              <span>{parsedDraft.detectedOccasionLabel}</span>
                            </span>
                            {parsedDraft.hostName ? (
                              <span
                                className="inline-flex items-center gap-1.5 text-[11px]"
                                style={{ color: 'var(--theme-text-muted)' }}
                              >
                                <GuestAvatar name={parsedDraft.hostName} size="sm" />
                                <span>{parsedDraft.hostName}</span>
                              </span>
                            ) : null}
                          </div>

                          <p
                            className="text-base sm:text-lg font-bold leading-snug"
                            style={{
                              fontFamily:
                                'var(--font-invite-display), var(--font-invite-body), sans-serif',
                            }}
                          >
                            {parsedDraft.title}
                          </p>

                          <div
                            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                            style={{ color: 'var(--theme-text-muted)' }}
                          >
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>{whenLabel}</span>
                            </span>
                            {parsedDraft.locationName || parsedDraft.virtualUrl ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>{parsedDraft.locationName || 'Online link'}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                  <button
                    type="submit"
                    data-testid="start-invite-btn"
                    disabled={!parsedDraft}
                    className="invite-cta-btn flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold shadow-xl transition hover:opacity-95 active:scale-[0.98] disabled:opacity-45 cursor-pointer"
                  >
                    <span>Start invite</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <Link
                    href="/create?blank=1"
                    data-testid="skip-to-blank-btn"
                    className="inline-flex items-center justify-center rounded-full border px-4 py-3 text-xs sm:text-sm font-medium transition hover:opacity-90"
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
