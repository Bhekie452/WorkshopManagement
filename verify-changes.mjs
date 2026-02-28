// Simple verification script to check if changes are in the built files
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying sidebar changes in built files...\n');

// Read the main bundled file
const distPath = path.join(__dirname, 'dist', 'assets');
const files = fs.readdirSync(distPath);
const jsFile = files.find(f => f.startsWith('index') && f.endsWith('.js'));

if (!jsFile) {
  console.error('❌ Could not find bundled JS file');
  process.exit(1);
}

const content = fs.readFileSync(path.join(distPath, jsFile), 'utf-8');

console.log('📊 Checking for color values...\n');

// Check for light/white background
const hasLightBg = content.includes('background-color: white') ||
                   content.includes('#ffffff') ||
                   content.includes('rgb(255, 255, 255)') ||
                   content.includes('#f5f5f5') ||
                   content.includes('f5f5f5');
console.log(hasLightBg ? '✅ Light/white background color found' : '❌ Light/white background NOT found');

// Check for old dark color
const hasDarkBg = content.includes('rgba(30,58,138') || content.includes('30,58,138');
console.log(!hasDarkBg ? '✅ Old dark color REMOVED' : '❌ Old dark color still present');

// Check if menu sections are removed
const hasOperations = content.includes('Operations');
const hasManagement = content.includes('Management');
const hasSystem = content.includes('System');
const hasAdministration = content.includes('Administration');

console.log('\n📋 Menu sections check:');
console.log(!hasOperations ? '✅ Operations removed' : '⚠️ Operations text found');
console.log(!hasManagement ? '✅ Management removed' : '⚠️ Management text found');
console.log(!hasSystem ? '✅ System removed' : '⚠️ System text found');
console.log(!hasAdministration ? '✅ Administration removed' : '⚠️ Administration text found');

// Check for overflow-y-auto removal (scrollbar)
const hasOverflowAuto = content.includes('overflow-y-auto') || content.includes('overflow-y');
console.log('\n📜 Scrollbar check:');
console.log(!hasOverflowAuto ? '✅ overflow-y-auto REMOVED (no scrollbar)' : '⚠️ overflow-y classes found');

// Summary
console.log('\n' + '='.repeat(50));
if (hasLightBg && !hasDarkBg) {
  console.log('✅ BUILD VERIFICATION PASSED');
  console.log('The changes are in the built files. Clear browser cache and refresh.');
} else {
  console.log('❌ BUILD VERIFICATION FAILED');
  console.log('Try running: npm run build && firebase deploy --only hosting');
}
