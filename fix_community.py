#!/usr/bin/env python3
"""
LittleLoom CommunityScreen Fix Script
=====================================
Fixes the actual issues in your CommunityScreen.tsx:
  1. Duplicate SmartVideoPlayer body (the 'return outside function' error)
  2. ViewToken import (not exported from react-native)
  3. sweetAlert prop drilling to child components
  4. SafeAvatar default vs named import
  5. Missing useEffect in React imports (for SmartVideoPlayer)

Usage:
  python fix_community.py --file path/to/CommunityScreen.tsx
  python fix_community.py --file path/to/CommunityScreen.tsx --dry-run
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


def fix_file(filepath: Path, dry_run: bool = False):
    print(f"\n[FIXING] {filepath}")
    if not dry_run:
        backup_file(filepath)

    content = filepath.read_text(encoding="utf-8")
    original = content
    changes = []

    # =====================================================================
    # FIX 1: Remove duplicate SmartVideoPlayer body (the 'return outside function' error)
    # =====================================================================
    # The bug: after the closing `});` of SmartVideoPlayer, there's a second
    # useEffect + return block that is orphaned. We need to remove everything
    # from the first `});` after SmartVideoPlayer up to (but not including)
    # the next component definition (ReactionBar).

    # Pattern: find the SmartVideoPlayer component and remove the duplicate
    # block that comes after its closing `});`
    smartvideo_pattern = r"(const SmartVideoPlayer = React\.memo\(\(\{ uri, isVisible \}.*?\}\);\s*\}\);)"
    match = re.search(smartvideo_pattern, content, re.DOTALL)
    if match:
        end_pos = match.end()
        # Check if there's orphaned code after this
        after = content[end_pos:]
        # Look for orphaned useEffect/return (not inside any function)
        orphaned = re.search(r"\s*useEffect\(\(\) => \{[\s\S]*?\}\);\s*return \(", after)
        if orphaned:
            # Find where the next const/const starts
            next_const = re.search(r"\n(const \w+ = React\.memo|const \w+ = \(|const \w+ = function)", after)
            if next_const:
                remove_start = end_pos
                remove_end = end_pos + next_const.start()
                content = content[:remove_start] + "\n\n" + content[remove_end:]
                changes.append("FIX 1: Removed duplicate orphaned SmartVideoPlayer code block")

    # Alternative approach: if the above didn't catch it, try direct removal
    # of the exact duplicate pattern
    duplicate_pattern = r"\}\);\s*\n\s*useEffect\(\(\) => \{\s*\n\s*if \(isVisible\) \{\s*\n\s*player\.play\(\);\s*\n\s*\} else \{\s*\n\s*player\.pause\(\);\s*\n\s*player\.currentTime = 0;\s*\n\s*\}\s*\n\s*\}, \[isVisible, player\]\);\s*\n\s*return \("
    if re.search(duplicate_pattern, content):
        # Find the position right before the orphaned block
        # We need to keep the first valid SmartVideoPlayer and remove the second
        # The second starts after the first `});` that closes React.memo
        parts = content.split("const SmartVideoPlayer = React.memo")
        if len(parts) == 2:
            # Find the first complete component end
            first_part = parts[0] + "const SmartVideoPlayer = React.memo" + parts[1]
            # Find where the first SmartVideoPlayer actually ends
            first_end = first_part.find("});\n\nconst ReactionBar")
            if first_end != -1:
                # Check if there's duplicate code between first_end and ReactionBar
                between = first_part[first_end:len(first_part) - len("const ReactionBar")]
                if "useEffect" in between and "return (" in between:
                    # Remove the duplicate
                    content = first_part[:first_end] + "});\n\nconst ReactionBar" + first_part[first_end + len("});\n\nconst ReactionBar") + len(between):]
                    changes.append("FIX 1b: Removed duplicate SmartVideoPlayer via split method")

    # =====================================================================
    # FIX 2: ViewToken import -> local type definition
    # =====================================================================
    if "ViewToken" in content and "from 'react-native'" in content:
        # Remove ViewToken from react-native import
        content = re.sub(
            r"(\s*ViewToken,\s*\n|\s*,\s*ViewToken\s*\n)",
            "\n",
            content,
            count=1
        )
        # Add local type definition after imports
        viewtoken_type = """\n// -- FIXED: ViewToken is not exported from react-native --
type ViewToken = {
  item: any;
  key: string;
  index: number | null;
  isViewable: boolean;
  section?: any;
};
"""
        # Insert after the last import
        last_import = None
        for m in re.finditer(r"^import\s+.*?from\s+['\"].*?['\"];\s*$", content, re.MULTILINE):
            last_import = m
        if last_import:
            pos = last_import.end()
            content = content[:pos] + viewtoken_type + content[pos:]
            changes.append("FIX 2: Replaced ViewToken import with local type")

    # =====================================================================
    # FIX 3: Add useEffect to React imports if missing
    # =====================================================================
    react_import_match = re.search(r"import React, \{([^}]+)\} from 'react';", content)
    if react_import_match:
        imports = react_import_match.group(1)
        if "useEffect" not in imports:
            new_imports = imports + ", useEffect"
            content = content.replace(
                f"import React, {{{imports}}} from 'react';",
                f"import React, {{{new_imports}}} from 'react';"
            )
            changes.append("FIX 3: Added useEffect to React imports")

    # =====================================================================
    # FIX 4: SafeAvatar import (default vs named)
    # =====================================================================
    if "import { SafeAvatar }" in content:
        content = content.replace(
            "import { SafeAvatar } from '../../components/SafeAvatar';",
            "import SafeAvatar from '../../components/SafeAvatar';"
        )
        changes.append("FIX 4: Changed SafeAvatar to default import")

    # =====================================================================
    # FIX 5: Add sweetAlert prop to components that use it
    # =====================================================================

    components_to_fix = [
        ("MomentsBar", "isDark,"),
        ("StoryViewer", "isDark,"),
        ("DailyWeavePrompt", "isDark,"),
        ("PollWidget", "isDark,"),
        ("PostCard", "isDark,"),
        ("GlassHeader", "isDark,"),
        ("SearchResults", "isDark,"),
    ]

    for comp_name, anchor in components_to_fix:
        pattern = rf"(const {comp_name} = React\.memo\(\(\{{[^}}]*?){anchor}\s*\n(\}}\):)"
        replacement = rf"\1{anchor}\n  sweetAlert,\n\2"
        new_content = re.sub(pattern, replacement, content)
        if new_content != content:
            content = new_content
            changes.append(f"FIX 5: Added sweetAlert prop to {comp_name}")

    # =====================================================================
    # FIX 6: Pass sweetAlert to component usages in JSX
    # =====================================================================

    usages_to_fix = [
        ("MomentsBar", "        "),
        ("StoryViewer", "          "),
        ("DailyWeavePrompt", "        "),
        ("GlassHeader", "          "),
        ("SearchResults", "            "),
        ("PostCard", "      "),
    ]

    for comp_name, indent in usages_to_fix:
        # Find JSX usage and add sweetAlert prop
        pattern = rf"(<{comp_name}[^>]*?)(isDark=\{{isDark\}})"
        replacement = rf"\1isDark={{isDark}}\n{indent}sweetAlert={{sweetAlert}}"
        new_content = re.sub(pattern, replacement, content)
        if new_content != content:
            content = new_content
            changes.append(f"FIX 6: Pass sweetAlert to {comp_name} usage")

    # =====================================================================
    # FIX 7: Add sweetAlert to useCallback dependency arrays that need it
    # =====================================================================

    # handleDelete
    if "const handleDelete = useCallback" in content:
        content = re.sub(
            r"(const handleDelete = useCallback\(\(postId: string\) => \{[\s\S]*?\}, \[)(deletePost)(\]\);)",
            r"\1deletePost, sweetAlert\3",
            content
        )
        if "deletePost, sweetAlert" in content:
            changes.append("FIX 7a: Added sweetAlert to handleDelete deps")

    # handleAddStory  
    if "const handleAddStory = useCallback" in content:
        content = re.sub(
            r"(\[canInteract, currentUser\?\.id, currentUser\?\.avatar)(\]\);)",
            r"\1, sweetAlert\2",
            content
        )
        if "currentUser?.avatar, sweetAlert" in content:
            changes.append("FIX 7b: Added sweetAlert to handleAddStory deps")

    # =====================================================================
    # SUMMARY
    # =====================================================================
    if content != original:
        if dry_run:
            print(f"  [DRY RUN] Would apply {len(changes)} changes:")
            for c in changes:
                print(f"    * {c}")
            print(f"  [DRY RUN] File NOT modified")
        else:
            filepath.write_text(content, encoding="utf-8")
            print(f"  [SAVED] {len(changes)} changes applied:")
            for c in changes:
                print(f"    ✓ {c}")
        return True
    else:
        print(f"  [NO CHANGES] File appears correct or patterns not found")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Fix LittleLoom CommunityScreen issues",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--file", "-f", required=True, help="Path to CommunityScreen.tsx")
    parser.add_argument("--dry-run", "-d", action="store_true", help="Preview changes without saving")
    args = parser.parse_args()

    filepath = Path(args.file).resolve()
    if not filepath.exists():
        print(f"[ERROR] File not found: {filepath}")
        return 1

    print(f"\n{'='*60}")
    print(f"  LittleLoom CommunityScreen Fix")
    print(f"  File: {filepath}")
    print(f"  Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    fix_file(filepath, dry_run=args.dry_run)

    print(f"\n{'='*60}")
    if args.dry_run:
        print("  DRY RUN complete. Remove --dry-run to apply.")
    else:
        print("  Done! Next steps:")
        print("    1. Clear Metro cache:  npx expo start --clear")
        print("    2. Check .bak file for original backup")
    print(f"{'='*60}\n")
    return 0


if __name__ == "__main__":
    exit(main())