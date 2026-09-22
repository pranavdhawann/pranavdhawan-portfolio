const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('node:fs');
const path = require('node:path');
const { readConfiguredHeaders, startStaticServer } = require('./helpers/static-server.cjs');

// Built output only — see portfolio.spec.js for rationale.
const rootDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(path.join(rootDir, 'index.html'))) {
  throw new Error('public/index.html missing — run `npm run build` before testing.');
}
let server;
let pageUrl;

test.beforeAll(async () => {
  ({ server, url: pageUrl } = await startStaticServer(rootDir, readConfiguredHeaders(rootDir)));
});

test.afterAll(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function openBlog(page) {
  // pageUrl already ends with a trailing slash.
  await page.goto(`${pageUrl}blog/`);
}

test('blog renders personal posts and the AI digest with sourced list entries', async ({ page }) => {
  await openBlog(page);

  await expect(page).toHaveTitle(/Blog/);
  await expect(page.getByRole('heading', { name: 'AI THIS WEEK' })).toBeVisible();

  const digestEntries = page.locator('.writing-list .writing-row-title[target="_blank"]');
  expect(await digestEntries.count()).toBeGreaterThanOrEqual(6);

  // Every digest entry links to a real external source over https.
  for (const href of await digestEntries.evaluateAll((links) => links.map((a) => a.href))) {
    expect(href).toMatch(/^https:\/\//);
  }
  await expect(page.locator('.writing-list .writing-tag').first()).toBeVisible();
  await expect(page.locator('.writing-list .writing-date').first()).toBeVisible();
});

test('newsletter signup keeps input and button on one row at desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openBlog(page);

  const box = page.locator('.newsletter');
  await expect(box).toBeVisible();
  const input = box.locator('#nl-email');
  const button = box.getByRole('button', { name: 'Subscribe' });
  await expect(input).toBeVisible();
  await expect(button).toBeVisible();

  const [inputBox, buttonBox] = [await input.boundingBox(), await button.boundingBox()];
  expect(Math.abs(inputBox.y - buttonBox.y)).toBeLessThan(8);
});

test('subscribing shows the success message when the form POST succeeds', async ({ page }) => {
  await openBlog(page);
  let postedFormName = '';
  await page.route('**/*', (route) => {
    if (route.request().method() === 'POST') {
      // Assert AFTER the route resolves — a failed expectation inside a route
      // handler aborts the request and surfaces as a confusing timeout.
      postedFormName = route.request().postData() || '';
      return route.fulfill({ status: 200, body: '' });
    }
    return route.continue();
  });

  await page.locator('#nl-email').fill('reader@example.com');
  await page.getByRole('button', { name: 'Subscribe' }).click();
  // Double opt-in: the address is not on the list until the emailed link is clicked,
  // so the confirmation copy must not claim otherwise.
  await expect(page.locator('#newsletterStatus')).toHaveText(/check your inbox/i);
  await expect(page.locator('#nl-email')).toHaveValue('');
  expect(postedFormName).toContain('form-name=newsletter');
});

test('the newsletter form cannot be submitted twice by double-clicking', async ({ page }) => {
  await openBlog(page);
  let posts = 0;
  await page.route('**/*', async (route) => {
    if (route.request().method() === 'POST') {
      posts += 1;
      await new Promise((r) => setTimeout(r, 400));
      return route.fulfill({ status: 200, body: '' });
    }
    return route.continue();
  });

  await page.locator('#nl-email').fill('reader@example.com');
  const button = page.getByRole('button', { name: 'Subscribe' });
  await button.click();
  await expect(button).toBeDisabled();
  await expect(page.locator('#newsletterStatus')).toHaveText(/check your inbox/i);
  expect(posts).toBe(1);
});

// script.js and newsletter.js both used to register the data-analytics click
// listener, so every blog CTA was counted twice in GoatCounter.
test('a CTA click fires exactly one analytics event', async ({ page }) => {
  await openBlog(page);
  await page.evaluate(() => {
    window.__hits = [];
    window.goatcounter = { count: (o) => window.__hits.push(o.path) };
    document.addEventListener('click', (e) => {
      if (e.target.closest('a')) e.preventDefault();
    }, true);
  });

  await page.locator('a.writing-row-title[data-analytics="blog:rag-hallucinations"]').click();
  expect(await page.evaluate(() => window.__hits)).toEqual(['blog:rag-hallucinations']);
});

test('a failed signup shows the error message with a fallback contact', async ({ page }) => {
  await openBlog(page);
  await page.route('**/*', (route) => (
    route.request().method() === 'POST'
      ? route.fulfill({ status: 500, body: '' })
      : route.continue()
  ));

  await page.locator('#nl-email').fill('reader@example.com');
  await page.getByRole('button', { name: 'Subscribe' }).click();
  const status = page.locator('#newsletterStatus');
  await expect(status).toHaveText(/Something went wrong/);
  await expect(status).toHaveClass(/is-error/);
});

test('blog page has no axe accessibility violations', async ({ page }) => {
  await openBlog(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('blog page has no axe accessibility violations in dark mode', async ({ page }) => {
  await openBlog(page);
  await page.locator('#themeToggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('blog distinguishes original writing from the curated digest and retains portfolio navigation', async ({ page }) => {
  await openBlog(page);
  await expect(page.getByRole('heading', { name: 'Written by me' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI THIS WEEK' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Portfolio', exact: true })).toHaveAttribute('href', '../index.html');
  await expect(page.getByRole('link', { name: 'Privacy', exact: true })).toHaveAttribute('href', '../privacy.html');
});

test('blog uses the self-hosted site fonts', async ({ page }) => {
  await openBlog(page);
  await expect(page.locator('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]')).toHaveCount(0);
});

// The writing/digest list carries no fill and no shadow, so its rules are the
// only thing separating one entry from the next. If they sink into the page
// background the list reads as an undifferentiated wall of text — and axe
// cannot see it, because WCAG 1.4.11 contrast is not statically checkable.
function relativeLuminance([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(rgbA, rgbB) {
  const [light, dark] = [relativeLuminance(rgbA), relativeLuminance(rgbB)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function parseRgb(value) {
  const parts = value.match(/\d+(\.\d+)?/g);
  if (!parts || parts.length < 3) throw new Error(`unparsable colour: ${value}`);
  return parts.slice(0, 3).map(Number);
}

for (const theme of ['light', 'dark']) {
  test(`writing list rules stay visible against the page in ${theme} mode`, async ({ page }) => {
    await openBlog(page);
    if (theme === 'dark') {
      await page.locator('#themeToggle').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    }

    const { pageBg, listTop, rowBottom } = await page.evaluate(() => ({
      pageBg: getComputedStyle(document.body).backgroundColor,
      listTop: getComputedStyle(document.querySelector('.writing-list')).borderTopColor,
      rowBottom: getComputedStyle(document.querySelector('.writing-row')).borderBottomColor,
    }));

    const background = parseRgb(pageBg);
    // WCAG 1.4.11 non-text contrast: boundaries needed to understand content.
    expect(contrastRatio(parseRgb(listTop), background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(parseRgb(rowBottom), background)).toBeGreaterThanOrEqual(3);
  });
}

test('digest entry links use the site focus ring, not the browser default', async ({ page }) => {
  await openBlog(page);
  const firstEntry = page.locator('.writing-list .writing-row-title').first();
  await firstEntry.evaluate((el) => el.focus());
  // `auto` means no author ring — the browser default, which ignores the palette.
  await expect(firstEntry).not.toHaveCSS('outline-style', 'auto');
  await expect(firstEntry).toHaveCSS('outline-style', 'solid');
  await expect(firstEntry).toHaveCSS('outline-color', 'rgb(107, 63, 224)');
});

// Regression: `.nowrap` was applied to a full 96-character sentence, forcing a
// 690px line inside a 343px column. That made the whole blog page scroll
// sideways at every width below ~700px, not just the intro paragraph.
for (const width of [320, 375, 480, 640]) {
  test(`blog page does not scroll sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await openBlog(page);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `blog page overflows the ${width}px viewport`).toBeLessThanOrEqual(width + 1);
  });
}
