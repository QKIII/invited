import fs from 'node:fs/promises';
import path from 'node:path';
import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  del,
  get,
  head,
  list,
  put,
} from '@vercel/blob';

export interface BinaryReadResult {
  data: Buffer;
  contentType: string;
}

function shouldUseVercelBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function getLocalDataDir(): string {
  const configured = process.env.INVITED_DATA_DIR?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(process.cwd(), '.data');
}

function normalizeStorageKey(key: string): string {
  const cleaned = key.replace(/^\/+/, '').replace(/\\/g, '/');
  const segments = cleaned.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((s) => s === '.' || s === '..')) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return segments.join('/');
}

function normalizePrefix(prefix: string): string {
  const cleaned = prefix.replace(/^\/+/, '').replace(/\\/g, '/');
  const trailingSlash = cleaned.endsWith('/');
  const segments = cleaned.split('/').filter(Boolean);
  if (segments.some((s) => s === '.' || s === '..')) {
    throw new Error(`Invalid storage prefix: ${prefix}`);
  }
  if (segments.length === 0) {
    return '';
  }
  return trailingSlash ? `${segments.join('/')}/` : segments.join('/');
}

function resolveLocalPath(root: string, key: string): string {
  const normalized = normalizeStorageKey(key);
  const fullPath = path.resolve(root, normalized);
  if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
    throw new Error(`Path escapes storage root: ${key}`);
  }
  return fullPath;
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  );
}

function isBlobMissing(err: unknown): boolean {
  return (
    err instanceof BlobNotFoundError ||
    (typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name?: string }).name === 'BlobNotFoundError')
  );
}

function isBlobConflict(err: unknown): boolean {
  return (
    err instanceof BlobPreconditionFailedError ||
    (typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name?: string }).name === 'BlobPreconditionFailedError') ||
    (err instanceof Error && /already exists/i.test(err.message))
  );
}

const keyLocks = new Map<string, Promise<void>>();

async function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = keyLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(
    () => current,
    () => current,
  );
  keyLocks.set(key, tail);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (keyLocks.get(key) === tail) {
      keyLocks.delete(key);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function atomicWriteFile(
  filePath: string,
  contents: string | Buffer,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    await fs.writeFile(tmpPath, contents);
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw err;
  }
}

function toBuffer(data: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * Writes JSON payload under `key` to Vercel Blob (private) or local filesystem.
 */
export async function putJson<T>(key: string, data: T): Promise<void> {
  const normalized = normalizeStorageKey(key);
  const serialized = JSON.stringify(data);

  if (shouldUseVercelBlob()) {
    await put(normalized, serialized, {
      access: 'private',
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: 'application/json; charset=utf-8',
    });
    return;
  }

  const fullPath = resolveLocalPath(getLocalDataDir(), normalized);
  await atomicWriteFile(fullPath, serialized);
}

function normalizeEtag(etag?: string | null): string | undefined {
  if (!etag) return undefined;
  const trimmed = etag.trim().replace(/^W\//i, '');
  return trimmed || undefined;
}

/**
 * Reads and parses JSON stored at `key` along with its Blob ETag (when available).
 */
export async function getJsonWithEtag<T>(
  key: string,
): Promise<{ data: T | null; etag?: string }> {
  const normalized = normalizeStorageKey(key);

  if (shouldUseVercelBlob()) {
    try {
      const result = await get(normalized, {
        access: 'private',
        useCache: false,
        headers: { 'accept-encoding': 'identity' },
      });
      if (!result || result.statusCode === 304 || !result.stream) {
        return { data: null };
      }
      const text = await new Response(result.stream).text();
      return {
        data: JSON.parse(text) as T,
        etag: normalizeEtag(result.blob.etag),
      };
    } catch (err) {
      if (isBlobMissing(err)) {
        return { data: null };
      }
      throw err;
    }
  }

  const fullPath = resolveLocalPath(getLocalDataDir(), normalized);
  try {
    const raw = await fs.readFile(fullPath, 'utf8');
    return { data: JSON.parse(raw) as T };
  } catch (err) {
    if (isEnoent(err)) {
      return { data: null };
    }
    throw err;
  }
}

/**
 * Reads and parses JSON stored at `key`, returning `null` if not found.
 */
export async function getJson<T>(key: string): Promise<T | null> {
  const { data } = await getJsonWithEtag<T>(key);
  return data;
}

/**
 * Atomically reads, transforms, and persists JSON at `key` using `ifMatch`
 * ETag optimistic concurrency control on Vercel Blob (and per-key locking locally).
 */
export async function updateJsonAtomically<T>(
  key: string,
  defaultValue: T,
  mutator: (current: T) => T | Promise<T>,
): Promise<T> {
  const normalized = normalizeStorageKey(key);

  return withKeyLock(normalized, async () => {
    if (!shouldUseVercelBlob()) {
      const fullPath = resolveLocalPath(getLocalDataDir(), normalized);
      let current: T;
      try {
        const raw = await fs.readFile(fullPath, 'utf8');
        current = JSON.parse(raw) as T;
      } catch (err) {
        if (isEnoent(err)) {
          current = structuredClone(defaultValue);
        } else {
          throw err;
        }
      }
      const next = await mutator(current);
      if (Object.is(next, current)) {
        return current;
      }
      await atomicWriteFile(fullPath, JSON.stringify(next));
      return next;
    }

    const MAX_ATTEMPTS = 6;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      // On retry after a precondition failure, query head() before get() so
      // compressed CDN ETags or replication lag cannot trap writes in a 500 loop.
      let headEtag: string | undefined;
      if (attempt > 0) {
        try {
          const meta = await head(normalized);
          headEtag = normalizeEtag(meta.etag);
        } catch (err) {
          if (!isBlobMissing(err)) {
            throw err;
          }
        }
      }

      const { data, etag: getEtag } = await getJsonWithEtag<T>(normalized);
      const effectiveEtag = headEtag ?? getEtag;
      const current = data !== null ? data : structuredClone(defaultValue);
      const next = await mutator(current);
      if (Object.is(next, current)) {
        return current;
      }
      const serialized = JSON.stringify(next);

      try {
        await put(normalized, serialized, {
          access: 'private',
          allowOverwrite: data !== null || Boolean(effectiveEtag),
          addRandomSuffix: false,
          ...(effectiveEtag ? { ifMatch: effectiveEtag } : {}),
          contentType: 'application/json; charset=utf-8',
        });
        return next;
      } catch (err) {
        if (isBlobConflict(err) && attempt < MAX_ATTEMPTS - 1) {
          await sleep(25 + Math.floor(Math.random() * 75));
          continue;
        }
        throw err;
      }
    }

    throw new Error(`Failed atomic JSON update for ${normalized}`);
  });
}

/**
 * Writes binary data under `key` to Vercel Blob (private) or local filesystem.
 */
export async function putBinary(
  key: string,
  data: Buffer | Uint8Array | ArrayBuffer,
  contentType: string,
): Promise<void> {
  const normalized = normalizeStorageKey(key);
  const buf = toBuffer(data);

  if (shouldUseVercelBlob()) {
    await put(normalized, buf, {
      access: 'private',
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType,
    });
    return;
  }

  const fullPath = resolveLocalPath(getLocalDataDir(), normalized);
  await atomicWriteFile(fullPath, buf);
}

/**
 * Reads binary data stored at `key`, returning `null` if not found.
 */
export async function getBinary(
  key: string,
  options?: { useCache?: boolean },
): Promise<BinaryReadResult | null> {
  const normalized = normalizeStorageKey(key);

  if (shouldUseVercelBlob()) {
    try {
      const result = await get(normalized, {
        access: 'private',
        useCache: options?.useCache ?? false,
      });
      if (!result || result.statusCode === 304 || !result.stream) {
        return null;
      }
      const ab = await new Response(result.stream).arrayBuffer();
      return {
        data: Buffer.from(ab),
        contentType: result.blob.contentType || 'application/octet-stream',
      };
    } catch (err) {
      if (isBlobMissing(err)) {
        return null;
      }
      throw err;
    }
  }

  const fullPath = resolveLocalPath(getLocalDataDir(), normalized);
  try {
    const data = await fs.readFile(fullPath);
    return {
      data,
      contentType: inferContentTypeFromKey(normalized),
    };
  } catch (err) {
    if (isEnoent(err)) {
      return null;
    }
    throw err;
  }
}

function inferContentTypeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

async function walkLocalFiles(
  dir: string,
  root: string,
  results: string[],
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (isEnoent(err)) {
      return;
    }
    throw err;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkLocalFiles(full, root, results);
    } else if (entry.isFile()) {
      // Ignore transient atomic write temp files
      if (entry.name.includes('.tmp-')) {
        continue;
      }
      const rel = path.relative(root, full).split(path.sep).join('/');
      results.push(rel);
    }
  }
}

/**
 * Lists all stored object keys beginning with `prefix`, sorted lexicographically.
 */
export async function listPrefix(prefix: string): Promise<string[]> {
  const normalized = normalizePrefix(prefix);

  if (shouldUseVercelBlob()) {
    const keys: string[] = [];
    let cursor: string | undefined;

    do {
      const res = await list({
        prefix: normalized,
        cursor,
        limit: 1000,
      });
      for (const blob of res.blobs) {
        keys.push(blob.pathname);
      }
      cursor = res.hasMore ? res.cursor : undefined;
    } while (cursor);

    return keys.sort();
  }

  const root = getLocalDataDir();
  const baseSegment = normalized.replace(/\/+$/, '');
  const walkStart = baseSegment ? path.resolve(root, baseSegment) : root;

  if (walkStart !== root && !walkStart.startsWith(root + path.sep)) {
    throw new Error(`Prefix escapes storage root: ${prefix}`);
  }

  const collected: string[] = [];
  // If walkStart is a directory, walk it; if it's a partial filename prefix, walk its parent
  try {
    const stat = await fs.stat(walkStart);
    if (stat.isDirectory()) {
      await walkLocalFiles(walkStart, root, collected);
    } else if (stat.isFile()) {
      collected.push(path.relative(root, walkStart).split(path.sep).join('/'));
    }
  } catch (err) {
    if (!isEnoent(err)) {
      throw err;
    }
    if (!normalized.endsWith('/') && baseSegment.includes('/')) {
      const parentDir = path.dirname(walkStart);
      await walkLocalFiles(parentDir, root, collected);
    }
  }

  return collected.filter((k) => k.startsWith(normalized)).sort();
}

/**
 * Deletes a single key if present.
 */
export async function deletePath(key: string): Promise<void> {
  const normalized = normalizeStorageKey(key);

  if (shouldUseVercelBlob()) {
    try {
      await del(normalized);
    } catch (err) {
      if (!isBlobMissing(err)) {
        throw err;
      }
    }
    return;
  }

  const fullPath = resolveLocalPath(getLocalDataDir(), normalized);
  await fs.rm(fullPath, { force: true });
}

/**
 * Deletes all objects stored under `prefix`.
 */
export async function deletePrefix(prefix: string): Promise<void> {
  const normalized = normalizePrefix(prefix);

  if (shouldUseVercelBlob()) {
    const keys = await listPrefix(normalized);
    for (let i = 0; i < keys.length; i += 500) {
      const batch = keys.slice(i, i + 500);
      if (batch.length > 0) {
        await del(batch);
      }
    }
    return;
  }

  const root = getLocalDataDir();
  const keys = await listPrefix(normalized);
  await Promise.all(
    keys.map((k) => fs.rm(resolveLocalPath(root, k), { force: true })),
  );

  // Remove directory itself when prefix denotes a folder
  if (normalized.endsWith('/')) {
    const dirPath = path.resolve(root, normalized.slice(0, -1));
    if (dirPath !== root && dirPath.startsWith(root + path.sep)) {
      await fs.rm(dirPath, { recursive: true, force: true });
    }
  }
}
