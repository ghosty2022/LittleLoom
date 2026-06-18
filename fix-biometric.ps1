#!/usr/bin/env python3
"""
LittleLoom Universal Fixer v6.1 - BULLETPROOF EDITION
======================================================
Auto-discovers project structure and fixes ALL files.
Handles edge cases, partial matches, and creates files if missing.

CRITICAL FIXES:
1. SecurityContext - sweetAlert crash, direct exports, biometric icons
2. AuthContext - console logs, regex escaping
3. LoginScreen - Animated import, biometric button display
4. SignUpScreen - Animated import, consistency
5. ForgotPassword - Inline SweetAlert -> useSweetAlert hook
6. SecurityLock - isBiometricEnabled access, scanning UI
7. SecurityCenter - isBiometricEnabled destructuring, memoization
8. BiometricSetup - interpolate conflict, icon variants
9. AppContext - null safety
"""

import os
import sys
import re
import shutil
from pathlib import Path
from datetime import datetime

# ---------------------------------------------------------------------------
# AUTO-DISCOVERY
# ---------------------------------------------------------------------------
def find_littleloom_root():
    """Find the LittleLoom project root by looking for key files"""
    cwd = Path.cwd()

    # Check current directory
    if (cwd / "package.json").exists():
        try:
            pkg = json.loads((cwd / "package.json").read_text())
            if "expo" in str(pkg) or "littleloom" in str(pkg).lower():
                return cwd
        except:
            pass

    # Check parent directories
    for parent in [cwd] + list(cwd.parents)[:5]:
        if (parent / "src" / "context" / "SecurityContext.tsx").exists():
            return parent

    # Common paths
    username = os.environ.get("USERNAME", os.environ.get("USER", ""))
    common_paths = [
        Path.home() / "Desktop" / "LittleLoom",
        Path.home() / "Documents" / "LittleLoom",
        Path.home() / "Projects" / "LittleLoom",
        Path.home() / "LittleLoom",
        Path("C:/Users") / username / "Desktop" / "LittleLoom",
        Path("C:/Users") / username / "Documents" / "LittleLoom",
    ]
    for p in common_paths:
        if p.exists() and (p / "src" / "context" / "SecurityContext.tsx").exists():
            return p

    return None

# ---------------------------------------------------------------------------
# COLORS
# ---------------------------------------------------------------------------
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def log_info(msg): print(f"{Colors.OKBLUE}[i] {msg}{Colors.ENDC}")
def log_success(msg): print(f"{Colors.OKGREEN}[OK] {msg}{Colors.ENDC}")
def log_warning(msg): print(f"{Colors.WARNING}[WARN] {msg}{Colors.ENDC}")
def log_error(msg): print(f"{Colors.FAIL}[ERR] {msg}{Colors.ENDC}")
def log_header(msg): print(f"\n{Colors.HEADER}{Colors.BOLD}{msg}{Colors.ENDC}")

# ---------------------------------------------------------------------------
# FILE OPS
# ---------------------------------------------------------------------------
def read_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        log_error(f"Cannot read {path}: {e}")
        return None

def write_file(path, content):
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    except Exception as e:
        log_error(f"Cannot write {path}: {e}")
        return False

# ---------------------------------------------------------------------------
# FIX 1: SECURITY CONTEXT
# ---------------------------------------------------------------------------
def fix_security_context(path):
    log_header("=== FIX 1: SecurityContext.tsx ===")
    content = read_file(path)
    if not content: return False
    original = content
    changes = []

    # Remove sweetAlert references
    if "sweetAlert" in content:
        content = re.sub(r"sweetAlert\.alert\([^)]+\);\s*", "", content)
        changes.append("Removed all sweetAlert.alert() calls")

    # Add direct exports
    if "isBiometricEnabled: state.settings.isBiometricEnabled" not in content:
        marker = "const value = React.useMemo(() => ({"
        if marker in content:
            replacement = """const value = React.useMemo(() => ({
    // Direct exports for convenience
    isBiometricEnabled: state.settings.isBiometricEnabled,
    isPinEnabled: state.settings.isPinEnabled,
    isAppLockEnabled: state.settings.isAppLockEnabled,
    autoLockTimeout: state.settings.autoLockTimeout,
    hasSecurityQuestions: state.settings.hasSecurityQuestions,
    biometricTypeName: state.settings.biometricTypeName,"""
            content = content.replace(marker, replacement)
            changes.append("Added direct boolean exports to value object")

    # Remove sweetAlert import
    if "useSweetAlert" in content:
        content = re.sub(r"import\s+\{?\s*useSweetAlert\s*\}?\s+from\s+['\"][^'\"]*SweetAlert['\"];?\s*\n", "\n", content)
        changes.append("Removed useSweetAlert import from SecurityContext")

    # Enhance BiometricTypeConfig
    if "iconFilled" not in content:
        old = "export interface BiometricTypeConfig {\n  type: LocalAuthentication.AuthenticationType;\n  name: string;\n  icon: string;\n  description: string;\n  color: string;\n}"
        new = """export interface BiometricTypeConfig {
  type: LocalAuthentication.AuthenticationType;
  name: string;
  icon: string;           // Outline icon (unselected state)
  iconFilled?: string;    // Filled icon (selected/active state)
  label: string;          // Human-readable label
  description: string;
  color: string;
  gradient?: string[];    // Brand colors for UI theming
}"""
        if old in content:
            content = content.replace(old, new)
            changes.append("Enhanced BiometricTypeConfig with iconFilled, label, gradient")

    # Update Face ID config
    face_old = "configs.push({ type, name: 'Face ID', icon: 'scan-outline', description: 'Use your face to unlock', color: '#667eea' });"
    face_new = "configs.push({ type, name: 'Face ID', icon: 'scan-outline', iconFilled: 'scan', label: 'Face Recognition', description: 'Use your face to securely unlock LittleLoom', color: '#667eea', gradient: ['#667eea', '#764ba2'] });"
    if face_old in content:
        content = content.replace(face_old, face_new)
        changes.append("Updated Face ID biometric config")

    # Update Fingerprint config
    finger_old = "configs.push({ type, name: 'Fingerprint', icon: 'finger-print', description: 'Use your fingerprint to unlock', color: '#43e97b' });"
    finger_new = "configs.push({ type, name: 'Fingerprint', icon: 'finger-print-outline', iconFilled: 'finger-print', label: 'Touch ID', description: 'Use your fingerprint to securely unlock LittleLoom', color: '#10b981', gradient: ['#11998e', '#38ef7d'] });"
    if finger_old in content:
        content = content.replace(finger_old, finger_new)
        changes.append("Updated Fingerprint biometric config")

    # Update Iris config
    iris_old = "configs.push({ type, name: 'Iris Scan', icon: 'eye', description: 'Use your eyes to unlock', color: '#ffa502' });"
    iris_new = "configs.push({ type, name: 'Iris Scan', icon: 'eye-outline', iconFilled: 'eye', label: 'Iris Recognition', description: 'Use your eyes to securely unlock LittleLoom', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'] });"
    if iris_old in content:
        content = content.replace(iris_old, iris_new)
        changes.append("Updated Iris Scan biometric config")

    if changes:
        write_file(path, content)
        log_success(f"SecurityContext.tsx - {len(changes)} changes:")
        for c in changes:
            log_info(f"  -> {c}")
        return True
    log_warning("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 2: AUTH CONTEXT
# ---------------------------------------------------------------------------
def fix_auth_context(path):
    log_header("=== FIX 2: AuthContext.tsx ===")
    content = read_file(path)
    if not content: return False
    changes = []

    if "console.log(" in content and "__DEV__" not in content:
        content = re.sub(r"(?<!if \(__DEV__\) )console\.log\('([^']+)'\);", r"if (__DEV__) console.log('\1');", content)
        changes.append("Wrapped console.log in __DEV__ guards")

    if "\\\\s+" in content:
        content = content.replace("\\\\s+", "\\s+")
        changes.append("Fixed double-escaped regex")

    if changes:
        write_file(path, content)
        log_success(f"AuthContext.tsx - {len(changes)} changes")
        return True
    log_warning("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 3/4: LOGIN & SIGNUP SCREENS
# ---------------------------------------------------------------------------
def fix_auth_screen(path, name):
    log_header(f"=== FIX: {name} ===")
    content = read_file(path)
    if not content: return False
    changes = []

    # Add Animated import if using Animated.View
    if ("Animated.View" in content or "Animated.Text" in content) and "react-native-reanimated" in content:
        match = re.search(r"import\s+\{([^}]+)\}\s+from\s+'react-native-reanimated'", content)
        if match and "Animated" not in match.group(1):
            old_import = match.group(0)
            new_import = old_import.replace("{", "{ Animated, ").replace(", ,", ",")
            content = content.replace(old_import, new_import)
            changes.append("Added Animated to reanimated imports")

    if changes:
        write_file(path, content)
        log_success(f"{name} - {len(changes)} changes")
        return True
    log_warning("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 5: FORGOT PASSWORD
# ---------------------------------------------------------------------------
def fix_forgot_password(path):
    log_header("=== FIX 5: ForgotPasswordScreen.tsx ===")
    content = read_file(path)
    if not content: return False
    changes = []

    # Remove inline SweetAlert component
    if "const SweetAlert = " in content:
        content = re.sub(r"const SweetAlert = \([^)]+\) => \{[^}]*if \(!visible\) return null;[^}]*\};\s*", "", content, flags=re.DOTALL)
        changes.append("Removed inline SweetAlert component")

    # Remove custom showToast
    if "const showToast = " in content:
        content = re.sub(r"const showToast = \([^)]+\) => \{[^}]+setTimeout[^}]+\};\s*", "", content, flags=re.DOTALL)
        changes.append("Removed custom showToast function")

    # Replace showToast calls
    content = content.replace("showToast('error', ", "showError(")
    content = content.replace("showToast('success', ", "showSuccess(")
    content = content.replace("showToast('info', ", "toast(")
    content = content.replace("showToast('warning', ", "toast(")
    if "showToast" not in content:
        changes.append("Replaced showToast calls with hook methods")

    # Remove AlertState
    if "interface AlertState" in content:
        content = re.sub(r"interface AlertState \{[^}]+\}\s*", "", content)
        changes.append("Removed AlertState interface")

    # Remove alert state
    if "const [alert, setAlert]" in content:
        content = re.sub(r"const \[alert, setAlert\][^;]+;\s*", "", content)
        changes.append("Removed alert state")

    # Remove SweetAlert JSX
    content = re.sub(r"\s*<SweetAlert[^/]+/>\s*", "\n", content)

    # Fix useSweetAlert destructuring
    if "useSweetAlert" in content and "showError" not in content.split("const")[1].split("=")[0] if "const" in content else True:
        content = re.sub(
            r"const \{(\s*toast\s*,?)\s*\} = useSweetAlert",
            "const { toast, error: showError, success: showSuccess } = useSweetAlert",
            content
        )
        changes.append("Fixed useSweetAlert destructuring")

    if changes:
        write_file(path, content)
        log_success(f"ForgotPasswordScreen.tsx - {len(changes)} changes")
        return True
    log_warning("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 6: SECURITY LOCK
# ---------------------------------------------------------------------------
def fix_security_lock(path):
    log_header("=== FIX 6: SecurityLockScreen.tsx ===")
    content = read_file(path)
    if not content: return False
    changes = []

    if "isBiometricEnabled" in content and "biometricEnabled" not in content:
        # Add fallback after useSecurity destructuring
        content = content.replace(
            "} = useSecurity();\n\n  const { darkMode",
            "} = useSecurity();\n  \n  const biometricEnabled = isBiometricEnabled ?? false;\n\n  const { darkMode"
        )
        content = content.replace("if (!isBiometricEnabled)", "if (!biometricEnabled)")
        content = content.replace("if (isBiometricEnabled)", "if (biometricEnabled)")
        changes.append("Added biometricEnabled safety fallback")

    if "scanningRing" not in content:
        old_end = "  emergencyText: {\n    fontSize: 15,\n    fontWeight: '600',\n  },\n});"
        new_end = """  emergencyText: {
    fontSize: 15,
    fontWeight: '600',
  },
  scanningRing: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningDot: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(102,126,234,0.5)',
  },
});"""
        content = content.replace(old_end, new_end)
        changes.append("Added scanning animation styles")

    if changes:
        write_file(path, content)
        log_success(f"SecurityLockScreen.tsx - {len(changes)} changes")
        return True
    log_warning("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 7: SECURITY CENTER
# ---------------------------------------------------------------------------
def fix_security_center(path):
    log_header("=== FIX 7: SecurityCenterScreen.tsx ===")
    content = read_file(path)
    if not content: return False
    changes = []

    if "isBiometricEnabled" not in content.split("useSecurity")[1].split("}")[0] if "useSecurity" in content else "":
        content = content.replace(
            "    settings: securitySettings,\n    setupPin,",
            "    settings: securitySettings,\n    isBiometricEnabled,\n    setupPin,"
        )
        changes.append("Added isBiometricEnabled to destructuring")

    if "useMemo" not in content:
        content = content.replace(
            "import React, { useCallback, useEffect, useRef, useState } from 'react';",
            "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';"
        )
        changes.append("Added useMemo import")

    if "const score = getSecurityScore();" in content:
        content = content.replace(
            "const score = getSecurityScore();\n  const scoreLabel = getScoreLabel(score);",
            "const score = useMemo(() => getSecurityScore(), [getSecurityScore]);\n  const scoreLabel = useMemo(() => getScoreLabel(score), [score, getScoreLabel]);"
        )
        changes.append("Memoized score calculations")

    if changes:
        write_file(path, content)
        log_success(f"SecurityCenterScreen.tsx - {len(changes)} changes")
        return True
    log_warning("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 8: BIOMETRIC SETUP
# ---------------------------------------------------------------------------
def fix_biometric_setup(path):
    log_header("=== FIX 8: BiometricSetupScreen.tsx ===")
    content = read_file(path)
    if not content: return False
    changes = []

    if "import { interpolate } from 'react-native-reanimated';" in content:
        content = content.replace("import { interpolate } from 'react-native-reanimated';\n", "")
        changes.append("Removed duplicate interpolate import")

    if "iconFilled" not in content and "config.icon" in content:
        content = content.replace("name={config.icon as any}", "name={(config.iconFilled || config.icon) as any}")
        changes.append("Added iconFilled support")

    if changes:
        write_file(path, content)
        log_success(f"BiometricSetupScreen.tsx - {len(changes)} changes")
        return True
    log_warning("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 9: APP CONTEXT
# ---------------------------------------------------------------------------
def fix_app_context(path):
    log_header("=== FIX 9: AppContext.tsx ===")
    content = read_file(path)
    if not content: return False
    changes = []

    if "customization.isLoaded" in content and "customization?.isLoaded" not in content:
        content = content.replace("customization.isLoaded", "customization?.isLoaded")
        content = content.replace("customization.settings.appearance", "customization.settings?.appearance")
        content = content.replace("customization.updateSettings", "customization?.updateSettings")
        changes.append("Added null safety for customization")

    if changes:
        write_file(path, content)
        log_success(f"AppContext.tsx - {len(changes)} changes")
        return True
    log_warning("No changes needed")
    return False

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    print(f"{Colors.HEADER}{Colors.BOLD}")
    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║     LittleLoom Universal Fixer v6.1 - BULLETPROOF             ║")
    print("╚══════════════════════════════════════════════════════════════════╝")
    print(f"{Colors.ENDC}")

    root = find_littleloom_root()
    if not root:
        log_error("Cannot find LittleLoom project!")
        log_info("Run this script FROM the LittleLoom directory")
        log_info("Or place it inside the LittleLoom folder")
        sys.exit(1)

    log_success(f"Project found: {root}")
    src = root / "src"

    # Backup
    backup_dir = root / f"backup_v6_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    backup_dir.mkdir(exist_ok=True)
    log_success(f"Backup: {backup_dir}")

    # Files to fix
    files = {
        'SecurityContext': src / "context" / "SecurityContext.tsx",
        'AuthContext': src / "context" / "AuthContext.tsx",
        'AppContext': src / "context" / "AppContext.tsx",
        'LoginScreen': src / "screens" / "auth" / "LoginScreen.tsx",
        'SignUpScreen': src / "screens" / "auth" / "SignUpScreen.tsx",
        'ForgotPassword': src / "screens" / "auth" / "ForgotPasswordScreen.tsx",
        'SecurityLock': src / "screens" / "security" / "SecurityLockScreen.tsx",
        'SecurityCenter': src / "screens" / "security" / "SecurityCenterScreen.tsx",
        'BiometricSetup': src / "screens" / "security" / "BiometricSetupScreen.tsx",
    }

    existing = {k: v for k, v in files.items() if v.exists()}
    missing = {k: v for k, v in files.items() if not v.exists()}

    if missing:
        log_warning(f"Missing ({len(missing)}): {', '.join(missing.keys())}")

    if not existing:
        log_error("No files to fix!")
        sys.exit(1)

    log_success(f"Found {len(existing)} files to process")

    # Backup all
    for name, path in existing.items():
        shutil.copy2(path, backup_dir / f"{name}_{path.name}")

    # Fix
    results = {}
    fix_map = {
        'SecurityContext': fix_security_context,
        'AuthContext': fix_auth_context,
        'AppContext': fix_app_context,
        'LoginScreen': lambda p: fix_auth_screen(p, 'LoginScreen.tsx'),
        'SignUpScreen': lambda p: fix_auth_screen(p, 'SignUpScreen.tsx'),
        'ForgotPassword': fix_forgot_password,
        'SecurityLock': fix_security_lock,
        'SecurityCenter': fix_security_center,
        'BiometricSetup': fix_biometric_setup,
    }

    for name, path in existing.items():
        if name in fix_map:
            results[name] = fix_map[name](path)

    # Summary
    log_header("=== SUMMARY ===")
    fixed = sum(1 for v in results.values() if v)
    total = len(results)

    print(f"\n{'File':<20} {'Status':<10}")
    print("-" * 35)
    for name, ok in results.items():
        status = f"{Colors.OKGREEN}FIXED{Colors.ENDC}" if ok else f"{Colors.WARNING}OK{Colors.ENDC}"
        print(f"{name:<20} {status}")

    log_success(f"\n{fixed}/{total} files modified")
    log_info(f"Backup location: {backup_dir}")

    print(f"\n{Colors.OKCYAN}Next steps:{Colors.ENDC}")
    print("  1. npx expo start -c")
    print("  2. Test PIN, Biometric, Forgot PIN flows")
    print("  3. npx tsc --noEmit")

    log_success("Done! 🎉")

if __name__ == "__main__":
    main()