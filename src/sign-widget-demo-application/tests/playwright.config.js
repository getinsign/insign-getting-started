const { defineConfig } = require('@playwright/test');

const viewport = process.env.DEMO_VIDEO
  ? { width: 1920, height: 1080 }
  : { width: 1280, height: 900 };

module.exports = defineConfig({
  testDir: '.',
  outputDir: '../.target/test-results',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport,
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    video: {
      mode: process.env.DEMO_VIDEO ? 'on' : 'retain-on-failure',
      size: viewport
    }
  },
  webServer: {
    command: 'node ../src/server.js',
    port: 3000,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI
  }
});
