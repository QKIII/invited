'use client';

import React, { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { Send, Trash2 } from 'lucide-react';
import {
  getDeviceProfile,
  getDeviceProfileServerSnapshot,
  saveDeviceProfile,
  subscribeDeviceProfile,
} from '@/lib/client/deviceProfile';
import type { CommentRecord, RsvpStatus } from '@/types/invite';
import { formatRelativeTime } from './calendarLinks';
import { GuestAvatar } from './GuestAvatar';

interface EventWallProps {
  eventId: string;
  comments: CommentRecord[];
  isHost: boolean;
  editKey: string | null;
  guestToken: string | null;
  defaultAuthorName?: string;
  viewerRsvpStatus?: RsvpStatus;
  onCommentsChange: (comments: CommentRecord[]) => void;
  onRefreshDetail: () => Promise<void>;
}

const REACTION_EMOJIS = ['🎉', '❤️', '🍽️', '🙌'] as const;

export function EventWall({
  eventId,
  comments,
  isHost,
  editKey,
  guestToken,
  defaultAuthorName = '',
  viewerRsvpStatus,
  onCommentsChange,
  onRefreshDetail,
}: EventWallProps) {
  const headingId = useId();
  const deviceProfile = useSyncExternalStore(
    subscribeDeviceProfile,
    getDeviceProfile,
    getDeviceProfileServerSnapshot,
  );

  const knownDefaultName = defaultAuthorName.trim() || deviceProfile?.name?.trim() || '';
  const [customAuthorName, setCustomAuthorName] = useState<string | null>(null);
  const authorName = customAuthorName ?? knownDefaultName;
  const [editingAuthorName, setEditingAuthorName] = useState<boolean>(false);
  const [body, setBody] = useState<string>('');
  const [posting, setPosting] = useState<boolean>(false);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeReactions, setActiveReactions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = window.localStorage.getItem(`invited_wall_reactions:${eventId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            setActiveReactions(parsed as Record<string, boolean>);
          }
        }
      } catch {
        // Ignore storage access errors
      }
    });
    return () => {
      active = false;
    };
  }, [eventId]);

  const effectiveAuthorName = authorName.trim() || knownDefaultName;
  const showNameInput = !effectiveAuthorName || editingAuthorName;

  async function submitComment() {
    const trimmedName = (showNameInput ? authorName : effectiveAuthorName).trim();
    const trimmedBody = body.trim();
    if (!trimmedName) {
      setEditingAuthorName(true);
      setErrorMsg('Please enter your name to post.');
      return;
    }
    if (!trimmedBody) {
      setErrorMsg('Please enter a message.');
      return;
    }

    setPosting(true);
    setErrorMsg(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (editKey) headers['x-edit-key'] = editKey;
      if (guestToken) headers['x-guest-token'] = guestToken;

      const res = await fetch(`/api/events/${eventId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          authorName: trimmedName,
          body: trimmedBody,
          rsvpStatus: viewerRsvpStatus,
          editKey: editKey ?? undefined,
        }),
      });

      const data = (await res.json()) as { comment?: CommentRecord; error?: string };
      if (!res.ok || !data.comment) {
        setErrorMsg(data.error ?? 'Could not post your comment.');
        return;
      }

      saveDeviceProfile({ name: trimmedName });
      setCustomAuthorName(trimmedName);
      setEditingAuthorName(false);
      setBody('');
      onCommentsChange([data.comment, ...comments]);
      await onRefreshDetail();
    } catch {
      setErrorMsg('Network error posting your comment.');
    } finally {
      setPosting(false);
    }
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submitComment();
  }

  function handleBodyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submitComment();
    }
  }

  async function handleReact(commentId: string, emoji: string) {
    const key = `${commentId}:${emoji}`;
    const wasActive = Boolean(activeReactions[key]);
    const delta = wasActive ? -1 : 1;
    setReactingId(key);
    try {
      const res = await fetch(`/api/events/${eventId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'react',
          commentId,
          emoji,
          delta,
        }),
      });
      const data = (await res.json()) as { comment?: CommentRecord; error?: string };
      if (res.ok && data.comment) {
        const nextActive = { ...activeReactions, [key]: !wasActive };
        if (wasActive) {
          delete nextActive[key];
        }
        setActiveReactions(nextActive);
        try {
          window.localStorage.setItem(
            `invited_wall_reactions:${eventId}`,
            JSON.stringify(nextActive),
          );
        } catch {
          // Ignore storage quota errors
        }
        onCommentsChange(comments.map((c) => (c.id === commentId ? data.comment! : c)));
      }
    } catch {
      // Ignore transient reaction network failure
    } finally {
      setReactingId(null);
    }
  }

  async function handleDelete(commentId: string) {
    if (!editKey) return;
    setDeletingId(commentId);
    try {
      const res = await fetch(`/api/events/${eventId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'x-edit-key': editKey,
        },
      });
      if (res.ok) {
        onCommentsChange(comments.filter((c) => c.id !== commentId));
      }
    } catch {
      setErrorMsg('Could not delete comment.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section id="wall-section" aria-labelledby={headingId} className="space-y-3.5">
      <div
        className="flex items-center justify-between gap-2 pb-2 border-b"
        style={{ borderColor: 'var(--theme-hairline)' }}
      >
        <h2
          id={headingId}
          className="text-sm font-medium"
          style={{
            color: 'var(--theme-text-muted)',
            fontFamily: 'var(--font-invite-display), var(--font-invite-body), sans-serif',
          }}
        >
          Activity{comments.length > 0 ? ` (${comments.length})` : ''}
        </h2>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-2">
        {showNameInput ? (
          <input
            id="wall-author-name"
            type="text"
            maxLength={80}
            autoComplete="name"
            value={authorName}
            onChange={(e) => setCustomAuthorName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border px-3.5 py-2 text-sm outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--theme-surface-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          />
        ) : null}

        <div className="flex items-start gap-2.5">
          {effectiveAuthorName ? (
            <GuestAvatar name={effectiveAuthorName} size="sm" className="mt-1.5" />
          ) : null}
          <div className="flex-1 min-w-0 flex items-end gap-2">
            <textarea
              id="wall-comment-body"
              rows={2}
              maxLength={600}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleBodyKeyDown}
              placeholder="Add a comment or what you're bringing..."
              aria-label="Comment message"
              className="w-full min-w-0 rounded-xl border px-3.5 py-2 text-sm outline-none focus:ring-2 resize-y"
              style={{
                backgroundColor: 'var(--theme-surface-bg)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            />
            <button
              type="submit"
              disabled={posting}
              aria-label="Post comment"
              className="h-9 shrink-0 rounded-xl px-3.5 text-xs sm:text-sm font-semibold transition hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-accent)',
                color: 'var(--theme-on-accent)',
              }}
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{posting ? '...' : 'Post'}</span>
            </button>
          </div>
        </div>

        {!showNameInput && effectiveAuthorName ? (
          <p className="text-xs pl-9" style={{ color: 'var(--theme-text-muted)' }}>
            Posting as <span className="font-medium">{effectiveAuthorName}</span> ·{' '}
            <button
              type="button"
              onClick={() => setEditingAuthorName(true)}
              className="underline underline-offset-2 hover:opacity-100 cursor-pointer"
            >
              Change
            </button>
          </p>
        ) : null}

        {errorMsg ? (
          <p role="alert" className="text-xs font-medium text-rose-300">
            {errorMsg}
          </p>
        ) : null}
      </form>

      {comments.length > 0 ? (
        <ul className="divide-y" style={{ borderColor: 'var(--theme-hairline)' }}>
          {comments.map((comment) => {
            const existingReactions = Object.entries(comment.reactions ?? {}).filter(
              ([, count]) => count > 0,
            );
            return (
              <li
                key={comment.id}
                className="py-3.5 space-y-2"
                style={{ borderColor: 'var(--theme-hairline)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <GuestAvatar name={comment.authorName} size="sm" className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-sm font-medium break-words"
                          style={{ color: 'var(--theme-text-primary)' }}
                        >
                          {comment.authorName}
                        </span>
                        {comment.isHost ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              backgroundColor: 'var(--theme-surface-bg)',
                              color: 'var(--theme-accent)',
                            }}
                          >
                            Host
                          </span>
                        ) : null}
                        <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                          · {formatRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <p
                        className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words"
                        style={{ color: 'var(--theme-text-primary)' }}
                      >
                        {comment.body}
                      </p>
                    </div>
                  </div>

                  {isHost && editKey ? (
                    <button
                      type="button"
                      disabled={deletingId === comment.id}
                      aria-label={`Delete comment by ${comment.authorName}`}
                      onClick={() => void handleDelete(comment.id)}
                      className="shrink-0 rounded-lg p-1.5 opacity-60 hover:opacity-100 disabled:opacity-35 transition cursor-pointer"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pl-9">
                  {existingReactions.map(([emoji, count]) => {
                    const isActive = Boolean(activeReactions[`${comment.id}:${emoji}`]);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        aria-pressed={isActive}
                        aria-label={`React with ${emoji} (${count})`}
                        disabled={reactingId === `${comment.id}:${emoji}`}
                        onClick={() => void handleReact(comment.id, emoji)}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition hover:opacity-90 cursor-pointer"
                        style={
                          isActive
                            ? {
                                backgroundColor: 'var(--theme-accent)',
                                borderColor: 'var(--theme-accent)',
                                color: 'var(--theme-on-accent)',
                              }
                            : {
                                backgroundColor: 'var(--theme-surface-bg)',
                                borderColor: 'var(--theme-hairline)',
                                color: 'var(--theme-text-primary)',
                              }
                        }
                      >
                        <span>{emoji}</span>
                        <span className="tabular-nums text-[11px]">{count}</span>
                      </button>
                    );
                  })}

                  {REACTION_EMOJIS.filter((emoji) => !(comment.reactions?.[emoji] > 0)).map(
                    (emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        aria-label={`React with ${emoji} (0)`}
                        disabled={reactingId === `${comment.id}:${emoji}`}
                        onClick={() => void handleReact(comment.id, emoji)}
                        className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs opacity-45 hover:opacity-100 transition cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ),
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
