import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const apiURL = process.env.E2E_API_URL || 'http://localhost:8787';
const testAuthSecret = process.env.TEST_AUTH_SECRET || 'test-secret';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  outputDir: path.resolve(__dirname, 'test-results'),
  reporter: isCI
    ? [
        ['github'],
        ['html', { open: 'never' }],
        ['junit', { outputFile: path.resolve(__dirname, 'test-results/junit.xml') }],
      ]
    : [['html', { open: 'on-failure' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `npm run dev -- --var ENABLE_TEST_AUTH:true --var TEST_AUTH_SECRET:${testAuthSecret} --var FRONTEND_URL:${baseURL} --var ALLOWED_ORIGINS:${baseURL} --var JWT_SECRET:test-jwt-secret`,
      cwd: path.resolve(__dirname, '../api'),
      url: `${apiURL}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: process.env.CI ? 'npm start' : 'npm run dev',
      cwd: path.resolve(__dirname, '../web'),
      url: `${baseURL}/`,
      env: {
        NEXT_PUBLIC_API_URL: apiURL,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    }
  ],
});
