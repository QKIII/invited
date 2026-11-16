import { NextResponse } from 'next/server';
import {
  isEmailConfigured,
  sendSubscriptionConfirmationEmail,
} from '@/lib/notifications/email';
import { ValidationError } from '@/lib/storage/errors';
import {
  addSubscriber,
  getEventDetail,
  removeSubscriberByTarget,
  type PushSubscriptionPayload,
} from '@/lib/storage/events';
import { handleRouteError, readJsonBody } from '@/lib/storage/http';

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
      const sub = await addSubscriber(id, {
        kind: 'email',
        email: normalizedEmail,
        label: body.label,
      });

      let emailSent = false;
      const emailConfigured = isEmailConfigured();
      if (emailConfigured) {
        const detail = await getEventDetail(id);
        if (detail) {
          const emailRes = await sendSubscriptionConfirmationEmail({
            to: normalizedEmail,
            event: detail.event,
            subId: sub.id,
            baseUrl: requestOrigin(req),
          });
          emailSent = emailRes.sent;
        }
      }

      return NextResponse.json(
        {
          subscribed: true,
          id: sub.id,
          kind: sub.kind,
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

    if (!subId && !endpoint && !email) {
      const text = await req.text();
      if (text.trim()) {
        const parsed = JSON.parse(text) as {
          subId?: string;
          endpoint?: string;
          email?: string;
        };
        subId = parsed.subId;
        endpoint = parsed.endpoint;
        email = parsed.email;
      }
    }

    const removed = await removeSubscriberByTarget(id, {
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
