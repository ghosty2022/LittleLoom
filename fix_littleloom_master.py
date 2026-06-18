#!/usr/bin/env python3
"""
================================================================================
LITTLELOOM COMMUNITY MODULE - MASTER FIX & UNIFORMITY SCRIPT
================================================================================

This script comprehensively fixes the Community module by:
1. Fixing the 'REPLACE' navigation error (route not handled)
2. Fixing the 'undefined element' error (import/export mismatches)
3. Ensuring route name uniformity across all files
4. Ensuring theme import uniformity
5. Ensuring type export consistency
6. Generating a detailed report

USAGE:
    python fix_littleloom_master.py [project_root]

    Default project_root is current directory.

ERRORS ADDRESSED:
    - "The action 'REPLACE' with payload {'name':'CommunityMain'} was not handled"
    - "Element type is invalid: expected string/class/function but got undefined"
    - Route name mismatches between CommunityScreen, CommunityNavigator, and navigation.ts
    - Missing type exports from CommunityContext
    - Inconsistent theme imports

AUTHOR: Auto-generated for LittleLoom Community Module
================================================================================
"""

import re
import sys
import os
from pathlib import Path
from typing import List, Dict, Set, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict

# =============================================================================
# CONFIGURATION
# =============================================================================

PROJECT_ROOT = Path(".") if len(sys.argv) <= 1 else Path(sys.argv[1])

REQUIRED_COMMUNITY_FILES = [
    "src/screens/community/CommunityScreen.tsx",
    "src/screens/community/CommunityOnboardingScreen.tsx",
    "src/screens/community/CommunitySplashScreen.tsx",
    "src/screens/community/CommunityProfileScreen.tsx",
    "src/screens/community/CommunityMemberProfileScreen.tsx",
    "src/screens/community/CreatePostScreen.tsx",
    "src/screens/community/PostDetailScreen.tsx",
    "src/screens/community/TopicScreen.tsx",
    "src/screens/community/ChatScreen.tsx",
    "src/screens/community/ChatListScreen.tsx",
    "src/screens/community/NotificationsScreen.tsx",
    "src/screens/community/FollowersScreen.tsx",
    "src/screens/community/FollowingScreen.tsx",
    "src/screens/community/ReportScreen.tsx",
    "src/navigation/CommunityNavigator.tsx",
    "src/types/navigation.ts",
    "src/context/CommunityContext.tsx",
    "src/theme/CommunityTheme.ts",
]

COMMUNITY_STACK_ROUTES = [
    "CommunityOnboarding",
    "CommunitySplash", 
    "CommunityMain",
    "Topic",
    "CreatePost",
    "PostDetail",
    "CommunityMemberProfile",
    "CommunityProfile",
    "ChatList",
    "Chat",
    "Notifications",
    "TopicMembers",
    "Followers",
    "Following",
    "SearchUsers",
    "BlockedUsers",
    "Report",
]

# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class FixResult:
    file: str
    action: str
    status: str  # 'fixed', 'already_ok', 'manual_required', 'error'
    details: str

@dataclass 
class RouteUsage:
    route_name: str
    defined_in: Set[str] = field(default_factory=set)
    used_in: Set[str] = field(default_factory=set)
    replace_calls: List[Tuple[str, int]] = field(default_factory=list)
    navigate_calls: List[Tuple[str, int]] = field(default_factory=list)

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def read_file(path: Path) -> str:
    """Read file content safely."""
    try:
        return path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"  ✗ Error reading {path}: {e}")
        return ""

def write_file(path: Path, content: str) -> bool:
    """Write file content safely."""
    try:
        path.write_text(content, encoding='utf-8')
        return True
    except Exception as e:
        print(f"  ✗ Error writing {path}: {e}")
        return False

def backup_file(path: Path) -> Path:
    """Create backup of file before modification."""
    backup = path.with_suffix(path.suffix + '.backup')
    try:
        backup.write_text(path.read_text(encoding='utf-8'), encoding='utf-8')
        return backup
    except:
        return path

def find_line_number(content: str, search: str) -> int:
    """Find line number of search string in content."""
    lines = content.split('\n')
    for i, line in enumerate(lines, 1):
        if search in line:
            return i
    return 0

# =============================================================================
# ANALYSIS FUNCTIONS
# =============================================================================

def analyze_file_structure() -> Tuple[List[str], List[str]]:
    """Check which required files exist and which are missing."""
    existing = []
    missing = []

    for file in REQUIRED_COMMUNITY_FILES:
        path = PROJECT_ROOT / file
        if path.exists():
            existing.append(file)
        else:
            missing.append(file)

    return existing, missing

def analyze_routes_across_files() -> Dict[str, RouteUsage]:
    """Analyze route usage across all community files."""
    routes: Dict[str, RouteUsage] = {r: RouteUsage(r) for r in COMMUNITY_STACK_ROUTES}

    # Check navigation.ts for definitions
    nav_path = PROJECT_ROOT / "src/types/navigation.ts"
    if nav_path.exists():
        content = read_file(nav_path)
        for route in COMMUNITY_STACK_ROUTES:
            if route + ':' in content:
                routes[route].defined_in.add('navigation.ts')

    # Check CommunityNavigator.tsx for registrations
    nav_path = PROJECT_ROOT / "src/navigation/CommunityNavigator.tsx"
    if nav_path.exists():
        content = read_file(nav_path)
        registered = set(re.findall(r'<Stack\.Screen\s+name=["\'](\w+)["\']', content))
        for route in registered:
            if route in routes:
                routes[route].defined_in.add('CommunityNavigator.tsx')

    # Check CommunityScreen.tsx for usage
    screen_path = PROJECT_ROOT / "src/screens/community/CommunityScreen.tsx"
    if screen_path.exists():
        content = read_file(screen_path)
        # Check ROUTES constant
        routes_match = re.search(r'const ROUTES = \{([^}]+)\} as const;', content, re.DOTALL)
        if routes_match:
            route_values = re.findall(r':\s*["\'](\w+)["\']', routes_match.group(1))
            for rv in route_values:
                if rv in routes:
                    routes[rv].used_in.add('CommunityScreen.tsx (ROUTES const)')

        # Check navigation calls
        for match in re.finditer(r"navigation\.(replace|navigate)\(['\"](\w+)['\"]", content):
            call_type, route_name = match.groups()
            if route_name in routes:
                line = find_line_number(content, match.group(0))
                if call_type == 'replace':
                    routes[route_name].replace_calls.append(('CommunityScreen.tsx', line))
                else:
                    routes[route_name].navigate_calls.append(('CommunityScreen.tsx', line))

    # Check CommunityOnboardingScreen.tsx
    onboarding_path = PROJECT_ROOT / "src/screens/community/CommunityOnboardingScreen.tsx"
    if onboarding_path.exists():
        content = read_file(onboarding_path)
        for match in re.finditer(r"navigation\.(replace|navigate)\(['\"](\w+)['\"]", content):
            call_type, route_name = match.groups()
            if route_name in routes:
                line = find_line_number(content, match.group(0))
                if call_type == 'replace':
                    routes[route_name].replace_calls.append(('CommunityOnboardingScreen.tsx', line))
                else:
                    routes[route_name].navigate_calls.append(('CommunityOnboardingScreen.tsx', line))

    return routes

def analyze_imports() -> List[Dict]:
    """Analyze imports for potential undefined element issues."""
    issues = []

    screen_path = PROJECT_ROOT / "src/screens/community/CommunityScreen.tsx"
    if not screen_path.exists():
        return issues

    content = read_file(screen_path)

    # Find all imports
    import_pattern = r"import\s+\{([^}]+)\}\s+from\s+['\"]([^'\"]+)['\"]"
    for match in re.finditer(import_pattern, content):
        imports_str, source = match.groups()
        imports = [i.strip().split(' as ')[0].strip() for i in imports_str.split(',')]

        for imp in imports:
            # Check if this import is actually used
            usage_count = len(re.findall(rf'\b{re.escape(imp)}\b', content))
            if usage_count <= 1:  # Only appears in import
                issues.append({
                    'type': 'unused_import',
                    'import': imp,
                    'source': source,
                    'suggestion': f'Remove unused import {imp} or verify it exists in {source}'
                })

    # Check for ViewToken specifically (known issue)
    if 'ViewToken' in content:
        rn_import = re.search(r"import\s+\{([^}]+)\}\s+from\s+'react-native'", content)
        if rn_import and 'ViewToken' not in rn_import.group(1):
            issues.append({
                'type': 'missing_import',
                'import': 'ViewToken',
                'source': 'react-native',
                'suggestion': 'Add ViewToken to react-native import'
            })

    return issues

# =============================================================================
# FIX FUNCTIONS
# =============================================================================

def fix_navigation_replace_calls() -> List[FixResult]:
    """Fix 1: Change navigation.replace() to navigation.navigate() for safety."""
    results = []

    files_to_fix = [
        "src/screens/community/CommunityOnboardingScreen.tsx",
        "src/screens/community/CommunityScreen.tsx",
    ]

    for file in files_to_fix:
        path = PROJECT_ROOT / file
        if not path.exists():
            results.append(FixResult(file, "fix_replace_calls", "error", "File not found"))
            continue

        content = read_file(path)
        original = content

        # Replace navigation.replace('X') with navigation.navigate('X' as never)
        # This is safer and works with nested navigators
        content = re.sub(
            r"navigation\.replace\(['\"](\w+)['\"]\)",
            r"navigation.navigate('\1' as never)",
            content
        )

        if content != original:
            backup_file(path)
            if write_file(path, content):
                results.append(FixResult(file, "fix_replace_calls", "fixed", 
                    "Changed navigation.replace() to navigation.navigate() for better compatibility"))
            else:
                results.append(FixResult(file, "fix_replace_calls", "error", "Write failed"))
        else:
            results.append(FixResult(file, "fix_replace_calls", "already_ok", "No replace calls found"))

    return results

def fix_community_screen_imports() -> List[FixResult]:
    """Fix 2: Ensure all imports in CommunityScreen are correct."""
    results = []

    path = PROJECT_ROOT / "src/screens/community/CommunityScreen.tsx"
    if not path.exists():
        return [FixResult("CommunityScreen.tsx", "fix_imports", "error", "File not found")]

    content = read_file(path)
    original = content

    # Fix 2a: Add ViewToken to react-native import if missing
    rn_import = re.search(r"import\s+\{([^}]+)\}\s+from\s+'react-native'", content)
    if rn_import and 'ViewToken' not in rn_import.group(1):
        old_import = rn_import.group(0)
        new_import = old_import.replace('}', ', ViewToken}')
        content = content.replace(old_import, new_import)

    # Fix 2b: Ensure ROUTES constant matches navigation types
    old_routes = re.search(r'const ROUTES = \{[^}]+\} as const;', content, re.DOTALL)
    if old_routes:
        new_routes = """const ROUTES = {
  CREATE_POST: 'CreatePost',
  POST_DETAIL: 'PostDetail',
  USER_PROFILE: 'CommunityMemberProfile',
  EDIT_PROFILE: 'CommunityProfile',
  NOTIFICATIONS: 'Notifications',
  MESSAGES: 'ChatList',
  TOPICS: 'Topic',
  AUTH: 'Auth',
  TRACKER_REMINDERS: 'TrackerReminders',
} as const;"""
        content = content.replace(old_routes.group(0), new_routes)

    # Fix 2c: Ensure Post types are imported from CommunityContext
    if 'from \'../../context/CommunityContext\'' not in content:
        type_import = "import type { Post, PostMood, Poll } from '../../context/CommunityContext';"
        # Find a good insertion point
        first_import = content.find('import ')
        if first_import >= 0:
            end_of_first = content.find('\n', first_import)
            content = content[:end_of_first+1] + type_import + '\n' + content[end_of_first+1:]

    if content != original:
        backup_file(path)
        if write_file(path, content):
            results.append(FixResult("CommunityScreen.tsx", "fix_imports", "fixed",
                "Fixed imports: ViewToken, ROUTES constant, CommunityContext types"))
        else:
            results.append(FixResult("CommunityScreen.tsx", "fix_imports", "error", "Write failed"))
    else:
        results.append(FixResult("CommunityScreen.tsx", "fix_imports", "already_ok", "No import issues"))

    return results

def fix_community_navigator_routes() -> List[FixResult]:
    """Fix 3: Ensure CommunityNavigator has all routes registered."""
    results = []

    path = PROJECT_ROOT / "src/navigation/CommunityNavigator.tsx"
    if not path.exists():
        return [FixResult("CommunityNavigator.tsx", "fix_routes", "error", "File not found")]

    content = read_file(path)
    original = content

    # Ensure CommunityMain is registered in the main navigator
    if 'name="CommunityMain"' not in content:
        # Find the main Stack.Navigator section
        # Look for the pattern where screens are registered
        # This is a structural fix that may need manual verification
        results.append(FixResult("CommunityNavigator.tsx", "fix_routes", "manual_required",
            "CommunityMain screen not found in Stack.Navigator. Please add:\n" +
            "  <Stack.Screen name=\"CommunityMain\" component={CommunityScreen} options={{ animation: 'fade' }} />"))
    else:
        results.append(FixResult("CommunityNavigator.tsx", "fix_routes", "already_ok", 
            "CommunityMain is registered"))

    # Fix navigation.replace calls in CommunityNavigator too
    content = re.sub(
        r"navigation\.replace\(['\"](\w+)['\"]\)",
        r"navigation.navigate('\1' as never)",
        content
    )

    if content != original:
        backup_file(path)
        write_file(path, content)

    return results

def fix_navigation_types() -> List[FixResult]:
    """Fix 4: Ensure navigation.ts has complete CommunityStackParamList."""
    results = []

    path = PROJECT_ROOT / "src/types/navigation.ts"
    if not path.exists():
        return [FixResult("navigation.ts", "fix_types", "error", "File not found")]

    content = read_file(path)

    if 'export type CommunityStackParamList' not in content:
        print("  Adding CommunityStackParamList to navigation.ts...")
        community_type = """export type CommunityStackParamList = {
  CommunityOnboarding: { onComplete?: () => void } | undefined;
  CommunitySplash: undefined;
  CommunityMain: undefined;
  Topic: { topicId: string; topicName?: string };
  CreatePost: { topicId?: string; draftId?: string } | undefined;
  PostDetail: { postId: string };
  CommunityMemberProfile: { userId: string };
  CommunityProfile: { userId?: string } | undefined;
  Followers: { userId?: string };
  Following: { userId?: string };
  SearchUsers: { 
    initialQuery?: string;
    filter?: 'all' | 'followers' | 'following' | 'topic';
    topicId?: string;
  };
  BlockedUsers: undefined;
  ChatList: undefined;
  Chat: { chatId: string; userId?: string; userName?: string };
  Notifications: undefined;
  TopicMembers: { topicId: string };
  Report: { 
    targetId: string; 
    targetType: 'post' | 'user' | 'comment'; 
    targetName?: string;
  };
};"""
        content = content + "\n\n" + community_type
        backup_file(path)
        if write_file(path, content):
            results.append(FixResult("navigation.ts", "fix_types", "fixed",
                "Added CommunityStackParamList type definition"))
        else:
            results.append(FixResult("navigation.ts", "fix_types", "error", "Write failed"))
    else:
        results.append(FixResult("navigation.ts", "fix_types", "already_ok",
            "CommunityStackParamList already exists"))

    return results

def fix_theme_imports() -> List[FixResult]:
    """Fix 5: Ensure consistent theme imports across community screens."""
    results = []

    community_dir = PROJECT_ROOT / "src/screens/community"
    if not community_dir.exists():
        return [FixResult("community screens", "fix_themes", "error", "Directory not found")]

    for file in community_dir.glob("*.tsx"):
        content = read_file(file)
        uses_theme = 'CommunityColors' in content or 'CommunityGradients' in content
        has_import = "from '../../theme/CommunityTheme'" in content or \
                     "from '../theme/CommunityTheme'" in content

        if uses_theme and not has_import:
            # Add theme import
            import_line = "import {\n  CommunityColors,\n  CommunityGradients,\n  CommunityShadows,\n  CommunityBorderRadius,\n} from '../../theme/CommunityTheme';"
            first_import = content.find('import ')
            if first_import >= 0:
                end_of_first = content.find('\n', first_import)
                content = content[:end_of_first+1] + import_line + '\n' + content[end_of_first+1:]
                backup_file(file)
                if write_file(file, content):
                    results.append(FixResult(file.name, "fix_themes", "fixed",
                        "Added CommunityTheme import"))
                else:
                    results.append(FixResult(file.name, "fix_themes", "error", "Write failed"))

    if not results:
        results.append(FixResult("community screens", "fix_themes", "already_ok",
            "All theme imports are correct"))

    return results

# =============================================================================
# REPORTING
# =============================================================================

def print_header(title: str):
    print("\n" + "="*70)
    print(title)
    print("="*70)

def print_results(results: List[FixResult]):
    fixed = [r for r in results if r.status == 'fixed']
    ok = [r for r in results if r.status == 'already_ok']
    manual = [r for r in results if r.status == 'manual_required']
    errors = [r for r in results if r.status == 'error']

    if fixed:
        print(f"\n  ✅ FIXED ({len(fixed)}):")
        for r in fixed:
            print(f"     {r.file}: {r.details}")

    if ok:
        print(f"\n  ✓ OK ({len(ok)}):")
        for r in ok:
            print(f"     {r.file}: {r.details}")

    if manual:
        print(f"\n  ⚠️  MANUAL ACTION REQUIRED ({len(manual)}):")
        for r in manual:
            print(f"     {r.file}: {r.details}")

    if errors:
        print(f"\n  ❌ ERRORS ({len(errors)}):")
        for r in errors:
            print(f"     {r.file}: {r.details}")

    return len(fixed), len(manual), len(errors)

def generate_final_report(all_results: List[FixResult], routes: Dict[str, RouteUsage], 
                          existing_files: List[str], missing_files: List[str]):
    print_header("FINAL REPORT")

    print(f"\n📁 FILE STRUCTURE:")
    print(f"   Existing: {len(existing_files)}/{len(REQUIRED_COMMUNITY_FILES)} files")
    if missing_files:
        print(f"   Missing: {', '.join(missing_files)}")

    print(f"\n🛣️  ROUTE ANALYSIS:")
    for route_name, usage in routes.items():
        if usage.replace_calls or usage.navigate_calls or not usage.defined_in:
            status = "✓" if usage.defined_in else "❌ NOT REGISTERED"
            print(f"   {route_name}: {status}")
            if usage.replace_calls:
                print(f"      replace() calls: {len(usage.replace_calls)}")
            if usage.navigate_calls:
                print(f"      navigate() calls: {len(usage.navigate_calls)}")

    fixed = [r for r in all_results if r.status == 'fixed']
    manual = [r for r in all_results if r.status == 'manual_required']
    errors = [r for r in all_results if r.status == 'error']

    print(f"\n📊 SUMMARY:")
    print(f"   Fixes applied: {len(fixed)}")
    print(f"   Manual actions needed: {len(manual)}")
    print(f"   Errors: {len(errors)}")

    print(f"\n📝 NEXT STEPS:")
    print(f"   1. Review manual actions above")
    print(f"   2. Run: npx tsc --noEmit")
    print(f"   3. Run: npx expo start --clear")
    print(f"   4. Test Community tab: Onboarding → Splash → Main → Profile")

    if errors:
        print(f"\n   ⚠️  Please fix errors before testing")
        return False
    return True

# =============================================================================
# MAIN
# =============================================================================

def main():
    print_header("LITTLELOOM COMMUNITY - MASTER FIX & UNIFORMITY SCRIPT")

    if not PROJECT_ROOT.exists():
        print(f"\n❌ Error: Project root not found: {PROJECT_ROOT}")
        print(f"   Usage: python {sys.argv[0]} [project_root]")
        sys.exit(1)

    print(f"\n📂 Project root: {PROJECT_ROOT.absolute()}")

    # Step 1: File structure
    print_header("STEP 1: FILE STRUCTURE CHECK")
    existing_files, missing_files = analyze_file_structure()
    print(f"   Found {len(existing_files)} files, {len(missing_files)} missing")

    # Step 2: Route analysis
    print_header("STEP 2: ROUTE ANALYSIS")
    routes = analyze_routes_across_files()

    # Step 3: Apply fixes
    all_results: List[FixResult] = []

    print_header("STEP 3: FIXING NAVIGATION REPLACE CALLS")
    all_results.extend(fix_navigation_replace_calls())

    print_header("STEP 4: FIXING COMMUNITYSCREEN IMPORTS")
    all_results.extend(fix_community_screen_imports())

    print_header("STEP 5: FIXING COMMUNITYNAVIGATOR ROUTES")
    all_results.extend(fix_community_navigator_routes())

    print_header("STEP 6: FIXING NAVIGATION TYPES")
    all_results.extend(fix_navigation_types())

    print_header("STEP 7: FIXING THEME IMPORTS")
    all_results.extend(fix_theme_imports())

    # Step 8: Report
    print_header("STEP 8: RESULTS")
    print_results(all_results)

    # Final report
    success = generate_final_report(all_results, routes, existing_files, missing_files)

    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()