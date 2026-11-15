import { NextResponse } from 'next/server';
import { notifyEventSubscribers } from '@/lib/notifications/push';
import { getEventDetail, upsertRsvp } from '@/lib/storage/events';
import {
  extractEditKey,
  extractGuestToken,
  handleRouteError,
  readJsonBody,
} from '@/lib/storage/http';

type RouteContext = { params: Promise<{ id: string }> };

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
    }>(req);

    const guestToken =
      typeof body.guestToken === 'string' && body.guestToken.trim()
        ? body.guestToken.trim()
        : extractGuestToken(req);

    const result = await upsertRsvp(id, {
      guestName: body.guestName ?? '',
      status: body.status ?? '',
      plusOnes: body.plusOnes,
      bringingNote: body.bringingNote,
      guestToken,
      postToWall: body.postToWall,
    });

    const editKey = extractEditKey(req);
    const detail = await getEventDetail(id, {
      editKey,
      guestToken: result.guestToken,
    });

    if (detail) {
      const statusLabel = result.rsvp.status === 'yes' ? 'is going' : "can't make it";
      await notifyEventSubscribers(id, {
        title: `${detail.event.title}`,
        body: `${result.rsvp.guestName} ${statusLabel}.`,
        url: `/e/${id}`,
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        rsvp: result.rsvp,
        guestToken: result.guestToken,
        ...(result.wallComment ? { wallComment: result.wallComment } : {}),
        detail,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
