const fs = require('fs');
const path = require('path');

const map = {
  '✈️': '✈️',
  '🕵️': '🕵️',
  '❤️': '❤️',
  '▶️': '▶️',
  '🔊': '🔊' // Wait, I'll just check if any others are still present.
};

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let fixedContent = content;
  
  for (const [bad, good] of Object.entries(map)) {
    fixedContent = fixedContent.split(bad).join(good);
  }
  
  if (content !== fixedContent) {
    fs.writeFileSync(filePath, fixedContent, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        scanDir(fullPath);
      }
    } else {
      if (fullPath.endsWith('.js') || fullPath.endsWith('.html') || fullPath.endsWith('.md')) {
        fixFile(fullPath);
      }
    }
  }
}

scanDir(__dirname);
console.log("Done fixing remaining mojibake.");
