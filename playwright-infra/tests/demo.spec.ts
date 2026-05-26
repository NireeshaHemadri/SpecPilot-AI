import { test, expect } from '@playwright/test';

test('TestForge AI - Demo Page Assertion', async ({ page }) => {
  // Go to a stable, lightweight public URL to verify browser interaction
  await page.goto('https://example.com');
  const title = await page.title();
  expect(title).toContain('Example Domain');
});
