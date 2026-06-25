import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Diz para o Playwright olhar APENAS para esta pasta
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 1,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Liga o Vite silenciosamente antes de testar
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
