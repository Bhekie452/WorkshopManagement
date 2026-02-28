import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔎 Checking built files for sidebar menu items...\n');

const distPath = path.join(__dirname, 'dist', 'assets');
const files = fs.readdirSync(distPath);
const jsFile = files.find(f => f.startsWith('index') && f.endsWith('.js'));

if (!jsFile) {
  console.error('❌ Bundled JS file not found');
  process.exit(1);
}

const content = fs.readFileSync(path.join(distPath, jsFile), 'utf-8');

const labels = [
  'Dashboard',
  'Jobs & Workflow',
  'Schedule',
  'Diagnostics',
  'Inventory',
  'Customers',
  'Fleet & Vehicles',
  'EV Fleet Manager',
  'Sales & Quotes',
  'Analytics',
  'Settings'
];

let found = 0;
console.log('Looking for menu labels...');
labels.forEach(label => {
  const present = content.includes(label);
  console.log(present ? `✅ ${label}` : `❌ ${label} (missing)`);
  if (present) found++;
});

console.log(`\n${found}/${labels.length} labels found.`);

if (found === labels.length) {
  console.log('✅ Build includes all expected menu items.');
} else {
  console.log('⚠️ Some menu items appear to be missing in build.');
}
