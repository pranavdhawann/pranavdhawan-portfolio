const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('node:fs');
const path = require('node:path');
const { readConfiguredHeaders, startStaticServer } = require('./helpers/static-server.cjs');

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
  await page.goto(`${pageUrl}blog/`);
}

test('blog lists the hand-published posts, each linking to a page that loads', async ({ page, request }) => {
  await openBlog(page);

  await expect(page).toHaveTitle(/Blog/);
  await expect(page.getByRole('heading', { level: 1, name: 'BLOG' })).toBeVisible();

  const entries = page.locator('.writing-list .writing-row-title');
  expect(await entries.count()).toBeGreaterThanOrEqual(4);
  for (const href of await entries.evaluateAll((links) => links.map((a) => a.href))) {
    const response = await request.get(href);
    expect(response.ok(), href).toBe(true);
  }
  await expect(page.locator('.writing-list .writing-tag').first()).toBeVisible();
  await expect(page.locator('.writing-list .writing-date').first()).toBeVisible();
});

test('the blog carries no signup form or third-party content', async ({ page }) => {
  await openBlog(page);
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.locator('.writing-list a[target="_blank"]')).toHaveCount(0);
});

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

test('blog retains portfolio navigation', async ({ page }) => {
  await openBlog(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'HOME', exact: true })).toHaveAttribute('href', '../');
  await expect(nav.getByRole('link', { name: 'PROJECTS', exact: true })).toHaveAttribute('href', '../#projects');
  await expect(nav.getByRole('link', { name: 'BLOG', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Privacy', exact: true })).toHaveAttribute('href', '../privacy.html');
});

test('the blog nav drawer opens and closes on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openBlog(page);
  const toggle = page.locator('#mobileToggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'CONTACT', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('a section link in the blog nav lands on that section of the portfolio', async ({ page }) => {
  await openBlog(page);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'PROJECTS', exact: true }).click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(page.locator('#projects .section-title')).toBeInViewport();
});

test('blog uses the self-hosted site fonts', async ({ page }) => {
  await openBlog(page);
  await expect(page.locator('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]')).toHaveCount(0);
});

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
    expect(contrastRatio(parseRgb(listTop), background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(parseRgb(rowBottom), background)).toBeGreaterThanOrEqual(3);
  });
}

test('post links use the site focus ring, not the browser default', async ({ page }) => {
  await openBlog(page);
  const firstEntry = page.locator('.writing-list .writing-row-title').first();
  await firstEntry.evaluate((el) => el.focus());
  await expect(firstEntry).not.toHaveCSS('outline-style', 'auto');
  await expect(firstEntry).toHaveCSS('outline-style', 'solid');
  await expect(firstEntry).toHaveCSS('outline-color', 'rgb(107, 63, 224)');
});

for (const width of [320, 375, 480, 640]) {
  test(`blog page does not scroll sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await openBlog(page);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, `blog page overflows the ${width}px viewport`).toBeLessThanOrEqual(width + 1);
  });
}
