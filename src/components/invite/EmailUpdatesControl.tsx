'use client';

import React, { useId, useState } from 'react';
import type {
  ActiveEmailNotifyLevel,
  EmailNotifyLevel,
  ViewerSubscription,
} from '@/types/invite';

export type { ActiveEmailNotifyLevel, EmailNotifyLevel, ViewerSubscription };
export type ViewerSubscriptionData = ViewerSubscription;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmailAddress(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'Please enter your email address.';
  }
  if (trimmed.length > 254 || !EMAIL_RE.test(trimmed)) {
    return 'Please enter a valid email address (like name@example.com).';
  }
  return null;
}

export const ACTIVE_EMAIL_NOTIFY_LEVELS: readonly ActiveEmailNotifyLevel[] = [
  'changes',
  'host_posts',
  'all_posts',
] as const;

export const EMAIL_NOTIFY_LEVEL_META: Record<
  ActiveEmailNotifyLevel,
  {
    value: 1 | 2 | 3;
    label: string;
    badgeLabel: string;
    description: string;
  }
> = {
  changes: {
    value: 1,
    label: 'Event updates',
    badgeLabel: 'Updates',
    description: 'Only time, location, or event detail changes',
  },
  host_posts: {
    value: 2,
    label: 'Host posts',
    badgeLabel: 'Host posts',
    description: 'Event detail changes + host announcements',
  },
  all_posts: {
    value: 3,
    label: 'All posts',
    badgeLabel: 'All posts',
    description: 'Event changes, host posts & every wall comment',
  },
};

export function levelToValue(level: ActiveEmailNotifyLevel): 1 | 2 | 3 {
  return EMAIL_NOTIFY_LEVEL_META[level].value;
}

export function valueToLevel(val: number): ActiveEmailNotifyLevel {
  if (val <= 1) return 'changes';
  if (val >= 3) return 'all_posts';
  return 'host_posts';
}

interface AnimatedBellProps {
  level: EmailNotifyLevel;
  pulseKey?: number;
  className?: string;
}

export function AnimatedBell({
  level,
  pulseKey = 0,
  className = 'w-8 h-6',
}: AnimatedBellProps) {
  const swingClass =
    level === 'changes'
      ? 'bell-swing-changes'
      : level === 'host_posts'
        ? 'bell-swing-host'
        : level === 'all_posts'
          ? 'bell-swing-all'
          : undefined;

  const fillOpacity =
    level === 'off'
      ? 0
      : level === 'changes'
        ? 0.14
        : level === 'host_posts'
          ? 0.24
          : 0.34;

  const showInnerWaves = level === 'host_posts' || level === 'all_posts';
  const showOuterWaves = level === 'all_posts';

  return (
    <svg
      key={`${level}-${pulseKey}`}
      viewBox="0 0 40 28"
      fill="none"
      aria-hidden="true"
      className={`${className} shrink-0 overflow-visible ${level === 'off' ? 'opacity-50' : ''}`}
      style={{
        color: level === 'off' ? 'var(--theme-text-muted)' : 'var(--theme-accent)',
      }}
    >
      {showInnerWaves ? (
        <g className="bell-waves-pop">
          <path
            d="M10.4 9.5a6.2 6.2 0 0 0 0 7.2"
            stroke="currentColor"
            strokeWidth={level === 'all_posts' ? 1.9 : 1.6}
            strokeLinecap="round"
            opacity={level === 'all_posts' ? 0.95 : 0.78}
          />
          <path
            d="M29.6 9.5a6.2 6.2 0 0 1 0 7.2"
            stroke="currentColor"
            strokeWidth={level === 'all_posts' ? 1.9 : 1.6}
            strokeLinecap="round"
            opacity={level === 'all_posts' ? 0.95 : 0.78}
          />
          {showOuterWaves ? (
            <>
              <path
                d="M7.1 7.3a9.6 9.6 0 0 0 0 11.6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                opacity="0.9"
              />
              <path
                d="M32.9 7.3a9.6 9.6 0 0 1 0 11.6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                opacity="0.9"
              />
            </>
          ) : null}
        </g>
      ) : null}

      <g className={swingClass}>
        <path
          d="M18.3 4.6a1.7 1.7 0 0 1 3.4 0"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M14.6 11.4a5.4 5.4 0 0 1 10.8 0c0 4 1.55 5.8 2.35 6.7a.7.7 0 0 1-.52 1.17H12.77a.7.7 0 0 1-.52-1.17c.8-.9 2.35-2.7 2.35-6.7Z"
          fill="currentColor"
          fillOpacity={fillOpacity}
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <g className={level === 'all_posts' ? 'bell-clapper-all' : undefined}>
          <path
            d="M18 19.4a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            fill="currentColor"
            fillOpacity={level === 'all_posts' ? 0.85 : 0.25}
          />
        </g>
      </g>
    </svg>
  );
}

interface NotifyLevelSliderProps {
  notifyLevel: ActiveEmailNotifyLevel;
  onNotifyLevelChange: (level: ActiveEmailNotifyLevel) => void;
  sliderTestId?: string;
  stopTestIdPrefix?: string;
  disabled?: boolean;
}

export function NotifyLevelSlider({
  notifyLevel,
  onNotifyLevelChange,
  sliderTestId = 'rsvp-notify-slider',
  stopTestIdPrefix = 'notify-stop',
  disabled = false,
}: NotifyLevelSliderProps) {
  const sliderId = useId();
  const descId = useId();
  const val = levelToValue(notifyLevel);
  const activeMeta = EMAIL_NOTIFY_LEVEL_META[notifyLevel];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={sliderId}
          className="text-xs font-medium"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          Email frequency
        </label>
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          style={{
            backgroundColor: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-accent)',
            color: 'var(--theme-accent)',
          }}
        >
          {activeMeta.label}
        </span>
      </div>

      <input
        type="range"
        id={sliderId}
        name="notifyLevelStop"
        data-testid={sliderTestId}
        min={1}
        max={3}
        step={1}
        disabled={disabled}
        value={val}
        aria-valuetext={`${activeMeta.label}: ${activeMeta.description}`}
        aria-describedby={descId}
        onChange={(e) => onNotifyLevelChange(valueToLevel(Number(e.target.value)))}
        style={{ '--progress': `${((val - 1) / 2) * 100}%` } as React.CSSProperties}
        className="invite-notify-slider w-full h-7"
      />

      <div
        className="grid grid-cols-3 gap-1.5"
        role="group"
        aria-label="Notification level options"
      >
        {ACTIVE_EMAIL_NOTIFY_LEVELS.map((levelKey) => {
          const meta = EMAIL_NOTIFY_LEVEL_META[levelKey];
          const isSelected = notifyLevel === levelKey;
          return (
            <button
              key={levelKey}
              type="button"
              disabled={disabled}
              data-testid={`${stopTestIdPrefix}-${levelKey}`}
              aria-pressed={isSelected}
              onClick={() => onNotifyLevelChange(levelKey)}
              className="min-h-[36px] rounded-xl border px-2 py-1.5 text-[11px] sm:text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              style={
                isSelected
                  ? {
                      backgroundColor: 'var(--theme-accent)',
                      borderColor: 'var(--theme-accent)',
                      color: 'var(--theme-on-accent)',
                    }
                  : {
                      backgroundColor: 'var(--theme-card-bg)',
                      borderColor: 'var(--theme-hairline)',
                      color: 'var(--theme-text-muted)',
                    }
              }
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      <p
        id={descId}
        className="text-xs leading-snug"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        {activeMeta.description}
      </p>
    </div>
  );
}

interface EmailUpdatesControlProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  email: string;
  onEmailChange: (value: string) => void;
  onEmailBlur?: () => void;
  emailError?: string | null;
  notifyLevel: ActiveEmailNotifyLevel;
  onNotifyLevelChange: (level: ActiveEmailNotifyLevel) => void;
  emailInputId?: string;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function EmailUpdatesControl({
  enabled,
  onEnabledChange,
  email,
  onEmailChange,
  onEmailBlur,
  emailError,
  notifyLevel,
  onNotifyLevelChange,
  emailInputId,
  emailInputRef,
}: EmailUpdatesControlProps) {
  const toggleId = useId();
  const generatedEmailId = useId();
  const errorId = useId();
  const [bellPulse, setBellPulse] = useState(0);

  const resolvedEmailId = emailInputId ?? generatedEmailId;
  const bellLevel: EmailNotifyLevel = enabled ? notifyLevel : 'off';
  const statusLabel = enabled
    ? EMAIL_NOTIFY_LEVEL_META[notifyLevel].badgeLabel
    : 'Off';

  function handleToggleChange(nextEnabled: boolean) {
    if (nextEnabled) {
      setBellPulse((p) => p + 1);
    }
    onEnabledChange(nextEnabled);
  }

  function handleLevelChange(nextLevel: ActiveEmailNotifyLevel) {
    setBellPulse((p) => p + 1);
    onNotifyLevelChange(nextLevel);
  }

  return (
    <div
      className="rounded-2xl border px-3.5 py-1.5 transition-colors"
      style={{
        backgroundColor: 'var(--theme-surface-bg)',
        borderColor: enabled ? 'var(--theme-accent)' : 'var(--theme-hairline)',
      }}
    >
      <div className="flex items-center justify-between gap-2 min-h-[48px]">
        <div className="flex items-center gap-2.5 flex-1 min-w-0 min-h-[48px]">
          <input
            type="checkbox"
            id={toggleId}
            name="emailUpdatesEnabled"
            data-testid="rsvp-email-updates-toggle"
            checked={enabled}
            onChange={(e) => handleToggleChange(e.target.checked)}
            className="invite-checkbox h-4 w-4 shrink-0 rounded"
            style={{ accentColor: 'var(--theme-accent)' }}
          />
          <label
            htmlFor={toggleId}
            className="invite-checkbox-label flex-1 min-h-[48px] inline-flex items-center text-xs sm:text-sm font-medium cursor-pointer"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            Email me event updates
          </label>
        </div>

        <button
          type="button"
          onClick={() => setBellPulse((p) => p + 1)}
          aria-label={
            enabled
              ? `Replay notification bell preview (${EMAIL_NOTIFY_LEVEL_META[notifyLevel].label})`
              : 'Notification alerts off'
          }
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 min-h-[34px] text-[11px] font-semibold transition hover:opacity-90 cursor-pointer shrink-0"
          style={{
            backgroundColor: 'var(--theme-card-bg)',
            borderColor: enabled ? 'var(--theme-accent)' : 'var(--theme-hairline)',
            color: enabled ? 'var(--theme-accent)' : 'var(--theme-text-muted)',
          }}
        >
          <AnimatedBell
            key={`${bellLevel}-${bellPulse}`}
            level={bellLevel}
            pulseKey={bellPulse}
            className="w-7 h-5"
          />
          <span>{statusLabel}</span>
        </button>
      </div>

      {enabled ? (
        <div
          className="pt-2.5 pb-2 border-t space-y-3"
          style={{ borderColor: 'var(--theme-hairline)' }}
        >
          <div>
            <label
              htmlFor={resolvedEmailId}
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              Email address
            </label>
            <input
              ref={emailInputRef}
              id={resolvedEmailId}
              name="guestEmail"
              data-testid="rsvp-email-input"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="done"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              onBlur={onEmailBlur}
              placeholder="you@example.com"
              aria-invalid={Boolean(emailError) || undefined}
              aria-describedby={emailError ? errorId : undefined}
              className="w-full rounded-xl border px-3.5 py-2 text-base sm:text-sm min-h-[44px] outline-none focus-visible:ring-2"
              style={{
                backgroundColor: 'var(--theme-card-bg)',
                borderColor: emailError ? '#f43f5e' : 'var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
            />
            {emailError ? (
              <p
                id={errorId}
                role="alert"
                className="mt-1.5 text-xs font-medium text-rose-500"
              >
                {emailError}
              </p>
            ) : null}
          </div>

          <NotifyLevelSlider
            notifyLevel={notifyLevel}
            onNotifyLevelChange={handleLevelChange}
            sliderTestId="rsvp-notify-slider"
            stopTestIdPrefix="notify-stop"
          />
        </div>
      ) : null}
    </div>
  );
}
