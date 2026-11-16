import { NextResponse } from 'next/server';
import {
  isEmailConfigured,
  sendSubscriptionConfirmationEmail,
} from '@/lib/notifications/email';
import { ValidationError } from '@/lib/storage/errors';
import {
  addSubscriber,
  getEventDetail,
  normalizeNotifyLevel,
  removeGuestEmailSubscription,
  removeSubscriberByTarget,
  type PushSubscriptionPayload,
} from '@/lib/storage/events';
import {
  extractGuestToken,
  handleRouteError,
  readJsonBody,
} from '@/lib/storage/http';
import type { ActiveEmailNotifyLevel } from '@/types/invite';

type RouteContext = { params: Promise<{ id: string }> };

function requestOrigin(req: Request): string | null {
  try {
    return new URL(req.url).origin;
  } catch {
    return null;
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody<{
      kind?: 'webpush' | 'email';
      subscription?: PushSubscriptionPayload;
      email?: string;
      label?: string;
      notifyLevel?: ActiveEmailNotifyLevel;
      guestToken?: string;
    }>(req);

    const inferredKind =
      body.kind ??
      (body.subscription ? 'webpush' : body.email ? 'email' : undefined);

    if (inferredKind === 'webpush' && body.subscription) {
      const sub = await addSubscriber(id, {
        kind: 'webpush',
        subscription: body.subscription,
        label: body.label,
      });
      return NextResponse.json(
        { subscribed: true, id: sub.id, kind: sub.kind },
        { status: 201, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (inferredKind === 'email' && typeof body.email === 'string') {
      const normalizedEmail = body.email.trim().toLowerCase();
      const guestToken =
        (typeof body.guestToken === 'string' && body.guestToken.trim()
          ? body.guestToken.trim()
          : null) ?? extractGuestToken(req);
      const notifyLevel =
        body.notifyLevel !== undefined
          ? normalizeNotifyLevel(body.notifyLevel)
          : undefined;

      const sub = await addSubscriber(id, {
        kind: 'email',
        email: normalizedEmail,
        label: body.label,
        notifyLevel,
        guestToken,
      });

      let emailSent = false;
      const emailConfigured = isEmailConfigured();
      if (emailConfigured) {
        const detail = await getEventDetail(id, { guestToken });
        if (detail) {
          const emailRes = await sendSubscriptionConfirmationEmail({
            to: normalizedEmail,
            event: detail.event,
            subId: sub.id,
            baseUrl: requestOrigin(req),
            rsvpStatus: detail.viewerRsvp?.status,
            notifyLevel: sub.notifyLevel,
          });
          emailSent = emailRes.sent;
        }
      }

      return NextResponse.json(
        {
          subscribed: true,
          id: sub.id,
          kind: sub.kind,
          notifyLevel: sub.notifyLevel,
          emailSent,
          emailConfigured,
        },
        { status: 201, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    throw new ValidationError(
      'Provide a valid Web Push subscription or email address',
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const url = new URL(req.url);
    let subId = url.searchParams.get('subId') ?? undefined;
    let endpoint = url.searchParams.get('endpoint') ?? undefined;
    let email = url.searchParams.get('email') ?? undefined;
    let guestToken = extractGuestToken(req) ?? undefined;

    if (!subId && !endpoint && !email) {
      const text = await req.text();
      if (text.trim()) {
        const parsed = JSON.parse(text) as {
          subId?: string;
          endpoint?: string;
          email?: string;
          guestToken?: string;
        };
        subId = parsed.subId;
        endpoint = parsed.endpoint;
        email = parsed.email;
        if (!guestToken && typeof parsed.guestToken === 'string' && parsed.guestToken.trim()) {
          guestToken = parsed.guestToken.trim();
        }
      }
    }

    const removed =
      !subId && !endpoint && !email && guestToken
        ? await removeGuestEmailSubscription(id, { guestToken })
        : await removeSubscriberByTarget(id, {
            subId,
            endpoint,
            email,
          });

    return NextResponse.json(
      { unsubscribed: true, removed },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
