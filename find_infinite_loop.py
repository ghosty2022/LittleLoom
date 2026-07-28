#!/usr/bin/env python3
# find_loop_v3.py — Surgical infinite-loop detector

import re
import sys
from pathlib import Path
from collections import defaultdict

PROJECT_ROOT = Path(__file__).parent / "src"
if not PROJECT_ROOT.exists():
    PROJECT_ROOT = Path.cwd() / "src"

EXTS = {".tsx", ".ts", ".jsx", ".js"}
results = []
file_scores = defaultdict(int)

# ── Small brace/string parser ───────────────────────────────────────────

def find_matching(text: str, start: int, open_ch: str, close_ch: str) -> int:
    """Find index of matching close_ch, skipping strings and nested pairs."""
    depth = 1
    i = start + 1
    in_string = False
    esc = False
    while i < len(text):
        ch = text[i]
        if in_string:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_string = False
            i += 1
            continue

        if ch == '"':
            in_string = True
            i += 1
            continue

        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1

def get_line(text: str, pos: int) -> int:
    return text[:pos].count("\n") + 1

def get_snippet(text: str, pos: int, length: int = 90) -> str:
    start = max(0, pos - 10)
    end = min(len(text), pos + length)
    return text[start:end].replace("\n", " ").strip()

def add(file: Path, line: int, cat: str, snippet: str, weight: int):
    results.append({
        "file": str(file.relative_to(Path.cwd())),
        "line": line,
        "cat": cat,
        "snippet": snippet[:120],
        "weight": weight,
    })
    file_scores[str(file)] += weight

# ── Core scanner ────────────────────────────────────────────────────────

def scan_effects(file: Path, text: str):
    """Find useEffect / useLayoutEffect calls and analyse their deps."""
    keywords = ("useEffect", "useLayoutEffect", "useFocusEffect")
    for kw in keywords:
        i = 0
        while True:
            idx = text.find(kw, i)
            if idx == -1:
                break

            # Skip if part of a larger word
            if idx > 0 and text[idx-1].isalnum():
                i = idx + 1
                continue

            # Find opening paren
            j = idx + len(kw)
            while j < len(text) and text[j].isspace():
                j += 1
            if j >= len(text) or text[j] != "(":
                i = idx + 1
                continue

            # Find the comma that separates arg1 from arg2 (or closing paren)
            # We need to skip the arrow function's own parens/braces
            k = j + 1
            paren_depth = 1
            in_string = False
            esc = False
            arg1_end = -1

            while k < len(text) and paren_depth > 0:
                ch = text[k]
                if in_string:
                    if esc:
                        esc = False
                    elif ch == "\\":
                        esc = True
                    elif ch == '"':
                        in_string = False
                    k += 1
                    continue

                if ch == '"':
                    in_string = True
                    k += 1
                    continue

                if ch == "(":
                    paren_depth += 1
                elif ch == ")":
                    paren_depth -= 1
                    if paren_depth == 0:
                        arg1_end = k
                        break

                # Top-level comma separates arguments
                if ch == "," and paren_depth == 1:
                    arg1_end = k
                    break
                k += 1

            if arg1_end == -1:
                i = idx + 1
                continue

            arg1 = text[j+1:arg1_end]

            # Check if arg1 body contains setState / dispatch / navigate / reset
            has_mutation = bool(re.search(r'\b(set\w+|dispatch|navigate|reset)\s*\(', arg1))

            # Determine if there is a dependency array
            rest = text[arg1_end:].lstrip()
            has_deps = rest.startswith(",")

            line = get_line(text, idx)

            if not has_deps:
                if has_mutation:
                    add(file, line, "🔥 EFFECT_NO_DEPS", get_snippet(text, idx), 100)
                else:
                    # Still suspicious if it does ANY work without deps
                    add(file, line, "⚠️  EFFECT_NO_DEPS (no setState)", get_snippet(text, idx), 40)
            else:
                # Extract dependency array content
                dep_start = arg1_end + 1
                while dep_start < len(text) and text[dep_start].isspace():
                    dep_start += 1
                if dep_start < len(text) and text[dep_start] == "[":
                    dep_end = find_matching(text, dep_start, "[", "]")
                    if dep_end != -1:
                        deps = text[dep_start+1:dep_end]

                        # Empty deps [] — usually safe, but flag if it mutates state
                        # (can cause stale-closure bugs, rarely infinite loops)
                        if deps.strip() == "" and has_mutation:
                            add(file, line, "⚠️  EFFECT_EMPTY_DEPS", get_snippet(text, idx), 50)

                        # Inline object/array inside deps
                        elif re.search(r'(?<!\.\.)\{', deps) or re.search(r'(?<!\.\.)\[', deps):
                            if has_mutation:
                                add(file, line, "🔥 EFFECT_INLINE_DEPS", get_snippet(text, idx), 95)

                        # Deps reference a hook that returns objects (common culprit)
                        elif re.search(r'\buse\w+\s*\(', deps) and has_mutation:
                            add(file, line, "🔥 EFFECT_UNSTABLE_HOOK_DEP", get_snippet(text, idx), 85)

            i = idx + 1

def scan_context_providers(file: Path, text: str):
    """Find <Provider value={{...}}> — inline object as value."""
    # Simple regex is enough here; false positives are low
    for m in re.finditer(r'<(\w+(?:Context)?\.Provider|\w+Provider)\s+value\s*=\s*\{\s*\{', text):
        line = get_line(text, m.start())
        add(file, line, "⚠️  CONTEXT_INLINE_VALUE", get_snippet(text, m.start()), 60)

def scan_file(file: Path):
    try:
        text = file.read_text(encoding="utf-8")
    except Exception:
        return

    # Skip tests / generated
    if any(k in file.name.lower() for k in ("test", "spec", ".d.ts")):
        return

    scan_effects(file, text)
    scan_context_providers(file, text)

# ── Main ────────────────────────────────────────────────────────────────

def main():
    print("=" * 72)
    print("  LITTLELOOM — Infinite Loop Detector v3 (Surgical)")
    print("=" * 72)

    if not PROJECT_ROOT.exists():
        print(f"\n❌  src/ not found at {PROJECT_ROOT}")
        sys.exit(1)

    files_scanned = 0
    for ext in EXTS:
        for f in PROJECT_ROOT.rglob(f"*{ext}"):
            if any(p.startswith(".") or p == "node_modules" for p in f.parts):
                continue
            scan_file(f)
            files_scanned += 1

    # Sort by weight, then deduplicate identical (file, line, cat)
    results.sort(key=lambda x: x["weight"], reverse=True)
    seen = set()
    unique_results = []
    for r in results:
        key = (r["file"], r["line"], r["cat"])
        if key not in seen:
            seen.add(key)
            unique_results.append(r)

    print(f"\n📁  Scanned {files_scanned} files")
    print(f"🎯  Found {len(unique_results)} unique issues\n")

    if not unique_results:
        print("✅  No obvious infinite-loop patterns found.")
        return

    # Print top hits
    print("─" * 72)
    print("TOP CULPRITS (highest confidence first):")
    print("─" * 72)
    for r in unique_results[:25]:
        bar = "█" * (r["weight"] // 10)
        print(f"\n  {bar}  {r['weight']} pts  {r['cat']}")
        print(f"       {r['file']}:{r['line']}")
        print(f"       {r['snippet']}")

    # File summary
    print("\n" + "─" * 72)
    print("FILES RANKED BY TOTAL DANGER:")
    print("─" * 72)
    for f, score in sorted(file_scores.items(), key=lambda x: x[1], reverse=True)[:12]:
        bar = "█" * min(score // 40, 20)
        print(f"  {bar}  {score:5d}  {Path(f).name}")

    # Specific hint based on user's Metro logs
    print("\n" + "=" * 72)
    print("💡  DIAGNOSIS BASED ON YOUR METRO LOGS:")
    print("=" * 72)
    print("""
  Your logs show:
    🔓 Reset all security locks
    🔓 Reset all security locks
    🔓 Force unlocked
    → Then "Maximum update depth exceeded"

  This means the loop is in your SECURITY / AUTH flow.

  Check these files FIRST (from your v2 scan):
    1. SecurityCenterScreen.tsx   (score: 6555)
    2. CommunityContext.tsx       (score: 5035)

  Look for:
    useEffect(() => {
      setSecurityLocked(false);   // or setIsLocked, setPin, etc.
    }, [someObjectThatChangesEveryRender])
    """)
    print("=" * 72)

if __name__ == "__main__":
    main()