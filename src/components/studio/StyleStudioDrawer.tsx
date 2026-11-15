'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import {
  Check,
  ChevronDown,
  Image as ImageIcon,
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
  EFFECT_OPTIONS,
  FONT_PAIRINGS,
  THEME_PRESETS,
  getThemePreset,
  type ThemePreset,
} from '@/lib/themes/presets';
import type { CoverLayout, InviteStyleConfig } from '@/types/invite';

interface StyleStudioDrawerProps {
  style: InviteStyleConfig;
  onChange: (next: InviteStyleConfig) => void;
  eventId?: string;
  editKey?: string;
  section?: 'themes' | 'customize' | 'covers' | 'all';
}

const ACCENT_SWATCHES = [
  '#7dd3fc',
  '#34d399',
  '#f59e0b',
  '#ef4444',
  '#fb7185',
  '#a78bfa',
  '#d97706',
  '#10b981',
];

const SURFACE_SWATCHES = [
  '#0c316e',
  '#0f172a',
  '#1a1423',
  '#14211b',
  '#faf7f2',
  '#f8fafc',
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
        coverLayout: style.coverLayout === 'none' ? 'square' : style.coverLayout,
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Cover photo upload failed.');
    } finally {
      setUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const currentAccent = style.customAccentHex || activePreset.accent;
  const currentSurface = style.customSurfaceHex || activePreset.surfaceBg;
  const currentColorMode = style.colorMode || activePreset.colorMode;

  const showThemes = section === 'all' || section === 'themes';
  const showCovers = section === 'all' || section === 'covers';
  const showCustomize = section === 'all' || section === 'customize';

  return (
    <div
      className="rounded-2xl border backdrop-blur-md p-3.5 space-y-3"
      style={{
        backgroundColor: 'var(--theme-glass-bg)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text-primary)',
      }}
    >
      {showThemes ? (
        <div className="space-y-2.5">
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

          <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-0.5">
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
                      background: `linear-gradient(135deg, ${preset.pageBg} 0%, ${preset.cardBg} 65%, ${preset.accent} 100%)`,
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
      ) : null}

      {showCovers ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>
              Cover Artwork ({style.customCoverUrl ? 'Custom Photo' : activeCover.name})
            </span>
            {style.customCoverUrl ? (
              <button
                type="button"
                onClick={() => onChange({ ...style, customCoverUrl: undefined })}
                className="inline-flex items-center gap-1 text-xs font-medium text-rose-300 hover:opacity-80 cursor-pointer"
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
              <span>{uploadingCover ? 'Uploading...' : 'Upload Photo'}</span>
            </label>

            {style.customCoverUrl ? (
              <div
                className="h-8 w-8 overflow-hidden rounded-lg border"
                style={{ borderColor: 'var(--theme-hairline)' }}
              >
                <CoverArt
                  coverPresetId={style.coverPresetId}
                  customCoverUrl={style.customCoverUrl}
                  layout="square"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
          </div>

          {uploadError ? (
            <p className="text-xs text-rose-400" role="alert">
              {uploadError}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
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
                      coverLayout: style.coverLayout === 'none' ? 'square' : style.coverLayout,
                    })
                  }
                  className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs font-medium transition cursor-pointer min-w-0"
                  style={{
                    backgroundColor: isSelected ? 'var(--theme-surface-bg)' : 'transparent',
                    borderColor: isSelected ? 'var(--theme-accent)' : 'var(--theme-hairline)',
                    color: 'var(--theme-text-primary)',
                  }}
                >
                  <span aria-hidden="true">{cover.emoji}</span>
                  <span className="truncate">{cover.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showCustomize ? (
        <div className="space-y-2">
          {/* Typography */}
          <details className="group rounded-xl border overflow-hidden" style={{ borderColor: 'var(--theme-hairline)' }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium">
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
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
                <span>Effect</span>
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

          {/* Cover Layout & Colors */}
          <details className="group rounded-xl border overflow-hidden" style={{ borderColor: 'var(--theme-hairline)' }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium">
              <span className="inline-flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
                <span>Layout &amp; Colors</span>
              </span>
              <span className="inline-flex items-center gap-1.5 opacity-75">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 rounded-full border"
                  style={{
                    backgroundColor: currentAccent,
                    borderColor: 'var(--theme-hairline)',
                  }}
                />
                <span className="capitalize">{style.coverLayout}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>

            <div className="border-t p-3 space-y-3" style={{ borderColor: 'var(--theme-hairline)' }}>
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                  Cover Frame
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { value: 'square', label: 'Square 1:1' },
                      { value: 'banner', label: 'Wide 16:9' },
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
                  htmlFor="custom-accent-color"
                  className="block text-[11px] font-medium"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  Accent Color
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {ACCENT_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Set accent color ${hex}`}
                      onClick={() => onChange({ ...style, customAccentHex: hex })}
                      className={`h-6 w-6 rounded-full border-2 transition cursor-pointer ${
                        currentAccent.toLowerCase() === hex.toLowerCase()
                          ? 'scale-110 border-white'
                          : 'border-white/25'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <input
                    id="custom-accent-color"
                    type="color"
                    value={currentAccent}
                    onChange={(e) => onChange({ ...style, customAccentHex: e.target.value })}
                    className="h-6 w-8 cursor-pointer rounded border bg-transparent"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="custom-surface-color"
                  className="block text-[11px] font-medium"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  Surface Color
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SURFACE_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Set surface color ${hex}`}
                      onClick={() => onChange({ ...style, customSurfaceHex: hex })}
                      className={`h-6 w-6 rounded-full border-2 transition cursor-pointer ${
                        currentSurface.toLowerCase() === hex.toLowerCase()
                          ? 'scale-110 border-white'
                          : 'border-white/25'
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
                  {(['dark', 'light'] as const).map((mode) => (
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
                      {mode}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...style,
                      customAccentHex: undefined,
                      customSurfaceHex: undefined,
                      colorMode: activePreset.colorMode,
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium opacity-80 hover:opacity-100 cursor-pointer"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  Reset
                </button>
              </div>
            </div>
          </details>

          {section === 'customize' ? (
            <div className="pt-1">
              <ImageIcon className="sr-only" aria-hidden="true" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
