import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Authorisation for POST /api/ingest.
 *
 * Two forms are accepted:
 *
 *  - the long-lived INGEST_SECRET, for a trusted scheduler holding it in a
 *    secret store;
 *  - a short-lived signed token, `<expiryMs>.<hmac>`, for places where the
 *    trigger has to travel somewhere less private — a CI run in a public
 *    repository, for instance, where inputs and logs are world-readable.
 *
 * The signed form lets a crawl be kicked off without ever exposing the
 * master secret: the token is useless the moment it expires.
 */

/** Tokens are deliberately short-lived; a crawl trigger is never urgent for long. */
export const DEFAULT_TOKEN_TTL_MS = 20 * 60 * 1000;

export function mintToken(secret: string, ttlMs = DEFAULT_TOKEN_TTL_MS): string {
  const expiry = String(Date.now() + ttlMs);
  return `${expiry}.${sign(secret, expiry)}`;
}

function sign(secret: string, expiry: string): string {
  return createHmac("sha256", secret).update(expiry).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyToken(token: string, secret: string, now = Date.now()): boolean {
  const separator = token.indexOf(".");
  if (separator <= 0) return false;

  const expiry = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expiryMs = Number(expiry);
  if (!Number.isFinite(expiryMs) || now > expiryMs) return false;

  return safeEqual(signature, sign(secret, expiry));
}

/** True when the request carries acceptable credentials. */
export function isAuthorized(request: Request, secret: string): boolean {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer && safeEqual(bearer, secret)) return true;

  const token =
    request.headers.get("x-ingest-token") ?? new URL(request.url).searchParams.get("token");
  return Boolean(token && verifyToken(token, secret));
}
