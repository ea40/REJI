const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 30000,
  webServer: {
    command: 'python -m http.server 8080 --directory ../frontend',
    port: 8080,
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:8080',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
