export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  // Keep reports aggregate-only: browser CSP reports can include visitor URLs.
  const report = await request.json().catch(() => null);
  const violation = report?.['csp-report'];
  if (violation?.['violated-directive']) {
    console.warn('CSP violation', { directive: violation['violated-directive'] });
  }
  return new Response(null, { status: 204 });
}
