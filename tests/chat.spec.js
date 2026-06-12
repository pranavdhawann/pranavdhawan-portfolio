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
  await page.locator('#chatBubble').click();
  await expect(page.locator('#chatPanel')).toBeVisible();
}

test('chat bubble opens and closes the panel with focus management', async ({ page }) => {
  await page.goto(pageUrl);
  const bubble = page.locator('#chatBubble');
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute('aria-expanded', 'false');

  await bubble.click();
  await expect(page.locator('#chatPanel')).toBeVisible();
  await expect(bubble).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#chatInput')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#chatPanel')).toBeHidden();
  await expect(bubble).toHaveAttribute('aria-expanded', 'false');
  await expect(bubble).toBeFocused();
});

test('sending a question renders the stubbed answer', async ({ page }) => {
  await page.route('**/.netlify/functions/ask', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.question).toBe('What do you do at ACS?');
    await route.fulfill({ json: { answer: 'I build AI agents at ACS.' } });
  });

  await openChat(page);
  await page.getByRole('button', { name: 'What do you do at ACS?' }).click();
  await expect(page.locator('.chat-message--user')).toHaveText('What do you do at ACS?');
  await expect(page.locator('.chat-message--bot').last()).toHaveText('I build AI agents at ACS.');
});

test('failed requests show the friendly error message', async ({ page }) => {
  await page.route('**/.netlify/functions/ask', (route) => route.abort());

  await openChat(page);
  await page.locator('#chatInput').fill('Hello?');
  await page.locator('.chat-send').click();
  await expect(page.locator('.chat-message--bot').last()).toContainText('Something went wrong');
});

test('open chat panel has no axe violations', async ({ page }) => {
  await openChat(page);
  const results = await new AxeBuilder({ page }).include('#chatPanel').analyze();
  expect(results.violations).toEqual([]);
});
