const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const path = require('node:path');
const { readConfiguredHeaders, startStaticServer } = require('./helpers/static-server.cjs');

const rootDir = path.join(__dirname, '..');
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

test('blog renders personal posts and the AI digest with sourced cards', async ({ page }) => {
  await openBlog(page);

  await expect(page).toHaveTitle(/Blog/);
  await expect(page.getByRole('heading', { name: 'AI THIS WEEK' })).toBeVisible();

  const digestCards = page.locator('.writing-card[target="_blank"]');
  expect(await digestCards.count()).toBeGreaterThanOrEqual(6);

  // Every digest card links to a real external source over https.
  for (const href of await digestCards.evaluateAll((cards) => cards.map((c) => c.href))) {
    expect(href).toMatch(/^https:\/\//);
  }
  await expect(digestCards.first().locator('.writing-tag')).toBeVisible();
  await expect(digestCards.first().locator('.writing-date')).toBeVisible();
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
  await page.route('**/*', (route) => {
    if (route.request().method() === 'POST') {
      expect(route.request().postData()).toContain('form-name=newsletter');
      return route.fulfill({ status: 200, body: '' });
    }
    return route.continue();
  });

  await page.locator('#nl-email').fill('reader@example.com');
  await page.getByRole('button', { name: 'Subscribe' }).click();
  await expect(page.locator('#newsletterStatus')).toHaveText(/You're on the list/);
  await expect(page.locator('#nl-email')).toHaveValue('');
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
