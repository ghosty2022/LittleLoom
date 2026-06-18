#!/usr/bin/env python3
"""
LittleLoom React Native Auto-Fix Script
Fixes common import and API issues across screen files.
"""

import os
import re
import shutil
import argparse


def fix_useSafeAreaInsets(content):
    """Move useSafeAreaInsets from 'react-native' to 'react-native-safe-area-context'"""
    lines = content.split('\n')
    new_lines = []
    fixed = False
    
    for line in lines:
        if "from 'react-native'" in line and 'useSafeAreaInsets' in line:
            m = re.search(r"import\s*\{\s*(.*?)\s*\}\s*from\s*'react-native'", line)
            if m:
                imports = [i.strip() for i in m.group(1).split(',')]
                filtered = [i for i in imports if i != 'useSafeAreaInsets']
                if filtered:
                    new_lines.append(f"import {{ {', '.join(filtered)} }} from 'react-native';")
                fixed = True
        else:
            new_lines.append(line)
    
    if fixed and "from 'react-native-safe-area-context'" not in content:
        # Insert after last import
        last_import = max((i for i, line in enumerate(new_lines) if line.startswith('import ')), default=-1)
        new_lines.insert(last_import + 1, "import { useSafeAreaInsets } from 'react-native-safe-area-context';")
        return '\n'.join(new_lines), True
    
    return content, False


def fix_animated_default_import(content):
    """Fix 'import Animated,{ ... } from react-native' to named import { Animated, ... }"""
    pattern = r"import\s+Animated\s*,\s*\{([^}]*)\}\s*from\s*'react-native'"
    matches = list(re.finditer(pattern, content))
    
    if not matches:
        return content, False
    
    for m in reversed(matches):
        inner = m.group(1).strip()
        inner = re.sub(r'\s+', ' ', inner)
        if inner:
            replacement = f"import {{ Animated, {inner} }} from 'react-native'"
        else:
            replacement = "import { Animated } from 'react-native'"
        content = content[:m.start()] + replacement + content[m.end():]
    
    return content, True


def fix_imagepicker_mediatype(content):
    """Replace deprecated ImagePicker.MediaTypeOptions with ImagePicker.MediaType"""
    if 'MediaTypeOptions' not in content:
        return content, False
    
    content = content.replace('ImagePicker.MediaTypeOptions.Images', 'ImagePicker.MediaType.IMAGES')
    content = content.replace('ImagePicker.MediaTypeOptions.Videos', 'ImagePicker.MediaType.VIDEOS')
    content = content.replace('ImagePicker.MediaTypeOptions.All', '[ImagePicker.MediaType.IMAGES, ImagePicker.MediaType.VIDEOS]')
    content = content.replace('MediaTypeOptions.Images', 'MediaType.IMAGES')
    content = content.replace('MediaTypeOptions.Videos', 'MediaType.VIDEOS')
    content = content.replace('MediaTypeOptions.All', '[MediaType.IMAGES, MediaType.VIDEOS]')
    return content, True


def fix_useSweetAlert_api(content):
    """Fix useSweetAlert API - replace { sweetAlert } destructuring with proper methods"""
    fixes = []
    
    # Pattern 1: const { sweetAlert } = useSweetAlert() - WRONG
    m = re.search(r"const\s*\{\s*([^}]*)\}\s*=\s*useSweetAlert\(\)", content)
    if m:
        destructured = m.group(1).strip()
        if 'sweetAlert' in destructured and 'confirm' not in destructured:
            parts = []
            if 'toast' in content: parts.append('toast')
            if 'error' in content or 'showError' in content: parts.append('error: showError')
            if 'success' in content or 'showSuccess' in content: parts.append('success: showSuccess')
            if 'confirm' in content or 'showConfirm' in content: parts.append('confirm: showConfirm')
            if 'alert' in content or 'showAlert' in content: parts.append('alert: showAlert')
            
            if parts:
                new_d = ', '.join(parts)
                old_line = f"const {{ {destructured} }} = useSweetAlert()"
                new_line = f"const {{ {new_d} }} = useSweetAlert()"
                content = content.replace(old_line, new_line)
                
                content = content.replace('sweetAlert.confirm(', 'showConfirm(')
                content = content.replace('sweetAlert.alert(', 'showAlert(')
                content = content.replace('sweetAlert.toast(', 'toast(')
                content = content.replace('sweetAlert.error(', 'showError(')
                content = content.replace('sweetAlert.success(', 'showSuccess(')
                fixes.append("destructured sweetAlert")
    
    # Pattern 2: const sweetAlert = useSweetAlert(); - ALSO WRONG
    if 'const sweetAlert = useSweetAlert()' in content:
        content = content.replace('const sweetAlert = useSweetAlert();', 'const { alert: showAlert } = useSweetAlert();')
        content = content.replace('sweetAlert.alert(', 'showAlert(')
        content = content.replace('sweetAlert.confirm(', 'showConfirm(')
        fixes.append("direct sweetAlert assignment")
    
    return content, len(fixes) > 0


def fix_useCustomization_bare(content):
    """Fix bare useCustomization() call without destructuring"""
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'useCustomization()' in line and 'const' not in line and 'import' not in line:
            lines[i] = "const { darkMode: isDark, themeColors, reduceMotion } = useCustomization();"
            return '\n'.join(lines), True
    return content, False


def process_file(filepath, output_dir=None):
    """Process a single file and apply all fixes"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    fixes = []
    
    content, fixed = fix_useSafeAreaInsets(content)
    if fixed: fixes.append("useSafeAreaInsets")
    
    content, fixed = fix_animated_default_import(content)
    if fixed: fixes.append("Animated import")
    
    content, fixed = fix_imagepicker_mediatype(content)
    if fixed: fixes.append("MediaTypeOptions")
    
    content, fixed = fix_useSweetAlert_api(content)
    if fixed: fixes.append("useSweetAlert API")
    
    content, fixed = fix_useCustomization_bare(content)
    if fixed: fixes.append("useCustomization")
    
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        outpath = os.path.join(output_dir, os.path.basename(filepath))
        with open(outpath, 'w') as f:
            f.write(content)
    
    return content != original, fixes


def main():
    parser = argparse.ArgumentParser(description='Fix LittleLoom React Native screen files')
    parser.add_argument('files', nargs='+', help='Screen .tsx files to fix')
    parser.add_argument('-o', '--output', help='Output directory for fixed files')
    parser.add_argument('--in-place', action='store_true', help='Modify files in place')
    args = parser.parse_args()
    
    for filepath in args.files:
        if not os.path.exists(filepath):
            print(f"SKIP: {filepath} not found")
            continue
        
        changed, fixes = process_file(filepath, args.output if not args.in_place else None)
        
        if args.in_place and changed:
            shutil.copy(filepath + '.tmp', filepath) if False else None
            with open(filepath, 'w') as f:
                with open(filepath, 'r') as orig:
                    pass  # Already written by process_file
        
        if fixes:
            print(f"FIXED {os.path.basename(filepath)}: {', '.join(fixes)}")
        elif changed:
            print(f"FIXED {os.path.basename(filepath)}")
        else:
            print(f"OK {os.path.basename(filepath)}")


if __name__ == '__main__':
    main()