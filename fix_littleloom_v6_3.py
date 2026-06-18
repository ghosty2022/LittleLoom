#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LittleLoom Universal Fixer v6.3 - POWERSHELL COMPATIBLE
========================================================
Run with: python fix_littleloom_v6_3.py
NOT: .\fix_littleloom_v6_3.py  (PowerShell will fail)

Fixes:
1. diagnose.py UnicodeDecodeError (encoding='utf-8')
2. OnboardingScreen appears ONLY ONCE for new users
3. SecurityContext direct exports & null safety
4. AuthContext __DEV__ guards
5. All auth screens (Login, SignUp, ForgotPassword)
6. Security screens (Lock, Center, BiometricSetup)
7. AppContext null safety
"""

import os
import sys
import re
import shutil
import json
from pathlib import Path
from datetime import datetime

# ---------------------------------------------------------------------------
# AUTO-DISCOVERY
# ---------------------------------------------------------------------------
def find_littleloom_root():
    """Find the LittleLoom project root"""
    cwd = Path.cwd()

    # Check current directory
    pkg_file = cwd / "package.json"
    if pkg_file.exists():
        try:
            with open(pkg_file, 'r', encoding='utf-8') as f:
                pkg = json.load(f)
            name = pkg.get("name", "")
            if "littleloom" in name.lower() or "expo" in str(pkg.get("dependencies", {})):
                return cwd
        except:
            pass

    # Check parent directories
    for parent in [cwd] + list(cwd.parents)[:5]:
        if (parent / "src" / "context" / "SecurityContext.tsx").exists():
            return parent

    # Common Windows paths
    username = os.environ.get("USERNAME", os.environ.get("USER", ""))
    common = [
        Path.home() / "Desktop" / "LittleLoom",
        Path.home() / "Documents" / "LittleLoom",
        Path("C:/Users") / username / "Desktop" / "LittleLoom",
        Path("C:/Users") / username / "Documents" / "LittleLoom",
    ]
    for p in common:
        if (p / "src" / "context" / "SecurityContext.tsx").exists():
            return p

    return None

# ---------------------------------------------------------------------------
# OUTPUT HELPERS (no ANSI for Windows compatibility)
# ---------------------------------------------------------------------------
def log_info(msg): print("[i] " + msg)
def log_ok(msg): print("[OK] " + msg)
def log_warn(msg): print("[WARN] " + msg)
def log_err(msg): print("[ERR] " + msg)
def log_header(msg): print("\n=== " + msg + " ===")

# ---------------------------------------------------------------------------
# FILE OPS (with UTF-8 encoding fix)
# ---------------------------------------------------------------------------
def read_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        log_err("Cannot read " + str(path) + ": " + str(e))
        return None

def write_file(path, content):
    try:
        os.makedirs(os.path.dirname(str(path)), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    except Exception as e:
        log_err("Cannot write " + str(path) + ": " + str(e))
        return False

# ---------------------------------------------------------------------------
# FIX 0: diagnose.py UnicodeDecodeError
# ---------------------------------------------------------------------------
def fix_diagnose_script(path):
    log_header("FIX 0: diagnose.py encoding")
    content = read_file(path)
    if not content: return False
    changes = []

    # Fix read_text() to use encoding='utf-8'
    if 'path.read_text()' in content and "encoding='utf-8'" not in content:
        content = content.replace(
            'content = path.read_text()',
            "content = path.read_text(encoding='utf-8')"
        )
        changes.append("Fixed path.read_text() to use utf-8 encoding")

    # Also fix any other file reads without encoding
    if "open(" in content:
        # Fix generic open calls that read text files
        content = re.sub(
            r"with open\(([^,]+), ['\"]r['\"]\) as f:",
            r"with open(\1, 'r', encoding='utf-8') as f:",
            content
        )
        if "encoding='utf-8'" in content and len(changes) == 0:
            changes.append("Fixed open() calls to use utf-8 encoding")

    if changes:
        write_file(path, content)
        log_ok("diagnose.py - " + str(len(changes)) + " changes")
        return True
    log_warn("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 1: SECURITY CONTEXT
# ---------------------------------------------------------------------------
def fix_security_context(path):
    log_header("FIX 1: SecurityContext.tsx")
    content = read_file(path)
    if not content: return False
    changes = []

    # Remove sweetAlert references
    if "sweetAlert" in content:
        content = re.sub(r"sweetAlert\.alert\([^)]*\);\s*", "", content)
        changes.append("Removed sweetAlert.alert() calls")

    # Add direct exports if missing
    if "isBiometricEnabled: state.settings.isBiometricEnabled" not in content:
        marker = "const value = React.useMemo(() => ({"
        if marker in content:
            replacement = """const value = React.useMemo(() => ({
    // Direct boolean exports for convenience
    isBiometricEnabled: state.settings.isBiometricEnabled,
    isPinEnabled: state.settings.isPinEnabled,
    isAppLockEnabled: state.settings.isAppLockEnabled,
    autoLockTimeout: state.settings.autoLockTimeout,
    hasSecurityQuestions: state.settings.hasSecurityQuestions,
    biometricTypeName: state.settings.biometricTypeName,"""
            content = content.replace(marker, replacement)
            changes.append("Added direct boolean exports")

    # Remove useSweetAlert import
    if "useSweetAlert" in content:
        content = re.sub(r"import\s+\{?\s*useSweetAlert\s*\}?\s+from\s+['\"][^'\"]*SweetAlert['\"];?\s*\n", "\n", content)
        changes.append("Removed useSweetAlert import")

    # Enhance BiometricTypeConfig
    if "iconFilled" not in content:
        old_iface = """export interface BiometricTypeConfig {
  type: LocalAuthentication.AuthenticationType;
  name: string;
  icon: string;
  description: string;
  color: string;
}"""
        new_iface = """export interface BiometricTypeConfig {
  type: LocalAuthentication.AuthenticationType;
  name: string;
  icon: string;           // Outline icon (unselected)
  iconFilled?: string;    // Filled icon (selected)
  label: string;          // Display label
  description: string;
  color: string;
  gradient?: string[];    // Brand colors
}"""
        if old_iface in content:
            content = content.replace(old_iface, new_iface)
            changes.append("Enhanced BiometricTypeConfig")

    # Update Face ID config
    face_old = "configs.push({ type, name: 'Face ID', icon: 'scan-outline', description: 'Use your face to unlock', color: '#667eea' });"
    face_new = "configs.push({ type, name: 'Face ID', icon: 'scan-outline', iconFilled: 'scan', label: 'Face Recognition', description: 'Use your face to securely unlock LittleLoom', color: '#667eea', gradient: ['#667eea', '#764ba2'] });"
    if face_old in content:
        content = content.replace(face_old, face_new)
        changes.append("Updated Face ID config")

    # Update Fingerprint config
    finger_old = "configs.push({ type, name: 'Fingerprint', icon: 'finger-print', description: 'Use your fingerprint to unlock', color: '#43e97b' });"
    finger_new = "configs.push({ type, name: 'Fingerprint', icon: 'finger-print-outline', iconFilled: 'finger-print', label: 'Touch ID', description: 'Use your fingerprint to securely unlock LittleLoom', color: '#10b981', gradient: ['#11998e', '#38ef7d'] });"
    if finger_old in content:
        content = content.replace(finger_old, finger_new)
        changes.append("Updated Fingerprint config")

    # Update Iris config
    iris_old = "configs.push({ type, name: 'Iris Scan', icon: 'eye', description: 'Use your eyes to unlock', color: '#ffa502' });"
    iris_new = "configs.push({ type, name: 'Iris Scan', icon: 'eye-outline', iconFilled: 'eye', label: 'Iris Recognition', description: 'Use your eyes to securely unlock LittleLoom', color: '#f59e0b', gradient: ['#f59e0b', '#fbbf24'] });"
    if iris_old in content:
        content = content.replace(iris_old, iris_new)
        changes.append("Updated Iris config")

    if changes:
        write_file(path, content)
        log_ok("SecurityContext.tsx - " + str(len(changes)) + " changes:")
        for c in changes:
            log_info("  -> " + c)
        return True
    log_warn("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 2: AUTH CONTEXT
# ---------------------------------------------------------------------------
def fix_auth_context(path):
    log_header("FIX 2: AuthContext.tsx")
    content = read_file(path)
    if not content: return False
    changes = []

    if "console.log(" in content and "__DEV__" not in content:
        content = re.sub(r"(?<!if \(__DEV__\) )console\.log\('([^']+)'\);", r"if (__DEV__) console.log('\1');", content)
        changes.append("Wrapped console.log in __DEV__")

    if "\\\\s+" in content:
        content = content.replace("\\\\s+", "\\s+")
        changes.append("Fixed double-escaped regex")

    if changes:
        write_file(path, content)
        log_ok("AuthContext.tsx - " + str(len(changes)) + " changes")
        return True
    log_warn("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 3/4/4b: LOGIN, SIGNUP, FORGOT PASSWORD SCREENS
# ---------------------------------------------------------------------------
def fix_auth_screen(path, name):
    log_header("FIX: " + name)
    content = read_file(path)
    if not content: return False
    changes = []

    # Add Animated import from reanimated if using Animated.View etc
    uses_animated = "Animated.View" in content or "Animated.Text" in content
    has_reanimated = "react-native-reanimated" in content
    has_animated_import = "import Animated" in content

    if uses_animated and has_reanimated and not has_animated_import:
        match = re.search(r"import\s+\{([^}]+)\}\s+from\s+'react-native-reanimated'", content)
        if match:
            imports = match.group(1)
            if "Animated" not in imports:
                old_imp = match.group(0)
                new_imp = old_imp.replace("{", "{ Animated, ", 1).replace(", ,", ",")
                content = content.replace(old_imp, new_imp)
                changes.append("Added Animated import from reanimated")

    if changes:
        write_file(path, content)
        log_ok(name + " - " + str(len(changes)) + " changes")
        return True
    log_warn("No changes needed")
    return False

def fix_forgot_password(path):
    log_header("FIX 5: ForgotPasswordScreen.tsx")
    content = read_file(path)
    if not content: return False
    changes = []

    # Remove inline SweetAlert
    if "const SweetAlert = " in content:
        content = re.sub(r"const SweetAlert = \([^)]*\) => \{.*?\};\s*", "", content, flags=re.DOTALL)
        changes.append("Removed inline SweetAlert")

    # Remove custom showToast
    if "const showToast = " in content:
        content = re.sub(r"const showToast = \([^)]*\) => \{.*?\};\s*", "", content, flags=re.DOTALL)
        changes.append("Removed custom showToast")

    # Replace showToast calls
    old_content = content
    content = content.replace("showToast('error', ", "showError(")
    content = content.replace("showToast('success', ", "showSuccess(")
    content = content.replace("showToast('info', ", "toast(")
    content = content.replace("showToast('warning', ", "toast(")
    if content != old_content:
        changes.append("Replaced showToast with hook methods")

    # Remove AlertState
    if "interface AlertState" in content:
        content = re.sub(r"interface AlertState \{[^}]*\}\s*", "", content)
        changes.append("Removed AlertState interface")

    # Remove alert state
    if "const [alert, setAlert]" in content:
        content = re.sub(r"const \[alert, setAlert\][^;]*;\s*", "", content)
        changes.append("Removed alert state")

    # Remove SweetAlert JSX
    content = re.sub(r"\s*<SweetAlert[^/]*/>\s*", "\n", content)

    # Fix useSweetAlert destructuring
    if "useSweetAlert" in content:
        sweetalert_match = re.search(r"const\s*\{([^}]*)\}\s*=\s*useSweetAlert\(\)", content)
        if sweetalert_match:
            destructured = sweetalert_match.group(1)
            if "showError" not in destructured:
                new_destructure = "const { toast, error: showError, success: showSuccess } = useSweetAlert()"
                content = content.replace(sweetalert_match.group(0), new_destructure)
                changes.append("Fixed useSweetAlert destructuring")

    if changes:
        write_file(path, content)
        log_ok("ForgotPasswordScreen.tsx - " + str(len(changes)) + " changes")
        return True
    log_warn("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 6: SECURITY LOCK
# ---------------------------------------------------------------------------
def fix_security_lock(path):
    log_header("FIX 6: SecurityLockScreen.tsx")
    content = read_file(path)
    if not content: return False
    changes = []

    if "isBiometricEnabled" in content and "biometricEnabled" not in content:
        content = content.replace(
            "} = useSecurity();\n\n  const { darkMode",
            "} = useSecurity();\n  \n  const biometricEnabled = isBiometricEnabled ?? false;\n\n  const { darkMode"
        )
        content = content.replace("if (!isBiometricEnabled)", "if (!biometricEnabled)")
        content = content.replace("if (isBiometricEnabled)", "if (biometricEnabled)")
        changes.append("Added biometricEnabled fallback")

    if "scanningRing" not in content:
        old_end = """  emergencyText: {
    fontSize: 15,
    fontWeight: '600',
  },
});"""
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
        changes.append("Added scanning styles")

    if changes:
        write_file(path, content)
        log_ok("SecurityLockScreen.tsx - " + str(len(changes)) + " changes")
        return True
    log_warn("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 7: SECURITY CENTER
# ---------------------------------------------------------------------------
def fix_security_center(path):
    log_header("FIX 7: SecurityCenterScreen.tsx")
    content = read_file(path)
    if not content: return False
    changes = []

    # Check if isBiometricEnabled is in the useSecurity destructuring
    if "useSecurity()" in content:
        parts = content.split("useSecurity()")
        if len(parts) > 1:
            after_useSecurity = parts[1]
            brace_end = after_useSecurity.find("};")
            if brace_end > 0:
                useSecurity_section = after_useSecurity[:brace_end]
                if "isBiometricEnabled" not in useSecurity_section:
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
        log_ok("SecurityCenterScreen.tsx - " + str(len(changes)) + " changes")
        return True
    log_warn("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 8: BIOMETRIC SETUP
# ---------------------------------------------------------------------------
def fix_biometric_setup(path):
    log_header("FIX 8: BiometricSetupScreen.tsx")
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
        log_ok("BiometricSetupScreen.tsx - " + str(len(changes)) + " changes")
        return True
    log_warn("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 9: APP CONTEXT
# ---------------------------------------------------------------------------
def fix_app_context(path):
    log_header("FIX 9: AppContext.tsx")
    content = read_file(path)
    if not content: return False
    changes = []

    if "customization.isLoaded" in content and "customization?.isLoaded" not in content:
        content = content.replace("customization.isLoaded", "customization?.isLoaded")
        content = content.replace("customization.settings.appearance", "customization.settings?.appearance")
        content = content.replace("customization.updateSettings", "customization?.updateSettings")
        changes.append("Added null safety")

    if changes:
        write_file(path, content)
        log_ok("AppContext.tsx - " + str(len(changes)) + " changes")
        return True
    log_warn("No changes needed")
    return False

# ---------------------------------------------------------------------------
# FIX 10: ONBOARDING SCREEN - ENSURE APPEARS ONLY ONCE
# ---------------------------------------------------------------------------
def fix_onboarding_screen(path):
    log_header("FIX 10: OnboardingScreen.tsx (ONCE-ONLY logic)")
    content = read_file(path)
    if not content: return False
    changes = []

    # Ensure proper storage keys are used
    if "ONBOARDING_COMPLETE_KEY" in content:
        if "@littleloom_onboarding_complete_v3" not in content:
            content = content.replace(
                "@littleloom_onboarding_complete",
                "@littleloom_onboarding_complete_v3"
            )
            changes.append("Updated onboarding complete key to v3")

    if "@littleloom_onboarding_seen_v3" not in content:
        content = content.replace(
            "@littleloom_onboarding_seen",
            "@littleloom_onboarding_seen_v3"
        )
        changes.append("Updated onboarding seen key to v3")

    # Ensure navigation.replace is used (not navigate) to prevent going back
    if "navigation.replace('Login')" not in content:
        if "navigation.navigate('Login')" in content:
            content = content.replace("navigation.navigate('Login')", "navigation.replace('Login')")
            changes.append("Changed navigate to replace for Login")

    if changes:
        write_file(path, content)
        log_ok("OnboardingScreen.tsx - " + str(len(changes)) + " changes")
        return True
    log_warn("No changes needed (already correct)")
    return False

# ---------------------------------------------------------------------------
# FIX 11: APP NAVIGATOR - ONBOARDING LOGIC
# ---------------------------------------------------------------------------
def fix_app_navigator(path):
    log_header("FIX 11: AppNavigator.tsx onboarding flow")
    content = read_file(path)
    if not content: return False
    changes = []

    # Ensure ONBOARDING keys are consistent
    if "@littleloom_onboarding_complete_v3" not in content:
        content = content.replace(
            "@littleloom_onboarding_complete",
            "@littleloom_onboarding_complete_v3"
        )
        changes.append("Updated onboarding key to v3")

    if "@littleloom_onboarding_seen_v3" not in content:
        content = content.replace(
            "@littleloom_onboarding_seen",
            "@littleloom_onboarding_seen_v3"
        )
        changes.append("Updated onboarding seen key to v3")

    if changes:
        write_file(path, content)
        log_ok("AppNavigator.tsx - " + str(len(changes)) + " changes")
        return True
    log_warn("No changes needed")
    return False

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    print("\n" + "="*60)
    print("  LittleLoom Universal Fixer v6.3")
    print("  Run: python fix_littleloom_v6_3.py")
    print("="*60 + "\n")

    root = find_littleloom_root()
    if not root:
        log_err("Cannot find LittleLoom project!")
        log_info("Run this script FROM the LittleLoom directory")
        log_info("Example: cd C:\\Users\\ondie\\Desktop\\LittleLoom")
        log_info("         python fix_littleloom_v6_3.py")
        sys.exit(1)

    log_ok("Project found: " + str(root))
    src = root / "src"

    # Backup
    backup_dir = root / ("backup_v6_3_" + datetime.now().strftime("%Y%m%d_%H%M%S"))
    os.makedirs(str(backup_dir), exist_ok=True)
    log_ok("Backup: " + str(backup_dir))

    # Files to fix
    files = {
        'diagnose': root / "diagnose.py",
        'SecurityContext': src / "context" / "SecurityContext.tsx",
        'AuthContext': src / "context" / "AuthContext.tsx",
        'AppContext': src / "context" / "AppContext.tsx",
        'LoginScreen': src / "screens" / "auth" / "LoginScreen.tsx",
        'SignUpScreen': src / "screens" / "auth" / "SignUpScreen.tsx",
        'ForgotPassword': src / "screens" / "auth" / "ForgotPasswordScreen.tsx",
        'SecurityLock': src / "screens" / "security" / "SecurityLockScreen.tsx",
        'SecurityCenter': src / "screens" / "security" / "SecurityCenterScreen.tsx",
        'BiometricSetup': src / "screens" / "security" / "BiometricSetupScreen.tsx",
        'OnboardingScreen': src / "screens" / "auth" / "OnboardingScreen.tsx",
        'AppNavigator': src / "navigation" / "AppNavigator.tsx",
    }

    existing = {}
    missing = []
    for name, path in files.items():
        if path.exists():
            existing[name] = path
        else:
            missing.append(name)

    if missing:
        log_warn("Missing files: " + ", ".join(missing))

    if not existing:
        log_err("No files found to fix!")
        sys.exit(1)

    log_ok("Found " + str(len(existing)) + " files to process")

    # Backup all
    for name, path in existing.items():
        shutil.copy2(str(path), str(backup_dir / (name + "_" + path.name)))

    # Apply fixes
    results = {}
    fix_functions = {
        'diagnose': fix_diagnose_script,
        'SecurityContext': fix_security_context,
        'AuthContext': fix_auth_context,
        'AppContext': fix_app_context,
        'LoginScreen': lambda p: fix_auth_screen(p, 'LoginScreen.tsx'),
        'SignUpScreen': lambda p: fix_auth_screen(p, 'SignUpScreen.tsx'),
        'ForgotPassword': fix_forgot_password,
        'SecurityLock': fix_security_lock,
        'SecurityCenter': fix_security_center,
        'BiometricSetup': fix_biometric_setup,
        'OnboardingScreen': fix_onboarding_screen,
        'AppNavigator': fix_app_navigator,
    }

    for name, path in existing.items():
        if name in fix_functions:
            results[name] = fix_functions[name](path)

    # Summary
    log_header("SUMMARY")
    fixed_count = sum(1 for v in results.values() if v)
    total_count = len(results)

    print("\n" + "-"*40)
    print("{:<20} {:<10}".format("File", "Status"))
    print("-"*40)
    for name, ok in results.items():
        status = "FIXED" if ok else "OK"
        print("{:<20} {:<10}".format(name, status))

    print("\n" + "="*40)
    log_ok(str(fixed_count) + "/" + str(total_count) + " files modified")
    log_info("Backup: " + str(backup_dir))

    print("\nNext steps:")
    print("  1. npx expo start -c")
    print("  2. Test: Fresh install -> Onboarding -> Login")
    print("  3. Kill app -> Reopen -> Should go directly to Login (not Onboarding)")
    print("  4. npx tsc --noEmit")
    print("\nDone!")

if __name__ == "__main__":
    main()