// prebuild-check.js
// Validates all dependencies' engine requirements against your EAS Node version
// Run BEFORE eas build to catch incompatibilities locally
// Usage: node prebuild-check.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Semver helper (lightweight) ──────────────────────────────────────
function satisfies(version, range) {
  // Very basic semver range checker for common patterns
  // For full accuracy, this script tries to use npm's semver if available
  try {
    const semver = require('semver');
    return semver.satisfies(version, range);
  } catch {
    // Fallback for when semver isn't installed
    return fallbackSatisfies(version, range);
  }
}

function fallbackSatisfies(version, range) {
  const [major, minor, patch] = version.split('.').map(Number);
  const r = range.trim();

  if (r === '*') return true;

  // >=x.y.z
  const gte = r.match(/^>=([0-9]+(?:\.[0-9]+){0,2})$/);
  if (gte) {
    const [tm, tmi, tp] = gte[1].split('.').map(Number);
    if (major > tm) return true;
    if (major < tm) return false;
    if ((minor || 0) > (tmi || 0)) return true;
    if ((minor || 0) < (tmi || 0)) return false;
    return (patch || 0) >= (tp || 0);
  }

  // ^x.y.z
  const caret = r.match(/\^([0-9]+)\.(?:([0-9]+))?(?:\.([0-9]+))?/);
  if (caret) {
    const cm = Number(caret[1]);
    if (major !== cm) return false;
    const cmi = Number(caret[2] || 0);
    if ((minor || 0) < cmi) return false;
    return true;
  }

  // x.y.z || >=a.b.c
  if (r.includes('||')) {
    return r.split('||').some(part => fallbackSatisfies(version, part.trim()));
  }

  return true; // unknown range = pass
}

// ─── Read EAS Node version ────────────────────────────────────────────
function getEasNodeVersion() {
  const easPath = path.join(__dirname, 'eas.json');
  if (!fs.existsSync(easPath)) {
    console.error('❌ eas.json not found');
    process.exit(1);
  }
  const eas = JSON.parse(fs.readFileSync(easPath, 'utf-8'));
  const node = eas.build?.development?.node
    || eas.build?.preview?.node
    || eas.build?.production?.node;
  if (!node) {
    console.error('❌ No Node version found in eas.json (add "node": "22.x.x" to your build profiles)');
    process.exit(1);
  }
  return node;
}

// ─── Check all packages in node_modules ───────────────────────────────
function checkEngines(targetNode) {
  const nm = path.join(__dirname, 'node_modules');
  if (!fs.existsSync(nm)) {
    console.error('❌ node_modules not found. Run npm install or yarn install first.');
    process.exit(1);
  }

  const failures = [];
  const dirs = fs.readdirSync(nm, { withFileTypes: true });

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    if (dir.name.startsWith('.')) continue;

    const pkgPath = path.join(nm, dir.name, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;

    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    } catch { continue; }

    const engineNode = pkg.engines?.node;
    if (!engineNode) continue;

    if (!satisfies(targetNode, engineNode)) {
      failures.push({
        name: pkg.name || dir.name,
        version: pkg.version || '?',
        required: engineNode,
        path: path.relative(__dirname, pkgPath),
      });
    }
  }

  return failures;
}

// ─── Check lockfile vs package manager ────────────────────────────────
function checkLockfiles() {
  const hasPackageLock = fs.existsSync(path.join(__dirname, 'package-lock.json'));
  const hasYarnLock = fs.existsSync(path.join(__dirname, 'yarn.lock'));
  const hasNpmShrinkwrap = fs.existsSync(path.join(__dirname, 'npm-shrinkwrap.json'));

  if (hasPackageLock && hasYarnLock) {
    return {
      warning: '⚠️  BOTH package-lock.json AND yarn.lock exist. EAS may pick a different package manager than you expect.',
      fix: 'Delete the one you do NOT use (rm yarn.lock OR rm package-lock.json)',
    };
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────
function main() {
  const targetNode = getEasNodeVersion();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PRE-BUILD CHECK');
  console.log(`  Target Node (from eas.json): ${targetNode}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // 1. Lockfile check
  const lockIssue = checkLockfiles();
  if (lockIssue) {
    console.log(lockIssue.warning);
    console.log(`   Fix: ${lockIssue.fix}\n`);
  } else {
    console.log('✅ Lockfile check passed\n');
  }

  // 2. Engine check
  console.log('Checking dependency engine constraints...');
  const failures = checkEngines(targetNode);

  if (failures.length === 0) {
    console.log(`✅ All ${fs.readdirSync(path.join(__dirname, 'node_modules')).length} packages satisfy Node ${targetNode}`);
    console.log('');
    console.log('🚀 Safe to run: eas build --platform android --profile development');
    console.log('');
    process.exit(0);
  }

  console.log(`❌ ${failures.length} package(s) incompatible with Node ${targetNode}:`);
  console.log('');

  for (const f of failures) {
    console.log(`  📦 ${f.name}@${f.version}`);
    console.log(`     Requires: node ${f.required}`);
    console.log(`     Fix: npm install ${f.name}@<compatible-version> --save-exact`);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  BUILD WILL FAIL ON EAS. Fix the packages above first.');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  process.exit(1);
}

main();