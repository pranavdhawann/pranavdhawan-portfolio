// Name of the Netlify Blobs store holding unsubscribed addresses.
//
// Shared so the unsubscribe function (which writes) and the weekly sender
// (which reads) can never drift apart — a mismatch here would silently mail
// people who already unsubscribed.
export const SUPPRESSION_STORE = 'newsletter-suppressions';
