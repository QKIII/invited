'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { AmbientBackdrop } from '@/components/effects/AmbientBackdrop';
import { InviteIcon } from '@/components/icons/InviteIcons';
import { consumeStudioDraft } from '@/lib/client/recentEvents';
import { useThemeViewportSync } from '@/lib/client/useThemeViewportSync';
import { parseEventPrompt, type ParsedEventDraft } from '@/lib/nlp/parseEventPrompt';
import { getThemePreset, resolveThemeCssVars } from '@/lib/themes/presets';
import type { InviteStyleConfig } from '@/types/invite';
import { getBrowserTimeZone } from './dateTimeUtils';
import { InviteStudio } from './InviteStudio';
import { RecentEventsDialog } from './RecentEventsDialog';

interface CreateInviteClientProps {
  initialPrompt?: string;
  skipSavedDraft?: boolean;
}

function getInitialStyle(): InviteStyleConfig {
  const preset = getThemePreset('winter-snowfall');
  return {
    themeId: preset.id,
    fontId: preset.defaultFontId,
    effectId: preset.defaultEffectId,
    coverPresetId: preset.defaultCoverPresetId,
    coverLayout: 'banner',
    colorMode: preset.colorMode,
  };
}

export function CreateInviteClient({
  initialPrompt,
  skipSavedDraft = false,
}: CreateInviteClientProps) {
  const [recentOpen, setRecentOpen] = useState(false);
  const [sessionDraft, setSessionDraft] = useState<ParsedEventDraft | null>(null);
  const [userStyle, setUserStyle] = useState<InviteStyleConfig | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (skipSavedDraft) {
        try {
          window.localStorage.removeItem('invited_create_draft_v1');
        } catch {
          // Ignore storage access errors
        }
        return;
      }
      const consumed = consumeStudioDraft();
      if (consumed) {
        setSessionDraft(consumed);
      }
    });
    return () => {
      active = false;
    };
  }, [skipSavedDraft]);

  const fallbackPromptDraft = useMemo(() => {
    const trimmed = initialPrompt?.trim();
    if (!trimmed) return null;
    return parseEventPrompt(trimmed, new Date(), getBrowserTimeZone());
  }, [initialPrompt]);

  const activeDraft = sessionDraft ?? fallbackPromptDraft;
  const studioKey = sessionDraft
    ? 'session-draft'
    : initialPrompt
      ? `prompt-${initialPrompt.slice(0, 32)}`
      : 'blank';

  const liveStyle = useMemo(
    () => userStyle ?? activeDraft?.style ?? getInitialStyle(),
    [userStyle, activeDraft],
  );

  const themeVars = useMemo(
    () => resolveThemeCssVars(liveStyle),
    [liveStyle],
  );
  const backdropMode =
    themeVars['--theme-backdrop-mode'] === 'light' ? 'light' : 'dark';

  useThemeViewportSync(themeVars['--theme-page-bg'], backdropMode);

  return (
    <div
      style={{
        ...(themeVars as React.CSSProperties),
        backgroundColor: 'var(--theme-page-bg)',
        color: 'var(--theme-text-primary)',
        fontFamily: 'var(--font-invite-body), var(--font-sans), sans-serif',
      }}
      className="min-h-dvh relative overflow-x-hidden"
    >
      <AmbientBackdrop
        fixedViewport
        effectId={liveStyle.effectId}
        pageBg={themeVars['--theme-page-bg']}
        accentColor={themeVars['--theme-accent']}
        secondaryColor={themeVars['--theme-cta-end']}
        colorMode={backdropMode}
        className="z-0"
      />

      {/* Single quiet top bar */}
      <header className="relative z-10 app-top-bar min-h-12 max-w-[580px] mx-auto flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight hover:opacity-80 transition shrink-0"
          style={{ color: 'var(--theme-outer-text)' }}
        >
          <InviteIcon name="brand" className="h-4 w-4" />
          <span>invited</span>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/?stage=prompt"
            className="h-8 inline-flex items-center rounded-full border px-3 text-xs font-medium backdrop-blur-md transition hover:opacity-90 shrink-0"
            style={{
              backgroundColor: 'var(--theme-outer-pill-bg)',
              borderColor: 'var(--theme-outer-pill-border)',
              color: 'var(--theme-outer-text)',
            }}
          >
            Describe event
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
        </div>
      </header>

      <main className="relative z-10 max-w-[580px] mx-auto px-3.5 sm:px-6 pt-2 pb-16">
        <InviteStudio
          key={studioKey}
          mode="create"
          initialDraft={activeDraft}
          skipSavedDraft={skipSavedDraft}
          onStyleChange={setUserStyle}
        />
      </main>

      <RecentEventsDialog open={recentOpen} onClose={() => setRecentOpen(false)} />
    </div>
  );
}
