import { test, expect } from '@playwright/test';

test.describe('Job Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@workshop.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("LOGIN")');
  });

  test('should create a new job', async ({ page }) => {
    await page.click('nav >> text=Jobs & Workflow');
    await page.click('button:has-text("Add Job")');
    
    // Assume form is open, fill it out
    // (Selectors would need to be exact based on the component)
    await page.selectOption('select[name="customer"]', { index: 1 });
    await page.selectOption('select[name="vehicle"]', { index: 1 });
    await page.fill('textarea[name="description"]', 'E2E Test Job');
    
    await page.click('button:has-text("Create Job")');
    
    // Verify job appears in list
    await expect(page.locator('text=E2E Test Job')).toBeVisible();
  });

  test('should convert quote to invoice', async ({ page }) => {
    await page.click('nav >> text=Sales & Quotes');
    // ... complete flow
  });
});
