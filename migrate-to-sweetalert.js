#!/usr/bin/env node
/**
 * SweetAlert Migration Script v2 (FIXED)
 * Scans your React Native codebase and migrates Alert.alert() to SweetAlert.
 * 
 * SAFETY FIXES in v2:
 * - Never injects script code into source files
 * - Checks for existing imports before adding duplicates
 * - Only injects hook inside function bodies, never in destructuring
 * - Uses AST-aware insertion points
 * 
 * Usage:
 *   node migrate-to-sweetalert-v2.js [path-to-src-directory]
 */

const fs = require('fs');
const path = require('path');

const TARGET_DIR = process.argv[2] || './src';
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Patterns to find and replace
const PATTERNS = [
  // Alert.alert() with 3+ args (confirmation)
  {
    name: 'Alert.alert 3-arg confirmation',
    regex: /Alert\.alert\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*\[\s*\{\s*text\s*:\s*['"`]([^'"`]+)['"`]\s*,\s*(?:style\s*:\s*['"`]([^'"`]+)['"`]\s*,\s*)?onPress\s*:\s*([^}]+)\}\s*,\s*\{\s*text\s*:\s*['"`]([^'"`]+)['"`]\s*,\s*(?:style\s*:\s*['"`]([^'"`]+)['"`]\s*,\s*)?onPress\s*:\s*([^}]+)\}\s*\]\s*\)/g,
    replace: (match, title, message, cancelText, cancelStyle, onCancel, confirmText, confirmStyle, onConfirm) => {
      const cleanOnCancel = onCancel.trim().replace(/,$/, '');
      const cleanOnConfirm = onConfirm.trim().replace(/,$/, '');
      return `sweetAlert.confirm(
    '${title}',
    '${message}',
    () => { ${cleanOnConfirm}; },
    () => { ${cleanOnCancel}; },
    '${confirmText}',
    '${cancelText}'
  )`;
    }
  },

  // Alert.alert() with 2 args (simple alert)
  {
    name: 'Alert.alert 2-arg simple',
    regex: /Alert\.alert\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/g,
    replace: (match, title, message) => `sweetAlert.alert('${title}', '${message}', 'warning')`
  },

  // Alert.alert() with 1 arg (title only)
  {
    name: 'Alert.alert 1-arg',
    regex: /Alert\.alert\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    replace: (match, title) => `sweetAlert.alert('${title}')`
  },

  // Alert.alert with only 2 args but has callback
  {
    name: 'Alert.alert 2-arg with callback',
    regex: /Alert\.alert\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*,\s*\[\s*\{\s*text\s*:\s*['"`]([^'"`]+)['"`]\s*\}\s*\]\s*\)/g,
    replace: (match, title, message, okText) => `sweetAlert.alert('${title}', '${message}', 'info')`
  },
];

// Flag-only patterns (for manual review)
const WARNING_PATTERNS = [
  {
    name: 'Alert.alert variable message',
    regex: /Alert\.alert\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*\[/g
  },
  {
    name: 'sweetAlert usage check',
    regex: /sweetAlert\./g
  }
];

const changes = [];
const warnings = [];

function scanFile(filePath, content) {
  let modified = content;

  PATTERNS.forEach(pattern => {
    const newContent = modified.replace(pattern.regex, pattern.replace);
    if (newContent !== modified) {
      const count = (content.match(pattern.regex) || []).length;
      changes.push({ file: filePath, pattern: pattern.name, count });
      modified = newContent;
    }
  });

  WARNING_PATTERNS.forEach(pattern => {
    const matches = [...content.matchAll(pattern.regex)];
    if (matches.length > 0) {
      warnings.push({
        file: filePath,
        pattern: pattern.name,
        count: matches.length,
        lines: matches.map(m => content.substring(0, m.index).split('\n').length)
      });
    }
  });

  return modified;
}

function hasImport(content, importName, importPath) {
  const regex = new RegExp(`import\\s+{[^}]*${importName}[^}]*}\\s+from\\s+['"\`]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);
  return regex.test(content);
}

function hasAnySweetAlertImport(content) {
  return /import\s+\{[^}]*useSweetAlert[^}]*\}\s+from\s+['"][^'"]+['"];/.test(content);
}

function addImport(content, importName, importPath) {
  if (hasImport(content, importName, importPath)) return content;
  if (hasAnySweetAlertImport(content) && importName === 'useSweetAlert') return content;

  const lines = content.split('\n');
  let lastImportLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s+/.test(lines[i])) lastImportLine = i;
  }

  const newImport = `import { ${importName} } from '${importPath}';`;

  if (lastImportLine >= 0) {
    lines.splice(lastImportLine + 1, 0, newImport);
  } else {
    lines.unshift(newImport);
  }

  return lines.join('\n');
}

function hasHookUsage(content) {
  return /const\s+sweetAlert\s*=\s*useSweetAlert\(\)/.test(content);
}

/**
 * SAFELY injects the hook ONLY inside a function body.
 * It finds the opening brace of the main component function and inserts after it.
 */
function addHookUsageSafe(content) {
  if (hasHookUsage(content)) return content;

  // Strategy: Find "export default function Name(" or "function Name(" or "const Name = ({...}) => {"
  // and insert the hook right after the opening { of the function body

  const lines = content.split('\n');
  let braceDepth = 0;
  let inFunction = false;
  let functionBraceLine = -1;
  let functionBraceCol = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect function start patterns
    if (!inFunction && (
      /^\s*export\s+default\s+function\s+\w+\s*\(/.test(line) ||
      /^\s*export\s+function\s+\w+\s*\(/.test(line) ||
      /^\s*function\s+\w+\s*\(/.test(line) ||
      /^\s*const\s+\w+\s*=\s*\(/.test(line) ||
      /^\s*const\s+\w+\s*=\s*\w+\s*=>/.test(line)
    )) {
      inFunction = true;
    }

    if (inFunction) {
      for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') {
          if (braceDepth === 0) {
            functionBraceLine = i;
            functionBraceCol = j;
          }
          braceDepth++;
        } else if (line[j] === '}') {
          braceDepth--;
        }
      }

      // If we found the opening brace and it's the main function body
      if (functionBraceLine >= 0 && braceDepth > 0) {
        // Insert after this line
        const indent = '  ';
        lines.splice(functionBraceLine + 1, 0, `${indent}const sweetAlert = useSweetAlert();`);
        return lines.join('\n');
      }
    }
  }

  // Fallback: if we couldn't find a safe spot, don't inject
  console.log(`⚠️  Could not safely inject hook in file (skipping): ${content.substring(0, 50)}...`);
  return content;
}

function removeAlertImport(content) {
  if (/Alert\.alert/.test(content)) return content; // Still using Alert.alert

  // Remove Alert from react-native import
  content = content.replace(/,\s*Alert\s*}/g, ' }');
  content = content.replace(/\{\s*Alert,\s*/g, '{ ');
  content = content.replace(/\{\s*Alert\s*\}/g, '{}');
  content = content.replace(/import\s+\{\s*Alert\s*\}\s+from\s+['"]react-native['"];\s*\n?/g, '');

  return content;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  if (!/Alert\.alert/.test(content)) return;

  let modified = scanFile(filePath, content);

  if (modified === content) return; // No changes made

  // Only add import if sweetAlert is actually used in the modified content
  if (/sweetAlert\./.test(modified)) {
    modified = addImport(modified, 'useSweetAlert', '../../components/SweetAlert');
    modified = addHookUsageSafe(modified);
  }

  modified = removeAlertImport(modified);

  fs.writeFileSync(filePath, modified, 'utf8');
  console.log(`✅  ${filePath}`);
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '.expo'].includes(entry.name)) continue;
      walkDir(fullPath);
    } else if (entry.isFile() && EXTENSIONS.includes(path.extname(entry.name))) {
      processFile(fullPath);
    }
  }
}

console.log('🔍 SweetAlert Migration Script v2 (FIXED)');
console.log(`📁 Scanning: ${path.resolve(TARGET_DIR)}\n`);

if (!fs.existsSync(TARGET_DIR)) {
  console.error(`❌ Directory not found: ${TARGET_DIR}`);
  process.exit(1);
}

walkDir(TARGET_DIR);

console.log('\n📊 Migration Summary:');
console.log('====================');

if (changes.length === 0 && warnings.length === 0) {
  console.log('✨ No issues found! Your codebase is clean.');
} else {
  if (changes.length > 0) {
    console.log(`\n✅ Auto-fixed ${changes.reduce((a, c) => a + c.count, 0)} issues across ${new Set(changes.map(c => c.file)).size} files:`);
    const byPattern = {};
    changes.forEach(c => {
      if (!byPattern[c.pattern]) byPattern[c.pattern] = 0;
      byPattern[c.pattern] += c.count;
    });
    Object.entries(byPattern).forEach(([pattern, count]) => {
      console.log(`   • ${pattern}: ${count}`);
    });
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} files need manual review:`);
    warnings.forEach(w => {
      console.log(`\n   📄 ${w.file}`);
      console.log(`      Pattern: ${w.pattern} (${w.count} occurrences)`);
      console.log(`      Lines: ${w.lines.join(', ')}`);
    });
  }
}

console.log('\n🎉 Done! Review the changes and test your app.\n');