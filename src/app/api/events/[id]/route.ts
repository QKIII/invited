import { NextResponse } from 'next/server';
import { notifyEventSubscribers } from '@/lib/notifications/push';
import {
  deleteEvent,
  getEventDetail,
  updateEvent,
  type UpdateEventPatch,
} from '@/lib/storage/events';
import {
  extractEditKey,
  extractGuestToken,
  handleRouteError,
  readJsonBody,
} from '@/lib/storage/http';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const editKey = extractEditKey(req);
    const guestToken = extractGuestToken(req);

    const detail = await getEventDetail(id, { editKey, guestToken });
    if (!detail) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(detail, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody<UpdateEventPatch & { editKey?: string }>(req);
    const editKey =
      extractEditKey(req) ??
      (typeof body.editKey === 'string' ? body.editKey : null);

    const updated = await updateEvent(id, editKey, body);
    let baseUrl: string | null = null;
    try {
      baseUrl = new URL(req.url).origin;
    } catch {
      baseUrl = null;
    }

    await notifyEventSubscribers(
      id,
      {
        title: `Event updated: ${updated.title}`,
        body: 'The host updated the event details.',
        url: `/e/${id}`,
      },
      {
        includeEmail: true,
        eventTitle: updated.title,
        emailSubject: `Updated: ${updated.title}`,
        baseUrl,
      },
    ).catch(() => {});

    return NextResponse.json(updated, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const editKey = extractEditKey(req);
    await deleteEvent(id, editKey);

    return NextResponse.json(
      { deleted: true, id },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
