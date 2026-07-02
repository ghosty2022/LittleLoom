#!/usr/bin/env python3
"""
LittleLoom Bundle Diagnostic Tool v3
Focuses on ACTUAL bundle-breaking issues, not false-positive JSX matching
"""

import os
import re
import sys
import ast
from pathlib import Path
from collections import defaultdict

class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
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
        source_files = []
        exclude_dirs = {'node_modules', '.expo', 'dist', 'build', 'android', 'ios', '.git', 'coverage', 'fixed'}
        
        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
            for file in files:
                if file.endswith(('.tsx', '.ts', '.jsx', '.js')):
                    source_files.append(Path(root) / file)
        return sorted(source_files)

    def check_imports(self, file_path, content, lines):
        """Check for missing import files - ACTUAL bundle breakers"""
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith('import ') and ' from ' in stripped:
                # Extract import path
                match = re.search(r"from\s+['\"]([^'\"]+)['\"]", stripped)
                if match:
                    import_path = match.group(1)
                    # Only check relative imports
                    if import_path.startswith('.'):
                        full_path = (file_path.parent / import_path).resolve()
                        exists = False
                        for ext in ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js']:
                            check_path = Path(str(full_path) + ext)
                            if check_path.exists():
                                exists = True
                                break
                        if not exists:
                            self.log_error(file_path, i, f"Import path does not exist: {import_path}", line)

    def check_syntax_errors(self, file_path, content, lines):
        """Check for actual JavaScript/TypeScript syntax issues"""
        # Check for common syntax errors that break Metro
        
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            
            # Skip comments and strings
            if stripped.startswith('//') or stripped.startswith('*'):
                continue
                
            # Check for unclosed template literals (odd number of backticks outside strings)
            # Simple check: count backticks not inside quotes
            in_string = False
            string_char = None
            backtick_count = 0
            for char in stripped:
                if char in '"\'`':
                    if not in_string:
                        in_string = True
                        string_char = char
                        if char == '`':
                            backtick_count += 1
                    elif char == string_char:
                        in_string = False
                        string_char = None
            
            # Only flag if we have an odd number of backticks AND it's likely a template literal
            if backtick_count % 2 != 0 and re.search(r'\$\{|\`[^\`]*\`', stripped):
                self.log_warning(file_path, i, "Possible unclosed template literal", line)

        # Try to parse with ast for .js files (catches real syntax errors)
        if file_path.suffix == '.js':
            try:
                ast.parse(content)
            except SyntaxError as e:
                self.log_error(file_path, e.lineno or 0, f"JavaScript syntax error: {e.msg}", 
                             lines[e.lineno-1] if e.lineno and e.lineno <= len(lines) else "")

    def check_common_issues(self, file_path, content, lines):
        """Check for common React Native specific issues"""
        
        # Check for missing React import in JSX files
        if file_path.suffix in ('.tsx', '.jsx'):
            has_react_import = 'import React' in content or 'import * as React' in content
            has_jsx = '<' in content and '>' in content
            if has_jsx and not has_react_import:
                self.log_warning(file_path, 1, "File contains JSX but no React import detected")
        
        # Check for hook rules violations (basic)
        hook_pattern = re.compile(r'\b(use[A-Z][a-zA-Z]+)\s*\(')
        hooks_found = hook_pattern.findall(content)
        if hooks_found:
            # Check if hooks are called conditionally (basic check)
            for i, line in enumerate(lines, 1):
                if re.search(r'\b(if|while|for)\s*\(.*\buse[A-Z]', line):
                    self.log_warning(file_path, i, "Hook may be called conditionally", line)

    def check_file(self, file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
        except Exception as e:
            self.log_error(file_path, 0, f"Could not read file: {e}")
            return

        self.files_checked += 1
        file_errors_before = len(self.errors)

        self.check_imports(file_path, content, lines)
        self.check_syntax_errors(file_path, content, lines)
        self.check_common_issues(file_path, content, lines)

        if len(self.errors) > file_errors_before:
            self.files_with_errors += 1

    def run(self):
        print(f"{Colors.BOLD}{Colors.CYAN}╔══════════════════════════════════════════════════════════════╗{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}║     LittleLoom Bundle Diagnostic Tool v3                     ║{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}║     (Fixed false-positive JSX matching)                      ║{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}╚══════════════════════════════════════════════════════════════╝{Colors.END}")
        print(f"{Colors.BLUE}Project path: {self.project_path}{Colors.END}")
        print(f"{Colors.YELLOW}Note: Excluding 'fixed/' backup folder{Colors.END}\n")

        source_files = self.get_source_files()
        print(f"{Colors.BLUE}Found {len(source_files)} source files to check...{Colors.END}\n")

        for file_path in source_files:
            self.check_file(file_path)

        self.print_results()

    def print_results(self):
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

        print(f"\n{Colors.CYAN}{Colors.BOLD}RUNTIME DEBUGGING TIPS:{Colors.END}")
        print(f"  1. Check Metro terminal for red error screens")
        print(f"  2. Run: adb logcat | grep ReactNative  (for Android)")
        print(f"  3. Verify all context providers are properly wrapped")
        print(f"  4. Try: npx expo start --no-dev --minify  (production mode)")
        print(f"  5. Check for TypeScript errors: npx tsc --noEmit")

        print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")

def main():
    project_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    diagnostic = BundleDiagnostic(project_path)
    diagnostic.run()

if __name__ == '__main__':
    main()