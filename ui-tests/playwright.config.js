/**
 * Configuration for Playwright using Galata
 */
const baseConfig = require('@jupyterlab/galata/lib/playwright-config');

module.exports = {
  ...baseConfig,
  // Remove webServer config as Galata will handle JupyterLab startup
  retries: process.env.CI ? 1 : 0
};
