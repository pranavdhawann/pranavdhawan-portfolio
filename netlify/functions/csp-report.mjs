// Receives browser CSP violation reports (report-uri in netlify.toml).
//
// This endpoint is public and unauthenticated, so it is rate limited per IP and
// accepts only tiny bodies — otherwise it is a free log-volume amplifier.
// Both report shapes are recognised: the legacy `csp-report` object and the
// newer Reporting-API envelope (`type: "csp-violation"`).
const WINDOW_MS = 60_000;
const MAX_REPORTS_PER_WINDOW = 30;
const MAX_BODY_BYTES = 16 * 1024;

const recentHits = new Map();

const isRateLimited = (ip) => {
  const now = Date.now();
  const hits = (recentHits.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  hits.push(now);
  recentHits.set(ip, hits);
  for (const [key, times] of recentHits) {
    if (key !== ip && times[times.length - 1] < now - WINDOW_MS) {
      recentHits.delete(key);
    }
  }
  return hits.length > MAX_REPORTS_PER_WINDOW;
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  if (isRateLimited(request.headers.get('x-nf-client-connection-ip') || 'unknown')) {
    return new Response(null, { status: 429 });
  }

  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  // Keep reports aggregate-only: browser CSP reports can include visitor URLs.
  const body = await request.text().catch(() => '');
  let report;
  try {
    report = JSON.parse(body);
  } catch {
    report = null;
  }
  const legacy = report?.['csp-report'];
  const modern = report?.type === 'csp-violation' ? report.body : null;
  const directive = legacy?.['violated-directive'] || modern?.effectiveDirective || modern?.violatedDirective;
  if (directive) {
    console.warn('CSP violation', {
      directive,
      shape: legacy ? 'legacy' : 'reporting-api',
    });
  }
  return new Response(null, { status: 204 });
}
