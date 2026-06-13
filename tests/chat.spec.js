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

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png'
};

test.beforeAll(async () => {
  const toml = fs.readFileSync(path.join(rootDir, 'netlify.toml'), 'utf8');
  const csp = readTomlString(toml, 'Content-Security-Policy');
  server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const relativePath = requestPath === '/' ? 'index.html' : requestPath.slice(1);
    const filePath = path.resolve(rootDir, relativePath);
    const isInRoot = filePath === rootDir || filePath.startsWith(rootDir + path.sep);

    if (!isInRoot || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404, { 'Content-Security-Policy': csp });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Security-Policy': csp,
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

async function openChat(page) {
  await page.goto(pageUrl);
  await page.locator('#chatInput').focus();
  await expect(page.locator('#chatPanel')).toBeVisible();
}

test('focusing the pill opens the panel and Escape closes it', async ({ page }) => {
  await page.goto(pageUrl);
  const pill = page.locator('#chatForm');
  const input = page.locator('#chatInput');
  await expect(pill).toBeVisible();
  await expect(page.locator('#chatPanel')).toBeHidden();

  await input.focus();
  await expect(page.locator('#chatPanel')).toBeVisible();
  await expect(input).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#chatPanel')).toBeHidden();
  await expect(input).toBeFocused();
});

test('clicking outside the panel closes it', async ({ page }) => {
  await openChat(page);
  await page.mouse.click(40, 200);
  await expect(page.locator('#chatPanel')).toBeHidden();
});

test('close button closes the panel and it stays closed', async ({ page }) => {
  await openChat(page);
  await page.locator('#chatClose').click();
  await page.waitForTimeout(350);
  await expect(page.locator('#chatPanel')).toBeHidden();
});

test('typing a question and pressing Enter renders the stubbed answer', async ({ page }) => {
  await page.route('**/.netlify/functions/ask', async (route) => {
    expect(route.request().postDataJSON().question).toBe('Who are you?');
    await route.fulfill({ json: { answer: 'I am Pranav.' } });
  });

  await openChat(page);
  await page.locator('#chatInput').fill('Who are you?');
  await page.keyboard.press('Enter');
  await expect(page.locator('.chat-message--user')).toHaveText('Who are you?');
  await expect(page.locator('.chat-message--bot').last()).toHaveText('I am Pranav.');
});

test('suggestion chip sends its question', async ({ page }) => {
  await page.route('**/.netlify/functions/ask', (route) =>
    route.fulfill({ json: { answer: 'I build AI agents at ACS.' } })
  );

  await openChat(page);
  await page.getByRole('button', { name: 'What do you do at ACS?' }).click();
  await expect(page.locator('.chat-message--bot').last()).toHaveText('I build AI agents at ACS.');
});

test('failed requests show the friendly error message', async ({ page }) => {
  await page.route('**/.netlify/functions/ask', (route) => route.abort());

  await openChat(page);
  await page.locator('#chatInput').fill('Hello?');
  await page.keyboard.press('Enter');
  await expect(page.locator('.chat-message--bot').last()).toContainText('Something went wrong');
});

test('server-provided error messages are shown to the visitor', async ({ page }) => {
  await page.route('**/.netlify/functions/ask', (route) =>
    route.fulfill({ status: 502, json: { error: "I'm getting a lot of questions right now — give it a few seconds and ask again." } })
  );

  await openChat(page);
  await page.locator('#chatInput').fill('Busy?');
  await page.keyboard.press('Enter');
  await expect(page.locator('.chat-message--bot').last()).toContainText('a lot of questions');
});

test('page with pill and open panel has no axe violations', async ({ page }) => {
  await openChat(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('mobile chat controls leave room for the back-to-top button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl);
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(page.locator('#backToTop')).toBeVisible();

  await page.locator('#chatInput').focus();
  await expect(page.locator('#chatPanel')).toBeVisible();

  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom
      };
    };
    const overlaps = (a, b) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

    const pill = rect('#chatForm');
    const panel = rect('#chatPanel');
    const backToTop = rect('#backToTop');

    return {
      pill,
      panel,
      backToTop,
      pillOverlapsBackToTop: overlaps(pill, backToTop),
      panelOverlapsPill: overlaps(panel, pill)
    };
  });

  expect(layout.pillOverlapsBackToTop).toBe(false);
  expect(layout.panelOverlapsPill).toBe(false);
  expect(layout.pill.right).toBeLessThanOrEqual(layout.backToTop.left - 8);
});
