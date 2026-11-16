import { NextResponse } from 'next/server';
import { notifyEventSubscribers } from '@/lib/notifications/push';
import { createComment, getEventDetail, toggleReaction } from '@/lib/storage/events';
import {
  extractEditKey,
  extractGuestToken,
  handleRouteError,
  readJsonBody,
} from '@/lib/storage/http';
import type { RsvpStatus } from '@/types/invite';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody<{
      action?: string;
      commentId?: string;
      emoji?: string;
      delta?: number;
      remove?: boolean;
      active?: boolean;
      authorName?: string;
      body?: string;
      editKey?: string;
      guestToken?: string;
      rsvpStatus?: RsvpStatus;
    }>(req);

    if (body.action === 'react') {
      const delta =
        body.delta === -1 || body.remove === true || body.active === false
          ? -1
          : 1;
      const comment = await toggleReaction(
        id,
        body.commentId ?? '',
        body.emoji ?? '',
        { delta },
      );
      return NextResponse.json(
        { comment },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const editKey =
      extractEditKey(req) ??
      (typeof body.editKey === 'string' ? body.editKey : null);
    const guestToken =
      extractGuestToken(req) ??
      (typeof body.guestToken === 'string' ? body.guestToken : null);

    const comment = await createComment(id, {
      authorName: body.authorName ?? '',
      body: body.body ?? '',
      editKey,
      guestToken,
      rsvpStatus: body.rsvpStatus,
    });

    if (comment.isHost) {
      let baseUrl: string | null = null;
      try {
        baseUrl = new URL(req.url).origin;
      } catch {
        baseUrl = null;
      }
      const detail = await getEventDetail(id).catch(() => null);
      const eventTitle = detail?.event.title ?? 'Event update';
      await notifyEventSubscribers(
        id,
        {
          title: eventTitle,
          body: `${comment.authorName}: ${comment.body}`,
          url: `/e/${id}`,
        },
        {
          includeEmail: true,
          eventTitle,
          emailSubject: `Update from ${comment.authorName}: ${eventTitle}`,
          baseUrl,
        },
      ).catch(() => {});
    }

    return NextResponse.json(
      { comment },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
