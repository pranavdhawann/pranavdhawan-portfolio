const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const pageUrl = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

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
  await expect(page.locator('#skillsGraph .node')).toHaveCount(21);
  await expect(page.locator('#skillsGraph .link')).not.toHaveCount(0);
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
