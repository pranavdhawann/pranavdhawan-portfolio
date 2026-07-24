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

test('dashboard project links to weather dashboard repository', async ({ page }) => {
  await openPortfolio(page);

  await expect(page.getByRole('link', { name: 'Code' }).nth(2)).toHaveAttribute(
    'href',
    'https://github.com/pranavdhawann/weather-dashboard'
  );
});

test('project cards render named screenshots inside the existing image frames', async ({ page }) => {
  await openPortfolio(page);

  const expectedImages = [
    ['Stock Screen', 'images/stockscreen.png'],
    ['Multimodal Techniques for Equity Forecasting', 'images/multimodal.png'],
    ['Edge-Based PII Detection & Censoring System', 'images/pii.png'],
    ['Serverless ETL — Weather Dashboard', 'images/weather-dashboard.png']
  ];

  for (const [projectName, imagePath] of expectedImages) {
    const card = page.locator('.project-card').filter({ hasText: projectName });
    const frame = card.locator('.project-image');
    const image = frame.locator('img.project-photo');

    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('src', imagePath);
    await expect(image).toHaveAttribute('alt', projectName);
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

  await expect(firstTimelineItem.getByText('June 2026 - Present')).toBeVisible();
  await expect(firstTimelineItem.getByRole('heading', { name: 'Independent Contractor - AI' })).toBeVisible();
  await expect(firstTimelineItem.getByText('Siva Info LLC | New York, NY | Part-time, Remote')).toBeVisible();
  await expect(firstTimelineItem.getByText(/change-manifest tooling/)).toBeVisible();
  await expect(firstTimelineItem.getByText(/32% to 99%/)).toBeVisible();
  await expect(firstTimelineItem.locator('.tech-tag', { hasText: 'Local LLMs' })).toBeVisible();

  await expect(experience.getByRole('heading', { name: 'AI Workplace Engineer Intern' })).toBeVisible();
  await expect(experience.getByText('American Chemical Society | Washington, DC | Full-time, Hybrid')).toBeVisible();
  await expect(experience.getByText(/~70% of monthly Ivanti Neurons service desk tickets/)).toBeVisible();
  await expect(experience.getByText(/Copilot Studio pilot program/)).toBeVisible();
  await expect(experience.getByText(/AI governance blueprint/)).toBeVisible();

  await expect(experience.getByRole('heading', { name: 'Machine Learning Engineer' })).toBeVisible();
  await expect(experience.getByText(/detect and extract complex equations from 10,000\+ unstructured documents/)).toBeVisible();
  await expect(experience.getByText(/fine-tuned BART\/BERT-based models/)).toBeVisible();
  await expect(experience.getByText(/reducing inference latency by 0\.3 seconds per page/)).toBeVisible();
  await expect(experience.getByText(/Operationalized machine learning workloads on AWS SageMaker/)).toBeVisible();

  await expect(experience.getByText('HCLTech | Noida, India | Internship, Hybrid')).toBeVisible();
  await expect(experience.getByText(/Built predictive workforce analytics models/)).toBeVisible();

  await expect(experience.getByText('EY | Gurugram, India | Internship, Hybrid')).toBeVisible();
  await expect(experience.getByText(/Automated ETL workflows using Alteryx/)).toBeVisible();

  // Earlier (2021) roles are collapsed behind a toggle — expand them first.
  await experience.getByRole('button', { name: /Show earlier roles/ }).click();

  await expect(experience.getByText('LEARNOVATE ECOMMERCE | Remote | Internship')).toBeVisible();
  await expect(experience.getByText(/Developed responsive web interfaces using HTML, CSS, and JavaScript/)).toBeVisible();

  await expect(experience.getByText(/Education 4 ol \| Remote \| Internship/)).toBeVisible();
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
  await expect(experience.getByText('Lumina Datamatics | Chennai, India | Full-time, final-semester placement')).toBeVisible();
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
  expect(css).toContain("url('fonts/dm-sans-variable.woff2')");
  expect(css).toContain("url('fonts/space-grotesk-variable.woff2')");
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
