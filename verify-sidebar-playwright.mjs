import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  console.log('Navigating to app...');
  await page.goto('https://workshop-d1832.web.app/');

  // perform login
  await page.fill('input[type="email"]', 'admin@workshop.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');

  // wait for navigation/dashboard
  await page.waitForTimeout(3000);

  // ensure sidebar loaded
  const sidebarSelector = 'aside';
  await page.waitForSelector(sidebarSelector, { timeout: 10000 });

  const menuTexts = await page.$$eval('aside nav a span', els => els.map(e => e.textContent.trim()));
  console.log('Menu items found:', menuTexts);

  const bgColor = await page.$eval(sidebarSelector, el => getComputedStyle(el).backgroundColor);
  console.log('Sidebar background color:', bgColor);

  await browser.close();
})();