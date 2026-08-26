// Sitemap lastmod rewriting for the blog index entry.
//
// Extracted from build-site.mjs so it can be unit tested: the rewrite used to
// be a silent no-op when the regex stopped matching, shipping stale dates on a
// green build.

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Replace the <lastmod> of the https://pranavdhawan.com/blog/ entry.
 *
 * - Tolerates whitespace/newlines between </loc> and <lastmod>.
 * - Throws on a non-W3C date instead of corrupting the sitemap.
 * - Returns { xml, replaced } so the caller can warn when nothing matched.
 */
export function rewriteBlogLastmod(xml, dateIso) {
  if (!ISO_DATE_PATTERN.test(String(dateIso || ''))) {
    throw new Error(`Refusing to write a non-ISO lastmod into sitemap.xml: "${dateIso}"`);
  }
  const pattern = /(<loc>https:\/\/pranavdhawan\.com\/blog\/<\/loc>\s*<lastmod>)[^<]*(<\/lastmod>)/;
  const replaced = pattern.test(xml);
  if (!replaced) {
    return { xml, replaced };
  }
  return { xml: xml.replace(pattern, `$1${dateIso}$2`), replaced: true };
}
