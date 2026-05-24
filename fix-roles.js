const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('app/**/*.{ts,tsx}', { cwd: __dirname });

let changedCount = 0;

for (const file of files) {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace table name
  content = content.replace(/\.from\(\s*["']staff_roles["']\s*\)/g, '.from("organization_members")');
  
  // Replace select statements to alias role_key to role
  content = content.replace(/\.select\(\s*(["'])([^"']*)role([^"']*)(["'])\s*\)/g, (match, q1, before, after, q2) => {
    // If it's already using role:role_key or role_key, skip
    if (before.includes('role_key') || after.includes('role_key')) return match;
    
    // Replace standalone 'role' with 'role:role_key'
    // This is a naive replace, might need to be careful about words containing role
    const newSelectStr = (before + "role" + after).replace(/\brole\b/g, 'role:role_key');
    return `.select(${q1}${newSelectStr}${q2})`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    changedCount++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Total files updated: ${changedCount}`);
