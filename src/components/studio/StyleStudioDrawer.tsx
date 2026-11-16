'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Check, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { CoverArt } from '@/components/covers/CoverArt';
import { InviteIcon } from '@/components/icons/InviteIcons';
import { setupDialogLightDismiss } from '@/lib/polyfills/ui';
import {
  COVER_PRESETS,
  CTA_PRESETS,
  EFFECT_OPTIONS,
  FONT_PAIRINGS,
  THEME_PRESETS,
  getThemePreset,
  type CoverStyleGroup,
  type EffectCategory,
  type ThemePreset,
} from '@/lib/themes/presets';
import type { CoverLayout, CtaStyleMode, InviteStyleConfig } from '@/types/invite';

export type StudioDrawerTab = 'theme' | 'cover' | 'backdrop' | 'style';

interface StyleStudioDrawerProps {
  open: boolean;
  initialTab?: StudioDrawerTab;
  onClose: () => void;
  style: InviteStyleConfig;
  onChange: (next: InviteStyleConfig) => void;
  eventId?: string;
  editKey?: string;
}

const SURFACE_SWATCHES = [
  '#ffffff',
  '#faf7f2',
  '#0c316e',
  '#0f172a',
  '#1a1423',
  '#14211b',
];

const THEME_CATEGORY_TABS: Array<{
  id: 'all' | ThemePreset['category'];
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'holiday', label: 'Holidays' },
  { id: 'milestone', label: 'Celebrations' },
  { id: 'ambient', label: 'Evening' },
  { id: 'editorial', label: 'Classic' },
];

const COVER_STYLE_FILTERS: Array<{
  id: 'all' | CoverStyleGroup;
  label: string;
  icon?: 'illustrated' | 'graphic' | 'pencil' | 'painted' | 'pattern';
}> = [
  { id: 'all', label: 'All' },
  { id: 'hand-drawn', label: 'Hand-drawn', icon: 'illustrated' },
  { id: 'vector', label: 'Minimal vector', icon: 'graphic' },
  { id: 'pencil', label: 'Pencil', icon: 'pencil' },
  { id: 'oil-paint', label: 'Oil & paint', icon: 'painted' },
  { id: 'pattern', label: 'Patterns', icon: 'pattern' },
];

const EFFECT_GROUPS: Array<{ id: EffectCategory; label: string }> = [
  { id: 'gradient', label: 'Color waves' },
  { id: 'weather', label: 'Weather' },
  { id: 'lights', label: 'Lights & glow' },
  { id: 'particles', label: 'Celebration' },
  { id: 'still', label: 'Still' },
];

function toCssFontVar(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'inherit';
  return trimmed.startsWith('var(') || !trimmed.startsWith('--')
    ? trimmed
    : `var(${trimmed})`;
}

export function StyleStudioDrawer({
  open,
  initialTab = 'theme',
  onClose,
  style,
  onChange,
  eventId,
  editKey,
}: StyleStudioDrawerProps) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<StudioDrawerTab>(initialTab);
  const [themeCategory, setThemeCategory] = useState<'all' | ThemePreset['category']>('all');
  const [coverStyleFilter, setCoverStyleFilter] = useState<'all' | CoverStyleGroup>('all');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => setTab(initialTab));
    }
  }, [open, initialTab]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const cleanupDismiss = setupDialogLightDismiss(dialog);
    const handleNativeClose = () => {
      onClose();
    };
    dialog.addEventListener('close', handleNativeClose);
    return () => {
      cleanupDismiss();
      dialog.removeEventListener('close', handleNativeClose);
    };
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [open]);

  const activePreset = getThemePreset(style.themeId);
  const filteredThemes =
    themeCategory === 'all'
      ? THEME_PRESETS
      : THEME_PRESETS.filter((t) => t.category === themeCategory);

  const filteredCovers =
    coverStyleFilter === 'all'
      ? COVER_PRESETS
      : COVER_PRESETS.filter((c) => c.styleGroup === coverStyleFilter);

  const applyThemePreset = (preset: ThemePreset) => {
    onChange({
      ...style,
      themeId: preset.id,
      fontId: preset.defaultFontId,
      effectId: preset.defaultEffectId,
      coverPresetId: style.customCoverUrl ? style.coverPresetId : preset.defaultCoverPresetId,
      coverLayout: style.coverLayout === 'none' ? 'banner' : style.coverLayout,
      colorMode: preset.colorMode,
      customAccentHex: undefined,
      customCtaEndHex: undefined,
      ctaStyle: undefined,
      customSurfaceHex: undefined,
    });
  };

  const handleCoverUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose a PNG, JPEG, WebP, or GIF image.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setUploadError('Image must be 4 MB or smaller.');
      return;
    }

    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const headers: Record<string, string> = {};
      if (editKey) headers['x-edit-key'] = editKey;

      let res = await fetch('/api/uploads/cover', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (res.status === 404 && eventId && editKey) {
        const retryForm = new FormData();
        retryForm.append('file', file);
        res = await fetch(`/api/events/${encodeURIComponent(eventId)}/cover`, {
          method: 'POST',
          headers: { 'x-edit-key': editKey },
          body: retryForm,
        });
      }

      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        customCoverUrl?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Could not upload photo.');
      }

      const uploadedUrl = data.url || data.customCoverUrl;
      if (!uploadedUrl) {
        throw new Error('Could not finish upload.');
      }

      onChange({
        ...style,
        customCoverUrl: uploadedUrl,
        coverLayout: style.coverLayout === 'none' ? 'banner' : style.coverLayout,
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const ctaMode: CtaStyleMode = style.ctaStyle ?? 'gradient';
  const currentCtaStart = style.customAccentHex || activePreset.ctaStart;
  const currentCtaEnd = style.customCtaEndHex || activePreset.ctaEnd;
  const currentSurface = style.customSurfaceHex || activePreset.surfaceBg;
  const currentColorMode = style.colorMode || activePreset.colorMode;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={headingId}
      data-testid="theme-studio-dialog"
      className="w-full sm:w-[min(94vw,540px)] max-h-[86dvh] mx-auto mt-auto mb-0 sm:my-auto rounded-t-3xl sm:rounded-3xl border shadow-2xl p-0 overflow-hidden backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      style={{
        backgroundColor: 'var(--theme-card-solid, #121a2e)',
        borderColor: 'var(--theme-border, rgba(255,255,255,0.16))',
        color: 'var(--theme-text-primary, #f8fafc)',
      }}
    >
      <div className="flex flex-col max-h-[86dvh]">
        {/* Header + 4-Tab Switcher */}
        <div
          className="shrink-0 border-b px-5 pt-4 pb-3 space-y-3"
          style={{ borderColor: 'var(--theme-hairline, rgba(255,255,255,0.12))' }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id={headingId}
              className="text-lg font-bold tracking-tight"
              style={{
                fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
              }}
            >
              Customize look
            </h2>

            <button
              type="button"
              onClick={onClose}
              aria-label="Done editing theme"
              className="h-9 w-9 rounded-full border inline-flex items-center justify-center opacity-80 hover:opacity-100 cursor-pointer"
              style={{
                borderColor: 'var(--theme-hairline, rgba(255,255,255,0.16))',
                color: 'var(--theme-text-primary, #f8fafc)',
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div
            role="tablist"
            aria-label="Theme options"
            className="grid grid-cols-4 rounded-2xl border p-1 gap-1"
            style={{
              backgroundColor: 'var(--theme-surface-bg, rgba(255,255,255,0.06))',
              borderColor: 'var(--theme-hairline, rgba(255,255,255,0.12))',
            }}
          >
            {(
              [
                { id: 'theme', label: 'Theme' },
                { id: 'cover', label: 'Cover' },
                { id: 'backdrop', label: 'Backdrop' },
                { id: 'style', label: 'Style' },
              ] as const
            ).map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  role="tab"
                  type="button"
                  data-testid={`studio-tab-${item.id}`}
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`rounded-xl py-2 px-1 text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    active ? 'invite-cta-btn shadow-sm font-semibold' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Sheet Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {tab === 'theme' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5" role="group" aria-label="Theme categories">
                {THEME_CATEGORY_TABS.map((cat) => {
                  const active = themeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setThemeCategory(cat.id)}
                      className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition cursor-pointer whitespace-nowrap"
                      style={
                        active
                          ? {
                              backgroundColor: 'var(--theme-accent)',
                              borderColor: 'var(--theme-accent)',
                              color: 'var(--theme-on-accent)',
                            }
                          : {
                              backgroundColor: 'var(--theme-surface-bg)',
                              borderColor: 'var(--theme-hairline)',
                              color: 'var(--theme-text-muted)',
                            }
                      }
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {filteredThemes.map((preset) => {
                  const isSelected = style.themeId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => applyThemePreset(preset)}
                      className="flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition cursor-pointer min-w-0"
                      style={{
                        backgroundColor: isSelected ? 'var(--theme-surface-bg)' : 'transparent',
                        borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-hairline)',
                      }}
                    >
                      <span
                        className="h-8 w-8 shrink-0 rounded-xl border flex items-center justify-center text-white"
                        style={{
                          background: `linear-gradient(135deg, ${preset.pageBg} 0%, ${preset.ctaStart} 100%)`,
                          borderColor: 'var(--theme-hairline)',
                        }}
                      >
                        <InviteIcon name={preset.icon} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block text-xs font-semibold truncate"
                          style={{ color: 'var(--theme-text-primary)' }}
                        >
                          {preset.name}
                        </span>
                      </span>
                      {isSelected ? (
                        <Check
                          className="h-4 w-4 shrink-0"
                          style={{ color: 'var(--theme-accent)' }}
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {tab === 'cover' ? (
            <div className="space-y-4">
              {/* Multi-Medium Horizontal Chip Strip */}
              <div
                role="group"
                aria-label="Cover art style"
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
              >
                {COVER_STYLE_FILTERS.map((filter) => {
                  const active = coverStyleFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      data-testid={`cover-style-filter-${filter.id}`}
                      aria-pressed={active}
                      onClick={() => setCoverStyleFilter(filter.id)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition cursor-pointer whitespace-nowrap"
                      style={
                        active
                          ? {
                              backgroundColor: 'var(--theme-accent)',
                              borderColor: 'var(--theme-accent)',
                              color: 'var(--theme-on-accent)',
                            }
                          : {
                              backgroundColor: 'var(--theme-surface-bg)',
                              borderColor: 'var(--theme-hairline)',
                              color: 'var(--theme-text-muted)',
                            }
                      }
                    >
                      {filter.icon ? (
                        <InviteIcon name={filter.icon} className="h-3.5 w-3.5 shrink-0" />
                      ) : null}
                      <span>{filter.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Photo Upload & Cover Shape Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    id="custom-cover-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => void handleCoverUpload(e)}
                    className="sr-only"
                  />
                  <label
                    htmlFor="custom-cover-upload"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed px-3.5 py-2 text-xs font-medium transition hover:opacity-90"
                    style={{
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text-primary)',
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
                    <span>{uploadingCover ? 'Uploading...' : 'Upload photo'}</span>
                  </label>

                  {style.customCoverUrl ? (
                    <button
                      type="button"
                      onClick={() => onChange({ ...style, customCoverUrl: undefined })}
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-medium text-rose-500 hover:opacity-80 cursor-pointer"
                      style={{ borderColor: 'var(--theme-hairline)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  ) : null}
                </div>

                <div
                  className="inline-flex items-center rounded-xl border p-0.5"
                  style={{ borderColor: 'var(--theme-hairline)' }}
                >
                  {(
                    [
                      { value: 'banner', label: 'Wide' },
                      { value: 'square', label: 'Square' },
                      { value: 'none', label: 'None' },
                    ] as Array<{ value: CoverLayout; label: string }>
                  ).map((option) => {
                    const selected = style.coverLayout === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChange({ ...style, coverLayout: option.value })}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition cursor-pointer"
                        style={
                          selected
                            ? {
                                backgroundColor: 'var(--theme-accent)',
                                color: 'var(--theme-on-accent)',
                              }
                            : { color: 'var(--theme-text-muted)' }
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {uploadError ? (
                <p className="text-xs text-rose-500" role="alert">
                  {uploadError}
                </p>
              ) : null}

              {/* Cover Thumbnail Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredCovers.map((cover) => {
                  const isSelected = !style.customCoverUrl && style.coverPresetId === cover.id;
                  return (
                    <button
                      key={cover.id}
                      type="button"
                      data-cover-style-group={cover.styleGroup}
                      aria-pressed={isSelected}
                      onClick={() =>
                        onChange({
                          ...style,
                          coverPresetId: cover.id,
                          customCoverUrl: undefined,
                          coverLayout: style.coverLayout === 'none' ? 'banner' : style.coverLayout,
                        })
                      }
                      className="rounded-2xl border p-1.5 text-left transition cursor-pointer min-w-0 space-y-1.5"
                      style={{
                        backgroundColor: isSelected ? 'var(--theme-surface-bg)' : 'transparent',
                        borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-hairline)',
                        color: 'var(--theme-text-primary)',
                      }}
                    >
                      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl">
                        {cover.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={cover.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <CoverArt
                            flushTop
                            coverPresetId={cover.id}
                            layout="banner"
                            accentColor={activePreset.accent}
                            className="h-full w-full"
                          />
                        )}
                      </div>
                      <p className="text-[11px] font-medium truncate px-0.5">{cover.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {tab === 'backdrop' ? (
            <div className="space-y-4">
              {EFFECT_GROUPS.map((group) => {
                const items = EFFECT_OPTIONS.filter((item) => item.category === group.id);
                if (items.length === 0) return null;
                return (
                  <section key={group.id} className="space-y-2">
                    <span
                      className="block text-xs font-semibold"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      {group.label}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((effect) => {
                        const isSelected = style.effectId === effect.id;
                        return (
                          <button
                            key={effect.id}
                            type="button"
                            data-effect-option={effect.id}
                            aria-pressed={isSelected}
                            onClick={() => onChange({ ...style, effectId: effect.id })}
                            className="flex items-start gap-2.5 rounded-2xl border p-2.5 text-left transition cursor-pointer min-w-0"
                            style={{
                              backgroundColor: isSelected ? 'var(--theme-surface-bg)' : 'transparent',
                              borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-hairline)',
                            }}
                          >
                            <span
                              className="h-7 w-7 shrink-0 rounded-xl flex items-center justify-center mt-0.5"
                              style={
                                isSelected
                                  ? {
                                      backgroundColor: 'var(--theme-accent)',
                                      color: 'var(--theme-on-accent)',
                                    }
                                  : {
                                      backgroundColor: 'var(--theme-surface-bg)',
                                      color: 'var(--theme-text-primary)',
                                    }
                              }
                            >
                              <InviteIcon name={effect.icon} className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold truncate">
                                {effect.name}
                              </span>
                              <span
                                className="block text-[11px] leading-snug line-clamp-2 mt-0.5"
                                style={{ color: 'var(--theme-text-muted)' }}
                              >
                                {effect.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}

          {tab === 'style' ? (
            <div className="space-y-4">
              {/* Button Color / Gradient */}
              <section
                className="rounded-2xl border p-3.5 space-y-3"
                style={{
                  backgroundColor: 'var(--theme-surface-bg)',
                  borderColor: 'var(--theme-hairline)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">Button color</span>

                  <div className="flex items-center gap-2">
                    <div
                      className="inline-flex items-center rounded-xl border p-0.5"
                      style={{ borderColor: 'var(--theme-hairline)' }}
                    >
                      {(['gradient', 'solid'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={ctaMode === mode}
                          onClick={() =>
                            onChange({
                              ...style,
                              ctaStyle: mode,
                              customAccentHex: style.customAccentHex || activePreset.ctaStart,
                              customCtaEndHex:
                                mode === 'gradient'
                                  ? style.customCtaEndHex || activePreset.ctaEnd
                                  : undefined,
                            })
                          }
                          className="rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition cursor-pointer"
                          style={
                            ctaMode === mode
                              ? {
                                  backgroundColor: 'var(--theme-accent)',
                                  color: 'var(--theme-on-accent)',
                                }
                              : { color: 'var(--theme-text-muted)' }
                          }
                        >
                          {mode}
                        </button>
                      ))}
                    </div>

                    {style.customAccentHex || style.customCtaEndHex || style.ctaStyle ? (
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...style,
                            customAccentHex: undefined,
                            customCtaEndHex: undefined,
                            ctaStyle: undefined,
                          })
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-medium opacity-75 hover:opacity-100 cursor-pointer"
                        style={{ color: 'var(--theme-text-muted)' }}
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        <span>Match theme</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {CTA_PRESETS.map((swatch) => {
                    const selected =
                      currentCtaStart.toLowerCase() === swatch.startHex.toLowerCase() &&
                      (swatch.mode === 'solid'
                        ? ctaMode === 'solid'
                        : currentCtaEnd.toLowerCase() === swatch.endHex.toLowerCase());
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        aria-label={`Set button color ${swatch.name}`}
                        aria-pressed={selected}
                        title={swatch.name}
                        onClick={() =>
                          onChange({
                            ...style,
                            ctaStyle: swatch.mode,
                            customAccentHex: swatch.startHex,
                            customCtaEndHex: swatch.endHex,
                          })
                        }
                        className={`h-7 w-7 rounded-full border-2 transition cursor-pointer ${
                          selected
                            ? 'scale-110 ring-2 ring-offset-1 ring-sky-400 border-white'
                            : 'border-black/15'
                        }`}
                        style={{
                          background:
                            swatch.mode === 'solid'
                              ? swatch.startHex
                              : `linear-gradient(135deg, ${swatch.startHex} 0%, ${swatch.endHex} 100%)`,
                        }}
                      />
                    );
                  })}

                  <label className="inline-flex items-center gap-1.5 text-[11px] font-medium pl-1 cursor-pointer">
                    <span style={{ color: 'var(--theme-text-muted)' }}>
                      {ctaMode === 'solid' ? 'Color' : 'From'}
                    </span>
                    <input
                      aria-label="Button primary color"
                      type="color"
                      value={currentCtaStart}
                      onChange={(e) =>
                        onChange({
                          ...style,
                          ctaStyle: ctaMode,
                          customAccentHex: e.target.value,
                        })
                      }
                      className="h-7 w-8 cursor-pointer rounded border bg-transparent"
                    />
                  </label>

                  {ctaMode === 'gradient' ? (
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-medium cursor-pointer">
                      <span style={{ color: 'var(--theme-text-muted)' }}>To</span>
                      <input
                        aria-label="Button second color"
                        type="color"
                        value={currentCtaEnd}
                        onChange={(e) =>
                          onChange({
                            ...style,
                            ctaStyle: 'gradient',
                            customAccentHex: currentCtaStart,
                            customCtaEndHex: e.target.value,
                          })
                        }
                        className="h-7 w-8 cursor-pointer rounded border bg-transparent"
                      />
                    </label>
                  ) : null}
                </div>
              </section>

              {/* Font */}
              <section className="space-y-2">
                <span
                  className="block text-xs font-semibold"
                  style={{ color: 'var(--theme-text-primary)' }}
                >
                  Lettering style
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {FONT_PAIRINGS.map((font) => {
                    const isSelected = style.fontId === font.id;
                    return (
                      <button
                        key={font.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onChange({ ...style, fontId: font.id })}
                        className="rounded-2xl border p-2.5 text-left transition cursor-pointer"
                        style={{
                          backgroundColor: isSelected ? 'var(--theme-surface-bg)' : 'transparent',
                          borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-hairline)',
                        }}
                      >
                        <p
                          style={{ fontFamily: toCssFontVar(font.headingVar) }}
                          className="text-sm font-semibold truncate"
                        >
                          {font.name}
                        </p>
                        <p
                          style={{
                            fontFamily: toCssFontVar(font.bodyVar),
                            color: 'var(--theme-text-muted)',
                          }}
                          className="text-[11px] truncate"
                        >
                          {font.sample}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Card Tone */}
              <section
                className="rounded-2xl border p-3.5 space-y-2.5"
                style={{
                  backgroundColor: 'var(--theme-surface-bg)',
                  borderColor: 'var(--theme-hairline)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold">Card look</span>

                  <div className="flex items-center gap-2">
                    <div
                      className="inline-flex items-center gap-0.5 rounded-xl border p-0.5"
                      style={{ borderColor: 'var(--theme-hairline)' }}
                    >
                      {(['light', 'dark'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={currentColorMode === mode}
                          onClick={() => onChange({ ...style, colorMode: mode })}
                          className="rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition cursor-pointer"
                          style={
                            currentColorMode === mode
                              ? {
                                  backgroundColor: 'var(--theme-accent)',
                                  color: 'var(--theme-on-accent)',
                                }
                              : { color: 'var(--theme-text-muted)' }
                          }
                        >
                          {mode}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...style,
                          customSurfaceHex: undefined,
                          colorMode: activePreset.colorMode,
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-medium opacity-75 hover:opacity-100 cursor-pointer"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {SURFACE_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Set card color ${hex}`}
                      onClick={() => onChange({ ...style, customSurfaceHex: hex })}
                      className={`h-7 w-7 rounded-full border-2 transition cursor-pointer ${
                        currentSurface.toLowerCase() === hex.toLowerCase()
                          ? 'scale-110 ring-2 ring-sky-400 border-white'
                          : 'border-black/20'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <input
                    id="custom-surface-color"
                    aria-label="Custom card color"
                    type="color"
                    value={currentSurface}
                    onChange={(e) => onChange({ ...style, customSurfaceHex: e.target.value })}
                    className="h-7 w-8 cursor-pointer rounded border bg-transparent"
                  />
                </div>
              </section>
            </div>
          ) : null}
        </div>

        {/* Bottom Sticky Done Bar */}
        <div
          className="shrink-0 border-t px-5 py-3 flex justify-end"
          style={{ borderColor: 'var(--theme-hairline, rgba(255,255,255,0.12))' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="invite-cta-btn rounded-full px-6 py-2.5 text-sm font-semibold shadow-md transition hover:opacity-95 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
