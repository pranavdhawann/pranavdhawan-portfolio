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

test('project cards render named screenshots inside the existing image frames', async ({ page }) => {
  await openPortfolio(page);

  const expectedImages = [
    ['Stock Screen', 'images/stockscreen.png'],
    ['Multimodal Techniques for Financial Time Series Forecasting', 'images/multimodal.png'],
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
  await expect(firstTimelineItem.getByRole('heading', { name: 'AI Independent Contractor' })).toBeVisible();
  await expect(firstTimelineItem.getByText('Siva Info LLC | New York, NY | Part-time, Remote')).toBeVisible();
  await expect(firstTimelineItem.getByText(/AI-driven document processing/)).toBeVisible();
  await expect(firstTimelineItem.getByText(/document workflows and computer vision pipelines/)).toBeVisible();
  await expect(firstTimelineItem.locator('.tech-tag', { hasText: 'Document Workflows' })).toBeVisible();

  await expect(experience.getByRole('heading', { name: 'AI Workplace Engineer Intern' })).toBeVisible();
  await expect(experience.getByText('American Chemical Society | Washington, DC | Full-time, Hybrid')).toBeVisible();
  await expect(experience.getByText(/Building agentic AI workflows to automate service desk/)).toBeVisible();
  await expect(experience.getByText(/workflow orchestration, knowledge retrieval, and human-in-the-loop automation/)).toBeVisible();

  await expect(experience.getByRole('heading', { name: 'Machine Learning Engineer' })).toBeVisible();
  await expect(experience.getByText(/detect and extract complex equations from 10,000\+ unstructured documents/)).toBeVisible();
  await expect(experience.getByText(/Operationalized machine learning workloads on AWS SageMaker/)).toBeVisible();

  await expect(experience.getByText('HCLTech | Noida, India | Internship, Hybrid')).toBeVisible();
  await expect(experience.getByText(/Built predictive workforce analytics models/)).toBeVisible();

  await expect(experience.getByText('EY | Gurugram, India | Internship, Hybrid')).toBeVisible();
  await expect(experience.getByText(/Automated ETL workflows using Alteryx/)).toBeVisible();

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

test('contact actions sit close beneath the get in touch heading', async ({ page }) => {
  await openPortfolio(page);

  const gap = await page.evaluate(() => {
    const title = document.querySelector('#contact .section-title').getBoundingClientRect();
    const action = document.querySelector('#contact .resume-btn').getBoundingClientRect();
    return action.top - title.bottom;
  });

  expect(gap).toBeLessThanOrEqual(28);
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

  const json = await page.locator('script[type="application/ld+json"]').textContent();
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
