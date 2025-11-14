// verify-files.js - Check if files were updated correctly
const fs = require('fs');
const path = require('path');

console.log('Verifying files are updated correctly...\n');

const checks = [
  {
    file: 'database.js',
    mustContain: 'NODE_ENV',
    description: 'database.js should check NODE_ENV for test mode',
  },
  {
    file: 'jest.setup.js',
    mustContain: "process.env.NODE_ENV = 'test'",
    description: 'jest.setup.js should set NODE_ENV=test',
  },
  {
    file: 'tests/dashboard.test.js',
    mustContain: 'createDate',
    description: 'dashboard.test.js should have createDate function',
  },
];

let allGood = true;

checks.forEach(({ file, mustContain, description }) => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${file} - FILE NOT FOUND`);
    allGood = false;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  if (content.includes(mustContain)) {
    console.log(`✅ ${file} - Updated correctly`);
  } else {
    console.log(`❌ ${file} - NOT UPDATED!`);
    console.log(`   Missing: "${mustContain}"`);
    console.log(`   ${description}`);
    allGood = false;
  }
});

console.log('\n' + '='.repeat(60));
if (allGood) {
  console.log('✅ All files updated correctly!');
  console.log('You can now run: npm test');
} else {
  console.log('❌ Some files are NOT updated!');
  console.log('Please replace the files with the downloaded versions.');
}
console.log('='.repeat(60));