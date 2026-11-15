import { beforeEach, describe, expect, it } from 'vitest';
import {
  extractEditKeyFromInput,
  getRecentEvents,
  getSavedHostKey,
  rememberHostEvent,
  rememberVisitedEvent,
  removeRecentEvent,
  saveHostKey,
} from '@/lib/client/recentEvents';
import {
  isoToLocalFields,
  parseInvitedNames,
  validateAndBuildZonedIso,
} from '@/components/studio/dateTimeUtils';
import { sanitizeRichTextHtml } from '@/components/editor/SafePreviewHtml';

describe('recentEvents localStorage & capability key helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('extracts edit keys from full URLs, relative paths, and raw keys', () => {
    expect(
      extractEditKeyFromInput('https://invited.app/e/abc123/edit?key=secret_XYZ'),
    ).toBe('secret_XYZ');
    expect(extractEditKeyFromInput('/e/abc123/edit?key=key%2B123')).toBe(
      'key+123',
    );
    expect(extractEditKeyFromInput('  rawSecretKey99  ')).toBe(
      'rawSecretKey99',
    );
  });

  it('remembers host events, syncs invited_host_keys, and preserves host role on revisit', () => {
    rememberHostEvent({
      id: 'ev1',
      title: 'Christmas Cocoa Night',
      startIso: '2026-12-09T15:00:00-05:00',
      timeZone: 'America/New_York',
      locationName: '42 Maple St',
      themeId: 'cozy-christmas',
      editKey: 'host-secret-1',
    });

    expect(getSavedHostKey('ev1')).toBe('host-secret-1');
    const hostMapRaw = window.localStorage.getItem('invited_host_keys');
    expect(JSON.parse(hostMapRaw ?? '{}')).toEqual({ ev1: 'host-secret-1' });

    // Guest visit on same browser must not strip saved host key
    rememberVisitedEvent({
      id: 'ev1',
      title: 'Christmas Cocoa Night Updated',
    });
    const list = getRecentEvents();
    expect(list).toHaveLength(1);
    expect(list[0].role).toBe('host');
    expect(list[0].editKey).toBe('host-secret-1');
    expect(list[0].editUrl).toBe('/e/ev1/edit?key=host-secret-1');

    // Manual key save works too
    saveHostKey('ev2', 'manual-key-2');
    expect(getSavedHostKey('ev2')).toBe('manual-key-2');

    removeRecentEvent('ev1');
    expect(getSavedHostKey('ev1')).toBeNull();
  });
});

describe('dateTimeUtils & Temporal DST conflict detection', () => {
  it('parses and deduplicates invited guest names across commas and newlines', () => {
    expect(
      parseInvitedNames('Alice, bob,\nAlice\n  Charlie  Smith , , bob '),
    ).toEqual(['Alice', 'bob', 'Charlie Smith']);
  });

  it('builds exact offset ISO for valid local date/time', async () => {
    const res = await validateAndBuildZonedIso(
      '2026-12-09',
      '15:00',
      'America/New_York',
    );
    expect(res.error).toBeUndefined();
    expect(res.dstConflict).toBeUndefined();
    expect(res.iso).toBe('2026-12-09T15:00:00-05:00');

    const roundTrip = await isoToLocalFields(res.iso, 'America/Los_Angeles');
    expect(roundTrip).toEqual({ date: '2026-12-09', time: '12:00' });
  });

  it('detects spring-forward nonexistent hour via Temporal disambiguation reject', async () => {
    const res = await validateAndBuildZonedIso(
      '2026-03-08',
      '02:30',
      'America/New_York',
    );
    expect(res.iso).toBeUndefined();
    expect(res.dstConflict?.kind).toBe('nonexistent');
    expect(res.dstConflict?.laterTime).toBe('03:30');
  });

  it('detects fall-back ambiguous hour and resolves earlier/later overrides', async () => {
    const conflict = await validateAndBuildZonedIso(
      '2026-11-01',
      '01:30',
      'America/New_York',
    );
    expect(conflict.iso).toBeUndefined();
    expect(conflict.dstConflict?.kind).toBe('ambiguous');

    const earlier = await validateAndBuildZonedIso(
      '2026-11-01',
      '01:30',
      'America/New_York',
      'earlier',
    );
    const later = await validateAndBuildZonedIso(
      '2026-11-01',
      '01:30',
      'America/New_York',
      'later',
    );
    expect(earlier.iso).toBe('2026-11-01T01:30:00-04:00');
    expect(later.iso).toBe('2026-11-01T01:30:00-05:00');
  });
});

describe('SafePreviewHtml client sanitizer', () => {
  it('strips scripts, event handlers, and javascript URIs while keeping safe prose tags', async () => {
    const dirty =
      '<p>Join <strong>us</strong>!</p><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">bad</a><a href="https://example.com">good</a><ul><li>Cocoa</li></ul>';
    const clean = await sanitizeRichTextHtml(dirty);
    expect(clean).toContain('<p>Join <strong>us</strong>!</p>');
    expect(clean).toContain('<ul><li>Cocoa</li></ul>');
    expect(clean).toContain('href="https://example.com"');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('javascript:');
  });
});
