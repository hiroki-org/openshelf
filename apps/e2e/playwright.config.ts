import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const apiURL = process.env.E2E_API_URL || 'http://localhost:8787';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `npm run dev -- --var ENABLE_TEST_AUTH:true --var FRONTEND_URL:${baseURL} --var ALLOWED_ORIGINS:${baseURL}`,
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
