const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Opening app...');
    await page.goto('https://workshop-d1832.web.app/', { waitUntil: 'networkidle2' });

    // Log in
    console.log('Logging in with admin@workshop.com...');
    await page.type('input[type="email"]', 'admin@workshop.com');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for sidebar to appear
    await page.waitForSelector('aside', { timeout: 10000 });
    console.log('Logged in, checking sidebar...');

    // Get sidebar background color
    const sidebarColor = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      const computedStyle = window.getComputedStyle(sidebar);
      return computedStyle.backgroundColor;
    });

    console.log('📊 Sidebar Background Color:', sidebarColor);

    // Check if it's light or dark
    // Accept pure white or the previous light grey
    if (
      sidebarColor === 'rgb(255, 255, 255)' ||
      sidebarColor.includes('255, 255, 255') ||
      sidebarColor.includes('245, 245, 245') ||
      sidebarColor === 'rgb(245, 245, 245)'
    ) {
      console.log('✅ SUCCESS: Sidebar is LIGHT/WHITE');
    } else if (sidebarColor.includes('30, 58, 138') || sidebarColor.includes('rgba')) {
      console.log('❌ FAILED: Sidebar is still DARK (old color)');
    } else {
      console.log('⚠️ WARNING: Unexpected color:', sidebarColor);
    }

    // Check for menu sections
    const hasOperations = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('p')).some(p => p.textContent.includes('Operations'));
    });

    const hasManagement = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('p')).some(p => p.textContent.includes('Management'));
    });

    const hasSystem = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('p')).some(p => p.textContent.includes('System'));
    });

    console.log('\n📋 Menu Sections Check:');
    console.log(hasOperations ? '❌ Operations section still present' : '✅ Operations removed');
    console.log(hasManagement ? '❌ Management section still present' : '✅ Management removed');
    console.log(hasSystem ? '❌ System section still present' : '✅ System removed');

    // Check for scrollbar
    const hasScrollbar = await page.evaluate(() => {
      const menuContainer = document.querySelector('div[class*="overflow"]');
      return menuContainer ? 'Present' : 'Not present';
    });

    console.log('\n📜 Scrollbar Check:', hasScrollbar);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
