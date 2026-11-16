'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  Palette,
  RefreshCw,
  Sliders,
  Sparkles,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { CoverArt } from '@/components/covers/CoverArt';
import {
  COVER_PRESETS,
  CTA_PRESETS,
  EFFECT_OPTIONS,
  FONT_PAIRINGS,
  THEME_PRESETS,
  getThemePreset,
  type ThemePreset,
} from '@/lib/themes/presets';
import type { CoverLayout, CtaStyleMode, InviteStyleConfig } from '@/types/invite';

interface StyleStudioDrawerProps {
  style: InviteStyleConfig;
  onChange: (next: InviteStyleConfig) => void;
  eventId?: string;
  editKey?: string;
  section?: 'themes' | 'customize' | 'covers' | 'all';
}

const SURFACE_SWATCHES = [
  '#ffffff',
  '#faf7f2',
  '#0c316e',
  '#0f172a',
  '#1a1423',
  '#14211b',
];

const CATEGORY_TABS: Array<{
  id: 'all' | ThemePreset['category'];
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'holiday', label: 'Holidays' },
  { id: 'milestone', label: 'Milestones' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'editorial', label: 'Editorial' },
];

function toCssFontVar(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'inherit';
  return trimmed.startsWith('var(') || !trimmed.startsWith('--')
    ? trimmed
    : `var(${trimmed})`;
}

export function StyleStudioDrawer({
  style,
  onChange,
  eventId,
  editKey,
  section = 'all',
}: StyleStudioDrawerProps) {
  const [themeCategory, setThemeCategory] = useState<'all' | ThemePreset['category']>('all');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePreset = getThemePreset(style.themeId);
  const activeFont = FONT_PAIRINGS.find((f) => f.id === style.fontId) ?? FONT_PAIRINGS[0];
  const activeEffect = EFFECT_OPTIONS.find((e) => e.id === style.effectId) ?? EFFECT_OPTIONS[0];
  const activeCover = COVER_PRESETS.find((c) => c.id === style.coverPresetId) ?? COVER_PRESETS[0];

  const filteredThemes =
    themeCategory === 'all'
      ? THEME_PRESETS
      : THEME_PRESETS.filter((t) => t.category === themeCategory);

  const applyThemePreset = (preset: ThemePreset) => {
    onChange({
      ...style,
      themeId: preset.id,
      fontId: preset.defaultFontId,
      effectId: preset.defaultEffectId,
      coverPresetId: preset.defaultCoverPresetId,
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
      setUploadError('Cover image must be 4 MB or smaller.');
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
        throw new Error(data.error || 'Could not upload cover image.');
      }

      const uploadedUrl = data.url || data.customCoverUrl;
      if (!uploadedUrl) {
        throw new Error('Upload succeeded without an image URL.');
      }

      onChange({
        ...style,
        customCoverUrl: uploadedUrl,
        coverLayout: style.coverLayout === 'none' ? 'banner' : style.coverLayout,
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Cover photo upload failed.');
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

  const showCovers = section === 'all' || section === 'covers';
  const showThemes = section === 'all' || section === 'themes' || section === 'customize';
  const showCustomize = section === 'all' || section === 'customize';

  return (
    <div
      className="space-y-3"
      style={{ color: 'var(--theme-text-primary)' }}
    >
      {showCovers ? (
        <div
          className="rounded-2xl border p-3.5 space-y-3"
          style={{
            backgroundColor: 'var(--theme-surface-bg)',
            borderColor: 'var(--theme-hairline)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
              Cover Art · {style.customCoverUrl ? 'Custom Photo' : activeCover.name}
            </span>
            {style.customCoverUrl ? (
              <button
                type="button"
                onClick={() => onChange({ ...style, customCoverUrl: undefined })}
                className="inline-flex items-center gap-1 text-xs font-medium text-rose-500 hover:opacity-80 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                Remove photo
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed px-3 py-1.5 text-xs font-medium transition hover:opacity-90"
              style={{
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            >
              <Upload className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
              <span>{uploadingCover ? 'Uploading...' : 'Upload your own photo'}</span>
            </label>

            {style.customCoverUrl ? (
              <div
                className="h-8 w-12 overflow-hidden rounded-lg border"
                style={{ borderColor: 'var(--theme-hairline)' }}
              >
                <CoverArt
                  coverPresetId={style.coverPresetId}
                  customCoverUrl={style.customCoverUrl}
                  layout="banner"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
          </div>

          {uploadError ? (
            <p className="text-xs text-rose-500" role="alert">
              {uploadError}
            </p>
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-0.5">
            {COVER_PRESETS.map((cover) => {
              const isSelected = !style.customCoverUrl && style.coverPresetId === cover.id;
              return (
                <button
                  key={cover.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() =>
                    onChange({
                      ...style,
                      coverPresetId: cover.id,
                      customCoverUrl: undefined,
                      coverLayout: style.coverLayout === 'none' ? 'banner' : style.coverLayout,
                    })
                  }
                  className="rounded-xl border p-1.5 text-left transition cursor-pointer min-w-0 space-y-1"
                  style={{
                    backgroundColor: isSelected ? 'var(--theme-card-bg)' : 'transparent',
                    borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-hairline)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  {cover.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={cover.imageUrl}
                      alt=""
                      className="h-12 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="h-12 w-full rounded-lg flex items-center justify-center text-lg"
                      style={{ backgroundColor: 'var(--theme-glass-bg)' }}
                    >
                      {cover.emoji}
                    </div>
                  )}
                  <p className="text-[11px] font-medium truncate px-0.5">{cover.name}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showCustomize ? (
        <div className="space-y-2.5">
          {/* Custom CTA Button Gradient / Solid Editor */}
          <div
            className="rounded-2xl border p-3.5 space-y-3"
            style={{
              backgroundColor: 'var(--theme-surface-bg)',
              borderColor: 'var(--theme-hairline)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">Custom Button Gradient</span>

              <div className="flex items-center gap-2">
                <div
                  className="inline-flex items-center rounded-lg border p-0.5"
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
                      className="rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition cursor-pointer"
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

                {(style.customAccentHex || style.customCtaEndHex || style.ctaStyle) ? (
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
                    Reset
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
                    aria-label={`Set button style ${swatch.name}`}
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
                      selected ? 'scale-110 ring-2 ring-offset-1 ring-sky-400 border-white' : 'border-black/15'
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
                    aria-label="Button gradient end color"
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
          </div>

          {showThemes ? (
            <details className="group rounded-xl border overflow-hidden" style={{ borderColor: 'var(--theme-hairline)' }}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium">
                <span className="inline-flex items-center gap-2">
                  <Palette className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
                  <span>All 18 Themes</span>
                </span>
                <span className="inline-flex items-center gap-1.5 opacity-75">
                  <span>{activePreset.emoji} {activePreset.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                </span>
              </summary>

              <div className="border-t p-3 space-y-2.5" style={{ borderColor: 'var(--theme-hairline)' }}>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Theme categories">
                  {CATEGORY_TABS.map((tab) => {
                    const active = themeCategory === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setThemeCategory(tab.id)}
                        className="rounded-full border px-2.5 py-1 text-xs font-medium transition cursor-pointer"
                        style={
                          active
                            ? {
                                backgroundColor: 'var(--theme-accent)',
                                borderColor: 'var(--theme-accent)',
                                color: 'var(--theme-on-accent)',
                              }
                            : {
                                backgroundColor: 'transparent',
                                borderColor: 'var(--theme-hairline)',
                                color: 'var(--theme-text-muted)',
                              }
                        }
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {filteredThemes.map((preset) => {
                    const isSelected = style.themeId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => applyThemePreset(preset)}
                        className="flex items-center gap-2 rounded-xl border p-2 text-left transition cursor-pointer min-w-0"
                        style={{
                          backgroundColor: isSelected
                            ? 'var(--theme-surface-bg)'
                            : 'transparent',
                          borderColor: isSelected
                            ? 'var(--theme-accent)'
                            : 'var(--theme-hairline)',
                        }}
                      >
                        <span
                          className="h-6 w-6 shrink-0 rounded-lg border flex items-center justify-center text-xs"
                          style={{
                            background: `linear-gradient(135deg, ${preset.pageBg} 0%, ${preset.ctaStart} 100%)`,
                            borderColor: 'var(--theme-hairline)',
                          }}
                        >
                          {preset.emoji}
                        </span>
                        <span
                          className="text-xs font-medium truncate flex-1"
                          style={{ color: 'var(--theme-text-primary)' }}
                        >
                          {preset.name}
                        </span>
                        {isSelected ? (
                          <Check
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: 'var(--theme-accent)' }}
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>
          ) : null}

          {/* Typography */}
          <details className="group rounded-xl border overflow-hidden" style={{ borderColor: 'var(--theme-hairline)' }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium">
              <span className="inline-flex items-center gap-2">
                <Type className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
                <span>Typography</span>
              </span>
              <span className="inline-flex items-center gap-1.5 opacity-75">
                <span>{activeFont.name}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>

            <div className="border-t p-2.5 grid grid-cols-2 gap-1.5" style={{ borderColor: 'var(--theme-hairline)' }}>
              {FONT_PAIRINGS.map((font) => {
                const isSelected = style.fontId === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onChange({ ...style, fontId: font.id })}
                    className="rounded-xl border p-2 text-left transition cursor-pointer"
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
          </details>

          {/* Ambient Effect */}
          <details className="group rounded-xl border overflow-hidden" style={{ borderColor: 'var(--theme-hairline)' }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
                <span>Ambient Effect</span>
              </span>
              <span className="inline-flex items-center gap-1.5 opacity-75">
                <span>
                  {activeEffect.emoji} {activeEffect.name}
                </span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>

            <div className="border-t p-2.5 grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto" style={{ borderColor: 'var(--theme-hairline)' }}>
              {EFFECT_OPTIONS.map((effect) => {
                const isSelected = style.effectId === effect.id;
                return (
                  <button
                    key={effect.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onChange({ ...style, effectId: effect.id })}
                    className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-xs transition cursor-pointer min-w-0"
                    style={{
                      backgroundColor: isSelected ? 'var(--theme-surface-bg)' : 'transparent',
                      borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-hairline)',
                    }}
                  >
                    <span aria-hidden="true">{effect.emoji}</span>
                    <span className="truncate font-medium">{effect.name}</span>
                  </button>
                );
              })}
            </div>
          </details>

          {/* Cover Frame & Card Surface */}
          <details className="group rounded-xl border overflow-hidden" style={{ borderColor: 'var(--theme-hairline)' }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium">
              <span className="inline-flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
                <span>Card &amp; Cover Layout</span>
              </span>
              <span className="inline-flex items-center gap-1.5 opacity-75">
                <span className="capitalize">{style.coverLayout} · {currentColorMode}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>

            <div className="border-t p-3 space-y-3" style={{ borderColor: 'var(--theme-hairline)' }}>
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                  Cover Aspect
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { value: 'banner', label: 'Banner 2:1' },
                      { value: 'square', label: 'Square 1:1' },
                      { value: 'none', label: 'No Cover' },
                    ] as Array<{ value: CoverLayout; label: string }>
                  ).map((option) => {
                    const selected = style.coverLayout === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChange({ ...style, coverLayout: option.value })}
                        className="rounded-xl border px-2 py-1.5 text-xs font-medium transition cursor-pointer"
                        style={
                          selected
                            ? {
                                backgroundColor: 'var(--theme-accent)',
                                borderColor: 'var(--theme-accent)',
                                color: 'var(--theme-on-accent)',
                              }
                            : {
                                backgroundColor: 'transparent',
                                borderColor: 'var(--theme-hairline)',
                                color: 'var(--theme-text-muted)',
                              }
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="custom-surface-color"
                  className="block text-[11px] font-medium"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  Card &amp; Background Tone
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SURFACE_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Set card surface color ${hex}`}
                      onClick={() => onChange({ ...style, customSurfaceHex: hex })}
                      className={`h-6 w-6 rounded-full border-2 transition cursor-pointer ${
                        currentSurface.toLowerCase() === hex.toLowerCase()
                          ? 'scale-110 ring-2 ring-sky-400 border-white'
                          : 'border-black/20'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <input
                    id="custom-surface-color"
                    type="color"
                    value={currentSurface}
                    onChange={(e) => onChange({ ...style, customSurfaceHex: e.target.value })}
                    className="h-6 w-8 cursor-pointer rounded border bg-transparent"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div
                  className="inline-flex items-center gap-1 rounded-lg border p-0.5"
                  style={{ borderColor: 'var(--theme-hairline)' }}
                >
                  {(['light', 'dark'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={currentColorMode === mode}
                      onClick={() => onChange({ ...style, colorMode: mode })}
                      className="rounded-md px-2.5 py-1 text-xs font-medium capitalize transition cursor-pointer"
                      style={
                        currentColorMode === mode
                          ? {
                              backgroundColor: 'var(--theme-accent)',
                              color: 'var(--theme-on-accent)',
                            }
                          : {
                              color: 'var(--theme-text-muted)',
                            }
                      }
                    >
                      {mode} card
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
                  className="inline-flex items-center gap-1 text-xs font-medium opacity-80 hover:opacity-100 cursor-pointer"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  Reset card
                </button>
              </div>
            </div>
          </details>

          <ImageIcon className="sr-only" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}
