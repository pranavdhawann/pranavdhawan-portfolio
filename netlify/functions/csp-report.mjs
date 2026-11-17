const WINDOW_MS = 60_000;
const MAX_REPORTS_PER_WINDOW = 30;
const MAX_BODY_BYTES = 16 * 1024;

export const config = {
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip'] },
};

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

  const body = await request.text().catch(() => '');
  if (body.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }
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
      directive: String(directive).slice(0, 80),
      shape: legacy ? 'legacy' : 'reporting-api',
    });
  }
  return new Response(null, { status: 204 });
}
