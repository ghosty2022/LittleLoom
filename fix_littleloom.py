#!/usr/bin/env python3
"""
LittleLoom Emergency Fix Script
Fixes corrupted showAlert replacements and syntax errors across the codebase.
"""

import os
import re
import shutil
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.resolve()

# Files that need fixing with their exact broken patterns and correct replacements
FIXES = {
    # ============================================================================
    # 1. CommunityContext.tsx - Line 2290: Extra }; at end
    # ============================================================================
    "src/context/CommunityContext.tsx": {
        "description": "Remove extra }; before export",
        "find": """    </CommunityContext.Provider>
  );
};

export const useCommunity = () => {""",
        "replace": """    </CommunityContext.Provider>
  );
}

export const useCommunity = () => {""",
    },
    
    # ============================================================================
    # 2. CommunityOnboardingScreen.tsx - Broken handleSkip showAlert
    # ============================================================================
    "src/screens/community/CommunityOnboardingScreen.tsx": {
        "description": "Fix handleSkip showAlert -> sweetAlert.confirm",
        "find": """  const handleSkip = async () => {

showAlert(
      'Skip Topic Selection?',
      'Selecting topics helps us show you relevant content. You can always change this later in your profile.',
      [
        { text: 'Select Topics', style: 'cancel' },
        { 
          text: 'Skip Anyway', 
          style: 'destructive',
          onPress: async () => {
            try {
              const data = { 
                completed: true, 
                selectedTopics: [],
                timestamp: new Date().toISOString(),
                skipped: true
              };
              await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
              await AsyncStorage.setItem('@community_selected_topics_v2', JSON.stringify([]));
              if (updateCommunityTopics) await updateCommunityTopics([]);
              if (updateUserTopics) await updateUserTopics([]);
              await updateSectionState('community', { onboardingComplete: true, topicSelected: false });
              
              if (onComplete) {
                onComplete();
              }
              
              if (navigation && navigation.replace) {
                navigation.replace('CommunityMain');
              }
            } catch (error) {
              console.error('Error skipping onboarding:', error);
            }
          }
        },
      ]
    );
  };""",
        "replace": """  const handleSkip = async () => {
    sweetAlert.confirm(
      'Skip Topic Selection?',
      'Selecting topics helps us show you relevant content. You can always change this later in your profile.',
      async () => {
        try {
          const data = { 
            completed: true, 
            selectedTopics: [],
            timestamp: new Date().toISOString(),
            skipped: true
          };
          await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
          await AsyncStorage.setItem('@community_selected_topics_v2', JSON.stringify([]));
          if (updateCommunityTopics) await updateCommunityTopics([]);
          if (updateUserTopics) await updateUserTopics([]);
          await updateSectionState('community', { onboardingComplete: true, topicSelected: false });
          
          if (onComplete) {
            onComplete();
          }
          
          if (navigation && navigation.replace) {
            navigation.replace('CommunityMain');
          }
        } catch (error) {
          console.error('Error skipping onboarding:', error);
        }
      },
      undefined,
      'Skip Anyway',
      'Select Topics',
      true
    );
  };""",
    },
}

# ============================================================================
# FamilyContext.tsx - The script corrupted this with a bad replacement
# ============================================================================
FAMILY_CONTEXT_FIX = {
    "src/context/FamilyContext.tsx": {
        "description": "Fix corrupted catch block",
        "find_pattern": r"} catch \(esweetAlert\.alert\('Error', 'Failed to update guardian', 'info'\)date guardian'\);\s*return false;",
        "replace": """} catch (error) {
      sweetAlert.alert('Error', 'Failed to update guardian', 'error');
      return false;""",
    }
}


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


def fix_file(relative_path: str, fix_info: dict):
    """Apply a fix to a file."""
    filepath = PROJECT_ROOT / relative_path
    
    if not filepath.exists():
        print(f"  ❌ File not found: {relative_path}")
        return False
    
    content = filepath.read_text(encoding='utf-8')
    
    if "find" in fix_info:
        if fix_info["find"] not in content:
            print(f"  ⚠️  Pattern not found in {relative_path} (may already be fixed or differently corrupted)")
            return False
        new_content = content.replace(fix_info["find"], fix_info["replace"])
    else:
        # Regex-based fix
        pattern = fix_info["find_pattern"]
        if not re.search(pattern, content):
            print(f"  ⚠️  Pattern not found in {relative_path}")
            return False
        new_content = re.sub(pattern, fix_info["replace"], content)
    
    if new_content == content:
        print(f"  ✓  No changes needed for {relative_path}")
        return True
    
    backup_path = backup_file(filepath)
    filepath.write_text(new_content, encoding='utf-8')
    print(f"  ✅ Fixed: {relative_path}")
    print(f"     Backup: {backup_path}")
    return True


def scan_for_remaining_showalert():
    """Find any remaining broken showAlert references."""
    print("\n🔍 Scanning for remaining showAlert issues...")
    
    issues = []
    src_dir = PROJECT_ROOT / "src"
    
    for filepath in src_dir.rglob("*.tsx"):
        if ".backup" in str(filepath):
            continue
            
        content = filepath.read_text(encoding='utf-8')
        relative = filepath.relative_to(PROJECT_ROOT)
        
        # Check for standalone showAlert (not sweetAlert.showAlert)
        for match in re.finditer(r'(?<!sweetAlert\.)showAlert\s*\(', content):
            line_num = content[:match.start()].count('\n') + 1
            issues.append(f"  {relative}:{line_num} - standalone showAlert call")
        
        # Check for corrupted patterns from bad replacements
        if 'catch (esweetAlert' in content:
            line_num = content.find('catch (esweetAlert')
            line_num = content[:line_num].count('\n') + 1
            issues.append(f"  {relative}:{line_num} - CORRUPTED catch block")
        
        # Check for double semicolons like };};
        if '};};' in content or ';\n};' in content:
            issues.append(f"  {relative} - possible extra semicolon before export")
    
    if issues:
        print("  Found issues:")
        for issue in issues:
            print(f"    {issue}")
    else:
        print("  ✓ No remaining showAlert issues found")
    
    return issues


def main():
    print("=" * 70)
    print("  LittleLoom Emergency Fix Script")
    print("=" * 70)
    
    # Apply known fixes
    print("\n🔧 Applying known fixes...")
    
    for path, fix in FIXES.items():
        print(f"\n  📄 {path} - {fix['description']}")
        fix_file(path, fix)
    
    # Apply FamilyContext fix if file exists
    family_path = "src/context/FamilyContext.tsx"
    if (PROJECT_ROOT / family_path).exists():
        print(f"\n  📄 {family_path} - {FAMILY_CONTEXT_FIX[family_path]['description']}")
        fix_file(family_path, FAMILY_CONTEXT_FIX[family_path])
    
    # Scan for anything we missed
    remaining = scan_for_remaining_showalert()
    
    print("\n" + "=" * 70)
    if remaining:
        print("  ⚠️  Some issues remain. Please check the files listed above.")
    else:
        print("  ✅ All known issues fixed!")
    print("  Backups saved in src/**/.backups/ folders")
    print("=" * 70)
    
    print("\n📝 Next steps:")
    print("   1. Clear Metro bundler cache: npx react-native start --reset-cache")
    print("   2. Or: expo start -c")
    print("   3. Test your app")


if __name__ == "__main__":
    main()