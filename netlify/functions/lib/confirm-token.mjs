// Stateless, forgery-resistant subscription-confirmation tokens.
//
// Token format: "<issuedAtMs>.<base64url(HMAC-SHA256("confirm:<email>:<issuedAtMs>", SECRET))>"
//
// The HMAC covers a "confirm:" prefix so the confirm and unsubscribe token
// spaces stay disjoint, and an issued-at timestamp so links expire: a forwarded
// or leaked confirmation link stops being a consent capability after
// CONFIRM_TOKEN_MAX_AGE_MS instead of living forever.
import { createHmac, timingSafeEqual } from 'node:crypto';

const PURPOSE = 'confirm';
const normalize = (email) => String(email || '').trim().toLowerCase();

export const CONFIRM_TOKEN_MAX_AGE_MS = 7 * 86400000;

export function confirmToken(email, secret, issuedAtMs = Date.now()) {
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is required to sign confirmation links');
  const ts = Math.floor(Number(issuedAtMs) || Date.now());
  const mac = createHmac('sha256', secret)
    .update(`${PURPOSE}:${normalize(email)}:${ts}`)
    .digest('base64url');
  return `${ts}.${mac}`;
}

export function verifyConfirmToken(email, token, secret, nowMs = Date.now()) {
  if (!secret || !token) return false;
  const match = /^(\d{13})\.([A-Za-z0-9_-]+)$/.exec(String(token));
  if (!match) return false;
  const ts = Number(match[1]);
  const age = nowMs - ts;
  if (!Number.isFinite(age) || age < 0 || age > CONFIRM_TOKEN_MAX_AGE_MS) return false;
  let expected;
  try {
    expected = Buffer.from(confirmToken(email, secret, ts), 'utf8');
    // Length includes the timestamp prefix, so a stale-but-valid-format token
    // with a different ts differs here before timingSafeEqual ever runs.
    if (expected.length !== match[0].length) return false;
    const provided = Buffer.from(match[0], 'utf8');
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}
