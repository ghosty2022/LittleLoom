// verify-schema-simple.js
// Robust schema vs migration checker

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'src', 'database', 'schema.ts');
const migrationPath = path.join(__dirname, 'src', 'database', 'migrations', 'migrations.ts');

// ─── Parse schema columns ─────────────────────────────────────────────
function getSchemaTables() {
  const content = fs.readFileSync(schemaPath, 'utf-8');
  const tables = {};

  // Find each sqliteTable call
  const tableRegex = /sqliteTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{/g;
  let m;
  while ((m = tableRegex.exec(content)) !== null) {
    const tableName = m[1];
    const start = m.index + m[0].length;

    // Find matching closing brace
    let depth = 1, i = start;
    while (depth > 0 && i < content.length) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') depth--;
      i++;
    }

    const block = content.slice(start, i);
    const cols = new Set();

    // Match text('col_name'), integer('col_name'), real('col_name')
    const colRe = /(?:text|integer|real|blob)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let cm;
    while ((cm = colRe.exec(block)) !== null) {
      cols.add(cm[1]);
    }

    tables[tableName] = Array.from(cols).sort();
  }
  return tables;
}

// ─── Parse migration columns ──────────────────────────────────────────
function getMigrationTables() {
  const content = fs.readFileSync(migrationPath, 'utf-8');
  const tables = {};

  // In raw file, backticks are escaped as \`
  // Match: CREATE TABLE \`name\` ( ... );
  const tableRe = /CREATE\s+TABLE\s+\\`([^\\`]+)\\`\s*\(([\s\S]*?)\);/g;
  let m;
  while ((m = tableRe.exec(content)) !== null) {
    const tableName = m[1];
    const body = m[2];
    const cols = new Set();

    const lines = body.split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('-->') || t.startsWith('FOREIGN KEY')) continue;
      // Match \\`col_name\\`
      const cm = t.match(/^\\`([^\\`]+)\\`/);
      if (cm) cols.add(cm[1]);
    }

    tables[tableName] = Array.from(cols).sort();
  }
  return tables;
}

// ─── Compare ──────────────────────────────────────────────────────────
const schemaTables = getSchemaTables();
const migrationTables = getMigrationTables();

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  SCHEMA vs MIGRATION VERIFICATION');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

let pass = 0, fail = 0, issues = 0;

for (const [name, schemaCols] of Object.entries(schemaTables)) {
  const migCols = migrationTables[name];
  console.log(`📋 ${name} — schema has ${schemaCols.length} cols`);

  if (!migCols) {
    console.log('   ❌ Table missing in migration');
    fail++;
    issues++;
    console.log('');
    continue;
  }

  const s = new Set(schemaCols);
  const m = new Set(migCols);
  const missing = [...s].filter(c => !m.has(c));
  const extra = [...m].filter(c => !s.has(c));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`   ✅ All ${s.size} columns match`);
    pass++;
  } else {
    if (missing.length) { console.log(`   ❌ Missing: ${missing.join(', ')}`); issues += missing.length; }
    if (extra.length) { console.log(`   ⚠️  Extra: ${extra.join(', ')}`); issues += extra.length; }
    fail++;
  }
  console.log('');
}

for (const name of Object.keys(migrationTables)) {
  if (!schemaTables[name]) {
    console.log(`📋 ${name}`);
    console.log('   ⚠️  In migration but not in schema');
    issues++;
    console.log('');
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(`  RESULT: ${pass}/${Object.keys(schemaTables).length} tables matched`);
console.log(`  ISSUES:  ${issues}`);
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

process.exit(issues > 0 ? 1 : 0);