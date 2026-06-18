#!/usr/bin/env python3
r"""
LittleLoom CommunityScreen Auto-Fix Script
==========================================
Fixes the crash preventing entry into CommunityScreen:
  1. ViewToken import (not exported from react-native)
  2. sweetAlert scope issues in PostCard/child components
  3. expo-video API mismatch (v2.0.6 vs old expo-av style)
  4. Missing Text import for placeholder

Usage:
  python fix_community.py --src-dir C:/Users/ondie/Desktop/LittleLoom/src
  python fix_community.py --src-dir ./src --dry-run
"""

import os
import re
import argparse
import shutil
from pathlib import Path
from datetime import datetime


def backup_file(filepath: Path):
    """Create a .bak backup of the original file."""
    bak = filepath.with_suffix(filepath.suffix + ".bak")
    if not bak.exists():
        shutil.copy2(filepath, bak)
        print(f"  [BACKUP] {bak.name}")


def fix_community_screen(filepath: Path, dry_run: bool = False):
    """Fix CommunityScreen.tsx - the main file with all the issues."""
    print(f"\n[FIXING] {filepath.name}")
    if not dry_run:
        backup_file(filepath)

    content = filepath.read_text(encoding="utf-8")
    original = content
    changes = []

    # =====================================================================
    # FIX 1: Remove ViewToken from react-native import, add local type
    # =====================================================================
    # ViewToken is NOT exported from 'react-native'. It is from @react-native/virtualized-lists
    # or we can define it locally.

    # Pattern 1: ViewToken on its own line in the import block
    if re.search(r"ViewToken,?\s*\n", content):
        content = re.sub(
            r"\s*ViewToken,?\s*\n",
            "\n",
            content,
            count=1
        )

        # Add local type definition before first interface
        viewtoken_type = """// -- FIXED: ViewToken is not exported from react-native --
type ViewToken = {
  item: any;
  key: string;
  index: number | null;
  isViewable: boolean;
  section?: any;
};

"""
        # Insert before first interface or const declaration at top level
        content = re.sub(
            r"^(interface\s+\w+",
            viewtoken_type + r"\1",
            content,
            count=1,
            flags=re.MULTILINE
        )
        changes.append("FIX 1: Replaced ViewToken import with local type definition")

    # =====================================================================
    # FIX 2: Remove expo-video imports (API mismatch with v2.0.6)
    # =====================================================================
    # expo-video ~2.0.6 has a completely different API than the old expo-av style.
    # The current code uses useVideoPlayer(uri, callback) which is the OLD API.
    # New API: const player = useVideoPlayer(videoSource, player => { ... })
    # We will replace with a placeholder to prevent crashes.

    expo_video_import = re.search(
        r"import\s*\{[^}]*?\}\s*from\s*['\"]expo-video['\"];\s*\n",
        content
    )
    if expo_video_import:
        content = content.replace(expo_video_import.group(0), "")
        changes.append("FIX 2: Removed expo-video import (v2.0.6 API incompatible with current usage)")

    # =====================================================================
    # FIX 3: Replace SmartVideoPlayer with safe placeholder
    # =====================================================================
    old_smart_video = re.search(
        r"const SmartVideoPlayer = React\.memo\(\(\{ uri, isVisible \}.*?\}\);",
        content,
        re.DOTALL
    )
    if old_smart_video:
        new_smart_video = """// -- FIXED: Replaced expo-video player with placeholder --
// TODO: Update for expo-video v2.0.6
// New API: import { VideoView, useVideoPlayer } from 'expo-video'
// const player = useVideoPlayer(videoSource, player => { player.loop = true; });
// <VideoView player={player} style={{ width: '100%', height: '100%' }} />
const SmartVideoPlayer = React.memo(({ uri, isVisible }: { uri: string; isVisible: boolean }) => {
  return (
    <View style={[styles.videoBox, { justifyContent: 'center', alignItems: 'center' }]}>
      <Ionicons name="videocam" size={40} color={LL.gray400} />
      <Text style={{ color: LL.gray400, marginTop: 8, fontSize: 13, fontWeight: '600' }}>
        Video playback
      </Text>
    </View>
  );
});"""
        content = content.replace(old_smart_video.group(0), new_smart_video)
        changes.append("FIX 3: Replaced SmartVideoPlayer with placeholder (prevents expo-video crash)")

    # =====================================================================
    # FIX 4: Add sweetAlert prop to PostCard and pass it from renderPost
    # =====================================================================
    # PostCard is defined at module scope but uses sweetAlert from CommunityScreen's closure.
    # This makes sweetAlert undefined when PostCard is rendered.

    # Step 4a: Add sweetAlert to PostCard destructured props
    postcard_start = content.find("const PostCard = React.memo(({")
    if postcard_start != -1:
        # Find the isDark prop and add sweetAlert after it
        postcard_header = content[postcard_start:postcard_start+800]
        if "sweetAlert" not in postcard_header:
            # Add sweetAlert after isDark in the destructuring
            content = content.replace(
                "isDark,\n}: {",
                "isDark,\n  sweetAlert,\n}: {"
            )
            # Add to type annotation
            content = content.replace(
                "isDark: boolean;\n}",
                "isDark: boolean;\n  sweetAlert: any;\n}",
                1  # Only replace first occurrence (PostCard's type)
            )
            changes.append("FIX 4a: Added sweetAlert prop to PostCard component")

    # Step 4b: Pass sweetAlert in renderPost
    if "sweetAlert={sweetAlert}" not in content:
        # Find the PostCard usage in renderPost and add sweetAlert prop
        content = content.replace(
            "isDark={isDark}\n    />",
            "isDark={isDark}\n      sweetAlert={sweetAlert}\n    />",
            1  # Only first occurrence
        )
        changes.append("FIX 4b: Pass sweetAlert prop in renderPost")

    # =====================================================================
    # FIX 5: Fix handleDelete dependency array to include sweetAlert
    # =====================================================================
    if "const handleDelete = useCallback" in content:
        # Find the dependency array for handleDelete
        delete_section = content.split("const handleDelete = useCallback")[1].split("const handleCommentSubmit")[0]
        if "[deletePost]" in delete_section and "sweetAlert" not in delete_section:
            content = content.replace(
                "}, [deletePost]);",
                "}, [deletePost, sweetAlert]);",
                1  # First occurrence only
            )
            changes.append("FIX 5: Added sweetAlert to handleDelete dependency array")

    # =====================================================================
    # FIX 6: Ensure Text is imported from react-native
    # =====================================================================
    # Our placeholder uses <Text> but we need to make sure it is imported
    rn_import = re.search(r"from 'react-native';", content)
    if rn_import:
        import_block = content[:rn_import.end()]
        if "Text," not in import_block and "Text\n" not in import_block:
            # Add Text to the react-native import
            content = content.replace(
                "  View,\n",
                "  View,\n  Text,\n",
                1
            )
            changes.append("FIX 6: Added Text import from react-native")

    # =====================================================================
    # FIX 7: Fix handleAddStory - add sweetAlert to deps
    # =====================================================================
    if "const handleAddStory = useCallback" in content:
        addstory_section = content.split("const handleAddStory = useCallback")[1].split("const handleStoryReply")[0]
        if "[canInteract, currentUser?.id, currentUser?.avatar, sweetAlert]" not in addstory_section:
            # Check current deps
            if "[canInteract, currentUser?.id, currentUser?.avatar]" in addstory_section:
                content = content.replace(
                    "[canInteract, currentUser?.id, currentUser?.avatar]",
                    "[canInteract, currentUser?.id, currentUser?.avatar, sweetAlert]"
                )
                changes.append("FIX 7: Added sweetAlert to handleAddStory dependency array")

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
                print(f"    OK {c}")
        return True
    else:
        print(f"  [NO CHANGES NEEDED] File appears correct")
        return False


def check_other_files(src_dir: Path):
    """Check related files for potential issues."""
    print(f"\n[CHECKING] Related files...")

    # Check CommunityNavigator
    navigator = src_dir / "navigation" / "CommunityNavigator.tsx"
    if navigator.exists():
        nav_content = navigator.read_text(encoding="utf-8")
        issues = []
        if "InlineSpinner" in nav_content:
            issues.append("Uses InlineSpinner - verify ../components/UniversalSpinner exists")
        if issues:
            print(f"  [CommunityNavigator.tsx]")
            for i in issues:
                print(f"    ! {i}")
        else:
            print(f"  [CommunityNavigator.tsx] OK")

    # Check CommunityTheme
    theme = src_dir / "theme" / "CommunityTheme.ts"
    if theme.exists():
        print(f"  [CommunityTheme.ts] OK - exists")

    # Check SafeAvatar
    safeavatar = src_dir / "components" / "SafeAvatar.tsx"
    if safeavatar.exists():
        sa_content = safeavatar.read_text(encoding="utf-8")
        if "export default" in sa_content:
            print(f"  [SafeAvatar.tsx] WARNING: Uses default export, but CommunityScreen imports named {{ SafeAvatar }}")
            print(f"    Fix: Change import to: import SafeAvatar from '../../components/SafeAvatar'")
        elif "export const SafeAvatar" in sa_content or "export function SafeAvatar" in sa_content:
            print(f"  [SafeAvatar.tsx] OK - named export matches import")
        else:
            print(f"  [SafeAvatar.tsx] WARNING - check export style")
    else:
        print(f"  [SafeAvatar.tsx] NOT FOUND - this will cause crash!")


def check_package_json(src_dir: Path):
    """Check package.json for relevant dependencies."""
    pkg_path = src_dir.parent / "package.json" if src_dir.name == "src" else src_dir / "package.json"
    if not pkg_path.exists():
        return

    import json
    with open(pkg_path) as f:
        pkg = json.load(f)

    deps = pkg.get("dependencies", {})
    print(f"\n[PACKAGE.JSON] Relevant dependencies:")
    print(f"  expo-video: {deps.get('expo-video', 'NOT INSTALLED')}")
    print(f"  expo-av: {deps.get('expo-av', 'NOT INSTALLED')}")
    print(f"  react-native-reanimated: {deps.get('react-native-reanimated', 'NOT INSTALLED')}")
    print(f"  @react-navigation/native-stack: {deps.get('@react-navigation/native-stack', 'NOT INSTALLED')}")

    if "expo-video" in deps:
        print(f"\n  [NOTE] expo-video {deps['expo-video']} detected.")
        print(f"         The old useVideoPlayer(uri, callback) API is GONE in v2.x.")
        print(f"         New API: useVideoPlayer(source, setupCallback)")
        print(f"         Docs: https://docs.expo.dev/versions/latest/sdk/video/")


def main():
    parser = argparse.ArgumentParser(
        description="Fix LittleLoom CommunityScreen crash issues",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python fix_community.py --src-dir C:/Users/ondie/Desktop/LittleLoom/src
  python fix_community.py --src-dir ./src --dry-run
  python fix_community.py --src-dir /home/user/projects/LittleLoom/src
        """
    )
    parser.add_argument("--src-dir", default=".", help="Path to src directory (default: current dir)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without modifying files")
    args = parser.parse_args()

    src_dir = Path(args.src_dir).resolve()

    print(f"\n{'='*65}")
    print(f"  LittleLoom CommunityScreen Auto-Fix")
    print(f"  Source: {src_dir}")
    print(f"  Mode: {'DRY RUN (no changes)' if args.dry_run else 'LIVE (will modify files)'}")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*65}")

    # Find CommunityScreen
    community_screen = src_dir / "screens" / "community" / "CommunityScreen.tsx"
    if not community_screen.exists():
        alternatives = [
            src_dir / "CommunityScreen.tsx",
            src_dir / "screens" / "CommunityScreen.tsx",
            Path("C:/Users/ondie/Desktop/LittleLoom/src/screens/community/CommunityScreen.tsx"),
            Path.home() / "Desktop" / "LittleLoom" / "src" / "screens" / "community" / "CommunityScreen.tsx",
        ]
        for alt in alternatives:
            if alt.exists():
                community_screen = alt
                break

    if not community_screen.exists():
        print(f"\n[ERROR] CommunityScreen.tsx not found!")
        print(f"  Searched: {community_screen}")
        print(f"  Please provide correct --src-dir path")
        return 1

    # Run fixes
    fixed = fix_community_screen(community_screen, dry_run=args.dry_run)
    check_other_files(src_dir)
    check_package_json(src_dir)

    print(f"\n{'='*65}")
    if args.dry_run:
        print(f"  DRY RUN complete. Run without --dry-run to apply fixes.")
    else:
        print(f"  Fixes applied! Next steps:")
        print(f"    1. Clear Metro cache:  npx expo start --clear")
        print(f"    2. Or full reset:      npx expo start --clear --reset-cache")
        print(f"    3. Rebuild dev-client: npx expo run:android  (or :ios)")
        print(f"    4. Backups saved as .bak files if you need to revert")
    print(f"{'='*65}\n")
    return 0


if __name__ == "__main__":
    exit(main())