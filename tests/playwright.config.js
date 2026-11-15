const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 30000,
  webServer: {
    command: 'python ../scripts/range_server.py 8080 ../frontend',
    port: 8080,
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:8080',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    { name: 'chromium', use: { channel: 'chrome' } },
  ],
});
