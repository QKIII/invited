'use client';

import { useState } from 'react';
import { Check, MessageSquare, Send, Sparkles, Trash, X } from 'lucide-react';
import { formatRelativeTime } from '@/components/invite/calendarLinks';
import type { CommentRecord, EventDetailResponse, RsvpStatus } from '@/types/invite';

const REACTION_EMOJIS = ['🎉', '❤️', '🍽️', '🥂', '🔥'] as const;

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

export function EventWall({
  eventId,
  comments,
  isHost,
  editKey,
  guestToken,
  defaultAuthorName,
  viewerRsvpStatus,
  onCommentsChange,
  onRefreshDetail,
}: EventWallProps) {
  const [authorName, setAuthorName] = useState<string>('');
  const [hasEditedAuthor, setHasEditedAuthor] = useState<boolean>(false);
  const [body, setBody] = useState<string>('');
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reactingKey, setReactingKey] = useState<string | null>(null);
  const [reactedMap, setReactedMap] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveAuthor = hasEditedAuthor ? authorName : authorName || defaultAuthorName || '';

  const submitComment = async () => {
    setErrorMessage(null);
    const trimmedAuthor = effectiveAuthor.trim();
    const trimmedBody = body.trim();

    if (!trimmedAuthor) {
      setErrorMessage('Please enter your name before posting to the wall.');
      return;
    }
    if (!trimmedBody) {
      setErrorMessage('Please write a message first.');
      return;
    }

    setIsPosting(true);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(editKey ? { 'x-edit-key': editKey } : {}),
          ...(guestToken ? { 'x-guest-token': guestToken } : {}),
        },
        body: JSON.stringify({
          authorName: trimmedAuthor,
          body: trimmedBody,
          editKey: editKey || undefined,
          guestToken: guestToken || undefined,
          rsvpStatus: viewerRsvpStatus,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        comment?: CommentRecord;
        comments?: CommentRecord[];
        detail?: EventDetailResponse;
      };

      if (!response.ok) {
        setErrorMessage(data.error || 'Could not post your message. Please try again.');
        return;
      }

      setBody('');
      if (data.detail?.comments) {
        onCommentsChange(data.detail.comments);
      } else if (Array.isArray(data.comments)) {
        onCommentsChange(data.comments);
      } else if (data.comment) {
        onCommentsChange([...comments, data.comment]);
      } else {
        await onRefreshDetail();
      }
    } catch {
      setErrorMessage('Network error while posting. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submitComment();
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submitComment();
    }
  };

  const handleReact = async (commentId: string, emoji: string) => {
    const key = `${commentId}:${emoji}`;
    if (reactingKey === key) return;
    setReactingKey(key);
    const wasPressed = Boolean(reactedMap[key]);
    const delta = wasPressed ? -1 : 1;

    try {
      const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'react',
          commentId,
          emoji,
          delta,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        comment?: CommentRecord;
        comments?: CommentRecord[];
        detail?: EventDetailResponse;
      };

      if (response.ok) {
        setReactedMap((prev) => ({ ...prev, [key]: !wasPressed }));
        if (data.detail?.comments) {
          onCommentsChange(data.detail.comments);
        } else if (Array.isArray(data.comments)) {
          onCommentsChange(data.comments);
        } else if (data.comment) {
          const updated = data.comment;
          onCommentsChange(comments.map((c) => (c.id === updated.id ? updated : c)));
        } else {
          await onRefreshDetail();
        }
      }
    } finally {
      setReactingKey(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!isHost || !editKey) return;
    setDeletingId(commentId);
    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(eventId)}/comments/${encodeURIComponent(commentId)}`,
        {
          method: 'DELETE',
          headers: {
            'x-edit-key': editKey,
          },
        },
      );
      if (response.ok) {
        onCommentsChange(comments.filter((c) => c.id !== commentId));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      aria-labelledby="event-wall-heading"
      className="invite-card rounded-2xl border p-5 sm:p-6 space-y-5"
      style={{
        backgroundColor: 'var(--theme-surface-bg)',
        borderColor: 'var(--theme-border)',
      }}
    >
      <div>
        <h2
          id="event-wall-heading"
          className="text-xl font-semibold tracking-tight flex items-center gap-2"
          style={{ fontFamily: 'var(--theme-font-heading)' }}
        >
          <MessageSquare className="h-5 w-5" style={{ color: 'var(--theme-accent)' }} aria-hidden="true" />
          <span>Event Wall</span>
          {comments.length > 0 && (
            <span className="text-sm font-normal" style={{ color: 'var(--theme-text-muted)' }}>
              ({comments.length})
            </span>
          )}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
          Coordinate rides, ask questions, or drop a warm note for everyone.
        </p>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-3" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="wall-author-name" className="block text-sm font-medium">
            Your Name
          </label>
          <input
            id="wall-author-name"
            type="text"
            required
            autoComplete="name"
            value={effectiveAuthor}
            onChange={(e) => {
              setHasEditedAuthor(true);
              setAuthorName(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="Your name"
            className="w-full rounded-xl border px-3.5 py-2.5 min-h-[48px] focus:outline-none focus-visible:ring-2"
            style={{
              fontSize: 'max(1rem, 1em)',
              backgroundColor: 'var(--theme-card-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="wall-comment-body" className="block text-sm font-medium">
            Message
          </label>
          <textarea
            id="wall-comment-body"
            rows={2}
            required
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Say hi, coordinate carpools, or ask about parking..."
            className="w-full rounded-xl border px-3.5 py-2.5 focus:outline-none focus-visible:ring-2"
            style={{
              resize: 'vertical',
              fontSize: 'max(1rem, 1em)',
              backgroundColor: 'var(--theme-card-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-primary)',
            }}
          />
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-sm text-red-400"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs hidden sm:inline" style={{ color: 'var(--theme-text-muted)' }}>
            Tip: Press Cmd/Ctrl + Enter to post
          </span>
          <button
            type="submit"
            disabled={isPosting}
            className="invite-on-accent ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold min-h-[48px] transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
            style={{ backgroundColor: 'var(--theme-accent)' }}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>{isPosting ? 'Posting...' : 'Post Note'}</span>
          </button>
        </div>
      </form>

      {comments.length === 0 ? (
        <p
          className="rounded-xl border border-dashed p-5 text-center text-sm"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-muted)',
          }}
        >
          No wall notes yet. Start the conversation!
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-xl border p-4 space-y-2.5"
              style={{
                backgroundColor: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm sm:text-base">
                    {comment.authorName}
                  </span>

                  {comment.isHost && (
                    <span
                      className="invite-on-accent inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: 'var(--theme-accent)' }}
                    >
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      Host
                    </span>
                  )}

                  {!comment.isHost && comment.rsvpStatus === 'yes' && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor:
                          'color-mix(in srgb, var(--theme-accent) 16%, transparent)',
                      }}
                    >
                      Going
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </span>
                  )}

                  {!comment.isHost && comment.rsvpStatus === 'no' && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                      style={{
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text-muted)',
                      }}
                    >
                      Can&apos;t Go
                      <X className="h-3 w-3" aria-hidden="true" />
                    </span>
                  )}

                  <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    {formatRelativeTime(comment.createdAt)}
                  </span>
                </div>

                {isHost && (
                  <button
                    type="button"
                    aria-label={`Delete comment by ${comment.authorName}`}
                    disabled={deletingId === comment.id}
                    onClick={() => void handleDeleteComment(comment.id)}
                    className="inline-flex h-10 w-10 min-w-[44px] min-h-[44px] items-center justify-center rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40 cursor-pointer"
                    style={{ color: 'var(--theme-text-muted)' }}
                  >
                    <Trash className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <p className="text-sm sm:text-base whitespace-pre-wrap break-words leading-relaxed">
                {comment.body}
              </p>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {REACTION_EMOJIS.map((emoji) => {
                  const count = comment.reactions?.[emoji] ?? 0;
                  const reactKey = `${comment.id}:${emoji}`;
                  const pressed = Boolean(reactedMap[reactKey]);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`React with ${emoji}${count > 0 ? `, ${count} reactions` : ''}`}
                      aria-pressed={pressed}
                      disabled={reactingKey === reactKey}
                      onClick={() => void handleReact(comment.id, emoji)}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium min-h-[40px] transition-colors hover:opacity-90 cursor-pointer"
                      style={{
                        borderColor:
                          pressed || count > 0
                            ? 'var(--theme-accent)'
                            : 'var(--theme-border)',
                        backgroundColor: pressed
                          ? 'color-mix(in srgb, var(--theme-accent) 18%, transparent)'
                          : 'var(--theme-surface-bg)',
                      }}
                    >
                      <span aria-hidden="true">{emoji}</span>
                      {count > 0 && <span className="tabular-nums">{count}</span>}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
