import crypto from 'node:crypto';
import { customAlphabet } from 'nanoid';

const URL_SAFE_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const defaultIdGenerator = customAlphabet(URL_SAFE_ALPHABET, 12);

/**
 * Generates a URL-safe random identifier using an alphanumeric alphabet.
 */
export function generateId(len = 12): string {
  const safeLen = Number.isFinite(len) && len >= 1 ? Math.trunc(len) : 12;
  return defaultIdGenerator(safeLen);
}

/**
 * Generates a 24-byte capability secret encoded as base64url.
 */
export function generateSecretKey(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Computes a SHA-256 hex digest of a capability secret.
 */
export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}

/**
 * Verifies a candidate capability secret against an expected SHA-256 hex hash
 * using constant-time buffer comparison.
 */
export function verifySecret(
  candidate: string | null | undefined,
  expectedHash: string,
): boolean {
  if (!candidate || typeof candidate !== 'string' || !expectedHash) {
    return false;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return false;
  }

  const candidateBuf = Buffer.from(hashSecret(trimmed), 'utf8');
  const expectedBuf = Buffer.from(expectedHash.toLowerCase(), 'utf8');

  if (candidateBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}
