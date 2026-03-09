import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/');
    
    // Fill in credentials (assuming seed data exists)
    await page.fill('input[type="email"]', 'admin@workshop.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("LOGIN")');
    
    // Should redirected to dashboard
    await expect(page).toHaveURL(/.*dashboard/i);
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should show error on invalid login', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("LOGIN")');
    
    await expect(page.locator('text=Authentication failed')).toBeVisible();
  });
});
