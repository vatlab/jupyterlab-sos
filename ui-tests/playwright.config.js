/**
 * Configuration for Playwright using Galata
 */
const baseConfig = require('@jupyterlab/galata/lib/playwright-config');

module.exports = {
  ...baseConfig,
  webServer: {
    command: 'jlpm start',
    port: 8888,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
  },
  retries: process.env.CI ? 1 : 0
};
