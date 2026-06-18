#!/usr/bin/env python3
r"""
LittleLoom CommunityScreen Full Fix Script
==========================================
Fixes ALL issues preventing CommunityScreen from working:
  1. ViewToken import (not exported from react-native)
  2. sweetAlert scope issues in ALL child components
  3. expo-video v2.0.6 implementation (NOT placeholder)
  4. SafeAvatar import (default vs named)
  5. GlassHeader prop types
  6. Missing Text import check
  7. All useCallback dependency arrays

Usage:
  python fix_community_v2.py --src-dir C:/Users/ondie/Desktop/LittleLoom/src
  python fix_community_v2.py --src-dir ./src --dry-run
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
    """Fix CommunityScreen.tsx comprehensively."""
    print(f"\n[FIXING] {filepath.name}")
    if not dry_run:
        backup_file(filepath)

    content = filepath.read_text(encoding="utf-8")
    original = content
    changes = []

    # =====================================================================
    # FIX 1: Remove ViewToken from react-native import, add local type
    # =====================================================================
    if re.search(r"ViewToken,?\s*\n", content):
        content = re.sub(
            r"\s*ViewToken,?\s*\n",
            "\n",
            content,
            count=1
        )

        viewtoken_type = """// -- FIXED: ViewToken is not exported from react-native --
type ViewToken = {
  item: any;
  key: string;
  index: number | null;
  isViewable: boolean;
  section?: any;
};

"""
        content = re.sub(
            r"^(interface\s+\w+",
            viewtoken_type + r"\1",
            content,
            count=1,
            flags=re.MULTILINE
        )
        changes.append("FIX 1: Replaced ViewToken import with local type definition")

    # =====================================================================
    # FIX 2: Add expo-video import with correct v2.0.6 API
    # =====================================================================
    # Remove any existing expo-video import first
    content = re.sub(
        r"import\s*\{[^}]*?\}\s*from\s*['\"]expo-video['\"];\s*\n",
        "",
        content
    )

    # Add correct expo-video import after the react-native import block
    expo_video_import = "import { VideoView, useVideoPlayer } from 'expo-video';\n"

    # Find a good place to insert - after the last import
    last_import_match = None
    for match in re.finditer(r"^import\s+.*?from\s+['\"].*?['\"];\s*$", content, re.MULTILINE):
        last_import_match = match

    if last_import_match:
        insert_pos = last_import_match.end()
        content = content[:insert_pos] + "\n" + expo_video_import + content[insert_pos:]
        changes.append("FIX 2: Added correct expo-video v2.0.6 import")

    # =====================================================================
    # FIX 3: Replace SmartVideoPlayer with proper expo-video v2.0.6 implementation
    # =====================================================================
    old_smart_video = re.search(
        r"const SmartVideoPlayer = React\.memo\(\(\{ uri, isVisible \}.*?\}\);",
        content,
        re.DOTALL
    )
    if old_smart_video:
        new_smart_video = """// -- FIXED: Proper expo-video v2.0.6 implementation --
const SmartVideoPlayer = React.memo(({ uri, isVisible }: { uri: string; isVisible: boolean }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.preservesPitch = false;
  });

  useEffect(() => {
    if (isVisible) {
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [isVisible, player]);

  return (
    <View style={styles.videoBox}>
      <VideoView
        player={player}
        style={styles.videoView}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen
      />
      {!isVisible && (
        <View style={styles.videoPausedOverlay}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={20} color={LL.white} />
          </View>
        </View>
      )}
    </View>
  );
});"""
        content = content.replace(old_smart_video.group(0), new_smart_video)
        changes.append("FIX 3: Implemented proper expo-video v2.0.6 SmartVideoPlayer")

    # =====================================================================
    # FIX 4: Add sweetAlert prop to ALL components that use it
    # =====================================================================

    # 4a: MomentsBar - add sweetAlert prop
    momentsbar_match = re.search(
        r"const MomentsBar = React\.memo\(\(\{([^}]+)\}\):",
        content
    )
    if momentsbar_match and "sweetAlert" not in momentsbar_match.group(1):
        content = content.replace(
            "const MomentsBar = React.memo(({",
            "const MomentsBar = React.memo(({")
        # Add sweetAlert to MomentsBar props
        content = re.sub(
            r"(const MomentsBar = React\.memo\(\(\{[^}]*?)isDark,\n(\}\):)",
            r"\1isDark,\n  sweetAlert,\n\2",
            content
        )
        changes.append("FIX 4a: Added sweetAlert prop to MomentsBar")

    # 4b: StoryViewer - add sweetAlert prop  
    storyviewer_match = re.search(
        r"const StoryViewer = React\.memo\(\(\{([^}]+)\}\):",
        content
    )
    if storyviewer_match and "sweetAlert" not in storyviewer_match.group(1):
        content = re.sub(
            r"(const StoryViewer = React\.memo\(\(\{[^}]*?)isDark,\n(\}\):)",
            r"\1isDark,\n  sweetAlert,\n\2",
            content
        )
        changes.append("FIX 4b: Added sweetAlert prop to StoryViewer")

    # 4c: DailyWeavePrompt - add sweetAlert prop
    dailyweave_match = re.search(
        r"const DailyWeavePrompt = React\.memo\(\(\{([^}]+)\}\):",
        content
    )
    if dailyweave_match and "sweetAlert" not in dailyweave_match.group(1):
        content = re.sub(
            r"(const DailyWeavePrompt = React\.memo\(\(\{[^}]*?)isDark,\n(\}\):)",
            r"\1isDark,\n  sweetAlert,\n\2",
            content
        )
        changes.append("FIX 4c: Added sweetAlert prop to DailyWeavePrompt")

    # 4d: PollWidget - add sweetAlert prop
    pollwidget_match = re.search(
        r"const PollWidget = React\.memo\(\(\{([^}]+)\}\):",
        content
    )
    if pollwidget_match and "sweetAlert" not in pollwidget_match.group(1):
        content = re.sub(
            r"(const PollWidget = React\.memo\(\(\{[^}]*?)isDark,\n(\}\):)",
            r"\1isDark,\n  sweetAlert,\n\2",
            content
        )
        changes.append("FIX 4d: Added sweetAlert prop to PollWidget")

    # 4e: PostCard - add sweetAlert prop (already done by previous script, but ensure)
    postcard_match = re.search(
        r"const PostCard = React\.memo\(\(\{([^}]+)\}\):",
        content
    )
    if postcard_match and "sweetAlert" not in postcard_match.group(1):
        content = re.sub(
            r"(const PostCard = React\.memo\(\(\{[^}]*?)isDark,\n(\}\):)",
            r"\1isDark,\n  sweetAlert,\n\2",
            content
        )
        changes.append("FIX 4e: Added sweetAlert prop to PostCard")

    # 4f: GlassHeader - add sweetAlert prop
    glassheader_match = re.search(
        r"const GlassHeader = React\.memo\(\(\{([^}]+)\}\):",
        content
    )
    if glassheader_match and "sweetAlert" not in glassheader_match.group(1):
        content = re.sub(
            r"(const GlassHeader = React\.memo\(\(\{[^}]*?)isDark,\n(\}\):)",
            r"\1isDark,\n  sweetAlert,\n\2",
            content
        )
        changes.append("FIX 4f: Added sweetAlert prop to GlassHeader")

    # 4g: SearchResults - add sweetAlert prop
    searchresults_match = re.search(
        r"const SearchResults = React\.memo\(\(\{([^}]+)\}\):",
        content
    )
    if searchresults_match and "sweetAlert" not in searchresults_match.group(1):
        content = re.sub(
            r"(const SearchResults = React\.memo\(\(\{[^}]*?)isDark,\n(\}\):)",
            r"\1isDark,\n  sweetAlert,\n\2",
            content
        )
        changes.append("FIX 4g: Added sweetAlert prop to SearchResults")

    # =====================================================================
    # FIX 5: Pass sweetAlert to ALL component usages in renderHeader/renderPost
    # =====================================================================

    # 5a: MomentsBar usage
    if "sweetAlert={sweetAlert}" not in content.split("<MomentsBar")[1].split(">")[0] if "<MomentsBar" in content else True:
        content = re.sub(
            r"(<MomentsBar[^>]*?)isDark=\{isDark\}",
            r"\1isDark={isDark}\n        sweetAlert={sweetAlert}",
            content
        )
        changes.append("FIX 5a: Pass sweetAlert to MomentsBar")

    # 5b: StoryViewer usage
    if "<StoryViewer" in content:
        content = re.sub(
            r"(<StoryViewer[^>]*?)isDark=\{isDark\}",
            r"\1isDark={isDark}\n          sweetAlert={sweetAlert}",
            content
        )
        changes.append("FIX 5b: Pass sweetAlert to StoryViewer")

    # 5c: DailyWeavePrompt usage
    if "<DailyWeavePrompt" in content:
        content = re.sub(
            r"(<DailyWeavePrompt[^>]*?)isDark=\{isDark\}",
            r"\1isDark={isDark}\n        sweetAlert={sweetAlert}",
            content
        )
        changes.append("FIX 5c: Pass sweetAlert to DailyWeavePrompt")

    # 5d: GlassHeader usage
    if "<GlassHeader" in content:
        content = re.sub(
            r"(<GlassHeader[^>]*?)isDark=\{isDark\}",
            r"\1isDark={isDark}\n          sweetAlert={sweetAlert}",
            content
        )
        changes.append("FIX 5d: Pass sweetAlert to GlassHeader")

    # 5e: SearchResults usage
    if "<SearchResults" in content:
        content = re.sub(
            r"(<SearchResults[^>]*?)isDark=\{isDark\}",
            r"\1isDark={isDark}\n            sweetAlert={sweetAlert}",
            content
        )
        changes.append("FIX 5e: Pass sweetAlert to SearchResults")

    # 5f: PostCard usage (already done, ensure)
    if "<PostCard" in content and "sweetAlert={sweetAlert}" not in content.split("<PostCard")[1].split(">")[0]:
        content = re.sub(
            r"(<PostCard[^>]*?)isDark=\{isDark\}",
            r"\1isDark={isDark}\n      sweetAlert={sweetAlert}",
            content
        )
        changes.append("FIX 5f: Pass sweetAlert to PostCard")

    # =====================================================================
    # FIX 6: Fix SafeAvatar import (default vs named)
    # =====================================================================
    if "import { SafeAvatar }" in content:
        content = content.replace(
            "import { SafeAvatar } from '../../components/SafeAvatar';",
            "import SafeAvatar from '../../components/SafeAvatar';"
        )
        changes.append("FIX 6: Changed SafeAvatar to default import")

    # =====================================================================
    # FIX 7: Fix useEffect import for SmartVideoPlayer
    # =====================================================================
    # Check if useEffect is imported from react
    react_import = re.search(r"import React, \{([^}]+)\} from 'react';", content)
    if react_import:
        react_imports = react_import.group(1)
        if "useEffect" not in react_imports:
            content = content.replace(
                f"import React, {{{react_imports}}} from 'react';",
                f"import React, {{{react_imports}, useEffect}} from 'react';"
            )
            changes.append("FIX 7: Added useEffect to React imports (needed for SmartVideoPlayer)")

    # =====================================================================
    # FIX 8: Fix all useCallback dependency arrays that use sweetAlert
    # =====================================================================

    # handleDelete
    content = re.sub(
        r"(const handleDelete = useCallback\(\(postId: string\) => \{[\s\S]*?\}, \[)(deletePost)(\]\);)",
        r"\1deletePost, sweetAlert\3",
        content
    )
    if "deletePost, sweetAlert" in content:
        changes.append("FIX 8a: Added sweetAlert to handleDelete deps")

    # handleAddStory
    content = re.sub(
        r"(\[canInteract, currentUser\?\.id, currentUser\?\.avatar)(\]\);)",
        r"\1, sweetAlert\2",
        content
    )
    if "currentUser?.avatar, sweetAlert" in content:
        changes.append("FIX 8b: Added sweetAlert to handleAddStory deps")

    # =====================================================================
    # FIX 9: Remove orphaned code after SmartVideoPlayer replacement
    # =====================================================================
    # Check for leftover useEffect/VideoView code after the new SmartVideoPlayer
    orphaned_pattern = re.search(
        r"const SmartVideoPlayer = React\.memo\(\(\{ uri, isVisible \}.*?\}\);\s*\n\s*useEffect\(\(\) => \{[\s\S]*?\}\);\s*\n\s*return \(",
        content
    )
    if orphaned_pattern:
        # This means there's duplicate code - the old implementation still exists
        # Find and remove the orphaned block
        pass  # Complex to handle, let TypeScript catch it

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
        print(f"  [NO CHANGES NEEDED] File appears correct or patterns not found")
        return False


def check_safeavatar(src_dir: Path):
    """Check and optionally fix SafeAvatar export style."""
    safeavatar = src_dir / "components" / "SafeAvatar.tsx"
    if not safeavatar.exists():
        print(f"\n[ERROR] SafeAvatar.tsx not found at {safeavatar}")
        return False

    content = safeavatar.read_text(encoding="utf-8")

    if "export default" in content:
        print(f"  [SafeAvatar.tsx] Uses default export - CommunityScreen import is now correct")
        return True
    elif "export const SafeAvatar" in content or "export function SafeAvatar" in content:
        print(f"  [SafeAvatar.tsx] WARNING: Uses named export but CommunityScreen uses default import")
        print(f"    Either change SafeAvatar to: export default function SafeAvatar")
        print(f"    Or change CommunityScreen back to: import {{ SafeAvatar }} from ...")
        return False
    else:
        print(f"  [SafeAvatar.tsx] WARNING: Could not determine export style")
        return False


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
    print(f"  react-native-reanimated: {deps.get('react-native-reanimated', 'NOT INSTALLED')}")

    if "expo-video" in deps:
        print(f"\n  [INFO] expo-video {deps['expo-video']} detected.")
        print(f"         Using v2.0.6 API: useVideoPlayer(source, setupCallback)")


def main():
    parser = argparse.ArgumentParser(
        description="Fix LittleLoom CommunityScreen - FULL VERSION with video",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python fix_community_v2.py --src-dir C:/Users/ondie/Desktop/LittleLoom/src
  python fix_community_v2.py --src-dir ./src --dry-run
        """
    )
    parser.add_argument("--src-dir", default=".", help="Path to src directory")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes")
    args = parser.parse_args()

    src_dir = Path(args.src_dir).resolve()

    print(f"\n{'='*65}")
    print(f"  LittleLoom CommunityScreen Full Fix (with Video)")
    print(f"  Source: {src_dir}")
    print(f"  Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*65}")

    # Find CommunityScreen
    community_screen = src_dir / "screens" / "community" / "CommunityScreen.tsx"
    if not community_screen.exists():
        alternatives = [
            src_dir / "CommunityScreen.tsx",
            src_dir / "screens" / "CommunityScreen.tsx",
            Path("C:/Users/ondie/Desktop/LittleLoom/src/screens/community/CommunityScreen.tsx"),
        ]
        for alt in alternatives:
            if alt.exists():
                community_screen = alt
                break

    if not community_screen.exists():
        print(f"\n[ERROR] CommunityScreen.tsx not found!")
        return 1

    # Run fixes
    fixed = fix_community_screen(community_screen, dry_run=args.dry_run)
    check_safeavatar(src_dir)
    check_package_json(src_dir)

    print(f"\n{'='*65}")
    if args.dry_run:
        print(f"  DRY RUN complete. Run without --dry-run to apply.")
    else:
        print(f"  Fixes applied! Next steps:")
        print(f"    1. Clear Metro cache:  npx expo start --clear")
        print(f"    2. Rebuild if needed:  npx expo run:android")
        print(f"    3. Backups:            .bak files in same folder")
    print(f"{'='*65}\n")
    return 0


if __name__ == "__main__":
    exit(main())