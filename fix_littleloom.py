#!/usr/bin/env python3
"""
LittleLoom - FINAL showAlert Fix Script (v3)
Handles ALL showAlert patterns including multi-line with button arrays.
"""

import os
import re
import shutil
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.resolve()


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


def find_showalert_calls(content):
    """
    Find ALL showAlert calls including multi-line ones.
    Returns list of (start_pos, end_pos, full_call_text).
    """
    results = []
    i = 0
    while i < len(content):
        # Find showAlert( that's not preceded by sweetAlert.
        match = re.search(r'(?<!sweetAlert\.)showAlert\s*\(', content[i:])
        if not match:
            break
        
        start = i + match.start()
        paren_start = i + match.end() - 1  # Position of the opening (
        
        # Track brackets to find matching )
        paren_depth = 1
        bracket_depth = 0
        brace_depth = 0
        in_string = False
        string_char = None
        
        pos = paren_start + 1
        while pos < len(content) and paren_depth > 0:
            char = content[pos]
            
            # Handle strings
            if not in_string and char in '"\'':
                in_string = True
                string_char = char
            elif in_string and char == string_char:
                # Check for escape
                if content[pos-1] != '\\':
                    in_string = False
                    string_char = None
            elif not in_string:
                if char == '(': paren_depth += 1
                elif char == ')': paren_depth -= 1
                elif char == '[': bracket_depth += 1
                elif char == ']': bracket_depth -= 1
                elif char == '{': brace_depth += 1
                elif char == '}': brace_depth -= 1
            
            pos += 1
        
        if paren_depth == 0:
            full_call = content[start:pos]
            results.append((start, pos, full_call))
        
        i = pos
    
    return results


def extract_showalert_info(full_call):
    """Extract title, message, and button info from a showAlert call."""
    # Extract first quoted string (title)
    title_match = re.search(r'showAlert\s*\(\s*([\'"])([^\'"]+)\1', full_call)
    title = title_match.group(2) if title_match else "Alert"
    
    # Extract second quoted string (message)
    msg_match = re.search(r'showAlert\s*\(\s*[\'"][^\'"]+[\'"]\s*,\s*([\'"])([^\'"]*)\1', full_call)
    message = msg_match.group(2) if msg_match else ""
    
    # Check if it has a button array
    has_buttons = '[' in full_call and 'text:' in full_call
    
    # Extract button texts
    button_texts = re.findall(r'text\s*:\s*([\'"])([^\'"]+)\1', full_call)
    button_texts = [b[1] for b in button_texts]
    
    # Check for destructive style
    has_destructive = "destructive" in full_call
    
    return {
        'title': title,
        'message': message,
        'has_buttons': has_buttons,
        'button_texts': button_texts,
        'has_destructive': has_destructive,
        'full_call': full_call
    }


def build_replacement(info, use_sweetalert=True):
    """Build the replacement code for a showAlert call."""
    title = info['title'].replace("'", "\\'")
    message = info['message'].replace("'", "\\'")
    
    if info['has_buttons'] and use_sweetalert:
        # Multi-button: use sweetAlert.confirm
        confirm_text = info['button_texts'][-1] if info['button_texts'] else "OK"
        cancel_text = info['button_texts'][0] if info['button_texts'] else "Cancel"
        destructive = "true" if info['has_destructive'] else "false"
        
        return f"""sweetAlert.confirm(
      '{title}',
      '{message}',
      () => {{
        // TODO: Confirm action
      }},
      () => {{
        // Cancel action
      }},
      '{confirm_text}',
      '{cancel_text}',
      {destructive}
    )"""
    
    elif use_sweetalert:
        # Simple alert
        return f"sweetAlert.alert('{title}', '{message}', 'info')"
    
    else:
        # Use React Native Alert
        if info['has_buttons']:
            return f"Alert.alert('{title}', '{message}')"  # Simplified
        else:
            return f"Alert.alert('{title}', '{message}')"


def fix_file(filepath: Path):
    """Fix ALL showAlert calls in a file."""
    if not filepath.exists():
        return 0
    
    content = filepath.read_text(encoding='utf-8')
    original = content
    
    # Check if file has useSweetAlert imported
    has_sweetalert = 'useSweetAlert' in content or 'import.*SweetAlert' in content
    
    # Find all showAlert calls
    calls = find_showalert_calls(content)
    
    if not calls:
        return 0
    
    # Replace from end to start to preserve positions
    replacements = 0
    for start, end, full_call in reversed(calls):
        info = extract_showalert_info(full_call)
        replacement = build_replacement(info, use_sweetalert=has_sweetalert)
        
        content = content[:start] + replacement + content[end:]
        replacements += 1
    
    if content != original:
        backup_file(filepath)
        filepath.write_text(content, encoding='utf-8')
        print(f"  ✅ Fixed {replacements} showAlert calls in: {filepath.name}")
        return replacements
    
    return 0


def scan_for_remaining():
    """Final scan for any remaining showAlert calls."""
    src_dir = PROJECT_ROOT / "src"
    issues = []
    
    for filepath in src_dir.rglob("*"):
        if filepath.is_file() and filepath.suffix in ['.tsx', '.ts', '.jsx', '.js']:
            if '.backup' in str(filepath):
                continue
            
            content = filepath.read_text(encoding='utf-8')
            relative = filepath.relative_to(PROJECT_ROOT)
            
            calls = find_showalert_calls(content)
            for start, end, full_call in calls:
                line_num = content[:start].count('\n') + 1
                # Skip if it's in utils/alert.ts (the definition file)
                if 'utils/alert' in str(relative):
                    continue
                issues.append(f"{relative}:{line_num}")
    
    return issues


def main():
    print("=" * 70)
    print("  LittleLoom FINAL showAlert Fix (v3)")
    print("=" * 70)
    
    total_fixes = 0
    
    # Fix all files in src/
    print("\n🔧 Fixing ALL showAlert calls in src/...")
    src_dir = PROJECT_ROOT / "src"
    
    for filepath in src_dir.rglob("*"):
        if filepath.is_file() and filepath.suffix in ['.tsx', '.ts', '.jsx', '.js']:
            if '.backup' in str(filepath):
                continue
            count = fix_file(filepath)
            total_fixes += count
    
    # Final scan
    print("\n🔍 Final scan for remaining issues...")
    remaining = scan_for_remaining()
    
    if remaining:
        print(f"  ⚠️  {len(remaining)} remaining showAlert calls:")
        for issue in remaining:
            print(f"    • {issue}")
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