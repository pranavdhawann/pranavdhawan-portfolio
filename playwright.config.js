const { defineConfig } = require('@playwright/test');

// Specs spin up their own static server in beforeAll, so no webServer is needed.
module.exports = defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.js',
  reporter: 'list',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    trace: 'on-first-retry'
  }
});
