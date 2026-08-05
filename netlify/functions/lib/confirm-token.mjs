// Stateless, forgery-resistant subscription-confirmation tokens.
//
// Same construction as unsubscribe-token.mjs, but the HMAC covers a "confirm:"
// prefix so the two token spaces are disjoint — a confirmation token can never
// be replayed against the unsubscribe endpoint, or vice versa.
//
// The unsubscribe scheme is deliberately left untouched: links in already-sent
// emails must keep verifying, so its payload format cannot change.
import { createHmac, timingSafeEqual } from 'node:crypto';

const PURPOSE = 'confirm';
const normalize = (email) => String(email || '').trim().toLowerCase();

export function confirmToken(email, secret) {
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is required to sign confirmation links');
  return createHmac('sha256', secret).update(`${PURPOSE}:${normalize(email)}`).digest('base64url');
}

export function verifyConfirmToken(email, token, secret) {
  if (!secret || !token) return false;
  let expected;
  try {
    expected = Buffer.from(confirmToken(email, secret), 'utf8');
    const provided = Buffer.from(String(token), 'utf8');
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}
