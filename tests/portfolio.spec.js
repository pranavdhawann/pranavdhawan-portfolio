const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('node:fs');
const path = require('node:path');
const { readConfiguredHeaders, startStaticServer } = require('./helpers/static-server.cjs');

// Tests run against the BUILT output in public/ — the same files Netlify
// serves — so minification and asset-copy regressions are caught locally.
// `npm run check` builds first; if you invoke playwright directly, run it too.
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

async function openPortfolio(page) {
  await page.goto(pageUrl);
}

test('desktop page loads nav and renders skills graph', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await openPortfolio(page);

  await expect(page).toHaveTitle(/Pranav Dhawan/);
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('link', { name: 'HOME' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'SKILLS' })).toBeVisible();
  await expect(page.locator('#skillsGraph .node')).toHaveCount(0);
  await page.locator('#skills').scrollIntoViewIfNeeded();
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

test('every project card links to a live, non-archived repository', async ({ page }) => {
  await openPortfolio(page);

  const expected = [
    ['Stock Screen', 'https://github.com/pranavdhawann/stock-screen'],
    ['Multimodal Techniques for Equity Forecasting', 'https://github.com/pranavdhawann/spring-2026-group4'],
    ['Edge-Based PII Detection & Censoring System', 'https://github.com/pranavdhawann/Final-Project-Group4'],
    ['Singularity — Local-First Memory for AI Assistants', 'https://github.com/pranavdhawann/singularity'],
  ];

  for (const [projectName, href] of expected) {
    const card = page.locator('.project-card').filter({ hasText: projectName });
    await expect(card.getByRole('link', { name: 'Code' })).toHaveAttribute('href', href);
  }
});

test('project cards render named screenshots inside the existing image frames', async ({ page }) => {
  await openPortfolio(page);

  const expectedImages = [
    ['Stock Screen', 'images/stockscreen.png'],
    ['Multimodal Techniques for Equity Forecasting', 'images/multimodal.png'],
    ['Edge-Based PII Detection & Censoring System', 'images/pii.png'],
    ['Singularity — Local-First Memory for AI Assistants', 'images/singularity.png']
  ];

  for (const [projectName, imagePath] of expectedImages) {
    const card = page.locator('.project-card').filter({ hasText: projectName });
    const frame = card.locator('.project-image');
    const image = frame.locator('img.project-photo');

    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('src', imagePath);
    // Alt text has to describe the screenshot, not just repeat the heading a
    // screen-reader user has already heard.
    const alt = await image.getAttribute('alt');
    expect(alt.length).toBeGreaterThan(projectName.length + 15);
    await expect(frame.locator('source[type="image/avif"]')).toHaveAttribute('srcset', imagePath.replace('.png', '.avif'));
    await expect(frame.locator('source[type="image/webp"]')).toHaveAttribute('srcset', imagePath.replace('.png', '.webp'));
    await expect(frame.locator('.project-icon')).toHaveCount(0);

    const layout = await image.evaluate((img) => {
      const imageBox = img.getBoundingClientRect();
      const frame = img.closest('.project-image');
      const styles = getComputedStyle(img);

      return {
        imageWidth: Math.round(imageBox.width),
        imageHeight: Math.round(imageBox.height),
        frameWidth: frame.clientWidth,
        frameHeight: frame.clientHeight,
        objectFit: styles.objectFit
      };
    });

    expect(layout.imageWidth).toBe(layout.frameWidth);
    expect(layout.imageHeight).toBe(layout.frameHeight);
    expect(layout.objectFit).toBe('cover');
  }
});

test('professional experience reflects updated role history', async ({ page }) => {
  await openPortfolio(page);

  const experience = page.locator('#experience');
  const firstTimelineItem = experience.locator('.timeline-item').first();

  await expect(firstTimelineItem.getByText('May 2026 - Present')).toBeVisible();
  await expect(firstTimelineItem.getByRole('heading', { name: 'AI Workplace Engineer Intern' })).toBeVisible();
  await expect(firstTimelineItem.getByText('American Chemical Society | Washington, DC')).toBeVisible();
  await expect(firstTimelineItem.getByText(/245 of 350 monthly tickets/)).toBeVisible();
  await expect(firstTimelineItem.getByText(/lifecycle-aware tracking/)).toBeVisible();
  await expect(firstTimelineItem.getByText(/AI governance framework/)).toBeVisible();

  await expect(experience.getByRole('heading', { name: 'Independent Contractor - AI' })).toBeVisible();
  await expect(experience.getByText('Siva Info LLC | New York, NY')).toBeVisible();
  await expect(experience.getByText(/edition-aware PDF-diff tooling/)).toBeVisible();
  await expect(experience.getByText(/32% to 99%/)).toBeVisible();
  await expect(experience.locator('.tech-tag', { hasText: 'Pipeline Automation' })).toBeVisible();

  await expect(experience.getByRole('heading', { name: 'Machine Learning Engineer' })).toBeVisible();
  await expect(experience.getByText(/YOLOv8 document intelligence pipeline/)).toBeVisible();
  await expect(experience.getByText(/hybrid RAG system/)).toBeVisible();
  await expect(experience.getByText(/reducing inference latency by approximately 0\.3 seconds per page/)).toBeVisible();
  await expect(experience.getByText(/AWS SageMaker deployment/)).toBeVisible();

  await expect(experience.getByText('HCLTech | Noida, India')).toBeVisible();
  await expect(experience.getByText(/500\+ employees/)).toBeVisible();

  await expect(experience.getByText('EY | Gurugram, India')).toBeVisible();
  await expect(experience.getByText(/Automated ETL workflows across more than five data sources/)).toBeVisible();

  // Earlier (2021) roles are collapsed behind a toggle — expand them first.
  await experience.getByRole('button', { name: /Show earlier roles/ }).click();

  await expect(experience.getByText('LEARNOVATE ECOMMERCE')).toBeVisible();
  await expect(experience.getByText(/Developed responsive web interfaces using HTML, CSS, and JavaScript/)).toBeVisible();

  await expect(experience.getByText('Education 4 ol')).toBeVisible();
  await expect(experience.getByText(/Built reusable frontend components using HTML, CSS, and JavaScript/)).toBeVisible();
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

  await expect(page.getByText(/Completed a published research paper and technical report from the Multimodal Techniques/)).toBeVisible();
  await expect(page.getByText('GPA: 8.51/10.0')).toBeVisible();
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

test('coursework tags follow the same visual style as technology tags', async ({ page }) => {
  await openPortfolio(page);

  const tagStyles = await page.evaluate(() => {
    const coursework = document.querySelector('.course-tag');
    const tech = document.querySelector('.tech-tag');
    const properties = ['backgroundColor', 'color', 'fontSize', 'fontWeight', 'paddingTop', 'paddingRight', 'borderTopWidth'];

    return Object.fromEntries(
      properties.map((property) => [
        property,
        {
          coursework: window.getComputedStyle(coursework)[property],
          tech: window.getComputedStyle(tech)[property]
        }
      ])
    );
  });

  for (const { coursework, tech } of Object.values(tagStyles)) {
    expect(coursework).toBe(tech);
  }
});

test('contact actions sit a balanced distance beneath the get in touch heading', async ({ page }) => {
  await openPortfolio(page);

  const gap = await page.evaluate(() => {
    const title = document.querySelector('#contact .section-title').getBoundingClientRect();
    const action = document.querySelector('#contact .resume-btn').getBoundingClientRect();
    return action.top - title.bottom;
  });

  // Deliberately generous breathing room beneath the heading before the
  // contact actions begin.
  expect(gap).toBeGreaterThanOrEqual(45);
  expect(gap).toBeLessThanOrEqual(130);
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

// .hero sets overflow:hidden, so a hero wider than the viewport is clipped
// instead of producing a scrollbar. Assert element widths rather than page
// scrollWidth, which stays clean even while the text is being cut off.
for (const width of [320, 375, 390]) {
  test(`hero fits the viewport at ${width}px without clipping`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await openPortfolio(page);

    for (const selector of ['.hero-container', '.hero-content', '.hero-title', '.hero-image', '.avatar-wrapper']) {
      const measured = await page.locator(selector).evaluate((el) => el.getBoundingClientRect().width);
      expect(measured, `${selector} overflows the ${width}px viewport`).toBeLessThanOrEqual(width);
    }
  });
}

test('portfolio presents the verified career and education facts', async ({ page }) => {
  await openPortfolio(page);

  const experience = page.locator('#experience');
  await expect(experience.getByRole('heading', { name: 'Independent Contractor - AI' })).toBeVisible();
  await expect(experience.getByText('AI Workplace Engineer Intern')).toBeVisible();
  await expect(experience.getByText('Lumina Datamatics | Chennai, India')).toBeVisible();
  await expect(experience.getByText('August 2020 - May 2024')).toBeVisible();
  await expect(experience.getByText('GPA: 8.51/10.0')).toBeVisible();
  await expect(experience.getByText(/published research paper and technical report/i)).toBeVisible();
});

test('timeline toggle keeps the same label after a full open-close cycle', async ({ page }) => {
  await openPortfolio(page);
  const toggle = page.locator('#timelineToggle');
  await toggle.click();
  await expect(toggle).toHaveAccessibleName('Hide earlier roles');
  await toggle.click();
  await expect(toggle).toHaveAccessibleName('Show earlier roles');
});

test('page has a skip link and hides eye pupils after an avatar load failure', async ({ page }) => {
  await openPortfolio(page);
  await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
  await expect(page.locator('.avatar-wrapper picture').first().locator('source[type="image/avif"]')).toHaveAttribute('srcset', 'images/photo.avif');
  await expect(page.locator('.avatar-wrapper picture').first().locator('source[type="image/webp"]')).toHaveAttribute('srcset', 'images/photo.webp');
  await expect(page.locator('.avatar-wrapper picture').nth(1).locator('source[type="image/avif"]')).toHaveAttribute('srcset', 'images/eye.avif');
  await expect(page.locator('.avatar-wrapper picture').nth(1).locator('source[type="image/webp"]')).toHaveAttribute('srcset', 'images/eye.webp');
  await page.locator('#avatarImg').dispatchEvent('error');
  await expect(page.locator('.eye-pupil')).toHaveCount(2);
  for (const pupil of await page.locator('.eye-pupil').all()) {
    await expect(pupil).toHaveCSS('display', 'none');
  }
});

// The smooth-scroll handler calls preventDefault(), which cancels the browser's
// own fragment navigation — and with it the focus move. Without an explicit
// focus() the skip link scrolls the page but strands keyboard users in the nav.
test('the skip link moves keyboard focus into main', async ({ page }) => {
  await openPortfolio(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('the contact form cannot be submitted twice by double-clicking', async ({ page }) => {
  await openPortfolio(page);
  let posts = 0;
  await page.route('**/*', async (route) => {
    if (route.request().method() === 'POST') {
      posts += 1;
      await new Promise((r) => setTimeout(r, 400));
      return route.fulfill({ status: 200, body: '' });
    }
    return route.continue();
  });

  await page.fill('#cf-name', 'Test');
  await page.fill('#cf-email', 'test@example.com');
  await page.fill('#cf-message', 'Hello');
  const button = page.locator('.contact-submit');
  await button.click();
  await expect(button).toBeDisabled();
  await expect(page.locator('#contactStatus')).toHaveText(/get back to you/i);
  expect(posts).toBe(1);
});

// A filled honeypot means a bot. Netlify would accept the POST with fake
// success anyway; the client must skip the POST so no phantom contact-sent
// analytics event fires for a submission that was never stored.
test('a filled honeypot fakes success without posting anything', async ({ page }) => {
  await openPortfolio(page);
  let posts = 0;
  await page.route('**/*', async (route) => {
    if (route.request().method() === 'POST') posts += 1;
    return route.continue();
  });

  await page.fill('#cf-name', 'Bot');
  await page.fill('#cf-email', 'bot@example.com');
  await page.fill('#cf-message', 'Buy now');
  await page.locator('input[name="bot-field"]').evaluate((el) => { el.value = 'spam'; });
  await page.locator('.contact-submit').click();

  await expect(page.locator('#contactStatus')).toHaveText(/get back to you/i);
  expect(posts).toBe(0);
});

test('a failed contact POST shows the error state with a fallback contact', async ({ page }) => {
  await openPortfolio(page);
  await page.route('**/*', (route) => (
    route.request().method() === 'POST'
      ? route.fulfill({ status: 500, body: '' })
      : route.continue()
  ));

  await page.fill('#cf-name', 'Test');
  await page.fill('#cf-email', 'test@example.com');
  await page.fill('#cf-message', 'Hello');
  await page.locator('.contact-submit').click();

  const status = page.locator('#contactStatus');
  await expect(status).toHaveText(/Something went wrong/);
  await expect(status).toHaveClass(/is-error/);
});

// The orbit runs on requestAnimationFrame, which the blanket reduced-motion CSS
// rule cannot reach — it has to opt out in JavaScript. expect.poll samples the
// transform repeatedly: with motion wrongly enabled the value keeps changing
// and the poll times out, no fixed sleeps needed.
test('reduced motion stops the avatar eye orbit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await openPortfolio(page);

  const first = await page.locator('#eyeLeft').evaluate((el) => el.style.transform);
  await expect.poll(
    () => page.locator('#eyeLeft').evaluate((el) => el.style.transform),
    { intervals: [100, 250, 500], timeout: 1500 }
  ).toBe(first);
  await expect(page.locator('.avatar-wrapper')).not.toHaveClass(/is-auto-orbit/);
});

test('every nav target exists and each section is reachable from the nav', async ({ page }) => {
  await openPortfolio(page);
  const hrefs = await page.locator('.nav-menu .nav-link').evaluateAll(
    (links) => links.map((a) => a.getAttribute('href'))
  );
  expect(hrefs).toContain('#client-work');

  for (const href of hrefs.filter((h) => h.startsWith('#'))) {
    await expect(page.locator(href)).toHaveCount(1);
  }
});

test('portfolio presents client work and links to its privacy notice', async ({ page }) => {
  await openPortfolio(page);
  await expect(page.getByRole('heading', { name: /Client Work/i })).toBeVisible();
  await expect(page.locator('.client-card', { hasText: 'Aevantis Aerospace' }).getByRole('link', { name: 'Visit site' })).toHaveAttribute('href', 'https://aevantisaerospace.com/');
  await expect(page.locator('.client-card', { hasText: 'Admiles Media' }).getByRole('link', { name: 'Visit site' })).toHaveAttribute('href', 'https://admiles.in/');
  await expect(page.getByRole('link', { name: 'Privacy', exact: true })).toHaveAttribute('href', 'privacy.html');
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
  await page.locator('#skills').scrollIntoViewIfNeeded();

  const pythonNode = page.locator('#skillsGraph .node[data-id="python"]');
  await expect(pythonNode).toHaveAttribute('tabindex', '0');
  await expect(pythonNode).toHaveAttribute('role', 'button');

  await pythonNode.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#skillsGraph .link.active')).not.toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(page.locator('#skillsGraph .link.active')).toHaveCount(0);
});

test('self-hosts fonts without requesting Google Fonts', async ({ page }) => {
  await openPortfolio(page);

  await expect(page.locator('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]')).toHaveCount(0);
  const css = await (await page.request.get(`${pageUrl}styles.css`)).text();
  expect(css).toContain('@font-face');
  // Minified CSS may normalize url() quoting, so assert on paths only.
  expect(css).toMatch(/fonts\/dm-sans-variable\.woff2/);
  expect(css).toMatch(/fonts\/space-grotesk-variable\.woff2/);
});

test('coalesces hero title pointer writes into an animation frame', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openPortfolio(page);

  const result = await page.locator('.hero-title').evaluate(async (title) => {
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150, clientY: 120 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 240 }));
    const beforeFrame = title.style.transform;
    await new Promise(requestAnimationFrame);
    return { beforeFrame, afterFrame: title.style.transform };
  });

  expect(result.beforeFrame).toBe('');
  expect(result.afterFrame).not.toBe('');
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

test('timeline dates all use the same full-month format', async ({ page }) => {
  await openPortfolio(page);

  const month = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
  const datePattern = new RegExp(`^${month} \\d{4} - (?:${month} \\d{4}|Present)$`);

  const dates = await page.locator('.timeline-date').allTextContents();
  expect(dates.length).toBeGreaterThan(0);
  for (const date of dates) {
    expect(date.trim()).toMatch(datePattern);
  }
});

test('footer is a contentinfo landmark outside main', async ({ page }) => {
  await openPortfolio(page);

  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.locator('main footer')).toHaveCount(0);
});

test('structured data describes the site owner as a Person', async ({ page }) => {
  await openPortfolio(page);

  const json = await page.locator('script[type="application/ld+json"]').first().textContent();
  const data = JSON.parse(json);
  expect(data['@type']).toBe('Person');
  expect(data.name).toBe('Pranav Dhawan');
  expect(data.sameAs).toContain('https://github.com/pranavdhawann');
});

test('hash navigation clears the fixed navbar via scroll padding', async ({ page }) => {
  await openPortfolio(page);

  const scrollPaddingTop = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollPaddingTop
  );
  expect(scrollPaddingTop).toBe('80px');
});

test('github and linkedin icons use brand paths instead of text placeholders', async ({ page }) => {
  await openPortfolio(page);

  await expect(page.locator('symbol#icon-github text')).toHaveCount(0);
  await expect(page.locator('symbol#icon-linkedin text')).toHaveCount(0);
  await expect(page.locator('symbol#icon-github path')).not.toHaveCount(0);
  await expect(page.locator('symbol#icon-linkedin path')).not.toHaveCount(0);
});
