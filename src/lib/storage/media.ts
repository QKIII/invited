import { ValidationError } from '@/lib/storage/errors';

export const MAX_COVER_BYTES = 4 * 1024 * 1024; // 4 MB

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export interface ValidatedImage {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  // GIF: GIF87a or GIF89a
  const header6 = buf.subarray(0, 6).toString('ascii');
  if (header6 === 'GIF87a' || header6 === 'GIF89a') {
    return 'image/gif';
  }

  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Validates that an uploaded buffer is a non-empty PNG, JPEG, WebP, or GIF <= 4 MB
 * by inspecting both declared MIME type and binary magic bytes.
 */
export function validateCoverImage(
  buffer: Buffer,
  declaredMime?: string | null,
): ValidatedImage {
  if (buffer.length === 0) {
    throw new ValidationError('Uploaded image file is empty');
  }

  if (buffer.length > MAX_COVER_BYTES) {
    throw new ValidationError('Cover image must be 4 MB or smaller');
  }

  const sniffed = sniffImageMime(buffer);
  if (!sniffed) {
    throw new ValidationError(
      'Unsupported image format. Please upload PNG, JPEG, WebP, or GIF.',
    );
  }

  if (declaredMime) {
    const normalized = declaredMime.split(';')[0].trim().toLowerCase();
    const mapped = normalized === 'image/jpg' ? 'image/jpeg' : normalized;
    if (mapped && mapped !== sniffed) {
      throw new ValidationError(
        'Image content does not match declared file type',
      );
    }
  }

  return {
    buffer,
    contentType: sniffed,
    extension: MIME_TO_EXT[sniffed] ?? 'png',
  };
}

/**
 * Parses a multipart FormData or JSON image payload from an HTTP request.
 */
export async function extractImagePayload(
  req: Request,
): Promise<{ buffer: Buffer; declaredMime?: string; editKeyFromForm?: string }> {
  const reqType = req.headers.get('content-type') || '';

  if (reqType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ValidationError('Missing image file in form field "file"');
    }
    if (file.size > MAX_COVER_BYTES) {
      throw new ValidationError('Cover image must be 4 MB or smaller');
    }
    const arrayBuffer = await file.arrayBuffer();
    const editKeyField = formData.get('editKey');
    return {
      buffer: Buffer.from(arrayBuffer),
      declaredMime: file.type || undefined,
      editKeyFromForm:
        typeof editKeyField === 'string' ? editKeyField : undefined,
    };
  }

  if (reqType.includes('application/json')) {
    const body = (await req.json()) as {
      dataUrl?: string;
      dataBase64?: string;
      contentType?: string;
      editKey?: string;
    };

    if (typeof body.dataUrl === 'string') {
      const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(
        body.dataUrl.trim(),
      );
      if (!match) {
        throw new ValidationError('Invalid image data URL');
      }
      return {
        buffer: Buffer.from(match[2], 'base64'),
        declaredMime: match[1],
        editKeyFromForm: typeof body.editKey === 'string' ? body.editKey : undefined,
      };
    }

    if (typeof body.dataBase64 === 'string') {
      return {
        buffer: Buffer.from(body.dataBase64, 'base64'),
        declaredMime: body.contentType,
        editKeyFromForm: typeof body.editKey === 'string' ? body.editKey : undefined,
      };
    }
  }

  throw new ValidationError(
    'Expected multipart/form-data with "file" or JSON image payload',
  );
}
