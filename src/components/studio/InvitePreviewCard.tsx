'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import {
  Check,
  EyeOff,
  MapPin,
  Sparkles,
  User,
  Users,
  Video,
  X,
} from 'lucide-react';
import { CoverArt } from '@/components/covers/CoverArt';
import { AmbientBackdrop } from '@/components/effects/AmbientBackdrop';
import { SafePreviewHtml } from '@/components/editor/SafePreviewHtml';
import {
  CalendarDateTile,
  formatDistinctLocation,
} from '@/components/invite/CalendarDateTile';
import { formatEventDateTime } from '@/lib/polyfills/temporal';
import {
  getThemePreset,
  resolveThemeCssVars,
} from '@/lib/themes/presets';
import type { InviteStyleConfig } from '@/types/invite';

interface InvitePreviewCardProps {
  title: string;
  descriptionHtml: string;
  startIso?: string;
  endIso?: string;
  timeZone: string;
  locationName?: string;
  locationAddress?: string;
  virtualUrl?: string;
  hostName?: string;
  rsvpNotePrompt?: string;
  invitedCount: number;
  hideGuestList: boolean;
  style: InviteStyleConfig;
}

export function InvitePreviewCard({
  title,
  descriptionHtml,
  startIso,
  endIso,
  timeZone,
  locationName,
  locationAddress,
  virtualUrl,
  hostName,
  rsvpNotePrompt,
  invitedCount,
  hideGuestList,
  style,
}: InvitePreviewCardProps) {
  const [formattedDate, setFormattedDate] = useState<{
    key: string;
    dateLabel: string;
    timeLabel: string;
  } | null>(null);
  const [previewRsvp, setPreviewRsvp] = useState<'yes' | 'no'>('yes');

  const preset = getThemePreset(style.themeId);
  const themeVars = resolveThemeCssVars(style);
  const accentColor = style.customAccentHex || preset.accent;
  const colorMode = style.colorMode || preset.colorMode;

  const formatKey = startIso ? `${startIso}|${endIso ?? ''}|${timeZone}` : '';

  useEffect(() => {
    if (!startIso) return;
    let cancelled = false;
    void formatEventDateTime(startIso, endIso, timeZone).then((formatted) => {
      if (!cancelled) {
        setFormattedDate({
          key: formatKey,
          dateLabel: formatted.dateLabel,
          timeLabel: formatted.timeLabel,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [startIso, endIso, timeZone, formatKey]);

  const dateLabel = !startIso
    ? 'Choose a date & time'
    : formattedDate?.key === formatKey
      ? formattedDate.dateLabel
      : 'Date & time TBD';
  const timeLabel =
    startIso && formattedDate?.key === formatKey ? formattedDate.timeLabel : '';

  const displayTitle = title.trim() || 'Your Event Title';
  const { primaryLocation, secondaryAddress } = formatDistinctLocation(
    locationName,
    locationAddress,
  );
  const isBanner = style.coverLayout === 'banner';
  const isSquare = style.coverLayout === 'square';
  const isLight = colorMode === 'light';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
          <Sparkles className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
          <span>Live Guest Preview</span>
        </div>
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
          {preset.emoji} {preset.name}
        </span>
      </div>

      <div
        style={{
          ...(themeVars as CSSProperties),
          backgroundColor: 'var(--theme-page-bg)',
          color: 'var(--theme-text-primary)',
          fontFamily: 'var(--theme-font-body)',
        }}
        className="relative overflow-hidden rounded-3xl border border-white/15 shadow-[0_24px_70px_-15px_rgba(0,0,0,0.7)]"
      >
        <div className="absolute inset-0 pointer-events-none">
          <AmbientBackdrop
            effectId={style.effectId}
            accentColor={accentColor}
            colorMode={colorMode}
          />
        </div>

        <div className="relative z-10 p-4 sm:p-5">
          <article
            style={{
              backgroundColor: 'var(--theme-card-bg)',
              borderColor: 'var(--theme-border)',
            }}
            className="invite-card overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl"
          >
            {isBanner ? (
              <div className="w-full aspect-video overflow-hidden border-b border-[color:var(--theme-border)]">
                <CoverArt
                  coverPresetId={style.coverPresetId}
                  customCoverUrl={style.customCoverUrl}
                  layout="banner"
                  title={displayTitle}
                  accentColor={accentColor}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            <div className="p-5 sm:p-6 space-y-5">
              <div
                className={
                  isSquare
                    ? 'flex flex-col sm:flex-row sm:items-center gap-4'
                    : 'space-y-3'
                }
              >
                {isSquare ? (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 overflow-hidden rounded-2xl border border-[color:var(--theme-border)] shadow-md">
                    <CoverArt
                      coverPresetId={style.coverPresetId}
                      customCoverUrl={style.customCoverUrl}
                      layout="square"
                      title={displayTitle}
                      accentColor={accentColor}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}

                <div className="min-w-0 flex-1 space-y-2">
                  {hostName?.trim() ? (
                    <span
                      style={{
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text-muted)',
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                    >
                      <User className="h-3 w-3" aria-hidden="true" />
                      Hosted by {hostName.trim()}
                    </span>
                  ) : null}

                  <h2
                    style={{
                      fontFamily: 'var(--theme-font-heading)',
                      color: 'var(--theme-text-primary)',
                    }}
                    className="text-2xl sm:text-3xl font-semibold leading-tight tracking-tight [text-wrap:balance]"
                  >
                    {displayTitle}
                  </h2>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--theme-surface-bg)',
                  borderColor: 'var(--theme-border)',
                }}
                className="rounded-xl border p-3.5 space-y-2.5 text-sm"
              >
                <div className="flex items-start gap-2.5">
                  <CalendarDateTile
                    startIso={startIso}
                    timeZone={timeZone}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{dateLabel}</p>
                    {timeLabel ? (
                      <p
                        style={{ color: 'var(--theme-text-muted)' }}
                        className="text-xs mt-0.5"
                      >
                        {timeLabel}
                      </p>
                    ) : null}
                  </div>
                </div>

                {primaryLocation ? (
                  <div className="flex items-start gap-2.5">
                    <MapPin
                      className="h-4 w-4 mt-0.5 shrink-0"
                      style={{ color: 'var(--theme-accent)' }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">
                        {primaryLocation}
                      </p>
                      {secondaryAddress ? (
                        <p
                          style={{ color: 'var(--theme-text-muted)' }}
                          className="text-xs mt-0.5"
                        >
                          {secondaryAddress}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {virtualUrl?.trim() ? (
                  <div className="flex items-center gap-2.5">
                    <Video
                      className="h-4 w-4 shrink-0"
                      style={{ color: 'var(--theme-accent)' }}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium truncate">
                      Virtual join link attached
                    </span>
                  </div>
                ) : null}
              </div>

              <SafePreviewHtml
                html={descriptionHtml}
                emptyFallback="Your invitation details will appear here with crisp editorial spacing."
                className="text-sm leading-relaxed"
              />

              <div
                style={{
                  borderColor: 'var(--theme-border)',
                  backgroundColor: 'var(--theme-surface-bg)',
                }}
                className="rounded-xl border p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    RSVP Preview
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    {hideGuestList ? (
                      <span
                        style={{ color: 'var(--theme-text-muted)' }}
                        className="inline-flex items-center gap-1"
                      >
                        <EyeOff className="h-3 w-3" aria-hidden="true" />
                        Private list
                      </span>
                    ) : invitedCount > 0 ? (
                      <span
                        style={{ color: 'var(--theme-text-muted)' }}
                        className="inline-flex items-center gap-1"
                      >
                        <Users className="h-3 w-3" aria-hidden="true" />
                        {invitedCount} invited
                      </span>
                    ) : null}
                  </div>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Preview RSVP response options"
                  className="grid grid-cols-2 gap-2"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={previewRsvp === 'yes'}
                    onClick={() => setPreviewRsvp('yes')}
                    style={
                      previewRsvp === 'yes'
                        ? {
                            backgroundColor: 'var(--theme-accent)',
                            borderColor: 'var(--theme-accent)',
                          }
                        : {
                            borderColor: 'var(--theme-border)',
                          }
                    }
                    className={`invite-pill inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs sm:text-sm font-semibold transition min-h-[48px] ${
                      previewRsvp === 'yes'
                        ? 'invite-on-accent shadow-sm'
                        : isLight
                          ? 'bg-black/[0.03] hover:bg-black/[0.06]'
                          : 'bg-white/[0.04] hover:bg-white/[0.08]'
                    }`}
                  >
                    <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Yes, I&apos;m coming</span>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={previewRsvp === 'no'}
                    onClick={() => setPreviewRsvp('no')}
                    style={{
                      borderColor:
                        previewRsvp === 'no'
                          ? 'var(--theme-text-primary)'
                          : 'var(--theme-border)',
                    }}
                    className={`invite-pill inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs sm:text-sm font-semibold transition min-h-[48px] ${
                      previewRsvp === 'no'
                        ? isLight
                          ? 'bg-slate-900 text-white'
                          : 'bg-white/15 text-white'
                        : isLight
                          ? 'bg-black/[0.03] hover:bg-black/[0.06]'
                          : 'bg-white/[0.04] hover:bg-white/[0.08]'
                    }`}
                  >
                    <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>No, can&apos;t make it</span>
                  </button>
                </div>

                {rsvpNotePrompt?.trim() ? (
                  <p
                    style={{
                      color: 'var(--theme-text-muted)',
                      borderColor: 'var(--theme-border)',
                    }}
                    className="rounded-lg border border-dashed px-3 py-2 text-xs"
                  >
                    Guest note prompt: &ldquo;{rsvpNotePrompt.trim()}&rdquo;
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
