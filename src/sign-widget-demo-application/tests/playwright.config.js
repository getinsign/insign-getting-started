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
    // For DEMO_VIDEO we need the Chromium PDF viewer to render #pdf-preview
    // inside the recorded video. The bundled "chromium-headless-shell" lacks
    // PDFium, so the default `headless: true` showed an empty iframe despite
    // the URL returning a valid application/pdf. Using `channel: 'chrome'`
    // (real Google Chrome) keeps the recording fully headless — no window
    // pops up on the user's desktop — while still rendering PDFs.
    headless: true,
    // Use real Google Chrome (ships PDFium) when recording the demo video;
    // the channel's executable isn't always at the default /opt path, so we
    // fall through to an explicit path if a pre-installed Chrome is on $PATH.
    channel: process.env.DEMO_VIDEO ? 'chrome' : undefined,
    launchOptions: process.env.DEMO_VIDEO ? { executablePath: process.env.CHROME_PATH || '/home/t/bin/google-chrome' } : undefined,
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
