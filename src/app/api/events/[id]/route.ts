import { NextResponse } from 'next/server';
import {
  computeEventChanges,
  formatEventWhenLine,
  formatEventWhereLine,
} from '@/lib/notifications/email';
import { notifyEventSubscribers } from '@/lib/notifications/push';
import {
  deleteEvent,
  getEventDetail,
  updateEventWithPrevious,
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
    const body = await readJsonBody<
      UpdateEventPatch & { editKey?: string; notifyGuests?: boolean }
    >(req);
    const editKey =
      extractEditKey(req) ??
      (typeof body.editKey === 'string' ? body.editKey : null);

    const { previous, updated } = await updateEventWithPrevious(
      id,
      editKey,
      body,
    );
    const diff = computeEventChanges(previous, updated);
    const shouldNotify =
      typeof body.notifyGuests === 'boolean'
        ? body.notifyGuests
        : diff.hasMaterialChanges;

    if (shouldNotify) {
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
          body: diff.summaryText,
          url: `/e/${id}`,
        },
        {
          includeEmail: true,
          category: 'event_change',
          eyebrow: 'Event update',
          eventTitle: updated.title,
          emailSubject: `Updated: ${updated.title}`,
          whenLine: formatEventWhenLine(updated),
          whereLine: formatEventWhereLine(updated),
          changeLines: diff.changeLines,
          baseUrl,
        },
      ).catch(() => {});
    }

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
