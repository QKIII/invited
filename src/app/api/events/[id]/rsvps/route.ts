import { NextResponse } from 'next/server';
import {
  isEmailConfigured,
  sendSubscriptionConfirmationEmail,
} from '@/lib/notifications/email';
import { notifyEventSubscribers } from '@/lib/notifications/push';
import {
  addSubscriber,
  getEventDetail,
  normalizeNotifyLevel,
  normalizeValidEmail,
  removeGuestEmailSubscription,
  upsertRsvp,
} from '@/lib/storage/events';
import {
  extractEditKey,
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
      guestName?: string;
      status?: string;
      plusOnes?: number;
      bringingNote?: string;
      guestToken?: string;
      postToWall?: boolean;
      emailUpdates?: {
        enabled?: boolean;
        email?: string;
        notifyLevel?: ActiveEmailNotifyLevel;
      };
    }>(req);

    const validatedEmail =
      body.emailUpdates?.enabled === true
        ? normalizeValidEmail(body.emailUpdates.email)
        : null;

    const editKey = extractEditKey(req);
    const guestToken =
      typeof body.guestToken === 'string' && body.guestToken.trim()
        ? body.guestToken.trim()
        : extractGuestToken(req);

    const result = await upsertRsvp(id, {
      guestName: body.guestName ?? '',
      status: body.status ?? '',
      plusOnes: body.plusOnes,
      bringingNote: body.bringingNote,
      editKey,
      guestToken,
      postToWall: body.postToWall,
    });

    let emailSub:
      | Awaited<ReturnType<typeof addSubscriber>>
      | undefined;
    if (body.emailUpdates?.enabled === true && validatedEmail) {
      const notifyLevel =
        body.emailUpdates.notifyLevel !== undefined
          ? normalizeNotifyLevel(body.emailUpdates.notifyLevel)
          : undefined;
      emailSub = await addSubscriber(id, {
        kind: 'email',
        email: validatedEmail,
        notifyLevel,
        guestToken: result.guestToken,
        label: result.rsvp.guestName,
      });
    } else if (body.emailUpdates?.enabled === false) {
      await removeGuestEmailSubscription(id, {
        guestToken: result.guestToken,
        email: body.emailUpdates.email,
      });
    }

    const detail = await getEventDetail(id, {
      editKey,
      guestToken: result.guestToken,
    });

    let emailSent = false;
    const emailConfigured = isEmailConfigured();

    if (detail) {
      const statusLabel = result.rsvp.status === 'yes' ? 'is going' : "can't make it";
      await notifyEventSubscribers(
        id,
        {
          title: `${detail.event.title}`,
          body: `${result.rsvp.guestName} ${statusLabel}.`,
          url: `/e/${id}`,
        },
        { includeEmail: false },
      ).catch(() => {});

      if (
        body.emailUpdates?.enabled === true &&
        emailSub &&
        emailSub.isNewOrChangedEmail &&
        emailConfigured &&
        validatedEmail
      ) {
        const emailRes = await sendSubscriptionConfirmationEmail({
          to: validatedEmail,
          event: detail.event,
          subId: emailSub.id,
          baseUrl: requestOrigin(req),
          rsvpStatus: result.rsvp.status,
          notifyLevel: emailSub.notifyLevel,
        }).catch(() => ({ sent: false, skipped: false }));
        emailSent = emailRes.sent;
      }
    }

    return NextResponse.json(
      {
        rsvp: result.rsvp,
        guestToken: result.guestToken,
        ...(result.wallComment ? { wallComment: result.wallComment } : {}),
        ...(emailSub ? { emailSent, emailConfigured } : {}),
        detail,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
