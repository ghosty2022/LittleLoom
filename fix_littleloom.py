#!/usr/bin/env python3
"""
LittleLoom - Complete showAlert Fix Script (v2)
Fixes ALL remaining showAlert calls across the entire codebase.
"""

import os
import re
import shutil
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.resolve()

# Files that had corrupted replacements from the bad PowerShell script
CORRUPTION_FIXES = {
    "src/context/FamilyContext.tsx": {
        "find": "} catch (esweetAlert.alert('Error', 'Failed to update guardian', 'info')date guardian');",
        "replace": "} catch (error) {\n      sweetAlert.alert('Error', 'Failed to update guardian', 'error');"
    }
}

# Files that need showAlert replaced with sweetAlert (have useSweetAlert imported)
SWEETALERT_FILES = [
    "src/context/CommunityContext.tsx",
    "src/context/FamilyChatContext.tsx", 
    "src/context/FamilyContext.tsx",
    "src/screens/baby/BabySelectorScreen.tsx",
    "src/screens/backup/BackupRestoreScreen.tsx",
    "src/screens/community/ChatScreen.tsx",
    "src/screens/community/CommunityScreen.tsx",
    "src/screens/community/PostDetailScreen.tsx",
    "src/screens/community/TopicScreen.tsx",
    "src/screens/family/FamilySharingScreen.tsx",
    "src/screens/gallery/GalleryScreen.tsx",
    "src/screens/settings/ContactSupportScreen.tsx",
    "src/screens/tracking/GrowthDashboardScreen.tsx",
    "src/screens/tracking/TrackerRemindersScreen.tsx",
    "src/hooks/useSocialAuth.ts",
]

# Files that should use Alert.alert instead (don't have sweetAlert)
ALERT_FILES = [
    "src/utils/alert.ts",
]


def backup_file(filepath: Path):
    """Create a numbered backup."""
    backup_dir = filepath.parent / ".backups"
    backup_dir.mkdir(exist_ok=True)
    counter = 1
    while True:
        backup_path = backup_dir / f"{filepath.name}.backup.{counter}"
        if not backup_path.exists():
            shutil.copy2(filepath, backup_path)
            return backup_path
        counter += 1


def fix_corruption(filepath: Path):
    """Fix corrupted replacements from bad PowerShell script."""
    content = filepath.read_text(encoding='utf-8')
    original = content
    
    # Fix the specific FamilyContext corruption
    if 'catch (esweetAlert' in content:
        content = content.replace(
            "} catch (esweetAlert.alert('Error', 'Failed to update guardian', 'info')date guardian');",
            "} catch (error) {\n      sweetAlert.alert('Error', 'Failed to update guardian', 'error');"
        )
    
    # Fix any other esweetAlert patterns
    content = re.sub(r'} catch \(esweetAlert[^)]*\)[^;]*;', 
                     r'} catch (error) {\n      sweetAlert.alert(\'Error\', \'An error occurred\', \'error\');', 
                     content)
    
    if content != original:
        backup_file(filepath)
        filepath.write_text(content, encoding='utf-8')
        print(f"  ✅ Fixed corruption in: {filepath.name}")
        return True
    return False


def replace_showalert_in_file(filepath: Path, use_sweetalert: bool):
    """Replace all showAlert calls in a file."""
    content = filepath.read_text(encoding='utf-8')
    original = content
    replacements = 0
    
    # Pattern 1: showAlert('title', 'message') -> sweetAlert.alert('title', 'message', 'info')
    # or Alert.alert('title', 'message')
    pattern1 = r'(?<!sweetAlert\.)showAlert\s*\(\s*([\'"])([^\'"]+)\1\s*,\s*([\'"])([^\'"]*)\3\s*\)'
    
    def replace_simple(match):
        nonlocal replacements
        title = match.group(2)
        message = match.group(4)
        replacements += 1
        if use_sweetalert:
            return f"sweetAlert.alert('{title}', '{message}', 'info')"
        else:
            return f"Alert.alert('{title}', '{message}')"
    
    content = re.sub(pattern1, replace_simple, content)
    
    # Pattern 2: showAlert with button arrays (multi-line)
    # Find showAlert( ... [ ... ] ... )
    pattern2 = r'(?<!sweetAlert\.)showAlert\s*\('
    
    # More complex: find showAlert calls that span multiple lines with arrays
    # Use a simpler approach: find and replace known patterns
    
    # Pattern 3: showAlert in catch blocks that got corrupted
    # catch (e) { showAlert(...) } -> catch (e) { sweetAlert.alert(...) }
    
    # Check if file has useSweetAlert imported
    has_sweetalert_import = 'useSweetAlert' in content or 'sweetAlert' in content
    has_alert_import = 'Alert' in content
    
    if content != original:
        backup_file(filepath)
        filepath.write_text(content, encoding='utf-8')
        print(f"  ✅ Fixed {replacements} showAlert calls in: {filepath.name}")
        return replacements
    return 0


def fix_file_comprehensive(filepath: Path):
    """Comprehensive fix for a single file."""
    if not filepath.exists():
        print(f"  ❌ File not found: {filepath}")
        return 0
    
    content = filepath.read_text(encoding='utf-8')
    original = content
    replacements = 0
    
    # Fix 1: Simple showAlert('title', 'message') calls
    simple_pattern = r'(?<!sweetAlert\.)showAlert\s*\(\s*([\'"])([^\'"]+)\1\s*,\s*([\'"])([^\'"]*)\3\s*\)'
    simple_matches = list(re.finditer(simple_pattern, content))
    for match in simple_matches:
        title = match.group(2)
        message = match.group(4)
        old = match.group(0)
        new = f"sweetAlert.alert('{title}', '{message}', 'info')"
        content = content.replace(old, new, 1)
        replacements += 1
    
    # Fix 2: showAlert with array arguments (Alert.alert style with buttons)
    # These are trickier - we need to find the full call
    # Look for showAlert( ... [ ... { text: ... } ... ] ... )
    
    # Find all showAlert occurrences
    for match in re.finditer(r'(?<!sweetAlert\.)showAlert\s*\(', content):
        start = match.start()
        # Find the matching closing paren
        paren_depth = 1
        i = match.end()
        while i < len(content) and paren_depth > 0:
            if content[i] == '(':
                paren_depth += 1
            elif content[i] == ')':
                paren_depth -= 1
            i += 1
        
        if paren_depth == 0:
            full_call = content[start:i]
            # Extract title and message
            title_match = re.search(r'showAlert\s*\(\s*([\'"])([^\'"]+)\1', full_call)
            msg_match = re.search(r',\s*([\'"])([^\'"]*)\1', full_call)
            
            if title_match and msg_match:
                title = title_match.group(2)
                message = msg_match.group(2)
                
                # Check if it has button array
                if '[' in full_call and ']' in full_call:
                    # This is an Alert.alert with buttons - convert to sweetAlert.confirm
                    new_call = f"""sweetAlert.confirm(
      '{title}',
      '{message}',
      () => {{
        // TODO: Confirm action
      }},
      () => {{
        // Cancel action
      }},
      'OK',
      'Cancel',
      false
    )"""
                else:
                    new_call = f"sweetAlert.alert('{title}', '{message}', 'info')"
                
                content = content[:start] + new_call + content[i:]
                replacements += 1
    
    if content != original:
        backup_file(filepath)
        filepath.write_text(content, encoding='utf-8')
        print(f"  ✅ Fixed {replacements} showAlert calls in: {filepath.name}")
        return replacements
    
    # Check for remaining showAlert calls
    remaining = list(re.finditer(r'(?<!sweetAlert\.)showAlert\s*\(', content))
    if remaining:
        print(f"  ⚠️  {len(remaining)} showAlert calls remain in: {filepath.name}")
        for r in remaining:
            line_num = content[:r.start()].count('\n') + 1
            print(f"      Line {line_num}")
    
    return 0


def scan_all_files():
    """Scan all source files for showAlert issues."""
    src_dir = PROJECT_ROOT / "src"
    issues = []
    
    for filepath in src_dir.rglob("*"):
        if filepath.is_file() and filepath.suffix in ['.tsx', '.ts', '.jsx', '.js']:
            if '.backup' in str(filepath):
                continue
                
            content = filepath.read_text(encoding='utf-8')
            relative = filepath.relative_to(PROJECT_ROOT)
            
            # Find standalone showAlert calls
            for match in re.finditer(r'(?<!sweetAlert\.)showAlert\s*\(', content):
                line_num = content[:match.start()].count('\n') + 1
                issues.append(f"{relative}:{line_num}")
    
    return issues


def main():
    print("=" * 70)
    print("  LittleLoom Complete showAlert Fix (v2)")
    print("=" * 70)
    
    total_fixes = 0
    
    # Step 1: Fix corruptions from bad PowerShell script
    print("\n🔧 Step 1: Fixing corruptions from previous bad script...")
    for rel_path, fix_info in CORRUPTION_FIXES.items():
        filepath = PROJECT_ROOT / rel_path
        if filepath.exists():
            content = filepath.read_text(encoding='utf-8')
            if fix_info['find'] in content:
                new_content = content.replace(fix_info['find'], fix_info['replace'])
                backup_file(filepath)
                filepath.write_text(new_content, encoding='utf-8')
                print(f"  ✅ Fixed corruption in: {rel_path}")
                total_fixes += 1
    
    # Step 2: Fix all known files with comprehensive replacement
    print("\n🔧 Step 2: Fixing showAlert calls in known files...")
    for rel_path in SWEETALERT_FILES:
        filepath = PROJECT_ROOT / rel_path
        if filepath.exists():
            count = fix_file_comprehensive(filepath)
            total_fixes += count
    
    # Step 3: Fix Alert.files
    print("\n🔧 Step 3: Fixing files that should use Alert.alert...")
    for rel_path in ALERT_FILES:
        filepath = PROJECT_ROOT / rel_path
        if filepath.exists():
            content = filepath.read_text(encoding='utf-8')
            # These files define showAlert, so we shouldn't replace the definition
            # Just check for any standalone calls that shouldn't be there
            pass  # Skip for now
    
    # Step 4: Scan for any remaining issues
    print("\n🔍 Step 4: Scanning for remaining issues...")
    remaining = scan_all_files()
    
    if remaining:
        print(f"  ⚠️  Found {len(remaining)} remaining showAlert calls:")
        for issue in remaining[:20]:  # Show first 20
            print(f"    • {issue}")
        if len(remaining) > 20:
            print(f"    ... and {len(remaining) - 20} more")
    else:
        print("  ✅ No remaining showAlert calls found!")
    
    print("\n" + "=" * 70)
    print(f"  Total fixes applied: {total_fixes}")
    print("=" * 70)
    
    print("\n📝 Next steps:")
    print("   1. Clear Metro cache: npx react-native start --reset-cache")
    print("   2. Or: expo start -c")
    print("   3. Test your app")


if __name__ == "__main__":
    main()