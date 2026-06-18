#!/usr/bin/env python3
"""
LittleLoom CommunityScreen Import Fix Script
=============================================
Diagnoses and fixes 'Element type is invalid' / import-export mismatches.

Usage:
  python fix_imports.py --file path/to/CommunityScreen.tsx
  python fix_imports.py --file path/to/CommunityScreen.tsx --dry-run
"""

import re
import argparse
import shutil
from pathlib import Path
from datetime import datetime


def backup_file(filepath: Path):
    bak = filepath.with_suffix(filepath.suffix + ".bak")
    if not bak.exists():
        shutil.copy2(filepath, bak)
        print(f"  [BACKUP] {bak.name}")


def analyze_and_fix(filepath: Path, dry_run: bool = False):
    print(f"\n[ANALYZING] {filepath}")
    if not dry_run:
        backup_file(filepath)

    content = filepath.read_text(encoding="utf-8")
    original = content
    changes = []

    # =====================================================================
    # DIAGNOSTIC: List all imports
    # =====================================================================
    print("\n  [IMPORTS FOUND]")
    imports = re.findall(r"^import\s+.*?from\s+['\"](.+?)['\"];\s*$", content, re.MULTILINE)
    for imp in imports:
        print(f"    → {imp}")

    # =====================================================================
    # FIX 1: SafeAvatar — SafeAvatar.tsx HAS default export at bottom
    #        So `import SafeAvatar from ...` is CORRECT.
    #        If script previously broke it, ensure it's default import.
    # =====================================================================
    safeavatar_named = re.search(
        r"import\s+\{\s*SafeAvatar\s*\}\s+from\s+['\"]../../components/SafeAvatar['\"];",
        content
    )
    safeavatar_default = re.search(
        r"import\s+SafeAvatar\s+from\s+['\"]../../components/SafeAvatar['\"];",
        content
    )

    if safeavatar_named:
        print("    ⚠ SafeAvatar uses NAMED import — SafeAvatar.tsx HAS default export")
        print("      Changing to default import...")
        content = re.sub(
            r"import\s+\{\s*SafeAvatar\s*\}\s+from\s+(['\"]../../components/SafeAvatar['\"]);",
            r"import SafeAvatar from \1;",
            content
        )
        changes.append("FIX 1: SafeAvatar → default import (matches SafeAvatar.tsx export)")
    elif safeavatar_default:
        print("    ✓ SafeAvatar already uses default import")
    else:
        print("    ? SafeAvatar import not found or unusual format")

    # =====================================================================
    # FIX 2: Check ALL component imports for similar issues
    # =====================================================================

    # Check for any named imports from components that might only have default exports
    component_imports = re.findall(
        r"import\s+\{([^}]+)\}\s+from\s+['\"](\.+?/components/[^'\"]+)['\"];",
        content
    )

    for imported_names, module_path in component_imports:
        names = [n.strip() for n in imported_names.split(",")]
        print(f"    [COMPONENT IMPORT] {module_path}: {names}")

        # If EmptyState is imported as named, check if it should be default
        if "EmptyState" in names:
            print(f"      ⚠ EmptyState uses named import — verify EmptyState.tsx exports")

    # =====================================================================
    # FIX 3: Check for missing/undefined component references in JSX
    # =====================================================================

    # Find all JSX component usages: <ComponentName ...>
    jsx_components = set(re.findall(r"<([A-Z][a-zA-Z0-9]*)", content))
    print(f"\n  [JSX COMPONENTS USED]: {', '.join(sorted(jsx_components))}")

    # Find all imported identifiers
    imported_defaults = set(re.findall(r"import\s+([A-Z][a-zA-Z0-9]*)\s+from", content))
    imported_named = set()
    for match in re.findall(r"import\s+\{([^}]+)\}\s+from", content):
        imported_named.update(n.strip().split(" as ")[0].strip() for n in match.split(","))

    all_imported = imported_defaults | imported_named
    print(f"  [IMPORTED IDENTIFIERS]: {', '.join(sorted(all_imported))}")

    undefined_components = jsx_components - all_imported - {
        'View', 'Text', 'Image', 'ScrollView', 'FlatList', 'TouchableOpacity',
        'Pressable', 'TextInput', 'Modal', 'ActivityIndicator', 'Button',
        'StatusBar', 'Share', 'RefreshControl', 'GestureHandlerRootView',
        'Animated', 'BlurView', 'LinearGradient', 'Ionicons', 'VideoView',
        'SafeAvatar', 'EmptyState'
    }

    if undefined_components:
        print(f"\n  🔴 UNDEFINED COMPONENTS (will cause 'Element type is invalid'):")
        for comp in undefined_components:
            print(f"      → {comp}")
    else:
        print(f"\n  ✓ All JSX components appear to be imported")

    # =====================================================================
    # FIX 4: Check for duplicate component definitions (causes undefined)
    # =====================================================================
    component_defs = re.findall(r"(?:const|function)\s+([A-Z][a-zA-Z0-9]*)\s*[=\(]", content)
    duplicates = {name for name in component_defs if component_defs.count(name) > 1}
    if duplicates:
        print(f"\n  🔴 DUPLICATE COMPONENT DEFINITIONS: {', '.join(duplicates)}")
        changes.append(f"WARNING: Duplicate definitions found: {duplicates}")

    # =====================================================================
    # FIX 5: Check for orphaned code (code outside any function/component)
    # =====================================================================
    # After the last `});` or `}`, there shouldn't be standalone statements
    # that look like component code

    # Look for return statements that aren't inside a function
    lines = content.split('\n')
    in_function = False
    function_depth = 0
    orphaned_returns = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith('//') or stripped.startswith('*'):
            continue

        # Track function/component boundaries (simplified)
        if re.match(r'^(const|function|export\s+default\s+function)\s+\w+', stripped):
            in_function = True
            function_depth = 0

        if in_function:
            function_depth += stripped.count('{') - stripped.count('}')
            if function_depth <= 0 and stripped.endswith('};'):
                in_function = False

        if not in_function and stripped.startswith('return ('):
            orphaned_returns.append((i+1, stripped[:60]))

    if orphaned_returns:
        print(f"\n  🔴 ORPHANED return STATEMENTS (outside any function):")
        for line_num, text in orphaned_returns:
            print(f"      Line {line_num}: {text}...")
        changes.append("WARNING: Orphaned return statements detected")

    # =====================================================================
    # FIX 6: Check for the specific SmartVideoPlayer duplicate issue
    # =====================================================================
    smartvideo_count = content.count("const SmartVideoPlayer = React.memo")
    if smartvideo_count > 1:
        print(f"\n  🔴 SmartVideoPlayer defined {smartvideo_count} times!")
        changes.append("CRITICAL: SmartVideoPlayer has duplicate definitions")
    elif smartvideo_count == 1:
        print(f"\n  ✓ SmartVideoPlayer defined once")
    else:
        print(f"\n  ? SmartVideoPlayer not found")

    # =====================================================================
    # FIX 7: Check that useSweetAlert hook is imported and used correctly
    # =====================================================================
    if "useSweetAlert" in content:
        print(f"\n  ✓ useSweetAlert hook is used")
        # Check if it's called correctly
        if "const sweetAlert = useSweetAlert()" in content:
            print(f"    ✓ sweetAlert initialized correctly")
        else:
            print(f"    ⚠ useSweetAlert called but variable name might differ")
    else:
        print(f"\n  ? useSweetAlert not found in this file")

    # =====================================================================
    # FIX 8: Check ViewToken
    # =====================================================================
    if "ViewToken" in content:
        if "from 'react-native'" in content and "ViewToken" in content.split("from 'react-native'")[0].split("import")[-1]:
            print(f"\n  🔴 ViewToken still imported from 'react-native'")
            # Remove from react-native import
            content = re.sub(
                r"(\s*ViewToken,\s*\n|\s*,\s*ViewToken\s*\n)",
                "\n",
                content,
                count=1
            )
            # Add local type
            viewtoken_type = """\n// -- FIXED: ViewToken is not exported from react-native --
type ViewToken = {
  item: any;
  key: string;
  index: number | null;
  isViewable: boolean;
  section?: any;
};
"""
            last_import = None
            for m in re.finditer(r"^import\s+.*?from\s+['\"].*?['\"];\s*$", content, re.MULTILINE):
                last_import = m
            if last_import:
                pos = last_import.end()
                content = content[:pos] + viewtoken_type + content[pos:]
                changes.append("FIX 8: Moved ViewToken to local type definition")
        else:
            print(f"\n  ✓ ViewToken not in react-native import")

    # =====================================================================
    # SUMMARY
    # =====================================================================
    if content != original:
        if dry_run:
            print(f"\n  [DRY RUN] Would apply {len(changes)} changes:")
            for c in changes:
                print(f"    * {c}")
            print(f"  [DRY RUN] File NOT modified")
        else:
            filepath.write_text(content, encoding="utf-8")
            print(f"\n  [SAVED] {len(changes)} changes applied:")
            for c in changes:
                print(f"    ✓ {c}")
        return True
    else:
        print(f"\n  [NO FILE CHANGES] Analysis complete, no modifications needed")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Diagnose and fix CommunityScreen import/export issues",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--file", "-f", required=True, help="Path to CommunityScreen.tsx")
    parser.add_argument("--dry-run", "-d", action="store_true", help="Preview only")
    args = parser.parse_args()

    filepath = Path(args.file).resolve()
    if not filepath.exists():
        print(f"[ERROR] File not found: {filepath}")
        return 1

    print(f"\n{'='*65}")
    print(f"  LittleLoom CommunityScreen Import Diagnostic")
    print(f"  File: {filepath}")
    print(f"  Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*65}")

    analyze_and_fix(filepath, dry_run=args.dry_run)

    print(f"\n{'='*65}")
    print("  Done! Check output above for 🔴 issues to fix.")
    print(f"{'='*65}\n")
    return 0


if __name__ == "__main__":
    exit(main())