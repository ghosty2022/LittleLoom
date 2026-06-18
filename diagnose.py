#!/usr/bin/env python3
"""Quick diagnostic - run with: python diagnose.py"""
import os, sys
from pathlib import Path

def find_project():
    cwd = Path.cwd()
    for p in [cwd] + list(cwd.parents)[:5]:
        if (p / "src" / "context" / "SecurityContext.tsx").exists():
            return p
    return None

root = find_project()
if not root:
    print("ERROR: Not in LittleLoom directory")
    sys.exit(1)

src = root / "src"
files = {
    "SecurityContext": src / "context" / "SecurityContext.tsx",
    "AuthContext": src / "context" / "AuthContext.tsx",
    "LoginScreen": src / "screens" / "auth" / "LoginScreen.tsx",
    "SignUpScreen": src / "screens" / "auth" / "SignUpScreen.tsx",
    "ForgotPassword": src / "screens" / "auth" / "ForgotPasswordScreen.tsx",
    "SecurityLock": src / "screens" / "security" / "SecurityLockScreen.tsx",
    "SecurityCenter": src / "screens" / "security" / "SecurityCenterScreen.tsx",
    "BiometricSetup": src / "screens" / "security" / "BiometricSetupScreen.tsx",
}

print("LittleLoom Diagnostic Results")
print("=" * 50)
print("Project:", root)
print()

critical = 0
for name, path in files.items():
    if not path.exists():
        print(f"[MISSING] {name}")
        continue

    content = path.read_text()
    issues = []

    if "sweetAlert" in content:
        issues.append("CRITICAL: sweetAlert undefined")
        critical += 1
    if "Animated.View" in content and "Animated," not in content.split("from 'react-native-reanimated'")[0]:
        issues.append("CRITICAL: Missing Animated import")
        critical += 1
    if "isBiometricEnabled" in content and "useSecurity" in content:
        # Check if destructured properly
        section = content.split("useSecurity()")[1][:500] if "useSecurity()" in content else ""
        if "isBiometricEnabled" not in section:
            issues.append("CRITICAL: isBiometricEnabled not destructured")
            critical += 1
    if "showToast(" in content:
        issues.append("WARNING: Uses showToast instead of hook")
    if "console.log(" in content and "__DEV__" not in content:
        issues.append("WARNING: Console logs without __DEV__")

    if issues:
        print(f"[ISSUES] {name}: {len(issues)}")
        for issue in issues:
            print(f"         - {issue}")
    else:
        print(f"[OK] {name}")

print()
print("=" * 50)
if critical > 0:
    print(f"CRITICAL ISSUES: {critical}")
    print("Run: python fix_littleloom_v6_2.py")
else:
    print("All clear! No critical issues found.")