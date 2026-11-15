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
}

const QUICK_THEME_IDS = [
  'aurora-midnight',
  'cozy-christmas',
  'sacred-nativity',
  'spooky-halloween',
  'warm-thanksgiving',
  'birthday-confetti',
];

const ACCENT_SWATCHES = [
  '#34d399',
  '#f59e0b',
  '#ef4444',
  '#fb7185',
  '#a78bfa',
  '#38bdf8',
  '#d97706',
  '#10b981',
];

const SURFACE_SWATCHES = [
  '#0f172a',
  '#1a1423',
  '#14211b',
  '#1f1612',
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
}: StyleStudioDrawerProps) {
  const [themeCategory, setThemeCategory] = useState<
    'all' | ThemePreset['category']
  >('all');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePreset = getThemePreset(style.themeId);
  const activeFont =
    FONT_PAIRINGS.find((f) => f.id === style.fontId) ?? FONT_PAIRINGS[0];
  const activeEffect =
    EFFECT_OPTIONS.find((e) => e.id === style.effectId) ?? EFFECT_OPTIONS[0];
  const activeCover =
    COVER_PRESETS.find((c) => c.id === style.coverPresetId) ?? COVER_PRESETS[0];

  const quickThemes = QUICK_THEME_IDS.map((id) =>
    THEME_PRESETS.find((t) => t.id === id),
  ).filter((t): t is ThemePreset => Boolean(t));

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
      if (editKey) {
        headers['x-edit-key'] = editKey;
      }

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
      setUploadError(
        err instanceof Error ? err.message : 'Cover photo upload failed.',
      );
    } finally {
      setUploadingCover(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const currentAccent = style.customAccentHex || activePreset.accent;
  const currentSurface = style.customSurfaceHex || activePreset.surfaceBg;
  const currentColorMode = style.colorMode || activePreset.colorMode;

  return (
    <section
      aria-labelledby="style-studio-heading"
      className="invite-card rounded-3xl border border-white/12 bg-white/[0.04] p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2
            id="style-studio-heading"
            className="text-lg font-semibold text-white"
          >
            Theme &amp; Atmosphere
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-matched to your occasion — expand any drawer below to customize.
          </p>
        </div>
      </div>

      {/* Auto-Matched Curated Theme Card + Quick Switcher */}
      <div className="rounded-2xl border border-white/15 bg-slate-950/60 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 text-xl shadow-inner"
              style={{
                backgroundColor: currentSurface,
                borderColor: currentAccent,
              }}
              aria-hidden="true"
            >
              {activePreset.emoji}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white truncate">
                  {activePreset.name}
                </p>
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: currentAccent }}
                />
              </div>
              <p className="text-xs text-slate-400 truncate">
                {activeFont?.name} · {activeEffect?.emoji} {activeEffect?.name}
              </p>
            </div>
          </div>

          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
            Active Style
          </span>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Quick Switch
          </p>
          <div className="flex flex-wrap gap-2">
            {(quickThemes.length > 0 ? quickThemes : THEME_PRESETS.slice(0, 6)).map(
              (preset) => {
                const isSelected = preset.id === style.themeId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-selected={isSelected}
                    aria-pressed={isSelected}
                    onClick={() => applyThemePreset(preset)}
                    className={`invite-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition min-h-[40px] ${
                      isSelected
                        ? 'border-emerald-400/70 bg-emerald-400/15 text-white'
                        : 'border-white/12 bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] hover:text-white'
                    }`}
                  >
                    <span aria-hidden="true">{preset.emoji}</span>
                    <span>{preset.name}</span>
                  </button>
                );
              },
            )}
          </div>
        </div>
      </div>

      {/* Progressive Disclosure Drawers */}
      <div className="space-y-2.5">
        {/* 1. Occasion & Holiday Themes */}
        <details className="group rounded-2xl border border-white/12 bg-slate-950/45 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-white hover:bg-white/[0.04] transition min-h-[52px]">
            <span className="inline-flex items-center gap-2.5">
              <Palette className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              <span>Occasion &amp; Holiday Themes</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-slate-300">
                {activePreset.emoji} {activePreset.name}
              </span>
              <ChevronDown
                className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </span>
          </summary>

          <div className="border-t border-white/10 p-4 space-y-4">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter themes by occasion">
              {CATEGORY_TABS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={themeCategory === cat.id}
                  onClick={() => setThemeCategory(cat.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition min-h-[36px] ${
                    themeCategory === cat.id
                      ? 'bg-white text-slate-950'
                      : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredThemes.map((preset) => {
                const isSelected = preset.id === style.themeId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-selected={isSelected}
                    aria-pressed={isSelected}
                    onClick={() => applyThemePreset(preset)}
                    className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition min-h-[56px] ${
                      isSelected
                        ? 'border-emerald-400/70 bg-emerald-400/12'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-base"
                      style={{
                        backgroundColor: preset.cardBg,
                        borderColor: preset.accent,
                      }}
                      aria-hidden="true"
                    >
                      {preset.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white truncate">
                          {preset.name}
                        </p>
                        {isSelected ? (
                          <Check
                            className="h-4 w-4 text-emerald-300 shrink-0"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </details>

        {/* 2. Cover Artwork & Layout */}
        <details className="group rounded-2xl border border-white/12 bg-slate-950/45 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-white hover:bg-white/[0.04] transition min-h-[52px]">
            <span className="inline-flex items-center gap-2.5">
              <ImageIcon className="h-4 w-4 text-sky-300" aria-hidden="true" />
              <span>Cover Artwork &amp; Layout</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-slate-300">
                {style.customCoverUrl
                  ? 'Custom Photo'
                  : `${activeCover?.emoji ?? ''} ${activeCover?.name ?? style.coverPresetId}`}{' '}
                · {style.coverLayout}
              </span>
              <ChevronDown
                className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </span>
          </summary>

          <div className="border-t border-white/10 p-4 space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Cover Layout
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: 'square', label: 'Square 1:1' },
                    { value: 'banner', label: 'Banner 16:9' },
                    { value: 'none', label: 'Minimal' },
                  ] as Array<{ value: CoverLayout; label: string }>
                ).map((option) => {
                  const selected = style.coverLayout === option.value;
                  return (
                    <label
                      key={option.value}
                      data-selected={selected}
                      className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-xs sm:text-sm font-medium transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px] ${
                        selected
                          ? 'border-emerald-400/70 bg-emerald-400/15 text-white'
                          : 'border-white/12 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="coverLayout"
                        value={option.value}
                        checked={selected}
                        onChange={() =>
                          onChange({ ...style, coverLayout: option.value })
                        }
                        className="sr-only"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Upload Custom Cover Photo
                </span>
                {style.customCoverUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ ...style, customCoverUrl: undefined })
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-300 hover:text-rose-200 min-h-[36px]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove custom photo
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
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
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/25 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-emerald-400/60 hover:bg-white/[0.08] transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
                >
                  <Upload className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  <span>
                    {uploadingCover ? 'Uploading photo...' : 'Upload Photo (PNG/JPG/WebP)'}
                  </span>
                </label>

                {style.customCoverUrl ? (
                  <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/20">
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
                <p className="text-xs text-rose-300" role="alert">
                  {uploadError}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Curated Cover Artwork
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COVER_PRESETS.map((cover) => {
                  const isSelected =
                    !style.customCoverUrl && style.coverPresetId === cover.id;
                  return (
                    <button
                      key={cover.id}
                      type="button"
                      data-selected={isSelected}
                      aria-pressed={isSelected}
                      onClick={() =>
                        onChange({
                          ...style,
                          coverPresetId: cover.id,
                          customCoverUrl: undefined,
                          coverLayout:
                            style.coverLayout === 'none'
                              ? 'square'
                              : style.coverLayout,
                        })
                      }
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition min-h-[48px] ${
                        isSelected
                          ? 'border-emerald-400/70 bg-emerald-400/15 text-white'
                          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]'
                      }`}
                    >
                      <span className="text-base" aria-hidden="true">
                        {cover.emoji}
                      </span>
                      <span className="truncate">{cover.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </details>

        {/* 3. Typography Pairing */}
        <details className="group rounded-2xl border border-white/12 bg-slate-950/45 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-white hover:bg-white/[0.04] transition min-h-[52px]">
            <span className="inline-flex items-center gap-2.5">
              <Type className="h-4 w-4 text-amber-300" aria-hidden="true" />
              <span>Typography Pairing</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-slate-300">
                {activeFont?.name}
              </span>
              <ChevronDown
                className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </span>
          </summary>

          <div className="border-t border-white/10 p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {FONT_PAIRINGS.map((font) => {
              const isSelected = style.fontId === font.id;
              return (
                <button
                  key={font.id}
                  type="button"
                  data-selected={isSelected}
                  aria-pressed={isSelected}
                  onClick={() => onChange({ ...style, fontId: font.id })}
                  className={`rounded-2xl border p-3.5 text-left transition min-h-[68px] ${
                    isSelected
                      ? 'border-emerald-400/70 bg-emerald-400/12'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      style={{ fontFamily: toCssFontVar(font.headingVar) }}
                      className="text-lg font-semibold text-white"
                    >
                      {font.name}
                    </span>
                    {isSelected ? (
                      <Check
                        className="h-4 w-4 text-emerald-300 shrink-0"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  <p
                    style={{ fontFamily: toCssFontVar(font.bodyVar) }}
                    className="text-xs text-slate-400 mt-1"
                  >
                    {font.sample}
                  </p>
                </button>
              );
            })}
          </div>
        </details>

        {/* 4. Ambient & Seasonal Effects */}
        <details className="group rounded-2xl border border-white/12 bg-slate-950/45 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-white hover:bg-white/[0.04] transition min-h-[52px]">
            <span className="inline-flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-violet-300" aria-hidden="true" />
              <span>Ambient &amp; Seasonal Effects</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-slate-300">
                {activeEffect?.emoji} {activeEffect?.name}
              </span>
              <ChevronDown
                className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </span>
          </summary>

          <div className="border-t border-white/10 p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EFFECT_OPTIONS.map((effect) => {
              const isSelected = style.effectId === effect.id;
              return (
                <button
                  key={effect.id}
                  type="button"
                  data-selected={isSelected}
                  aria-pressed={isSelected}
                  onClick={() => onChange({ ...style, effectId: effect.id })}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition min-h-[56px] ${
                    isSelected
                      ? 'border-emerald-400/70 bg-emerald-400/12'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="text-lg leading-none mt-0.5" aria-hidden="true">
                    {effect.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      {effect.name}
                    </p>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {effect.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </details>

        {/* 5. Fine-Tune Accent & Surface Colors */}
        <details className="group rounded-2xl border border-white/12 bg-slate-950/45 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-white hover:bg-white/[0.04] transition min-h-[52px]">
            <span className="inline-flex items-center gap-2.5">
              <Sliders className="h-4 w-4 text-rose-300" aria-hidden="true" />
              <span>Fine-Tune Accent &amp; Surface Colors</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-full border border-white/30"
                style={{ backgroundColor: currentAccent }}
              />
              <ChevronDown
                className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </span>
          </summary>

          <div className="border-t border-white/10 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="custom-accent-color"
                  className="block text-xs font-medium uppercase tracking-wider text-slate-400"
                >
                  Accent Color
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {ACCENT_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Set accent color ${hex}`}
                      onClick={() =>
                        onChange({ ...style, customAccentHex: hex })
                      }
                      className={`h-8 w-8 rounded-full border-2 transition ${
                        currentAccent.toLowerCase() === hex.toLowerCase()
                          ? 'border-white scale-110'
                          : 'border-white/20 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <input
                    id="custom-accent-color"
                    type="color"
                    value={currentAccent}
                    onChange={(e) =>
                      onChange({ ...style, customAccentHex: e.target.value })
                    }
                    className="h-9 w-11 cursor-pointer rounded-lg border border-white/20 bg-transparent p-0.5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="custom-surface-color"
                  className="block text-xs font-medium uppercase tracking-wider text-slate-400"
                >
                  Card Surface Color
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {SURFACE_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Set surface color ${hex}`}
                      onClick={() =>
                        onChange({ ...style, customSurfaceHex: hex })
                      }
                      className={`h-8 w-8 rounded-full border-2 transition ${
                        currentSurface.toLowerCase() === hex.toLowerCase()
                          ? 'border-emerald-400 scale-110'
                          : 'border-white/25 hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <input
                    id="custom-surface-color"
                    type="color"
                    value={currentSurface}
                    onChange={(e) =>
                      onChange({ ...style, customSurfaceHex: e.target.value })
                    }
                    className="h-9 w-11 cursor-pointer rounded-lg border border-white/20 bg-transparent p-0.5"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] p-1">
                {(['dark', 'light'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={currentColorMode === mode}
                    onClick={() => onChange({ ...style, colorMode: mode })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition min-h-[36px] ${
                      currentColorMode === mode
                        ? 'bg-white text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {mode} canvas
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 transition min-h-[40px]"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset to theme colors
              </button>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
