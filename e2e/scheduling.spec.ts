import { test, expect } from '@playwright/test';

test.describe('Scheduling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@workshop.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("LOGIN")');
  });

  test('should schedule an appointment', async ({ page }) => {
    await page.click('nav >> text=Schedule');
    await page.click('button:has-text("New Appointment")');
    
    // Fill appointment form
    await page.fill('input[name="date"]', '2026-03-10');
    await page.fill('input[name="time"]', '14:30');
    await page.selectOption('select[name="customer"]', { index: 1 });
    
    await page.click('button:has-text("Confirm")');
    
    // Check if added to calendar/list
    await expect(page.locator('text=14:30')).toBeVisible();
  });
});
