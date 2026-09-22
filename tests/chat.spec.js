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
  // Spans the 250ms suppressOpen window that guards against the close→refocus
  // reopen loop; the panel must still be hidden once it expires.
  await page.waitForTimeout(300);
  await expect(page.locator('#chatPanel')).toBeHidden();
});

// Regression for the 250ms suppression window eating genuine reopens: after an
// outside-click close, clicking straight into the pill input must reopen.
test('clicking into the pill right after an outside-click close reopens the panel', async ({ page }) => {
  await openChat(page);
  await page.mouse.click(40, 200);
  await expect(page.locator('#chatPanel')).toBeHidden();
  // The pill collapses to a FAB when it loses focus, so the reopen gesture is a
  // click on the pill itself; the input inside it is zero-width until expanded.
  await page.locator('#chatForm').click();
  await expect(page.locator('#chatPanel')).toBeVisible();
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

test('dark-mode bot and typing messages use white text', async ({ page }) => {
  await page.route('**/.netlify/functions/ask', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ json: { answer: 'I am Pranav.' } });
  });

  await page.goto(pageUrl);
  await page.locator('#themeToggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#chatInput').focus();
  await page.locator('#chatInput').fill('Who are you?');
  await page.keyboard.press('Enter');

  const textColors = await page.locator('.chat-message--bot, .chat-message--typing').evaluateAll((messages) =>
    messages.map((message) => getComputedStyle(message).color)
  );
  expect(textColors).toEqual(['rgb(255, 255, 255)', 'rgb(255, 255, 255)']);
  await expect(page.locator('.chat-message--user')).toHaveCSS('color', 'rgb(26, 26, 26)');
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

// The chat FAB and the back-to-top button share the bottom-right corner and
// stack vertically. They must never overlap each other or the panel.
test('mobile chat controls leave room for the back-to-top button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl);
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(page.locator('#backToTop')).toBeVisible();

  await page.locator('#chatForm').click();
  await expect(page.locator('#chatPanel')).toBeVisible();
  // Both controls slide in; measure resting geometry, not a frame mid-transition.
  await page.evaluate(() => Promise.all(
    ['#backToTop', '#chatForm', '#chatPanel']
      .flatMap((s) => document.querySelector(s).getAnimations())
      .map((a) => a.finished.catch(() => {}))
  ));

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
  // Stacked, not side by side: back-to-top sits clear above the chat FAB, and
  // both hug the same right edge.
  expect(layout.backToTop.bottom).toBeLessThanOrEqual(layout.pill.top - 8);
  expect(Math.abs(layout.backToTop.right - layout.pill.right)).toBeLessThanOrEqual(1);
});

test('floating chat controls stop above the footer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(pageUrl);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.documentElement.scrollTop = document.documentElement.scrollHeight;
    document.body.scrollTop = document.body.scrollHeight;
  });
  await page.waitForFunction(() => window.scrollY > 0);
  await page.locator('#chatInput').focus();
  await expect(page.locator('#chatPanel')).toBeVisible();

  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return {
        top: box.top,
        bottom: box.bottom
      };
    };

    return {
      footer: rect('.footer'),
      pill: rect('#chatForm'),
      panel: rect('#chatPanel')
    };
  });

  expect(layout.pill.bottom).toBeLessThanOrEqual(layout.footer.top - 12);
  expect(layout.panel.bottom).toBeLessThanOrEqual(layout.pill.top - 12);
});

// Regression: `send()` bailed out on `pending` with no feedback at all, so a
// second Enter while a request was in flight was indistinguishable from a dead
// control. The send button now reports the busy state.
test('the send button reports the in-flight state and recovers', async ({ page }) => {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('**/.netlify/functions/ask', async (route) => {
    await held;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ answer: 'Done.' }),
    });
  });

  await openChat(page);
  const send = page.locator('.chat-send');
  await expect(send).toBeEnabled();

  await page.locator('#chatInput').fill('what do you do?');
  await page.locator('#chatInput').press('Enter');
  await expect(send).toBeDisabled();

  release();
  await expect(page.locator('.chat-message--bot').nth(1)).toHaveText('Done.');
  await expect(send).toBeEnabled();
});
