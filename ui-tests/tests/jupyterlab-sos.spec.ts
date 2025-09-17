import { test, expect } from '@jupyterlab/galata';

/**
 * Test that the jupyterlab-sos extension loads successfully
 */
test('should load jupyterlab-sos extension', async ({ page }) => {
  // Check that JupyterLab loads
  await expect(page.locator('#jp-main-dock-panel')).toBeVisible();

  // This is a minimal test - just checks that JupyterLab itself loads
  // More specific tests for SoS functionality could be added here
});
