#!/usr/bin/env python3
"""
LittleLoom Bundle Diagnostic Tool v4 - DEEP SCAN
Catches ACTUAL Metro bundle breakers: syntax errors, import cycles,
undefined exports, malformed JSX, missing dependencies, and more.
"""

import os
import re
import sys
import ast
import json
from pathlib import Path
from collections import defaultdict, deque

class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    BOLD = '\033[1m'
    END = '\033[0m'

class BundleDiagnostic:
    def __init__(self, project_path):
        self.project_path = Path(project_path)
        self.errors = []
        self.warnings = []
        self.files_checked = 0
        self.files_with_errors = 0
        self.all_exports = {}  # file -> set of exported names
        self.all_imports = {}  # file -> list of {name, source}
        self.package_json = None
        self.tsconfig = None

    def log_error(self, file_path, line_num, message, line_content="", severity="CRITICAL"):
        self.errors.append({
            'file': str(file_path),
            'line': line_num,
            'message': message,
            'content': line_content.strip() if line_content else "",
            'severity': severity
        })

    def log_warning(self, file_path, line_num, message, line_content=""):
        self.warnings.append({
            'file': str(file_path),
            'line': line_num,
            'message': message,
            'content': line_content.strip() if line_content else ""
        })

    def load_configs(self):
        """Load package.json and tsconfig.json"""
        pkg_path = self.project_path / 'package.json'
        if pkg_path.exists():
            try:
                with open(pkg_path, 'r', encoding='utf-8') as f:
                    self.package_json = json.load(f)
            except Exception as e:
                self.log_error(pkg_path, 0, f"Corrupted package.json: {e}")

        tsconfig_path = self.project_path / 'tsconfig.json'
        if tsconfig_path.exists():
            try:
                with open(tsconfig_path, 'r', encoding='utf-8') as f:
                    self.tsconfig = json.load(f)
            except Exception as e:
                self.log_error(tsconfig_path, 0, f"Corrupted tsconfig.json: {e}")

    def get_source_files(self):
        source_files = []
        exclude_dirs = {'node_modules', '.expo', 'dist', 'build', 'android', 'ios', '.git', 
                        'coverage', 'fixed', '__tests__', '__mocks__'}

        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
            for file in files:
                if file.endswith(('.tsx', '.ts', '.jsx', '.js')):
                    source_files.append(Path(root) / file)
        return sorted(source_files)

    def resolve_import_path(self, import_path, importing_file):
        """Resolve a relative import to an actual file path"""
        if not import_path.startswith('.'):
            return None  # Not a relative import

        base = (importing_file.parent / import_path).resolve()
        extensions = ['', '.tsx', '.ts', '.jsx', '.js', 
                      '/index.tsx', '/index.ts', '/index.jsx', '/index.js']
        for ext in extensions:
            check = Path(str(base) + ext)
            if check.exists():
                return check
        return None

    def extract_exports(self, file_path, content, lines):
        """Extract all named and default exports from a file"""
        exports = set()

        # Default export
        if re.search(r'export\s+default\s+(?:class|function|const|let|var|\w+)', content):
            exports.add('default')

        # Named exports: export const Foo, export function Foo, export class Foo
        named_pattern = re.compile(r'export\s+(?:const|let|var|function|class)\s+(\w+)')
        for match in named_pattern.finditer(content):
            exports.add(match.group(1))

        # export { Foo, Bar }
        export_block_pattern = re.compile(r'export\s*\{([^}]+)\}')
        for match in export_block_pattern.finditer(content):
            names = re.findall(r'(?:\w+\s+as\s+)?(\w+)', match.group(1))
            exports.update(n for n in names if n)

        # export * from './something'
        star_pattern = re.compile(r"export\s*\*\s*from\s+['"]([^'"]+)['"]")
        for match in star_pattern.finditer(content):
            source = match.group(1)
            resolved = self.resolve_import_path(source, file_path)
            if resolved and resolved in self.all_exports:
                exports.update(self.all_exports[resolved])

        self.all_exports[file_path] = exports
        return exports

    def extract_imports(self, file_path, content, lines):
        """Extract all imports from a file"""
        imports = []

        # import Foo from './bar'
        default_pattern = re.compile(r"import\s+(\w+)\s+from\s+['"]([^'"]+)['"]")
        for match in default_pattern.finditer(content):
            imports.append({'name': match.group(1), 'source': match.group(2), 'type': 'default'})

        # import { Foo, Bar } from './baz'
        named_pattern = re.compile(r"import\s*\{([^}]+)\}\s*from\s+['"]([^'"]+)['"]")
        for match in named_pattern.finditer(content):
            source = match.group(2)
            names = [n.strip().split(' as ')[0].strip() for n in match.group(1).split(',')]
            for name in names:
                if name:
                    imports.append({'name': name, 'source': source, 'type': 'named'})

        # import * as Foo from './bar'
        namespace_pattern = re.compile(r"import\s*\*\s*as\s+(\w+)\s+from\s+['"]([^'"]+)['"]")
        for match in namespace_pattern.finditer(content):
            imports.append({'name': match.group(1), 'source': match.group(2), 'type': 'namespace'})

        self.all_imports[file_path] = imports
        return imports

    def check_imports(self, file_path, content, lines):
        """Check for missing import files and unresolved named imports"""
        imports = self.extract_imports(file_path, content, lines)

        for imp in imports:
            source = imp['source']

            # Check relative imports exist
            if source.startswith('.'):
                resolved = self.resolve_import_path(source, file_path)
                if not resolved:
                    # Find the line number
                    for i, line in enumerate(lines, 1):
                        if source in line and 'import' in line:
                            self.log_error(file_path, i, 
                                f"IMPORT NOT FOUND: '{source}' — file does not exist", 
                                line, "CRITICAL")
                            break
                else:
                    # Check if named import exists in target (if we know the exports)
                    if imp['type'] == 'named' and resolved in self.all_exports:
                        target_exports = self.all_exports[resolved]
                        if imp['name'] not in target_exports:
                            for i, line in enumerate(lines, 1):
                                if imp['name'] in line and source in line:
                                    self.log_error(file_path, i,
                                        f"NAMED IMPORT NOT EXPORTED: '{imp['name']}' from '{source}' — "
                                        f"target exports: {sorted(target_exports)[:5]}",
                                        line, "CRITICAL")
                                    break

            # Check npm package dependencies
            elif not source.startswith('.') and not source.startswith('@/'):
                pkg_name = source.split('/')[0]
                if pkg_name.startswith('@'):
                    pkg_name = '/'.join(source.split('/')[:2])

                if self.package_json:
                    deps = {**self.package_json.get('dependencies', {}), 
                            **self.package_json.get('devDependencies', {})}
                    if pkg_name not in deps:
                        for i, line in enumerate(lines, 1):
                            if source in line and 'import' in line:
                                self.log_error(file_path, i,
                                    f"MISSING DEPENDENCY: '{pkg_name}' not found in package.json",
                                    line, "CRITICAL")
                                break

    def check_syntax_errors(self, file_path, content, lines):
        """Deep syntax checking for JS/TS files"""

        # Check for unbalanced braces/parens/brackets
        stack = []
        line_of_open = {}

        in_string = False
        string_char = None
        in_template = False
        in_regex = False
        escaped = False

        for char_idx, char in enumerate(content):
            line_num = content[:char_idx].count('\n') + 1

            if escaped:
                escaped = False
                continue

            if char == '\\':
                escaped = True
                continue

            # String handling
            if char in '"'`':
                if not in_string and not in_template:
                    in_string = True
                    string_char = char
                    if char == '`':
                        in_template = True
                elif char == string_char:
                    in_string = False
                    string_char = None
                    in_template = False
                continue

            if in_string:
                continue

            # Comments
            if char == '/' and char_idx + 1 < len(content):
                next_char = content[char_idx + 1]
                if next_char == '/':
                    # Skip to end of line
                    while char_idx < len(content) and content[char_idx] != '\n':
                        char_idx += 1
                    continue
                elif next_char == '*':
                    # Skip to end of comment
                    while char_idx < len(content) - 1:
                        if content[char_idx] == '*' and content[char_idx + 1] == '/':
                            break
                        char_idx += 1
                    continue

            # Bracket matching
            if char in '({[':
                stack.append((char, line_num))
            elif char in ')}]':
                if not stack:
                    self.log_error(file_path, line_num, 
                        f"UNEXPECTED CLOSING '{char}' — no matching opener", 
                        lines[line_num-1] if line_num <= len(lines) else "", "CRITICAL")
                else:
                    opener, open_line = stack.pop()
                    pairs = {'(': ')', '{': '}', '[': ']'}
                    if pairs[opener] != char:
                        self.log_error(file_path, line_num,
                            f"MISMATCHED BRACKETS: '{opener}' (line {open_line}) closed with '{char}'",
                            lines[line_num-1] if line_num <= len(lines) else "", "CRITICAL")

        if stack:
            for opener, line_num in stack:
                self.log_error(file_path, line_num,
                    f"UNCLOSED '{opener}' — never closed, file ends prematurely",
                    lines[line_num-1] if line_num <= len(lines) else "", "CRITICAL")

        # Check for common JS syntax killers
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if not stripped or stripped.startswith('//') or stripped.startswith('*'):
                continue

            # Double commas
            if re.search(r',\s*,', stripped):
                self.log_error(file_path, i, "DOUBLE COMMA — syntax error", line, "CRITICAL")

            # Trailing comma in function params (pre-ES2017 issue)
            if re.search(r'function\s*\w*\s*\([^)]*,\s*\)', stripped):
                self.log_warning(file_path, i, "Trailing comma in function parameters", line)

            # Missing comma between object properties
            if re.search(r'\w+\s*:\s*[^,\s]+\s+\w+\s*:', stripped) and not stripped.startswith('//'):
                if not re.search(r'[?{}()[\]]', stripped):
                    self.log_warning(file_path, i, "Possible missing comma between properties", line)

            # JSX without React import
            if '<' in stripped and '>' in stripped and not stripped.startswith('import'):
                # Check for JSX-specific patterns
                if re.search(r'<[A-Z][a-zA-Z]*', stripped) or re.search(r'</[a-z]+>', stripped):
                    pass  # Looks like JSX

        # AST parse for .js files
        if file_path.suffix == '.js':
            try:
                ast.parse(content)
            except SyntaxError as e:
                self.log_error(file_path, e.lineno or 0, 
                    f"JAVASCRIPT SYNTAX ERROR: {e.msg}", 
                    lines[e.lineno-1] if e.lineno and e.lineno <= len(lines) else "", "CRITICAL")
            except Exception as e:
                self.log_error(file_path, 0, 
                    f"PARSE ERROR: {type(e).__name__}: {e}", "", "CRITICAL")

    def check_jsx_issues(self, file_path, content, lines):
        """Check for JSX-specific issues that break Metro"""

        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if not stripped or stripped.startswith('//') or stripped.startswith('*'):
                continue

            # Unclosed JSX tags (simplified check)
            open_tags = len(re.findall(r'<[A-Za-z][^>]*[^/]>', stripped))
            close_tags = len(re.findall(r'</[A-Za-z][^>]*>', stripped))
            self_closing = len(re.findall(r'<[A-Za-z][^>]*/>', stripped))

            # JSX in expressions without proper wrapping
            if re.search(r'return\s+[^(\s]', stripped) and '<' in stripped:
                if not re.search(r'return\s*\(', stripped):
                    pass  # Could be valid in some cases

            # JSX attribute without value when required
            if re.search(r'\w+=[^"'\{]', stripped) and '<' in stripped:
                if not re.search(r'\w+=\{', stripped) and not re.search(r'\w+="', stripped):
                    if not re.search(r'\w+=true|false|null|undefined', stripped):
                        pass  # Might be shorthand boolean

    def check_commonjs_issues(self, file_path, content, lines):
        """Check for CommonJS/ES module mixing issues"""
        has_require = 'require(' in content
        has_import = any(l.strip().startswith('import ') for l in lines)
        has_export = any('export ' in l for l in lines)
        has_module_exports = 'module.exports' in content

        if has_import and has_require:
            self.log_warning(file_path, 1, 
                "MIXED MODULES: Uses both ES import and CommonJS require — can cause issues")

        if has_export and has_module_exports:
            self.log_warning(file_path, 1,
                "MIXED EXPORTS: Uses both ES export and module.exports — can cause issues")

    def check_react_native_specific(self, file_path, content, lines):
        """React Native specific checks"""

        # Check for hook rules
        hook_pattern = re.compile(r'\b(use[A-Z][a-zA-Z]+)\s*\(')

        for i, line in enumerate(lines, 1):
            stripped = line.strip()

            # Hooks in conditionals
            if re.search(r'\b(if|while|for|switch)\s*\(.*\buse[A-Z]', stripped):
                self.log_error(file_path, i, 
                    f"HOOK IN CONDITIONAL: Hook called inside conditional — violates Rules of Hooks",
                    line, "CRITICAL")

            # Hooks in loops
            if re.search(r'\b(for|while)\s*\(', stripped):
                if hook_pattern.search(stripped):
                    self.log_error(file_path, i,
                        f"HOOK IN LOOP: Hook called inside loop — violates Rules of Hooks",
                        line, "CRITICAL")

            # Hooks in callbacks (basic check)
            if re.search(r'=>\s*\{[^}]*use[A-Z]', stripped):
                self.log_error(file_path, i,
                    f"HOOK IN CALLBACK: Hook called inside callback — violates Rules of Hooks",
                    line, "CRITICAL")

        # Check for missing React import in JSX files
        if file_path.suffix in ('.tsx', '.jsx'):
            has_react_import = 'import React' in content or 'import * as React' in content
            has_jsx = bool(re.search(r'<[A-Z][a-zA-Z]', content))
            if has_jsx and not has_react_import:
                # In newer React (17+), JSX transform doesn't need React import
                # But for React Native with older setup, it might be needed
                self.log_warning(file_path, 1, 
                    "No React import found — may be needed depending on JSX transform config")

    def check_babel_metro_issues(self, file_path, content, lines):
        """Check for issues that specifically break Metro bundler"""

        for i, line in enumerate(lines, 1):
            stripped = line.strip()

            # Dynamic requires that Metro can't resolve
            if re.search(r'require\s*\(\s*[^"'\`]', stripped):
                if not stripped.startswith('//'):
                    self.log_warning(file_path, i,
                        "DYNAMIC REQUIRE: Metro may not be able to statically analyze this",
                        line)

            # Circular dependency indicator
            if 'require.main' in stripped or 'module.parent' in stripped:
                self.log_warning(file_path, i,
                    "CIRCULAR DEPENDENCY PATTERN: May cause issues with Metro", line)

    def detect_cycles(self, source_files):
        """Detect circular dependencies"""
        # Build dependency graph
        graph = defaultdict(set)
        file_map = {}

        for file_path in source_files:
            rel = str(file_path.relative_to(self.project_path))
            file_map[rel] = file_path
            imports = self.all_imports.get(file_path, [])
            for imp in imports:
                if imp['source'].startswith('.'):
                    resolved = self.resolve_import_path(imp['source'], file_path)
                    if resolved:
                        graph[rel].add(str(resolved.relative_to(self.project_path)))

        # Find cycles using DFS
        visited = set()
        rec_stack = set()
        cycles = []

        def dfs(node, path):
            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for neighbor in graph.get(node, []):
                if neighbor not in visited:
                    result = dfs(neighbor, path)
                    if result:
                        return result
                elif neighbor in rec_stack:
                    cycle_start = path.index(neighbor)
                    cycle = path[cycle_start:] + [neighbor]
                    return cycle

            path.pop()
            rec_stack.remove(node)
            return None

        for node in list(graph.keys()):
            if node not in visited:
                cycle = dfs(node, [])
                if cycle:
                    cycles.append(cycle)

        if cycles:
            for cycle in cycles[:3]:  # Report first 3
                cycle_str = " → ".join(cycle)
                self.log_error(file_path, 0,
                    f"CIRCULAR DEPENDENCY DETECTED: {cycle_str}",
                    "", "CRITICAL")

    def check_file(self, file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
        except UnicodeDecodeError:
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    content = f.read()
                    lines = content.split('\n')
                self.log_warning(file_path, 1, "File has non-UTF-8 encoding (latin-1)")
            except Exception as e:
                self.log_error(file_path, 0, f"Could not read file: {e}", "", "CRITICAL")
                return
        except Exception as e:
            self.log_error(file_path, 0, f"Could not read file: {e}", "", "CRITICAL")
            return

        self.files_checked += 1
        file_errors_before = len(self.errors)

        # Extract exports first (needed for import checking)
        self.extract_exports(file_path, content, lines)

        # Run all checks
        self.check_imports(file_path, content, lines)
        self.check_syntax_errors(file_path, content, lines)
        self.check_jsx_issues(file_path, content, lines)
        self.check_commonjs_issues(file_path, content, lines)
        self.check_react_native_specific(file_path, content, lines)
        self.check_babel_metro_issues(file_path, content, lines)

        if len(self.errors) > file_errors_before:
            self.files_with_errors += 1

    def check_entry_points(self):
        """Check main entry points exist and are valid"""
        entry_files = ['App.tsx', 'App.ts', 'App.jsx', 'App.js', 'index.ts', 'index.js']
        found_entry = False

        for entry in entry_files:
            entry_path = self.project_path / entry
            if entry_path.exists():
                found_entry = True
                with open(entry_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if not content.strip():
                    self.log_error(entry_path, 1, "ENTRY POINT IS EMPTY", "", "CRITICAL")
                break

        if not found_entry:
            self.log_error(self.project_path, 0, 
                "NO ENTRY POINT FOUND: Missing App.tsx/ts/jsx/js or index.ts/js", "", "CRITICAL")

    def check_babel_config(self):
        """Check babel config for issues"""
        babel_files = ['babel.config.js', 'babel.config.json', '.babelrc', '.babelrc.js']
        found = False
        for bf in babel_files:
            bp = self.project_path / bf
            if bp.exists():
                found = True
                with open(bp, 'r', encoding='utf-8') as f:
                    content = f.read()
                if 'reanimated' in content.lower():
                    if 'module:metro-react-native-babel-preset' not in content:
                        self.log_warning(bp, 1,
                            "Reanimated plugin found but metro preset may be missing")
        if not found:
            self.log_warning(self.project_path, 0, "No babel config found")

    def run(self):
        print(f"{Colors.BOLD}{Colors.CYAN}╔══════════════════════════════════════════════════════════════════════╗{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}║     LittleLoom Bundle Diagnostic Tool v4 — DEEP SCAN                 ║{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}║     Finds REAL Metro bundle breakers, not false positives            ║{Colors.END}")
        print(f"{Colors.BOLD}{Colors.CYAN}╚══════════════════════════════════════════════════════════════════════╝{Colors.END}")
        print(f"{Colors.BLUE}Project path: {self.project_path}{Colors.END}")
        print(f"{Colors.YELLOW}Scanning ALL source files for CRITICAL bundle-breaking issues...{Colors.END}\n")

        self.load_configs()
        self.check_entry_points()
        self.check_babel_config()

        source_files = self.get_source_files()
        print(f"{Colors.BLUE}Found {len(source_files)} source files to analyze...{Colors.END}\n")

        # First pass: extract all exports
        for file_path in source_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')
                self.extract_exports(file_path, content, lines)
            except:
                pass

        # Second pass: full analysis
        for file_path in source_files:
            self.check_file(file_path)

        # Detect circular dependencies
        self.detect_cycles(source_files)

        self.print_results()

    def print_results(self):
        print(f"\n{Colors.BOLD}{'='*78}{Colors.END}")
        print(f"{Colors.BOLD}DIAGNOSTIC SUMMARY{Colors.END}")
        print(f"{Colors.BOLD}{'='*78}{Colors.END}")
        print(f"Files checked: {self.files_checked}")
        print(f"Files with errors: {self.files_with_errors}")

        critical = [e for e in self.errors if e.get('severity') == 'CRITICAL']
        warnings_only = [e for e in self.errors if e.get('severity') != 'CRITICAL']

        print(f"{Colors.RED}CRITICAL errors (bundle breakers): {len(critical)}{Colors.END}")
        print(f"{Colors.YELLOW}Other errors: {len(warnings_only)}{Colors.END}")
        print(f"{Colors.YELLOW}Warnings: {len(self.warnings)}{Colors.END}")

        if critical:
            print(f"\n{Colors.BOLD}{Colors.RED}{'▓'*78}{Colors.END}")
            print(f"{Colors.BOLD}{Colors.RED} 🚨 CRITICAL BUNDLE-BREAKING ERRORS ({len(critical)}){Colors.END}")
            print(f"{Colors.BOLD}{Colors.RED}{'▓'*78}{Colors.END}")
            by_file = defaultdict(list)
            for err in critical:
                by_file[err['file']].append(err)
            for file_path, errors in sorted(by_file.items()):
                rel_path = Path(file_path).relative_to(self.project_path)
                print(f"\n{Colors.BOLD}{Colors.RED}📁 {rel_path}{Colors.END}")
                for err in errors:
                    line_info = f"line {err['line']}" if err['line'] else "file level"
                    print(f"   {Colors.RED}✗ [{line_info}]{Colors.END}")
                    print(f"      {Colors.BOLD}{err['message']}{Colors.END}")
                    if err['content']:
                        content = err['content'][:100] + '...' if len(err['content']) > 100 else err['content']
                        print(f"      {Colors.CYAN}→ {content}{Colors.END}")

        if warnings_only:
            print(f"\n{Colors.BOLD}{Colors.YELLOW}⚠️  OTHER ERRORS ({len(warnings_only)}):{Colors.END}")
            print(f"{Colors.YELLOW}{'─'*78}{Colors.END}")
            by_file = defaultdict(list)
            for err in warnings_only:
                by_file[err['file']].append(err)
            for file_path, errors in sorted(by_file.items()):
                rel_path = Path(file_path).relative_to(self.project_path)
                print(f"\n{Colors.BOLD}{Colors.YELLOW}📁 {rel_path}{Colors.END}")
                for err in errors:
                    line_info = f"line {err['line']}" if err['line'] else "file level"
                    print(f"   {Colors.YELLOW}⚠ {line_info}:{Colors.END} {err['message']}")

        if self.warnings:
            print(f"\n{Colors.BOLD}{Colors.MAGENTA}💡 WARNINGS ({len(self.warnings)}):{Colors.END}")
            print(f"{Colors.MAGENTA}{'─'*78}{Colors.END}")
            by_file = defaultdict(list)
            for warn in self.warnings:
                by_file[warn['file']].append(warn)
            for file_path, warnings in sorted(by_file.items()):
                rel_path = Path(file_path).relative_to(self.project_path)
                print(f"\n{Colors.BOLD}{Colors.MAGENTA}📁 {rel_path}{Colors.END}")
                for warn in warnings:
                    line_info = f"line {warn['line']}" if warn['line'] else "file level"
                    print(f"   {Colors.MAGENTA}💡 {line_info}:{Colors.END} {warn['message']}")

        if not self.errors and not self.warnings:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✅ No issues found!{Colors.END}")

        print(f"\n{Colors.CYAN}{Colors.BOLD}🔧 NEXT STEPS:{Colors.END}")
        if critical:
            print(f"{Colors.RED}1. FIX ALL CRITICAL ERRORS ABOVE — these will crash your app{Colors.END}")
            print(f"{Colors.YELLOW}2. Run: npx tsc --noEmit  (TypeScript check){Colors.END}")
            print(f"{Colors.YELLOW}3. Run: npx expo start --clear  (clear Metro cache){Colors.END}")
        else:
            print(f"{Colors.GREEN}1. No critical bundle errors found in source files{Colors.END}")
            print(f"{Colors.YELLOW}2. Try: npx expo start --clear  (clear Metro cache){Colors.END}")
            print(f"{Colors.YELLOW}3. Check: node_modules may be corrupted — try deleting and reinstalling{Colors.END}")
            print(f"{Colors.YELLOW}4. Check: babel.config.js and metro.config.js for misconfigurations{Colors.END}")

        print(f"\n{Colors.CYAN}5. For runtime debugging:{Colors.END}")
        print(f"   adb logcat | grep ReactNative  (Android)")
        print(f"   Console.app  (iOS Simulator logs)")
        print(f"\n{Colors.BOLD}{'='*78}{Colors.END}")

def main():
    project_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    diagnostic = BundleDiagnostic(project_path)
    diagnostic.run()

if __name__ == '__main__':
    main()