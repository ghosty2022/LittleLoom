// verify-schema.js
// Compares Drizzle schema.ts columns against migration SQL columns
// Run: node verify-schema.js

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'src', 'database', 'schema.ts');

// Auto-detect migration file
function findMigrationFile() {
  const candidates = [
    path.join(__dirname, 'src', 'database', 'migrations', 'migrations.ts'),
    path.join(__dirname, 'src', 'database', 'migrations', 'migrations.js'),
    path.join(__dirname, 'src', 'database', 'migrations', 'meta', '_journal.json'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`Found migration file: ${p}\n`);
      return p;
    }
  }

  // Try to find any .ts or .js file in migrations folder
  const migrationsDir = path.join(__dirname, 'src', 'database', 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir);
    const tsFile = files.find(f => f.endsWith('.ts') || f.endsWith('.js'));
    if (tsFile) {
      const p = path.join(migrationsDir, tsFile);
      console.log(`Found migration file: ${p}\n`);
      return p;
    }
  }

  return null;
}

// ─── Parse schema.ts ──────────────────────────────────────────────────
function parseSchema(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tables = {};

  const tableRegex = /export\s+const\s+(\w+)\s*=\s*sqliteTable\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{/g;
  let match;

  while ((match = tableRegex.exec(content)) !== null) {
    const [, constName, tableName] = match;
    const startIdx = match.index + match[0].length;
    let braceDepth = 1;
    let i = startIdx;
    while (braceDepth > 0 && i < content.length) {
      if (content[i] === '{') braceDepth++;
      else if (content[i] === '}') braceDepth--;
      i++;
    }
    const columnsBlock = content.slice(startIdx, i);

    const colRegex = /(\w+)\s*:\s*(?:text|integer|real|blob)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const columns = new Set();
    let colMatch;
    while ((colMatch = colRegex.exec(columnsBlock)) !== null) {
      columns.add(colMatch[2]);
    }

    tables[tableName] = {
      constName,
      columns: Array.from(columns).sort(),
    };
  }

  return tables;
}

// ─── Parse migration SQL ──────────────────────────────────────────────
function parseMigration(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let sql = '';

  // Try to extract SQL from TypeScript template literal
  const sqlMatch = content.match(/const\s+m0000\s*=\s*`([\s\S]*?)`;/);
  if (sqlMatch) {
    sql = sqlMatch[1];
  } else {
    // Maybe it's a raw .sql file or JSON journal
    sql = content;
  }

  const tables = {};
  const tableRegex = /CREATE\s+TABLE\s+[`"']([^`'"]+)[`"']\s*\(([\s\S]*?)\);/g;
  let match;

  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];

    const columns = new Set();
    const lines = body.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('-->') || trimmed.startsWith('FOREIGN KEY')) continue;
      const colMatch = trimmed.match(/^[`"']([^`'"]+)[`"']\s+/);
      if (colMatch) {
        columns.add(colMatch[1]);
      }
    }

    tables[tableName] = {
      columns: Array.from(columns).sort(),
    };
  }

  return tables;
}

// ─── Compare ──────────────────────────────────────────────────────────
function compare() {
  const MIGRATION_PATH = findMigrationFile();

  if (!MIGRATION_PATH) {
    console.error('ERROR: Could not find migration file.');
    console.error('Searched in:');
    console.error('  - src/database/migrations/migrations.ts');
    console.error('  - src/database/migrations/migrations.js');
    console.error('  - src/database/migrations/meta/_journal.json');
    console.error('\nPlease save the migrations.ts file first, or run this from the project root.');
    process.exit(1);
  }

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`ERROR: Schema file not found at ${SCHEMA_PATH}`);
    process.exit(1);
  }

  const schemaTables = parseSchema(SCHEMA_PATH);
  const migrationTables = parseMigration(MIGRATION_PATH);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SCHEMA vs MIGRATION COLUMN VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let totalTables = 0;
  let passedTables = 0;
  let totalIssues = 0;

  for (const [tableName, schemaData] of Object.entries(schemaTables)) {
    totalTables++;
    const migrationData = migrationTables[tableName];

    console.log(`📋 Table: ${tableName} (${schemaData.constName})`);

    if (!migrationData) {
      console.log(`   ❌ MISSING in migration SQL\n`);
      totalIssues++;
      continue;
    }

    const schemaCols = new Set(schemaData.columns);
    const migrationCols = new Set(migrationData.columns);

    const missingInMigration = [...schemaCols].filter(c => !migrationCols.has(c));
    const extraInMigration = [...migrationCols].filter(c => !schemaCols.has(c));

    if (missingInMigration.length === 0 && extraInMigration.length === 0) {
      console.log(`   ✅ All ${schemaCols.size} columns match\n`);
      passedTables++;
    } else {
      if (missingInMigration.length > 0) {
        console.log(`   ❌ Missing in migration: ${missingInMigration.join(', ')}`);
        totalIssues += missingInMigration.length;
      }
      if (extraInMigration.length > 0) {
        console.log(`   ⚠️  Extra in migration: ${extraInMigration.join(', ')}`);
        totalIssues += extraInMigration.length;
      }
      console.log('');
    }
  }

  for (const tableName of Object.keys(migrationTables)) {
    if (!schemaTables[tableName]) {
      console.log(`📋 Table: ${tableName}`);
      console.log(`   ⚠️  Exists in migration but NOT in schema.ts\n`);
      totalIssues++;
    }
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  RESULT: ${passedTables}/${totalTables} tables fully matched`);
  console.log(`  ISSUES:  ${totalIssues}`);
  console.log('═══════════════════════════════════════════════════════════════');

  process.exit(totalIssues > 0 ? 1 : 0);
}

compare();