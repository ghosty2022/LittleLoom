#!/usr/bin/env node
/**
 * LittleLoom Community Screen Rename Automation
 * Run: node rename-community-screens.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = 'C:\\Users\\ondie\\Desktop\\LittleLoom';
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

// ─── CONFIGURATION ───────────────────────────────────────────────────
const RENAMES = [
  {
    oldPath: 'src/screens/community/EditCommunityProfileScreen.tsx',
    newPath: 'src/screens/community/CommunityProfileScreen.tsx',
    oldComponent: 'EditCommunityProfileScreen',
    newComponent: 'CommunityProfileScreen',
    oldRoute: 'EditCommunityProfile',
    newRoute: 'CommunityProfile',
  },
  {
    oldPath: 'src/screens/community/UserProfileScreen.tsx',
    newPath: 'src/screens/community/CommunityMemberProfileScreen.tsx',
    oldComponent: 'UserProfileScreen',
    newComponent: 'CommunityMemberProfileScreen',
    oldRoute: 'UserProfile',
    newRoute: 'CommunityMemberProfile',
  },
];

// ─── FILES TO SCAN FOR IMPORT UPDATES ─────────────────────────────────
const SCAN_PATTERNS = [
  'src/**/*.tsx',
  'src/**/*.ts',
  'src/**/*.js',
  'src/**/*.jsx',
];

// ─── HELPERS ─────────────────────────────────────────────────────────
function getAllFiles(dir, patterns) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.includes('node_modules')) {
      files.push(...getAllFiles(fullPath, patterns));
    } else if (stat.isFile()) {
      const ext = path.extname(item);
      if (['.tsx', '.ts', '.js', '.jsx'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  for (const { old: oldStr, new: newStr } of replacements) {
    const regex = new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    if (regex.test(content)) {
      content = content.replace(regex, newStr);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ Updated: ${path.relative(PROJECT_ROOT, filePath)}`);
    return true;
  }
  return false;
}

// ─── MAIN EXECUTION ───────────────────────────────────────────────────
console.log('🚀 LittleLoom Community Screen Rename Tool\n');

// Step 1: Rename files
console.log('📁 Step 1: Renaming files...');
for (const rename of RENAMES) {
  const oldFullPath = path.join(PROJECT_ROOT, rename.oldPath);
  const newFullPath = path.join(PROJECT_ROOT, rename.newPath);
  
  if (!fs.existsSync(oldFullPath)) {
    console.log(`  ⚠️  Skipped (not found): ${rename.oldPath}`);
    continue;
  }
  
  // Create backup
  const backupPath = oldFullPath + '.backup';
  fs.copyFileSync(oldFullPath, backupPath);
  
  // Rename file
  fs.renameSync(oldFullPath, newFullPath);
  console.log(`  ✓ Renamed: ${rename.oldPath} → ${rename.newPath}`);
  
  // Update internal component name
  let content = fs.readFileSync(newFullPath, 'utf8');
  const componentRegex = new RegExp(
    `export\\s+default\\s+function\\s+${rename.oldComponent}|` +
    `export\\s+default\\s+${rename.oldComponent}|` +
    `function\\s+${rename.oldComponent}\\s*\\(`,
    'g'
  );
  
  if (componentRegex.test(content)) {
    content = content.replace(
      new RegExp(rename.oldComponent, 'g'),
      rename.newComponent
    );
    fs.writeFileSync(newFullPath, content, 'utf8');
    console.log(`     Updated component name: ${rename.oldComponent} → ${rename.newComponent}`);
  }
}

// Step 2: Update imports across codebase
console.log('\n🔍 Step 2: Scanning for imports...');
const allFiles = getAllFiles(SRC_DIR, SCAN_PATTERNS);
let updatedCount = 0;

for (const file of allFiles) {
  const replacements = [];
  
  for (const rename of RENAMES) {
    // Update import paths
    replacements.push({
      old: rename.oldPath.replace('src/', '../').replace(/\\/g, '/').replace('.tsx', ''),
      new: rename.newPath.replace('src/', '../').replace(/\\/g, '/').replace('.tsx', ''),
    });
    replacements.push({
      old: rename.oldPath.replace('src/', '@/').replace(/\\/g, '/').replace('.tsx', ''),
      new: rename.newPath.replace('src/', '@/').replace(/\\/g, '/').replace('.tsx', ''),
    });
    
    // Update route names in navigation
    replacements.push({
      old: `'${rename.oldRoute}'`,
      new: `'${rename.newRoute}'`,
    });
    replacements.push({
      old: `"${rename.oldRoute}"`,
      new: `"${rename.newRoute}"`,
    });
    
    // Update component references
    replacements.push({
      old: rename.oldComponent,
      new: rename.newComponent,
    });
  }
  
  if (replaceInFile(file, replacements)) {
    updatedCount++;
  }
}

// Step 3: Update navigation types
console.log('\n📋 Step 3: Updating navigation types...');
const navTypeFiles = [
  'src/types/navigation.ts',
  'src/types/navigation.d.ts',
  'src/navigation/CommunityNavigator.tsx',
  'src/navigation/AppNavigator.tsx',
];

for (const navFile of navTypeFiles) {
  const fullPath = path.join(PROJECT_ROOT, navFile);
  if (fs.existsSync(fullPath)) {
    const replacements = [];
    for (const rename of RENAMES) {
      replacements.push(
        { old: rename.oldRoute, new: rename.newRoute },
        { old: rename.oldComponent, new: rename.newComponent }
      );
    }
    replaceInFile(fullPath, replacements);
  }
}

console.log(`\n✅ Done! Updated ${updatedCount} files.`);
console.log('📝 Backups created with .backup extension');
console.log('🧹 Run: node rename-community-screens.js --cleanup to remove backups');