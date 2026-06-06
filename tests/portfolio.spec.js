const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
let server;
let pageUrl;

function readTomlString(content, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`^${escapedKey}\\s*=\\s*"([^"]*)"`, 'm'));
  return match ? match[1] : undefined;
}

function readConfiguredHeaders() {
  const content = fs.readFileSync(path.join(rootDir, 'netlify.toml'), 'utf8');
  return {
    'Content-Security-Policy': readTomlString(content, 'Content-Security-Policy'),
    'Strict-Transport-Security': readTomlString(content, 'Strict-Transport-Security'),
    'X-Frame-Options': readTomlString(content, 'X-Frame-Options'),
    'X-Content-Type-Options': readTomlString(content, 'X-Content-Type-Options'),
    'Referrer-Policy': readTomlString(content, 'Referrer-Policy'),
    'Permissions-Policy': readTomlString(content, 'Permissions-Policy')
  };
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.pdf': 'application/pdf'
};

test.beforeAll(async () => {
  const configuredHeaders = readConfiguredHeaders();
  server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const relativePath = requestPath === '/' ? 'index.html' : requestPath.slice(1);
    const filePath = path.resolve(rootDir, relativePath);
    const isInRoot = filePath === rootDir || filePath.startsWith(rootDir + path.sep);

    if (!isInRoot || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404, configuredHeaders);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      ...configuredHeaders,
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream'
    });
    fs.createReadStream(filePath).pipe(response);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  pageUrl = `http://127.0.0.1:${server.address().port}/`;
});

test.afterAll(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function openPortfolio(page) {
  await page.goto(pageUrl);
}

test('desktop page loads nav and renders skills graph', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openPortfolio(page);

  await expect(page).toHaveTitle(/Pranav Dhawan/);
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('link', { name: 'HOME' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'SKILLS' })).toBeVisible();
  await expect(page.locator('#skillsGraph')).toBeVisible();
  await expect(page.locator('#skillsGraph .node')).toHaveCount(20);
  await expect(page.locator('#skillsGraph .link')).not.toHaveCount(0);
});

test('test harness serves the page over HTTP with configured security headers', async ({ page }) => {
  expect(new URL(pageUrl).protocol).toBe('http:');

  const response = await page.goto(pageUrl);
  expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
});

test('dashboard project links to weather dashboard repository', async ({ page }) => {
  await openPortfolio(page);

  await expect(page.getByRole('link', { name: 'Code' }).nth(2)).toHaveAttribute(
    'href',
    'https://github.com/pranavdhawann/weather-dashboard'
  );
});

test('american chemical society experience includes RAG and Teams bot impact', async ({ page }) => {
  await openPortfolio(page);

  await expect(
    page.getByText(/Created a RAG proof of concept with a locally hosted Qwen model/)
  ).toBeVisible();
  await expect(page.getByText(/tickets get resolved/)).toBeVisible();
  await expect(page.getByText('30% faster')).toBeVisible();
});

test('portfolio copy uses workplace engineer consistently', async ({ page }) => {
  await openPortfolio(page);

  const metaDescription = page.locator('meta[name="description"]');
  await expect(metaDescription).toHaveAttribute('content', /AI Workplace Engineer/);
  await expect(page.getByText('AI Workplace Engineer')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('AI Workforce Engineer');
});

test('stock screen copy avoids unverified paid-tier language', async ({ page }) => {
  await openPortfolio(page);

  const card = page.locator('.project-card').filter({ hasText: 'Stock Screen' });
  await expect(card).toContainText('forecasting workflows');
  await expect(card).not.toContainText('paid tier');
  await expect(card).not.toContainText('tested algorithmic models');
});

test('education sections include academic project and paper highlights', async ({ page }) => {
  await openPortfolio(page);

  await expect(page.getByText(/Published a journal paper from the Multimodal Techniques/)).toBeVisible();
  await expect(page.getByText(/U\.S\. government health, CBP\.gov, and WMATA datasets/)).toBeVisible();
  await expect(page.getByText(/comparative analysis paper on transformer models versus LSTM/)).toBeVisible();
  await expect(page.getByText(/sentiment classification across the X platform/)).toBeVisible();
});

test('coursework sections use the same top spacing as technology sections', async ({ page }) => {
  await openPortfolio(page);

  const spacing = await page.evaluate(() => {
    const coursework = document.querySelector('.coursework');
    const techStack = document.querySelector('.tech-stack');

    return {
      coursework: window.getComputedStyle(coursework).marginTop,
      techStack: window.getComputedStyle(techStack).marginTop
    };
  });

  expect(spacing.coursework).toBe(spacing.techStack);
});

test('mobile hamburger menu toggles expanded state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPortfolio(page);

  const toggle = page.getByRole('button', { name: 'Toggle navigation menu' });
  const menu = page.locator('#navMenu');

  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).not.toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).not.toBeVisible();
});

test('reduced motion prevents injected hero decorations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await openPortfolio(page);

  await expect(page.locator('.particles-container')).toHaveCount(0);
  await expect(page.locator('.hero-rockets')).toHaveCount(0);
});

test('skills graph nodes are keyboard accessible', async ({ page }) => {
  await openPortfolio(page);

  const pythonNode = page.locator('#skillsGraph .node[data-id="python"]');
  await expect(pythonNode).toHaveAttribute('tabindex', '0');
  await expect(pythonNode).toHaveAttribute('role', 'button');

  await pythonNode.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#skillsGraph .link.active')).not.toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(page.locator('#skillsGraph .link.active')).toHaveCount(0);
});

test('page has no axe accessibility violations', async ({ page }) => {
  await openPortfolio(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('font awesome stylesheet is not loaded', async ({ page }) => {
  await openPortfolio(page);

  await expect(page.locator('link[href*="font-awesome"]')).toHaveCount(0);
});

test('github and linkedin icons use brand paths instead of text placeholders', async ({ page }) => {
  await openPortfolio(page);

  await expect(page.locator('symbol#icon-github text')).toHaveCount(0);
  await expect(page.locator('symbol#icon-linkedin text')).toHaveCount(0);
  await expect(page.locator('symbol#icon-github path')).not.toHaveCount(0);
  await expect(page.locator('symbol#icon-linkedin path')).not.toHaveCount(0);
});
