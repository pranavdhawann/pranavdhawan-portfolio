// Stateless, forgery-resistant unsubscribe tokens.
//
// Token format: "<issuedAtMs>.<base64url(HMAC-SHA256("<email>:<issuedAtMs>", SECRET))>"
//
// The issued-at timestamp expires leaked links after
// UNSUBSCRIBE_TOKEN_MAX_AGE_MS. Every outgoing email embeds a freshly signed
// link, so expiring old ones costs nothing: the newest digest always carries a
// working unsubscribe.
import { createHmac, timingSafeEqual } from 'node:crypto';

const normalize = (email) => String(email || '').trim().toLowerCase();

export const UNSUBSCRIBE_TOKEN_MAX_AGE_MS = 180 * 86400000;

export function unsubscribeToken(email, secret, issuedAtMs = Date.now()) {
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is required to sign unsubscribe links');
  const ts = Math.floor(Number(issuedAtMs) || Date.now());
  const mac = createHmac('sha256', secret)
    .update(`${normalize(email)}:${ts}`)
    .digest('base64url');
  return `${ts}.${mac}`;
}

export function verifyUnsubscribeToken(email, token, secret, nowMs = Date.now()) {
  if (!secret || !token) return false;
  const match = /^(\d{13})\.([A-Za-z0-9_-]+)$/.exec(String(token));
  if (!match) return false;
  const ts = Number(match[1]);
  const age = nowMs - ts;
  if (!Number.isFinite(age) || age < 0 || age > UNSUBSCRIBE_TOKEN_MAX_AGE_MS) return false;
  let expected;
  try {
    expected = Buffer.from(unsubscribeToken(email, secret, ts), 'utf8');
    if (expected.length !== match[0].length) return false;
    const provided = Buffer.from(match[0], 'utf8');
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}
