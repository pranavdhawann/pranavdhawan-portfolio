// Shared, on-brand HTML shell for the transactional endpoints (confirm and
// unsubscribe). These used to render bare unstyled markup that looked nothing
// like the rest of the site — not reassuring on a page whose whole job is to
// tell someone their email preference was honoured.
//
// noindex because these URLs are per-recipient and must never reach search.

import { escapeHtml } from './text.mjs';

/**
 * @param {string} title      Heading + document title (plain text).
 * @param {string} body       Sentence under the heading (plain text).
 * @param {string} [actionHtml] Optional pre-built markup (e.g. a confirm form).
 */
export function page(title, body, actionHtml = '') {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} — Pranav Dhawan</title>
<link rel="stylesheet" href="/styles.css">
<script src="/theme-init.js"></script>
</head>
<body><main class="main-content" id="main-content"><div class="container writing-content">
<p class="article-meta">AI THIS WEEK</p>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(body)}</p>
${actionHtml}
<p><a class="resume-btn" href="/">Back to pranavdhawan.com</a></p>
</div></main></body></html>`;
}

export const html = (title, body, { status = 200, actionHtml = '' } = {}) =>
  new Response(page(title, body, actionHtml), {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
