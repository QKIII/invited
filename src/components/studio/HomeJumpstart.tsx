'use client';

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  History,
  MapPin,
  Palette,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { AmbientBackdrop } from '@/components/effects/AmbientBackdrop';
import { RecentEventsDialog } from '@/components/studio/RecentEventsDialog';
import { getBrowserTimeZone } from '@/components/studio/dateTimeUtils';
import {
  getRecentEvents,
  getRecentEventsServerSnapshot,
  saveStudioDraft,
  subscribeRecentEvents,
} from '@/lib/client/recentEvents';
import {
  EXAMPLE_EVENT_PROMPTS,
  parseEventPrompt,
  type ParsedEventDraft,
} from '@/lib/nlp/parseEventPrompt';
import { formatEventDateTime } from '@/lib/polyfills/temporal';
import {
  EFFECT_OPTIONS,
  getThemePreset,
} from '@/lib/themes/presets';

const noopSubscribe = () => () => {};

export function HomeJumpstart() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [prompt, setPrompt] = useState('');
  const deferredPrompt = useDeferredValue(prompt);
  const browserTz = useSyncExternalStore(
    noopSubscribe,
    getBrowserTimeZone,
    () => 'America/New_York',
  );
  const recentEvents = useSyncExternalStore(
    subscribeRecentEvents,
    getRecentEvents,
    getRecentEventsServerSnapshot,
  );
  const recentCount = recentEvents.length;

  const [formattedPair, setFormattedPair] = useState<{
    key: string;
    label: string;
  } | null>(null);
  const [myEventsOpen, setMyEventsOpen] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const draft: ParsedEventDraft | null = useMemo(() => {
    const trimmed = deferredPrompt.trim();
    if (!trimmed) return null;
    return parseEventPrompt(trimmed, new Date(), browserTz);
  }, [deferredPrompt, browserTz]);

  const whenKey = draft?.startIso
    ? `${draft.startIso}|${draft.endIso ?? ''}|${draft.timeZone}`
    : '';

  useEffect(() => {
    if (!draft?.startIso) return;
    let cancelled = false;
    void formatEventDateTime(draft.startIso, draft.endIso, draft.timeZone).then(
      (res) => {
        if (!cancelled) {
          setFormattedPair({ key: whenKey, label: res.fullLabel });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [draft?.startIso, draft?.endIso, draft?.timeZone, whenKey]);

  const formattedWhen =
    whenKey && formattedPair?.key === whenKey ? formattedPair.label : '';

  const matchedPreset = draft ? getThemePreset(draft.style.themeId) : null;
  const matchedEffect = draft
    ? EFFECT_OPTIONS.find((item) => item.id === draft.style.effectId)
    : null;

  const launchStudioFromPrompt = (sourceText: string) => {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      setPromptError(
        'Tell us a sentence about your event (or tap an example below), or choose Start Blank.',
      );
      textareaRef.current?.focus();
      return;
    }

    setIsNavigating(true);
    setPromptError(null);
    const parsed = parseEventPrompt(trimmed, new Date(), browserTz);
    saveStudioDraft(parsed);
    const query =
      trimmed.length <= 420
        ? `?from=prompt&prompt=${encodeURIComponent(trimmed)}`
        : '?from=prompt';
    router.push(`/create${query}`);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isNavigating) return;
    launchStudioFromPrompt(prompt);
  };

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isNavigating) {
        launchStudioFromPrompt(prompt);
      }
    }
  };

  const handlePickExample = (examplePrompt: string) => {
    setPrompt(examplePrompt);
    setPromptError(null);
    textareaRef.current?.focus();
  };

  const locationSummary =
    draft?.locationName ||
    draft?.locationAddress ||
    (draft?.virtualUrl ? 'Online link included' : '');

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050811] text-slate-100">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <AmbientBackdrop effectId="aurora" colorMode="dark" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.14),transparent_55%)]"
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-full py-1.5 pr-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-teal-300 to-violet-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20">
              i
            </span>
            <span
              className="text-2xl tracking-tight text-white"
              style={{ fontFamily: 'var(--font-editorial-serif), Georgia, serif' }}
            >
              invited
            </span>
            <span className="hidden sm:inline-flex rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-slate-300">
              Zero accounts
            </span>
          </Link>

          <nav aria-label="Primary actions" className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMyEventsOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-100 backdrop-blur-md hover:bg-white/[0.14] transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
            >
              <History className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              <span>My Events</span>
              {recentCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400/20 px-1.5 text-xs font-semibold text-emerald-200">
                  {recentCount}
                </span>
              ) : null}
            </button>

            <Link
              href="/create"
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-black/30 hover:bg-emerald-50 transition min-h-[48px] [@media(pointer:coarse)]:min-h-[52px]"
            >
              <span>Start Blank</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </nav>
        </header>

        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 pb-16 pt-4 sm:px-8 sm:pt-8">
          <div className="text-center space-y-5 mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3.5 py-1.5 text-xs font-medium text-emerald-200 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Account-free invitations · Instant Yes/No RSVPs &amp; event wall</span>
            </div>

            <h1
              className="mx-auto max-w-3xl text-4xl sm:text-6xl leading-[1.06] tracking-tight text-white [text-wrap:balance]"
              style={{ fontFamily: 'var(--font-editorial-serif), Georgia, serif' }}
            >
              Send invitations people{' '}
              <span className="italic text-emerald-300">
                genuinely look forward
              </span>{' '}
              to opening.
            </h1>

            <p className="mx-auto max-w-xl text-base sm:text-lg text-slate-300 leading-relaxed [text-wrap:pretty]">
              Describe your gathering in plain English and watch it turn into a
              crafted invite with seasonal atmosphere, guest notes, and zero
              sign-ups.
            </p>
          </div>

          <section
            aria-label="Natural language event jumpstart"
            className="invite-card rounded-3xl border border-white/15 bg-slate-950/65 p-5 sm:p-7 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="nl-event-prompt"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white"
                  >
                    <Wand2
                      className="h-4 w-4 text-emerald-300"
                      aria-hidden="true"
                    />
                    Tell us about your event
                  </label>
                  <span className="hidden sm:inline text-xs text-slate-400">
                    Press ⌘/Ctrl + Enter to jump in
                  </span>
                </div>

                <textarea
                  ref={textareaRef}
                  id="nl-event-prompt"
                  name="prompt"
                  rows={3}
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    if (promptError) setPromptError(null);
                  }}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Hey I'm doing a Christmas party on the 9th at 3 o'clock at 42 Maple St. Bringing hot cocoa & board games!"
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/80 px-4 py-3.5 text-base text-white placeholder:text-slate-400/80 focus:border-emerald-400/70 focus:outline-none focus:ring-2 focus:ring-emerald-400/25 resize-y [field-sizing:content] min-h-[112px] transition"
                />
                {promptError ? (
                  <p className="text-sm text-amber-300" role="alert">
                    {promptError}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Try an instant example
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_EVENT_PROMPTS.map((example) => (
                    <button
                      key={example.label}
                      type="button"
                      onClick={() => handlePickExample(example.prompt)}
                      className="invite-pill inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:border-emerald-300/45 hover:bg-emerald-400/15 hover:text-white transition min-h-[44px] [@media(pointer:coarse)]:min-h-[48px]"
                    >
                      <span aria-hidden="true">{example.emoji}</span>
                      <span>{example.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {draft ? (
                <div
                  aria-live="polite"
                  className="rounded-2xl border border-white/12 bg-white/[0.04] p-4 space-y-3 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      Detected from your note
                    </span>
                    <span className="text-xs text-slate-400">
                      {draft.detectedOccasionLabel}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="invite-pill inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-slate-900/90 px-3 py-1.5 text-sm text-white">
                      <Sparkles
                        className="h-3.5 w-3.5 text-emerald-300 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-slate-400 text-xs">Title:</span>
                      <strong className="font-semibold">{draft.title}</strong>
                    </span>

                    <span className="invite-pill inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-slate-900/90 px-3 py-1.5 text-sm text-white">
                      <Calendar
                        className="h-3.5 w-3.5 text-sky-300 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-slate-400 text-xs">When:</span>
                      <span className="font-medium">
                        {formattedWhen || draft.startIso}
                      </span>
                    </span>

                    {locationSummary ? (
                      <span className="invite-pill inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-slate-900/90 px-3 py-1.5 text-sm text-white">
                        <MapPin
                          className="h-3.5 w-3.5 text-rose-300 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-slate-400 text-xs">Where:</span>
                        <span className="font-medium">{locationSummary}</span>
                      </span>
                    ) : null}

                    {matchedPreset ? (
                      <span className="invite-pill inline-flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900/90 px-3 py-1.5 text-sm text-white">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: matchedPreset.accent }}
                        />
                        <Palette
                          className="h-3.5 w-3.5 text-violet-300 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="font-medium">
                          {matchedPreset.emoji} {matchedPreset.name}
                          {matchedEffect && matchedEffect.id !== 'none'
                            ? ` · ${matchedEffect.name}`
                            : ''}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isNavigating}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 px-6 py-3.5 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-105 active:scale-[0.99] transition min-h-[52px] disabled:opacity-70"
                >
                  <span>
                    {isNavigating
                      ? 'Opening Studio...'
                      : 'Create & Style Invite →'}
                  </span>
                </button>

                <Link
                  href="/create"
                  className="inline-flex items-center justify-center text-sm font-medium text-slate-300 hover:text-white underline underline-offset-4 decoration-white/30 hover:decoration-white py-2 min-h-[44px]"
                >
                  Or fill out manually without text prompt
                </Link>
              </div>
            </form>
          </section>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur-md">
              <p className="text-sm font-semibold text-white">
                Two links, zero logins
              </p>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Get one public invite link to text guests and one secret host
                link to edit anytime.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur-md">
              <p className="text-sm font-semibold text-white">
                Crisp Yes or No RSVPs
              </p>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                No vague maybes. Guests share headcount, dishes they&apos;re
                bringing, and chat on the wall.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur-md">
              <p className="text-sm font-semibold text-white">
                Works on every phone
              </p>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Open effortlessly from iMessage, WhatsApp, or SMS with rich link
                previews and calendar export.
              </p>
            </div>
          </div>
        </main>
      </div>

      <RecentEventsDialog
        open={myEventsOpen}
        onClose={() => setMyEventsOpen(false)}
      />
    </div>
  );
}
