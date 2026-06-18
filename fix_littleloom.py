#!/usr/bin/env python3
"""
LittleLoom Security Diagnostic Tool
====================================
Analyzes all security/auth files and reports exact issues found.
Run this BEFORE the fixer to see what needs fixing.
"""

import os
import re
import json
from pathlib import Path

class Colors:
    HEADER = '\033[95m'; OKBLUE = '\033[94m'; OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'; WARNING = '\033[93m'; FAIL = '\033[91m'
    ENDC = '\033[0m'; BOLD = '\033[1m'

def find_project():
    cwd = Path.cwd()
    for p in [cwd] + list(cwd.parents)[:5]:
        if (p / "src" / "context" / "SecurityContext.tsx").exists():
            return p
    username = os.environ.get("USERNAME", os.environ.get("USER", ""))
    for base in [Path.home() / "Desktop", Path.home() / "Documents", Path("C:/Users") / username / "Desktop"]:
        if (base / "LittleLoom" / "src" / "context" / "SecurityContext.tsx").exists():
            return base / "LittleLoom"
    return None

def check_file(path, checks):
    """Run diagnostic checks on a file"""
    if not path.exists():
        return [("MISSING", f"File not found: {path}")]

    content = path.read_text(encoding='utf-8')
    issues = []

    for check_name, pattern, severity, message in checks:
        if callable(pattern):
            result = pattern(content)
            if result:
                issues.append((severity, f"{check_name}: {message}"))
        elif pattern in content:
            issues.append((severity, f"{check_name}: {message}"))

    return issues

def main():
    print(f"{Colors.HEADER}{Colors.BOLD}")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║     LittleLoom Security Diagnostic Tool                   ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print(f"{Colors.ENDC}")

    root = find_project()
    if not root:
        print(f"{Colors.FAIL}ERROR: Cannot find LittleLoom project{Colors.ENDC}")
        print("Run this script from inside the LittleLoom directory")
        return

    print(f"{Colors.OKGREEN}Project: {root}{Colors.ENDC}\n")
    src = root / "src"

    # Define checks for each file
    diagnostics = {
        "SecurityContext.tsx": {
            "path": src / "context" / "SecurityContext.tsx",
            "checks": [
                ("sweetAlert", "sweetAlert", "CRITICAL", "Uses undefined 'sweetAlert' variable - WILL CRASH"),
                ("direct_exports", lambda c: "isBiometricEnabled: state.settings.isBiometricEnabled" not in c, "CRITICAL", "Missing direct isBiometricEnabled export"),
                ("iconFilled", lambda c: "iconFilled" not in c, "WARNING", "Missing iconFilled in BiometricTypeConfig"),
                ("label_field", lambda c: "label: string" not in c, "WARNING", "Missing label field in BiometricTypeConfig"),
                ("gradient_field", lambda c: "gradient?:" not in c, "INFO", "Missing gradient field in BiometricTypeConfig"),
            ]
        },
        "AuthContext.tsx": {
            "path": src / "context" / "AuthContext.tsx",
            "checks": [
                ("console_logs", lambda c: "console.log(" in c and "__DEV__" not in c, "WARNING", "Console logs without __DEV__ guards"),
                ("regex_escape", "\\\\s+", "WARNING", "Double-escaped regex pattern \\\\s+"),
            ]
        },
        "LoginScreen.tsx": {
            "path": src / "screens" / "auth" / "LoginScreen.tsx",
            "checks": [
                ("animated_import", lambda c: "Animated.View" in c and "Animated," not in c.split("from 'react-native-reanimated'")[0], "CRITICAL", "Uses Animated.View without importing Animated from reanimated"),
                ("sweetAlert", "sweetAlert", "CRITICAL", "Uses undefined sweetAlert"),
            ]
        },
        "SignUpScreen.tsx": {
            "path": src / "screens" / "auth" / "SignUpScreen.tsx",
            "checks": [
                ("animated_import", lambda c: "Animated.View" in c and "Animated," not in c.split("from 'react-native-reanimated'")[0], "CRITICAL", "Uses Animated.View without importing Animated from reanimated"),
            ]
        },
        "ForgotPasswordScreen.tsx": {
            "path": src / "screens" / "auth" / "ForgotPasswordScreen.tsx",
            "checks": [
                ("inline_sweetalert", "const SweetAlert = ", "WARNING", "Has inline SweetAlert component instead of using hook"),
                ("custom_showtoast", "const showToast = ", "WARNING", "Has custom showToast instead of hook methods"),
                ("showToast_calls", "showToast(", "WARNING", "Uses showToast instead of showError/showSuccess"),
            ]
        },
        "SecurityLockScreen.tsx": {
            "path": src / "screens" / "security" / "SecurityLockScreen.tsx",
            "checks": [
                ("biometric_access", lambda c: "isBiometricEnabled" in c and "biometricEnabled" not in c and "useSecurity" in c, "WARNING", "Uses isBiometricEnabled without safety fallback"),
                ("scanning_styles", lambda c: "scanningRing" not in c, "INFO", "Missing scanning animation styles"),
            ]
        },
        "SecurityCenterScreen.tsx": {
            "path": src / "screens" / "security" / "SecurityCenterScreen.tsx",
            "checks": [
                ("biometric_destructure", lambda c: "isBiometricEnabled" not in c.split("useSecurity")[1].split("}")[0] if "useSecurity" in c else False, "CRITICAL", "isBiometricEnabled not destructured from useSecurity"),
                ("useMemo_import", lambda c: "useMemo" not in c, "WARNING", "Missing useMemo import"),
                ("unmemoized_score", "const score = getSecurityScore();", "WARNING", "Score calculation not memoized"),
            ]
        },
        "BiometricSetupScreen.tsx": {
            "path": src / "screens" / "security" / "BiometricSetupScreen.tsx",
            "checks": [
                ("duplicate_interpolate", "import { interpolate } from 'react-native-reanimated';", "WARNING", "Duplicate interpolate import (also in Animated from RN)"),
                ("iconFilled_support", lambda c: "iconFilled" not in c, "INFO", "Missing iconFilled support"),
            ]
        },
        "AppContext.tsx": {
            "path": src / "context" / "AppContext.tsx",
            "checks": [
                ("null_safety", lambda c: "customization.isLoaded" in c and "customization?.isLoaded" not in c, "WARNING", "Missing null safety for customization"),
            ]
        },
    }

    total_issues = 0
    critical_issues = 0

    for filename, diag in diagnostics.items():
        issues = check_file(diag["path"], diag["checks"])

        if not issues:
            print(f"{Colors.OKGREEN}✓ {filename:<30} CLEAN{Colors.ENDC}")
            continue

        has_critical = any(sev == "CRITICAL" for sev, _ in issues)
        color = Colors.FAIL if has_critical else Colors.WARNING
        print(f"{color}⚠ {filename:<30} {len(issues)} issue(s){Colors.ENDC}")

        for severity, message in issues:
            if severity == "CRITICAL":
                print(f"   {Colors.FAIL}[CRIT] {message}{Colors.ENDC}")
                critical_issues += 1
            elif severity == "WARNING":
                print(f"   {Colors.WARNING}[WARN] {message}{Colors.ENDC}")
            else:
                print(f"   {Colors.OKBLUE}[INFO] {message}{Colors.ENDC}")
            total_issues += 1

    print(f"\n{Colors.HEADER}{'='*60}{Colors.ENDC}")
    print(f"Total issues: {total_issues} (Critical: {critical_issues})")

    if critical_issues > 0:
        print(f"\n{Colors.FAIL}⚠ {critical_issues} CRITICAL issues found!{Colors.ENDC}")
        print(f"{Colors.OKCYAN}Run fix_littleloom_v6_1.py to auto-fix all issues{Colors.ENDC}")
    elif total_issues > 0:
        print(f"\n{Colors.WARNING}⚠ {total_issues} non-critical issues found{Colors.ENDC}")
        print(f"{Colors.OKCYAN}Run fix_littleloom_v6_1.py to auto-fix{Colors.ENDC}")
    else:
        print(f"\n{Colors.OKGREEN}✓ All files clean! No fixes needed{Colors.ENDC}")

if __name__ == "__main__":
    main()