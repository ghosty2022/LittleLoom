#!/usr/bin/env python3
"""
LittleLoom React Native Bundle Diagnostic Tool
Scans all source files for syntax errors, mismatched tags, import issues,
and other problems that cause "bad application bundle" errors.
"""

import os
import re
import sys
from pathlib import Path
from collections import defaultdict

class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

class BundleDiagnostic:
    def __init__(self, project_path):
        self.project_path = Path(project_path)
        self.errors = []
        self.warnings = []
        self.files_checked = 0
        self.files_with_errors = 0

    def log_error(self, file_path, line_num, message, line_content=""):
        self.errors.append({
            'file': str(file_path),
            'line': line_num,
            'message': message,
            'content': line_content.strip() if line_content else ""
        })

    def log_warning(self, file_path, line_num, message, line_content=""):
        self.warnings.append({
            'file': str(file_path),
            'line': line_num,
            'message': message,
            'content': line_content.strip() if line_content else ""
        })

    def get_source_files(self):
        """Get all relevant source files, excluding node_modules and build dirs"""
        source_files = []
        exclude_dirs = {'node_modules', '.expo', 'dist', 'build', 'android', 'ios', '.git', 'coverage'}

        for root, dirs, files in os.walk(self.project_path):
            # Remove excluded directories from traversal
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]

            for file in files:
                if file.endswith(('.tsx', '.ts', '.jsx', '.js')):
                    source_files.append(Path(root) / file)

        return sorted(source_files)

    def check_jsx_tags(self, file_path, content, lines):
        """Check for mismatched JSX tags"""
        # Track tag stack
        tag_stack = []

        # Pattern for self-closing tags: <Component ... />
        self_closing_pattern = re.compile(r'<([A-Z][a-zA-Z0-9_]*|View|Text|Image|ScrollView|TouchableOpacity|Animated\.View|Animated\.ScrollView|LinearGradient|BlurView|SafeAreaView|FlatList|SectionList|Modal|TextInput|Switch|ActivityIndicator|RefreshControl|StatusBar)(?:\s+[^>]*)?\s*/>')

        # Pattern for opening tags: <Component ...>
        opening_pattern = re.compile(r'<([A-Z][a-zA-Z0-9_]*|View|Text|Image|ScrollView|TouchableOpacity|Animated\.View|Animated\.ScrollView|LinearGradient|BlurView|SafeAreaView|FlatList|SectionList|Modal|TextInput|Switch|ActivityIndicator|RefreshControl|StatusBar)(?:\s+[^>]*)?>')

        # Pattern for closing tags: </Component>
        closing_pattern = re.compile(r'</([A-Z][a-zA-Z0-9_]*|View|Text|Image|ScrollView|TouchableOpacity|Animated\.View|Animated\.ScrollView|LinearGradient|BlurView|SafeAreaView|FlatList|SectionList|Modal|TextInput|Switch|ActivityIndicator|RefreshControl|StatusBar)>')

        # Pattern for fragment tags
        fragment_open = re.compile(r'<>')
        fragment_close = re.compile(r'</>')

        for i, line in enumerate(lines, 1):
            # Skip comments and strings (basic)
            code_line = re.sub(r'"[^"]*"', '""', line)
            code_line = re.sub(r"'[^']*'", "''", code_line)
            code_line = re.sub(r'`[^`]*`', '``', code_line)

            # Check for self-closing tags (these are fine)
            for match in self_closing_pattern.finditer(code_line):
                pass  # Self-closing tags don't need tracking

            # Check for fragment opens
            for match in fragment_open.finditer(code_line):
                tag_stack.append(('Fragment', i, file_path))

            # Check for fragment closes
            for match in fragment_close.finditer(code_line):
                if tag_stack and tag_stack[-1][0] == 'Fragment':
                    tag_stack.pop()
                else:
                    self.log_error(file_path, i, "Unmatched fragment close tag </>", line)

            # Check for opening tags
            for match in opening_pattern.finditer(code_line):
                tag_name = match.group(1)
                # Skip if it's actually self-closing (ends with />)
                if not code_line[match.end()-2:match.end()] == '/>':
                    tag_stack.append((tag_name, i, file_path))

            # Check for closing tags
            for match in closing_pattern.finditer(code_line):
                tag_name = match.group(1)
                if tag_stack and tag_stack[-1][0] == tag_name:
                    tag_stack.pop()
                else:
                    # Check if the tag exists anywhere in stack
                    found = False
                    for j, (stack_tag, stack_line, _) in enumerate(reversed(tag_stack)):
                        if stack_tag == tag_name:
                            # Pop everything up to this tag
                            for _ in range(j + 1):
                                tag_stack.pop()
                            found = True
                            break
                    if not found:
                        self.log_error(file_path, i, f"Unmatched closing tag </{tag_name}>", line)

        # Report any unclosed tags
        for tag_name, line_num, _ in tag_stack:
            self.log_error(file_path, line_num, f"Unclosed JSX tag <{tag_name}>")

    def check_common_syntax_errors(self, file_path, content, lines):
        """Check for common syntax errors that crash bundles"""

        for i, line in enumerate(lines, 1):
            # Check for double closing braces on same line (common paste error)
            if re.search(r'\}\}\s*\}\}', line):
                self.log_warning(file_path, i, "Suspicious double closing braces }}", line)

            # Check for closing tag without matching opening on same line in wrong order
            if re.search(r'</([A-Za-z.]+)>\s*</([A-Za-z.]+)>', line):
                matches = re.findall(r'</([A-Za-z.]+)>\s*</([A-Za-z.]+)>', line)
                for m in matches:
                    if m[0] != m[1]:
                        self.log_warning(file_path, i, f"Multiple different closing tags on same line: </{m[0]}> </{m[1]}>", line)

            # Check for Text inside Text (can cause issues in some RN versions)
            if '<Text' in line and any(prev_line.strip().startswith('<Text') for prev_line in lines[max(0,i-3):i-1]):
                pass  # This is usually fine

            # Check for missing closing parenthesis in arrow functions
            if '=>' in line and '(' in line and ')' not in line:
                # Check next few lines for closing paren
                found_close = False
                for j in range(i, min(i+5, len(lines))):
                    if ')' in lines[j-1]:
                        found_close = True
                        break
                if not found_close:
                    self.log_warning(file_path, i, "Possible missing closing parenthesis in arrow function", line)

            # Check for unclosed template literals
            backtick_count = line.count('`')
            if backtick_count % 2 != 0:
                self.log_warning(file_path, i, "Possible unclosed template literal (odd number of backticks)", line)

            # Check for common React Native specific issues
            if 'style={[' in line and ']}' not in line:
                # Check if style array is closed
                found_close = False
                for j in range(i, min(i+10, len(lines))):
                    if ']}' in lines[j-1] or ']}' in lines[j-1]:
                        found_close = True
                        break
                if not found_close:
                    self.log_warning(file_path, i, "Possible unclosed style array", line)

    def check_imports(self, file_path, content, lines):
        """Check for import issues"""
        # Find all imports - use raw string to avoid quote issues
        import_pattern = r"import\s+{?([^}]+)}?\s+from\s+['"]([^'"]+)['"]"
        imports = re.findall(import_pattern, content)

        # Check for relative imports that might be circular
        relative_imports = [imp for _, imp in imports if imp.startswith('.')]

        # Check for imports from non-existent files (basic check)
        for imported_names, import_path in imports:
            if import_path.startswith('.'):
                full_path = (file_path.parent / import_path).resolve()
                # Check with various extensions
                exists = False
                for ext in ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js']:
                    if (full_path.with_suffix('') if not ext else Path(str(full_path) + ext)).exists():
                        exists = True
                        break
                if not exists:
                    self.log_error(file_path, 0, f"Import path does not exist: {import_path}")

    def check_hooks_rules(self, file_path, content, lines):
        """Check for common hooks issues"""
        # Check for hooks inside conditionals or loops
        hook_pattern = re.compile(r'\b(use[A-Z][a-zA-Z0-9_]*)\(')

        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if hook_pattern.search(stripped):
                # Check if line is inside a conditional or loop
                # Look at previous lines for if/for/while
                for j in range(max(0, i-5), i):
                    prev = lines[j].strip()
                    if prev.startswith('if ') or prev.startswith('for ') or prev.startswith('while ') or prev.startswith('?'):
                        self.log_warning(file_path, i, f"Hook called inside conditional/loop: {hook_pattern.search(stripped).group(1)}", line)
                        break

    def check_file(self, file_path):
        """Run all checks on a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
        except Exception as e:
            self.log_error(file_path, 0, f"Could not read file: {e}")
            return

        self.files_checked += 1
        file_errors_before = len(self.errors)

        # Run all checks
        self.check_jsx_tags(file_path, content, lines)
        self.check_common_syntax_errors(file_path, content, lines)
        self.check_imports(file_path, content, lines)
        self.check_hooks_rules(file_path, content, lines)

        if len(self.errors) > file_errors_before:
            self.files_with_errors += 1

    def run(self):
        """Run the full diagnostic"""
        print(f"{Colors.BOLD}{Colors.CYAN}╔══════════════════════════════════════════════════════════════╗{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}║     LittleLoom Bundle Diagnostic Tool                        ║{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}╚══════════════════════════════════════════════════════════════╝{Colors.END}")
        print(f"{Colors.BLUE}Project path: {self.project_path}{Colors.END}\n")

        source_files = self.get_source_files()
        print(f"{Colors.BLUE}Found {len(source_files)} source files to check...{Colors.END}\n")

        for file_path in source_files:
            self.check_file(file_path)

        self.print_results()

    def print_results(self):
        """Print diagnostic results"""
        print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
        print(f"{Colors.BOLD}DIAGNOSTIC SUMMARY{Colors.END}")
        print(f"{Colors.BOLD}{'='*70}{Colors.END}")
        print(f"Files checked: {self.files_checked}")
        print(f"Files with errors: {self.files_with_errors}")
        print(f"Total errors: {len(self.errors)}")
        print(f"Total warnings: {len(self.warnings)}")

        if self.errors:
            print(f"\n{Colors.BOLD}{Colors.RED}ERRORS ({len(self.errors)}):{Colors.END}")
            print(f"{Colors.RED}{'─'*70}{Colors.END}")

            # Group by file
            by_file = defaultdict(list)
            for err in self.errors:
                by_file[err['file']].append(err)

            for file_path, errors in sorted(by_file.items()):
                rel_path = Path(file_path).relative_to(self.project_path)
                print(f"\n{Colors.BOLD}{Colors.RED}📁 {rel_path}{Colors.END}")
                for err in errors:
                    line_info = f"line {err['line']}" if err['line'] else "file level"
                    print(f"   {Colors.RED}✗ {line_info}:{Colors.END} {err['message']}")
                    if err['content']:
                        content = err['content'][:80] + '...' if len(err['content']) > 80 else err['content']
                        print(f"      {Colors.YELLOW}→ {content}{Colors.END}")

        if self.warnings:
            print(f"\n{Colors.BOLD}{Colors.YELLOW}WARNINGS ({len(self.warnings)}):{Colors.END}")
            print(f"{Colors.YELLOW}{'─'*70}{Colors.END}")

            by_file = defaultdict(list)
            for warn in self.warnings:
                by_file[warn['file']].append(warn)

            for file_path, warnings in sorted(by_file.items()):
                rel_path = Path(file_path).relative_to(self.project_path)
                print(f"\n{Colors.BOLD}{Colors.YELLOW}📁 {rel_path}{Colors.END}")
                for warn in warnings:
                    line_info = f"line {warn['line']}" if warn['line'] else "file level"
                    print(f"   {Colors.YELLOW}⚠ {line_info}:{Colors.END} {warn['message']}")
                    if warn['content']:
                        content = warn['content'][:80] + '...' if len(warn['content']) > 80 else warn['content']
                        print(f"      {Colors.YELLOW}→ {content}{Colors.END}")

        if not self.errors and not self.warnings:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✅ No issues found!{Colors.END}")
            print(f"{Colors.GREEN}If you're still getting bundle errors, try:{Colors.END}")
            print(f"  1. Check that your entry point (App.tsx or index.ts) is valid")
            print(f"  2. Look for runtime errors in the Metro bundler terminal")
            print(f"  3. Try running: npx expo start --no-dev --minify")
            print(f"  4. Check if a native module is failing to load")

        print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")

def main():
    # Get project path from command line or use current directory
    if len(sys.argv) > 1:
        project_path = sys.argv[1]
    else:
        project_path = os.getcwd()

    diagnostic = BundleDiagnostic(project_path)
    diagnostic.run()

if __name__ == '__main__':
    main()