'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowLeft, History } from 'lucide-react';
import { InviteStudio } from '@/components/studio/InviteStudio';
import { RecentEventsDialog } from '@/components/studio/RecentEventsDialog';
import { getBrowserTimeZone } from '@/components/studio/dateTimeUtils';
import {
  consumeStudioDraft,
  getRecentEvents,
  getRecentEventsServerSnapshot,
  subscribeRecentEvents,
} from '@/lib/client/recentEvents';
import {
  parseEventPrompt,
  type ParsedEventDraft,
} from '@/lib/nlp/parseEventPrompt';

interface CreateInviteClientProps {
  initialPrompt?: string;
}

export function CreateInviteClient({ initialPrompt }: CreateInviteClientProps) {
  const [sessionDraft, setSessionDraft] = useState<ParsedEventDraft | null>(
    null,
  );
  const [myEventsOpen, setMyEventsOpen] = useState(false);
  const recentEvents = useSyncExternalStore(
    subscribeRecentEvents,
    getRecentEvents,
    getRecentEventsServerSnapshot,
  );
  const recentCount = recentEvents.length;

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const saved = consumeStudioDraft();
      if (saved) {
        setSessionDraft(saved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fallbackPromptDraft = useMemo(() => {
    if (!initialPrompt || !initialPrompt.trim()) return null;
    return parseEventPrompt(
      initialPrompt.trim(),
      new Date(),
      getBrowserTimeZone(),
    );
  }, [initialPrompt]);

  const activeDraft = sessionDraft ?? fallbackPromptDraft;
  const studioKey = sessionDraft
    ? 'session-draft'
    : initialPrompt
      ? `prompt-${initialPrompt.slice(0, 32)}`
      : 'blank';

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.12),transparent_48%),radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.1),transparent_50%)]"
      />

      <header className="relative z-10 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-white/[0.12] transition min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Back</span>
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="text-xl tracking-tight text-white"
                  style={{
                    fontFamily: 'var(--font-editorial-serif), Georgia, serif',
                  }}
                >
                  invited
                </Link>
                <span className="text-slate-600">/</span>
                <h1 className="text-sm sm:text-base font-semibold text-white truncate">
                  Create Invite
                </h1>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMyEventsOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-white/[0.14] transition min-h-[44px]"
          >
            <History className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            <span>My Events</span>
            {recentCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400/20 px-1.5 text-xs font-semibold text-emerald-200">
                {recentCount}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <InviteStudio
          key={studioKey}
          mode="create"
          initialDraft={activeDraft}
        />
      </main>

      <RecentEventsDialog
        open={myEventsOpen}
        onClose={() => setMyEventsOpen(false)}
      />
    </div>
  );
}
