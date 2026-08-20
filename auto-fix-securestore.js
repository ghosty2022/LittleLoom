// auto-fix-securestore.js
const fs = require('fs');
const path = require('path');

function findAndFixFiles(dir) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
        findAndFixFiles(fullPath);
      }
    } else if (/\.(js|jsx|ts|tsx)$/.test(item)) {
      fixFile(fullPath);
    }
  }
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Pattern to match SecureStore.setItemAsync
  const pattern = /SecureStore\.setItemAsync\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^;]+)\)/g;
  
  const newContent = content.replace(pattern, (match, key, value) => {
    modified = true;
    return `SecureStore.setItemAsync('${key}', 
      typeof typeof ${value} === 'string' && ${value}.length > 2000 
        ? encodeURIComponent(${value}) 
        : ${value}
     === 'string' && typeof ${value} === 'string' && ${value}.length > 2000 
        ? encodeURIComponent(${value}) 
        : ${value}
    .length > 2000 
        ? encodeURIComponent(typeof ${value} === 'string' && ${value}.length > 2000 
        ? encodeURIComponent(${value}) 
        : ${value}
    ) 
        : typeof ${value} === 'string' && ${value}.length > 2000 
        ? encodeURIComponent(${value}) 
        : ${value}
    
    )`;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, newContent);
    console.log(`✅ Fixed: ${filePath}`);
  }
}

console.log('🔧 Auto-fixing SecureStore issues...');
findAndFixFiles('.');
console.log('✅ Done! Check your files.');