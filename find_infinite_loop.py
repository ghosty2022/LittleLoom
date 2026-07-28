#!/usr/bin/env python3
# find_loop_v2.py — Precise infinite-loop detector for React Native

import os
import re
import sys
from pathlib import Path
from collections import defaultdict

PROJECT_ROOT = Path(__file__).parent / "src"
if not PROJECT_ROOT.exists():
    PROJECT_ROOT = Path.cwd() / "src"

EXTS = {".tsx", ".ts", ".jsx", ".js"}

# ── Patterns that ACTUALLY cause infinite loops ─────────────────────────

# 1. useEffect / useLayoutEffect with NO dependency array at all
#    useEffect(() => { setSomething(...) })   ← runs every render
EFFECT_NO_DEPS = re.compile(
    r'(useEffect|useLayoutEffect)\s*\(\s*(?:\(\)\s*=>|function)\s*[^{]*\{'
    r'[^{}]*?(?:set\w+|dispatch|navigate|reset)\s*\('
    r'[^{}]*?\}\s*\)(?!\s*,)',  # negative lookahead: no comma after the closing paren
    re.DOTALL
)

# 2. useEffect with empty deps [] that still calls setState 
#    (usually fine, but dangerous if combined with context/prop changes)
EFFECT_EMPTY_DEPS_SETSTATE = re.compile(
    r'(useEffect|useLayoutEffect)\s*\(\s*(?:\(\)\s*=>|function)\s*[^{]*\{'
    r'[^{}]*?(?:set\w+|dispatch)\s*\('
    r'[^{}]*?\}\s*,\s*\[\s*\]\s*\)',
    re.DOTALL
)

# 3. useEffect where deps contain an inline object or array literal
#    useEffect(..., [{foo}]) or useEffect(..., [someArray])
EFFECT_INLINE_DEPS = re.compile(
    r'(useEffect|useLayoutEffect)\s*\(\s*(?:\(\)\s*=>|function)\s*[^{]*\{'
    r'[^{}]*?(?:set\w+|dispatch|navigate|reset)\s*\('
    r'[^{}]*?\}\s*,\s*\[\s*[^\]]*?(?:\{[^\}]*\}|\[[^\]]*\])[^\]]*?\]\s*\)',
    re.DOTALL
)

# 4. useEffect that sets state based on a prop or context value
#    useEffect(() => { setX(props.foo) }, [props.foo])
EFFECT_SETSTATE_FROM_PROP = re.compile(
    r'(useEffect|useLayoutEffect)\s*\(\s*(?:\(\)\s*=>|function)\s*[^{]*\{'
    r'[^{}]*?set\w+\s*\(\s*(?:[^)]*?props\.|[^)]*?context\.|[^)]*?use\w+\([^)]*\))'
    r'[^{}]*?\}\s*,\s*\[',
    re.DOTALL
)

# 5. Context Provider passing an inline object literal as value
#    <MyContext.Provider value={{ state, setState }}>
CONTEXT_INLINE_VALUE = re.compile(
    r'<(\w+(?:Context)?\.Provider|\w+Provider)\s+value\s*=\s*\{\s*\{',
    re.DOTALL
)

# 6. useState called with a function/expression that creates a new object every render
#    const [x, setX] = useState({}) or useState([]) or useState(someExpression())
USESTATE_INLINE_INIT = re.compile(
    r'const\s+\[\s*\w+\s*,\s*set\w+\s*\]\s*=\s*useState\s*\(\s*(?:\{\s*\}|\[\s*\]|'
    r'(?:\w+\(\)|new\s+\w+\(|Object\.|Array\.|JSON\.parse|JSON\.stringify))',
    re.DOTALL
)

# 7. setState called directly in the render body (outside any hook/handler)
#    Heuristic: line contains setX(...) but not inside useEffect, onPress, etc.
SETSTATE_IN_RENDER = re.compile(
    r'^\s*set\w+\s*\([^)]+\)',
    re.MULTILINE
)

# 8. useEffect that calls navigate/reset with no deps or props-based deps
EFFECT_NAVIGATE = re.compile(
    r'(useEffect|useLayoutEffect)\s*\(\s*(?:\(\)\s*=>|function)\s*[^{]*\{'
    r'[^{}]*?(?:navigate|reset)\s*\('
    r'[^{}]*?\}\s*,\s*\[',
    re.DOTALL
)

results = []
file_scores = defaultdict(int)

def get_line(text: str, pos: int) -> int:
    return text[:pos].count("\n") + 1

def get_snippet(text: str, pos: int, length: int = 80) -> str:
    start = max(0, pos - 20)
    end = min(len(text), pos + length)
    snippet = text[start:end].replace("\n", " ").strip()
    return snippet

def add(file: Path, line: int, cat: str, snippet: str, weight: int):
    # Filter out obvious false positives
    snippet_clean = snippet.lower()
    if "useref" in snippet_clean and cat == "effect_no_deps":
        return
    if "usecallback" in snippet_clean:
        return
    if "usememo" in snippet_clean:
        return
    if "console.log" in snippet_clean and weight < 50:
        return
    
    results.append({
        "file": str(file.relative_to(Path.cwd())),
        "line": line,
        "cat": cat,
        "snippet": snippet[:120],
        "weight": weight,
    })
    file_scores[str(file)] += weight

def scan_file(file: Path):
    try:
        text = file.read_text(encoding="utf-8")
    except Exception:
        return

    # Skip test files and generated code
    if "test" in file.name.lower() or "spec" in file.name.lower():
        return

    # 1. Effect with no deps
    for m in EFFECT_NO_DEPS.finditer(text):
        line = get_line(text, m.start())
        snippet = get_snippet(text, m.start())
        if "useRef" not in snippet and "useMemo" not in snippet:
            add(file, line, "🔥 EFFECT_NO_DEPS", snippet, 100)

    # 2. Effect with [] that calls setState
    for m in EFFECT_EMPTY_DEPS_SETSTATE.finditer(text):
        line = get_line(text, m.start())
        snippet = get_snippet(text, m.start())
        add(file, line, "⚠️  EFFECT_EMPTY_SETSTATE", snippet, 60)

    # 3. Effect with inline object/array deps
    for m in EFFECT_INLINE_DEPS.finditer(text):
        line = get_line(text, m.start())
        snippet = get_snippet(text, m.start())
        add(file, line, "🔥 EFFECT_INLINE_DEPS", snippet, 90)

    # 4. Effect sets state from props/context
    for m in EFFECT_SETSTATE_FROM_PROP.finditer(text):
        line = get_line(text, m.start())
        snippet = get_snippet(text, m.start())
        add(file, line, "🔥 EFFECT_SETSTATE_FROM_PROP", snippet, 85)

    # 5. Context inline value
    for m in CONTEXT_INLINE_VALUE.finditer(text):
        line = get_line(text, m.start())
        snippet = get_snippet(text, m.start())
        add(file, line, "⚠️  CONTEXT_INLINE_VALUE", snippet, 70)

    # 6. useState with inline object/array init
    for m in USESTATE_INLINE_INIT.finditer(text):
        line = get_line(text, m.start())
        snippet = get_snippet(text, m.start())
        add(file, line, "⚠️  USESTATE_INLINE_INIT", snippet, 50)

    # 7. setState in render body
    for m in SETSTATE_IN_RENDER.finditer(text):
        line = get_line(text, m.start())
        snippet = get_snippet(text, m.start())
        # Only flag if not inside a handler name
        if not any(h in snippet.lower() for h in ["onpress", "onchange", "onsubmit", "handler", "callback"]):
            add(file, line, "🔥 SETSTATE_IN_RENDER", snippet, 95)

    # 8. Effect that navigates
    for m in EFFECT_NAVIGATE.finditer(text):
        line = get_line(text, m.start())
        snippet = get_snippet(text, m.start())
        add(file, line, "🔥 EFFECT_NAVIGATE", snippet, 90)

def main():
    print("=" * 72)
    print("  LITTLELOOM — Infinite Loop Detector v2 (Precision Mode)")
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

    results.sort(key=lambda x: x["weight"], reverse=True)

    print(f"\n📁  Scanned {files_scanned} files")
    print(f"🎯  Found {len(results)} HIGH-CONFIDENCE issues\n")

    if not results:
        print("✅  No obvious infinite-loop patterns found.")
        print("   The loop may be inside a 3rd-party library.")
        return

    # Top individual hits
    print("─" * 72)
    print("TOP CULPRITS (highest confidence first):")
    print("─" * 72)
    seen = set()
    for r in results[:20]:
        key = (r["file"], r["line"], r["cat"])
        if key in seen:
            continue
        seen.add(key)
        bar = "█" * (r["weight"] // 10)
        print(f"\n  {bar}  {r['weight']} pts  {r['cat']}")
        print(f"       {r['file']}:{r['line']}")
        print(f"       {r['snippet']}")

    # File summary
    print("\n" + "─" * 72)
    print("FILES RANKED BY TOTAL DANGER:")
    print("─" * 72)
    for f, score in sorted(file_scores.items(), key=lambda x: x[1], reverse=True)[:10]:
        bar = "█" * min(score // 50, 20)
        print(f"  {bar}  {score:5d}  {Path(f).name}")

    print("\n" + "=" * 72)
    print("🔍  QUICK DIAGNOSIS GUIDE:")
    print("=" * 72)
    print("""
  🔥 EFFECT_NO_DEPS
     → useEffect(() => { setX(...) }) has NO dependency array.
       FIX: Add [stableDep] or use useRef.

  🔥 EFFECT_INLINE_DEPS  
     → useEffect(..., [{foo}]) or useEffect(..., [array]).
       The object/array is recreated every render → effect runs forever.
       FIX: useRef, or stringify the dep: JSON.stringify(obj).

  🔥 EFFECT_SETSTATE_FROM_PROP
     → useEffect(() => setX(props.foo), [props.foo])
       If props.foo is unstable (new object every render), this loops.
       FIX: Use useMemo for derived state, not useEffect + setState.

  🔥 EFFECT_NAVIGATE
     → useEffect(() => { navigate('X') }, [...])
       If the effect re-triggers because navigation changes state...
       FIX: Add a ref guard: if (hasNavigated.current) return;

  🔥 SETSTATE_IN_RENDER
     → setX(...) called directly during component render.
       FIX: Move into useEffect, event handler, or use useState(fn).

  ⚠️  CONTEXT_INLINE_VALUE
     → <Provider value={{ state, setState }}> creates new object every render.
       FIX: Wrap in useMemo: const value = useMemo(() => ({state, setState}), [state]);
    """)
    print("=" * 72)

if __name__ == "__main__":
    main()