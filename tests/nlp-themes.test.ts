import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AmbientBackdrop } from '@/components/effects/AmbientBackdrop';
import { CoverArt } from '@/components/covers/CoverArt';
import { EXAMPLE_EVENT_PROMPTS, parseEventPrompt } from '@/lib/nlp/parseEventPrompt';
import { formatEventDateTime } from '@/lib/polyfills/temporal';
import {
  contrastRatio,
  ensureReadableAccentOnSurface,
  pickAccessibleForeground,
  relativeLuminance,
} from '@/lib/themes/contrast';
import {
  COVER_PRESETS,
  EFFECT_OPTIONS,
  FONT_PAIRINGS,
  THEME_PRESETS,
  getThemePreset,
  resolveThemeCssVars,
} from '@/lib/themes/presets';
import type { AmbientEffectId, FontPairingId } from '@/types/invite';

const REF_DATE = new Date('2026-11-15T17:00:00Z'); // Nov 15, 2026 12:00 PM EST
const NY_TZ = 'America/New_York';

function formatInTz(iso: string, timeZone = NY_TZ) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(iso));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const rawHour = pick('hour');
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: pick('minute'),
  };
}

describe('WCAG 2.1 contrast utilities', () => {
  it('computes accurate relative luminance and contrast ratios', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
    expect(contrastRatio('111827', '111827')).toBeCloseTo(1, 5);
  });

  it('picks accessible foreground with >= 4.5 contrast for dark and light colors', () => {
    expect(pickAccessibleForeground('#0b0f19')).toBe('#ffffff');
    expect(pickAccessibleForeground('#18181b')).toBe('#ffffff');
    expect(pickAccessibleForeground('#34d399')).toBe('#0b0f19');
    expect(pickAccessibleForeground('#f5c451')).toBe('#0b0f19');
    expect(contrastRatio('#34d399', pickAccessibleForeground('#34d399'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#2c6b4a', pickAccessibleForeground('#2c6b4a'))).toBeGreaterThanOrEqual(4.5);
  });

  it('adjusts unreadable accent colors to meet target contrast on surfaces', () => {
    const adjustedOnDark = ensureReadableAccentOnSurface('#111827', '#0b0f19', 3);
    expect(contrastRatio(adjustedOnDark, '#0b0f19')).toBeGreaterThanOrEqual(3);

    const adjustedOnLight = ensureReadableAccentOnSurface('#fde047', '#ffffff', 4.5);
    expect(contrastRatio(adjustedOnLight, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('curated themes, fonts, effects, and covers', () => {
  it('includes 22 curated presets covering expressive, ambient, holiday, milestone, and editorial', () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(22);
    const categories = new Set(THEME_PRESETS.map((p) => p.category));
    expect(categories).toEqual(
      new Set(['expressive', 'ambient', 'holiday', 'milestone', 'editorial']),
    );
  });

  it('guarantees WCAG AA >= 4.5 contrast on textPrimary and readable accents across EVERY preset', () => {
    for (const preset of THEME_PRESETS) {
      expect(contrastRatio(preset.textPrimary, preset.cardBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(preset.textPrimary, preset.surfaceBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(preset.textMuted, preset.cardBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(preset.accent, preset.cardBg)).toBeGreaterThanOrEqual(3.0);

      const onAccent = pickAccessibleForeground(preset.accent);
      expect(contrastRatio(onAccent, preset.accent)).toBeGreaterThanOrEqual(4.5);

      const vars = resolveThemeCssVars({
        themeId: preset.id,
        fontId: preset.defaultFontId,
        effectId: preset.defaultEffectId,
        coverPresetId: preset.defaultCoverPresetId,
        coverLayout: 'banner',
      });
      for (let slot = 1; slot <= 6; slot += 1) {
        const bg = vars[`--theme-avatar-${slot}-bg`];
        const fg = vars[`--theme-avatar-${slot}-fg`];
        expect(bg).toMatch(/^#[0-9a-f]{6}$/i);
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('covers all 7 font pairings, 30 animated/static backgrounds, and 72 image-backed covers across 5 mediums', () => {
    const expectedFonts: FontPairingId[] = [
      'editorial-serif',
      'modern-sans',
      'expressive-display',
      'sacred-classic',
      'playful-rounded',
      'studio-mono',
      'y2k-display',
    ];
    expect(FONT_PAIRINGS.map((f) => f.id)).toEqual(expectedFonts);

    const expectedEffects: AmbientEffectId[] = [
      'prism-gradient',
      'aurora',
      'liquid-chrome',
      'cyber-grid',
      'lava-lamp',
      'water-caustics',
      'twilight-clouds',
      'stained-glass',
      'disco-prism',
      'snowfall',
      'rain-glass',
      'christmas-lights',
      'starlight-radiance',
      'warm-bokeh',
      'lullaby-stars',
      'shooting-stars',
      'fireflies',
      'paper-lanterns',
      'fireworks',
      'confetti',
      'botanical-petals',
      'autumn-leaves',
      'floating-hearts',
      'champagne-sparkle',
      'halloween-bats',
      'static-glow',
      'static-grain',
      'static-linen',
      'static-watercolor',
      'none',
    ];
    expect(EFFECT_OPTIONS.map((e) => e.id)).toEqual(expectedEffects);
    expect(EFFECT_OPTIONS.find((e) => e.id === 'cyber-grid')?.name).toBe('Neon Silk');
    expect(EFFECT_OPTIONS.filter((e) => e.animated)).toHaveLength(25);
    expect(EFFECT_OPTIONS.filter((e) => !e.animated)).toHaveLength(5);

    expect(COVER_PRESETS).toHaveLength(72);
    expect(COVER_PRESETS.filter((c) => c.styleGroup === 'hand-drawn')).toHaveLength(18);
    expect(COVER_PRESETS.filter((c) => c.styleGroup === 'pattern')).toHaveLength(16);
    expect(COVER_PRESETS.filter((c) => c.styleGroup === 'vector')).toHaveLength(14);
    expect(COVER_PRESETS.filter((c) => c.styleGroup === 'pencil')).toHaveLength(12);
    expect(COVER_PRESETS.filter((c) => c.styleGroup === 'oil-paint')).toHaveLength(12);

    const coverIds = new Set(COVER_PRESETS.map((c) => c.id));
    for (const preset of THEME_PRESETS) {
      expect(coverIds.has(preset.defaultCoverPresetId)).toBe(true);
    }

    for (const cover of COVER_PRESETS) {
      expect(cover.imageUrl).toBeTruthy();
      if (cover.imageUrl) {
        const diskPath = path.join(process.cwd(), 'public', cover.imageUrl);
        expect(fs.existsSync(diskPath)).toBe(true);
      }
    }
  });

  it('falls back to aurora-midnight on unknown preset id and resolves CSS variables safely', () => {
    expect(getThemePreset('does-not-exist').id).toBe('aurora-midnight');

    const vars = resolveThemeCssVars({
      themeId: 'sacred-nativity',
      fontId: 'sacred-classic',
      effectId: 'starlight-radiance',
      coverPresetId: 'sacred-star',
      coverLayout: 'square',
      customSurfaceHex: '#ffffff',
      customAccentHex: '#fde047',
    });

    expect(vars['--theme-color-scheme']).toBe('light');
    expect(contrastRatio(vars['--theme-text-primary'], vars['--theme-card-bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(vars['--theme-accent'], vars['--theme-card-bg'])).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(vars['--theme-on-accent'], vars['--theme-accent'])).toBeGreaterThanOrEqual(4.5);
    expect(vars['--theme-font-heading']).toContain('--font-sacred-classic');
    expect(vars['--font-invite-display']).toContain('--font-sacred-classic');

    const ctaVars = resolveThemeCssVars({
      themeId: 'winter-snowfall',
      fontId: 'modern-sans',
      effectId: 'snowfall',
      coverPresetId: 'snowy-pines',
      coverLayout: 'banner',
      ctaStyle: 'gradient',
      customAccentHex: '#e11d48',
      customCtaEndHex: '#7c3aed',
    });
    expect(ctaVars['--theme-backdrop-mode']).toBe('dark');
    expect(ctaVars['--theme-cta-bg']).toBe('linear-gradient(135deg, #e11d48 0%, #7c3aed 100%)');
    expect(ctaVars['--theme-cta-text']).toBe('#ffffff');

    const solidCtaVars = resolveThemeCssVars({
      themeId: 'winter-snowfall',
      fontId: 'modern-sans',
      effectId: 'snowfall',
      coverPresetId: 'snowy-pines',
      coverLayout: 'banner',
      ctaStyle: 'solid',
      customAccentHex: '#0f172a',
    });
    expect(solidCtaVars['--theme-cta-bg']).toBe('#0f172a');
    expect(solidCtaVars['--theme-cta-text']).toBe('#ffffff');
  });
});

describe('deterministic NLP event prompt parser', () => {
  it('parses Christmas party with written ordinal "on the ninth at 3 o\'clock at 42 Maple St"', async () => {
    const draft = parseEventPrompt(
      "Hey I'm doing a Christmas party on the ninth at 3 o'clock at 42 Maple St",
      REF_DATE,
      NY_TZ,
    );

    expect(draft.title).toBe('Christmas Party');
    expect(draft.style.themeId).toBe('cozy-christmas');
    expect(draft.style.effectId).toBe('christmas-lights');
    expect(draft.locationName).toBe('42 Maple St');
    expect(draft.locationAddress).toBe('42 Maple St');

    const wall = formatInTz(draft.startIso, NY_TZ);
    expect(wall.year).toBe(2026);
    expect(wall.month).toBe(12);
    expect(wall.day).toBe(9);
    expect(wall.hour).toBe(15);
    expect(wall.minute).toBe(0);

    // Ensure compatibility with Temporal formatter
    const formatted = await formatEventDateTime(draft.startIso, draft.endIso, draft.timeZone);
    expect(formatted.timeLabel).toContain('3:00 PM');
  });

  it('parses numeric ordinal "on the 9th at 3 o\'clock"', () => {
    const draft = parseEventPrompt(
      "Hey I'm doing a Christmas party on the 9th at 3 o'clock",
      REF_DATE,
      NY_TZ,
    );
    expect(draft.title).toBe('Christmas Party');
    const wall = formatInTz(draft.startIso, NY_TZ);
    expect(wall.month).toBe(12);
    expect(wall.day).toBe(9);
    expect(wall.hour).toBe(15);
  });

  it('matches sacred-nativity for Jesus birth candlelight service Dec 24 at 7pm', () => {
    const draft = parseEventPrompt(
      'Candlelight service celebrating Jesus birth Dec 24 at 7pm',
      REF_DATE,
      NY_TZ,
    );
    expect(draft.style.themeId).toBe('sacred-nativity');
    expect(draft.style.effectId).toBe('starlight-radiance');
    expect(draft.style.fontId).toBe('sacred-classic');
    expect(draft.title).toBe('Candlelight Service Celebrating Jesus Birth');

    const wall = formatInTz(draft.startIso, NY_TZ);
    expect(wall.month).toBe(12);
    expect(wall.day).toBe(24);
    expect(wall.hour).toBe(19);
    expect(wall.minute).toBe(0);
  });

  it('prioritizes sacred-nativity over birthday when both "Jesus Birthday" and "Nativity" appear', () => {
    const draft = parseEventPrompt(
      'Jesus Birthday & Nativity Candlelight at Grace Chapel Dec 24 at 6:30pm',
      REF_DATE,
      NY_TZ,
    );
    expect(draft.style.themeId).toBe('sacred-nativity');
    expect(draft.locationName).toBe('Grace Chapel');
    const wall = formatInTz(draft.startIso, NY_TZ);
    expect(wall.hour).toBe(18);
    expect(wall.minute).toBe(30);
  });

  it('preserves 4th of July in title and assigns fireworks theme + Riverside Park location', () => {
    const draft = parseEventPrompt('4th of July BBQ at Riverside Park', REF_DATE, NY_TZ);
    expect(draft.title).toBe('4th of July BBQ');
    expect(draft.locationName).toBe('Riverside Park');
    expect(draft.style.themeId).toBe('fourth-of-july');
    expect(draft.style.effectId).toBe('fireworks');

    const wall = formatInTz(draft.startIso, NY_TZ);
    expect(wall.month).toBe(7);
    expect(wall.day).toBe(4);
    expect(wall.hour).toBe(17);
  });

  it('parses 4th of July with separate time span cleanly', () => {
    const draft = parseEventPrompt(
      '4th of July backyard BBQ at 5pm at Riverside Park',
      REF_DATE,
      NY_TZ,
    );
    const wall = formatInTz(draft.startIso, NY_TZ);
    expect(wall.month).toBe(7);
    expect(wall.day).toBe(4);
    expect(wall.hour).toBe(17);
    expect(draft.locationName).toBe('Riverside Park');
  });

  it('parses Halloween costume party Oct 31 at 8pm', () => {
    const draft = parseEventPrompt('Halloween costume party Oct 31 at 8pm', REF_DATE, NY_TZ);
    expect(draft.title).toBe('Halloween Costume Party');
    expect(draft.style.themeId).toBe('spooky-halloween');
    expect(draft.style.effectId).toBe('halloween-bats');
    const wall = formatInTz(draft.startIso, NY_TZ);
    expect(wall.month).toBe(10);
    expect(wall.day).toBe(31);
    expect(wall.hour).toBe(20);
  });

  it('parses Friendsgiving potluck Nov 26 at 5pm', () => {
    const draft = parseEventPrompt('Friendsgiving potluck Nov 26 at 5pm', REF_DATE, NY_TZ);
    expect(draft.title).toBe('Friendsgiving Potluck');
    expect(draft.style.themeId).toBe('warm-thanksgiving');
    expect(draft.style.effectId).toBe('autumn-leaves');
    const wall = formatInTz(draft.startIso, NY_TZ);
    expect(wall.month).toBe(11);
    expect(wall.day).toBe(26);
    expect(wall.hour).toBe(17);
  });

  it("parses Emma's baby shower next Saturday at 2pm", () => {
    const draft = parseEventPrompt("Emma's baby shower next Saturday at 2pm", REF_DATE, NY_TZ);
    expect(draft.title).toBe("Emma's Baby Shower");
    expect(draft.style.themeId).toBe('baby-shower-cloud');
    expect(draft.style.effectId).toBe('lullaby-stars');
    expect(draft.style.colorMode).toBe('light');
    const wall = formatInTz(draft.startIso, NY_TZ);
    expect(wall.month).toBe(11);
    expect(wall.day).toBe(21);
    expect(wall.hour).toBe(14);
  });

  it('parses Bridal shower brunch in light editorial style with morning/brunch hour', () => {
    const draft = parseEventPrompt('Bridal shower brunch', REF_DATE, NY_TZ);
    expect(draft.title).toBe('Bridal Shower Brunch');
    expect(draft.style.themeId).toBe('bridal-atelier');
    expect(draft.style.colorMode).toBe('light');
    const wall = formatInTz(draft.startIso, NY_TZ);
    expect(wall.hour).toBe(11);
  });

  it('parses Birthday dinner with Maya and time ranges from 7 to 10', () => {
    const simple = parseEventPrompt('Birthday dinner with Maya', REF_DATE, NY_TZ);
    expect(simple.title).toBe('Birthday Dinner with Maya');
    expect(simple.style.themeId).toBe('birthday-confetti');
    expect(simple.style.effectId).toBe('confetti');

    const ranged = parseEventPrompt(
      'Birthday dinner with Maya on Friday from 7 to 10',
      REF_DATE,
      NY_TZ,
    );
    expect(ranged.title).toBe('Birthday Dinner with Maya');
    const startWall = formatInTz(ranged.startIso, NY_TZ);
    const endWall = formatInTz(ranged.endIso!, NY_TZ);
    expect(startWall.day).toBe(20);
    expect(startWall.hour).toBe(19);
    expect(endWall.hour).toBe(22);
  });

  it('handles New Year Eve cross-midnight duration (9pm to 1am)', () => {
    const draft = parseEventPrompt(
      "New Year's Eve rooftop countdown Dec 31 from 9pm to 1am at Sky Lounge",
      REF_DATE,
      NY_TZ,
    );
    expect(draft.style.themeId).toBe('new-years-eve');
    expect(draft.style.effectId).toBe('champagne-sparkle');
    expect(draft.locationName).toBe('Sky Lounge');
    const startWall = formatInTz(draft.startIso, NY_TZ);
    const endWall = formatInTz(draft.endIso!, NY_TZ);
    expect(startWall.month).toBe(12);
    expect(startWall.day).toBe(31);
    expect(startWall.hour).toBe(21);
    expect(endWall.month).toBe(1);
    expect(endWall.day).toBe(1);
    expect(endWall.hour).toBe(1);
  });

  it("extracts Valentine's/Galentine's, St. Patrick's, Easter, Memorial Day, and Dinner themes", () => {
    const gal = parseEventPrompt(
      "Galentine's wine night Feb 13 at 7pm hosted by Sofia",
      REF_DATE,
      NY_TZ,
    );
    expect(gal.style.themeId).toBe('valentines-rose');
    expect(gal.hostName).toBe('Sofia');

    const stPat = parseEventPrompt("St Patrick's Day pub night March 17 at 6:30pm", REF_DATE, NY_TZ);
    expect(stPat.style.themeId).toBe('st-patricks-emerald');

    const easter = parseEventPrompt(
      'Easter egg hunt and spring garden brunch April 5 at 11am',
      REF_DATE,
      NY_TZ,
    );
    expect(easter.style.themeId).toBe('spring-easter-garden');
    expect(easter.style.colorMode).toBe('light');

    const memorial = parseEventPrompt('Memorial Day backyard cookout at 4pm', REF_DATE, NY_TZ);
    expect(memorial.style.themeId).toBe('summer-cookout');

    const dinner = parseEventPrompt(
      'Candlelit dinner party at 118 Oak Ave — bring your favorite red wine!',
      REF_DATE,
      NY_TZ,
    );
    expect(dinner.style.themeId).toBe('candlelit-dinner');
    expect(dinner.locationAddress).toBe('118 Oak Ave');
    expect(dinner.descriptionHtml).toContain('bring your favorite red wine!');
  });

  it('extracts virtual URL, host name, and clean title for online gatherings', () => {
    const draft = parseEventPrompt(
      'Join our Zoom game night Friday at 8pm https://zoom.us/j/987654321 hosted by Alex',
      REF_DATE,
      NY_TZ,
    );
    expect(draft.title).toBe('Zoom Game Night');
    expect(draft.virtualUrl).toBe('https://zoom.us/j/987654321');
    expect(draft.hostName).toBe('Alex');
    expect(draft.confidenceChips.some((c) => c.label === 'Host' && c.value === 'Alex')).toBe(true);
  });

  it('preserves period abbreviations (St., Ave., Mt., Dr., Rev., p.m.) in locations and sentences', () => {
    const nativity = parseEventPrompt(
      'Jesus nativity service Dec 24 at 7pm at St. Luke Chapel',
      REF_DATE,
      NY_TZ,
    );
    expect(nativity.title).toBe('Jesus Nativity Service');
    expect(nativity.locationName).toBe('St. Luke Chapel');
    expect(nativity.style.themeId).toBe('sacred-nativity');
    expect(nativity.descriptionHtml).not.toContain('Note from the host');
    expect(nativity.descriptionHtml).not.toContain('Luke Chapel');

    const withNote = parseEventPrompt(
      'Candlelight vigil Dec 24 at 7:30 p.m. at Mt. Olive Chapel hosted by Rev. Thomas. Candles provided!',
      REF_DATE,
      NY_TZ,
    );
    expect(withNote.locationName).toBe('Mt. Olive Chapel');
    expect(withNote.hostName).toBe('Rev. Thomas');
    expect(withNote.descriptionHtml).toContain('Candles provided!');
  });

  it('matches enriched covers and vibes for taco nights, pool parties, campfires, movies, and pelican breakfasts', () => {
    const taco = parseEventPrompt('Patio taco night Friday at 7pm at 42 Maple St', REF_DATE, NY_TZ);
    expect(taco.style.coverPresetId).toBe('handdrawn-taco-patio');
    expect(taco.detectedOccasionLabel).toBe('Taco Night');

    const pool = parseEventPrompt('Summer pool party Saturday at 2pm', REF_DATE, NY_TZ);
    expect(pool.style.coverPresetId).toBe('handdrawn-pool-party');
    expect(pool.style.effectId).toBe('water-caustics');

    const campfire = parseEventPrompt('Lakeside bonfire and smores Saturday at 8pm', REF_DATE, NY_TZ);
    expect(campfire.style.coverPresetId).toBe('handdrawn-campfire-smores');
    expect(campfire.style.effectId).toBe('fireflies');

    const pelican = parseEventPrompt(
      'Christmas breakfast with Blue Pelican Dec 5 at 9:30am hosted by Ivan',
      REF_DATE,
      NY_TZ,
    );
    expect(pelican.style.themeId).toBe('winter-snowfall');
    expect(pelican.style.coverPresetId).toBe('handdrawn-pelican-holiday');
    expect(pelican.hostName).toBe('Ivan');
  });

  it('provides 6 valid starter prompts in EXAMPLE_EVENT_PROMPTS', () => {
    expect(EXAMPLE_EVENT_PROMPTS).toHaveLength(6);
    for (const sample of EXAMPLE_EVENT_PROMPTS) {
      const parsed = parseEventPrompt(sample.prompt, REF_DATE, NY_TZ);
      expect(parsed.title.length).toBeGreaterThan(2);
      expect(Date.parse(parsed.startIso)).not.toBeNaN();
      expect(parsed.rsvpNotePrompt.length).toBeGreaterThan(5);
    }
  });
});

describe('AmbientBackdrop and CoverArt components', () => {
  it('renders AmbientBackdrop with aria-hidden, pointer-events-none, and reduced-motion safety', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const fakeCtx = {
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'round',
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;

    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(fakeCtx);

    const matchMediaSpy = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMediaSpy);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(AmbientBackdrop, {
          effectId: 'aurora',
          accentColor: '#34d399',
          colorMode: 'dark',
        }),
      );
    });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper.className).toContain('pointer-events-none');
    expect(wrapper.dataset.effectId).toBe('aurora');
    expect(wrapper.querySelector('canvas[data-webgl-backdrop="true"]')).not.toBeNull();
    expect(getContextSpy).toHaveBeenCalled();

    act(() => {
      root.render(
        React.createElement(AmbientBackdrop, {
          effectId: 'static-glow',
          colorMode: 'light',
        }),
      );
    });
    expect(wrapper.querySelector('canvas')).toBeNull();

    act(() => {
      root.render(
        React.createElement(AmbientBackdrop, {
          effectId: 'christmas-lights',
          colorMode: 'dark',
          className: 'fixed inset-0',
        }),
      );
    });
    expect(wrapper.querySelector('svg')).not.toBeNull();
    expect(wrapper.className).toContain('fixed inset-0');

    act(() => {
      root.render(
        React.createElement(AmbientBackdrop, {
          effectId: 'none',
          colorMode: 'light',
        }),
      );
    });
    expect(wrapper.querySelector('canvas')).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
    getContextSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('renders CoverArt for none, customCoverUrl, and every preset in COVER_PRESETS', () => {
    const noneMarkup = renderToStaticMarkup(
      React.createElement(CoverArt, {
        coverPresetId: 'aurora-ridge',
        layout: 'none',
      }),
    );
    expect(noneMarkup).toBe('');

    const customMarkup = renderToStaticMarkup(
      React.createElement(CoverArt, {
        coverPresetId: 'aurora-ridge',
        customCoverUrl: 'https://example.com/photo.jpg',
        layout: 'banner',
        title: 'Winter Party',
      }),
    );
    expect(customMarkup).toContain('<img');
    expect(customMarkup).toContain('https://example.com/photo.jpg');
    expect(customMarkup).toContain('aspect-[16/9]');

    for (const preset of COVER_PRESETS) {
      const markup = renderToStaticMarkup(
        React.createElement(CoverArt, {
          coverPresetId: preset.id,
          layout: 'banner',
          title: preset.name,
        }),
      );
      if (preset.imageUrl) {
        expect(markup).toContain('<img');
        expect(markup).toContain(preset.imageUrl);
      } else {
        expect(markup).toContain('<svg');
      }
      expect(markup).toContain(`data-cover-preset="${preset.id}"`);
    }

    for (const legacyId of ['snowy-pines', 'aurora-ridge', 'painted-citrus-table', 'gallery-monolith']) {
      const legacyMarkup = renderToStaticMarkup(
        React.createElement(CoverArt, {
          coverPresetId: legacyId,
          layout: 'banner',
          title: 'Legacy Invite',
        }),
      );
      expect(legacyMarkup.includes('<img') || legacyMarkup.includes('<svg')).toBe(true);
    }
  });

  it('ignores minor mobile browser chrome height jitter in AmbientBackdrop without wiping the canvas', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    let resizeCallback: (() => void) | null = null;
    let observedEl: HTMLElement | null = null;
    class MockResizeObserver {
      constructor(cb: () => void) {
        resizeCallback = cb;
      }
      observe(el: Element) {
        observedEl = el as HTMLElement;
      }
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    let mockHeight = 760;
    const container = document.createElement('div');
    document.body.appendChild(container);

    const fakeCtx = {
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'round',
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);

    const root = createRoot(container);
    act(() => {
      root.render(
        React.createElement(AmbientBackdrop, {
          effectId: 'snowfall',
          fixedViewport: true,
          colorMode: 'dark',
        }),
      );
    });

    const backdropParent = observedEl!;
    expect(backdropParent).not.toBeNull();
    Object.defineProperty(backdropParent, 'clientWidth', { configurable: true, get: () => 390 });
    Object.defineProperty(backdropParent, 'clientHeight', { configurable: true, get: () => mockHeight });
    // Trigger an initial baseline resize with mocked clientWidth/clientHeight
    act(() => {
      resizeCallback?.();
    });

    const canvas = container.querySelectorAll('canvas')[1] ?? container.querySelector('canvas')!;
    const setTransformCallsAfterBaseline = (fakeCtx.setTransform as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(canvas.height).toBeGreaterThan(0);

    // Simulate mobile Chrome address bar hide/show (56px delta < 140px threshold)
    mockHeight = 816;
    act(() => {
      resizeCallback?.();
    });
    expect((fakeCtx.setTransform as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      setTransformCallsAfterBaseline,
    );

    // Simulate genuine rotation / window resize (>= 140px delta)
    mockHeight = 1040;
    act(() => {
      resizeCallback?.();
    });
    expect((fakeCtx.setTransform as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      setTransformCallsAfterBaseline + 1,
    );

    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
