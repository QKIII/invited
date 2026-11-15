import { NextResponse } from 'next/server';
import { deleteComment } from '@/lib/storage/events';
import { extractEditKey, handleRouteError } from '@/lib/storage/http';

type RouteContext = { params: Promise<{ id: string; commentId: string }> };

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { id, commentId } = await context.params;
    const editKey = extractEditKey(req);
    await deleteComment(id, commentId, editKey);

    return NextResponse.json(
      { deleted: true, commentId },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
