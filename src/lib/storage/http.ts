import { NextResponse } from 'next/server';
import { AppError, ValidationError } from '@/lib/storage/errors';

export function extractEditKey(req: Request): string | null {
  const fromHeader = req.headers.get('x-edit-key');
  if (fromHeader && fromHeader.trim()) {
    return fromHeader.trim();
  }
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('key');
  return fromQuery && fromQuery.trim() ? fromQuery.trim() : null;
}

export function extractGuestToken(req: Request): string | null {
  const fromHeader = req.headers.get('x-guest-token');
  if (fromHeader && fromHeader.trim()) {
    return fromHeader.trim();
  }
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('guestToken');
  return fromQuery && fromQuery.trim() ? fromQuery.trim() : null;
}

export async function readJsonBody<T = Record<string, unknown>>(
  req: Request,
): Promise<T> {
  try {
    const parsed = (await req.json()) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new ValidationError('Request body must be a JSON object');
    }
    return parsed as T;
  } catch (err) {
    if (err instanceof ValidationError) {
      throw err;
    }
    throw new ValidationError('Invalid JSON request body');
  }
}

export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.message },
      { status: err.statusCode, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const message =
    err instanceof Error ? err.message : 'Unexpected server error';
  return NextResponse.json(
    { error: message },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  );
}
