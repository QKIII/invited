'use client';

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Calendar, Sparkles } from 'lucide-react';
import { AmbientBackdrop } from '@/components/effects/AmbientBackdrop';
import { GuestAvatar } from '@/components/invite/GuestAvatar';
import {
  getDeviceProfile,
  getDeviceProfileServerSnapshot,
  subscribeDeviceProfile,
} from '@/lib/client/deviceProfile';
import { consumeStudioDraft } from '@/lib/client/recentEvents';
import { parseEventPrompt, type ParsedEventDraft } from '@/lib/nlp/parseEventPrompt';
import { getThemePreset, resolveThemeCssVars } from '@/lib/themes/presets';
import type { InviteStyleConfig } from '@/types/invite';
import { getBrowserTimeZone } from './dateTimeUtils';
import { InviteStudio } from './InviteStudio';
import { RecentEventsDialog } from './RecentEventsDialog';

interface CreateInviteClientProps {
  initialPrompt?: string;
}

function getInitialStyle(): InviteStyleConfig {
  const preset = getThemePreset('winter-snowfall');
  return {
    themeId: preset.id,
    fontId: preset.defaultFontId,
    effectId: preset.defaultEffectId,
    coverPresetId: preset.defaultCoverPresetId,
    coverLayout: 'square',
    colorMode: preset.colorMode,
  };
}

export function CreateInviteClient({ initialPrompt }: CreateInviteClientProps) {
  const [recentOpen, setRecentOpen] = useState(false);
  const [sessionDraft, setSessionDraft] = useState<ParsedEventDraft | null>(null);
  const [userStyle, setUserStyle] = useState<InviteStyleConfig | null>(null);

  const deviceProfile = useSyncExternalStore(
    subscribeDeviceProfile,
    getDeviceProfile,
    getDeviceProfileServerSnapshot,
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const consumed = consumeStudioDraft();
      if (consumed) {
        setSessionDraft(consumed);
      }
    });
    return () => {
      active = false;
    };
  }, []);

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
    () => resolveThemeCssVars(liveStyle) as React.CSSProperties,
    [liveStyle],
  );

  return (
    <div
      style={{
        ...themeVars,
        backgroundColor: 'var(--theme-page-bg)',
        color: 'var(--theme-text-primary)',
        fontFamily: 'var(--font-invite-body), var(--font-sans), sans-serif',
      }}
      className="min-h-screen relative overflow-x-hidden transition-colors duration-300"
    >
      <AmbientBackdrop effectId={liveStyle.effectId} />

      {/* Minimal 48px single-row header */}
      <header className="relative z-10 h-12 max-w-[480px] lg:max-w-[920px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight hover:opacity-80 transition shrink-0"
          style={{ color: 'var(--theme-text-primary)' }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
          <span>invited</span>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setRecentOpen(true)}
            className="h-8 inline-flex items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition hover:opacity-90 cursor-pointer"
            style={{
              backgroundColor: 'var(--theme-glass-bg)',
              borderColor: 'var(--theme-hairline)',
              color: 'var(--theme-text-primary)',
            }}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>My Invites</span>
          </button>

          {deviceProfile?.name ? (
            <GuestAvatar name={deviceProfile.name} size="sm" className="shrink-0" />
          ) : null}
        </div>
      </header>

      <main className="relative z-10 max-w-[480px] lg:max-w-[920px] mx-auto px-4 lg:px-8 pt-2 sm:pt-4 pb-16">
        <InviteStudio
          key={studioKey}
          mode="create"
          initialDraft={activeDraft}
          onStyleChange={setUserStyle}
        />
      </main>

      <RecentEventsDialog open={recentOpen} onClose={() => setRecentOpen(false)} />
    </div>
  );
}
