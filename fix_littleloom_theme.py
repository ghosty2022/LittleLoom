#!/usr/bin/env python3
"""
LittleLoom – Module Component Theme Safety Fix
================================================
Applies the exact crash-fix pattern to:
  • CommunityMemberProfileScreen.tsx
  • CommunityProfileScreen.tsx
  • BabyFamilyCenterScreen.tsx

Rule summary:
  1. Every module-level React.memo component receives (isDark, colors) props.
  2. Each computes: const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);
  3. themeColors.primary  →  colors.primary
  4. Outer-scope isDarkMode  →  local isDark prop
  5. JSX call sites get isDark={isDark} colors={COLORS_VAR}
  6. Specific one-offs (SCREEN_H, ROLE_CONFIG, etc.)

Backups are written as *.tsx.bak
"""

import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Component names that must be transformed in each file.
# (Only these top-level React.memo components are touched.)
COMPONENTS = {
    "CommunityMemberProfileScreen.tsx": [
        "GlassCard", "SectionHeader", "KpiPill", "TabBar",
        "EngagementInsightsCard", "CommunityInfluenceCard", "ContentHighlightsCard",
        "ActivityPatternGraph", "MutualConnections", "SmartActions",
        "ParentingTipsEngine", "TopicBreakdown", "InteractionHeatMap",
        "ContributionStreakCard", "SocialGraphCard", "RecentInteractions",
        "AchievementBadge", "PostCard",
    ],
    "CommunityProfileScreen.tsx": [
        "GlassCard", "SectionHeader", "TabBar", "KpiPill",
        "InfluenceDashboard", "WeeklyImpactCard", "CommunityStandingCard",
        "ContentBreakdownCard", "EngagementSparkline", "SmartSuggestions",
        "TopicAffinityCard", "PeerComparisonCard", "ContentStreaks",
        "QuickActionsDock", "ActionModal",
    ],
    "BabyFamilyCenterScreen.tsx": [
        "GlassCard", "NextMilestoneCountdown", "FamilyConnectionHub",
        "SectionHeader", "TabBar", "KpiPill", "SafeBabyAvatar",
        "DevelopmentStageTracker", "SmartHealthInsights", "ActivitySparkline",
        "QuickActionDock", "BabyHealthScore", "ActionModal", "EmojiPickerModal",
    ],
}

# Name of the colours object passed from the main component body to children.
COLORS_VAR = {
    "CommunityMemberProfileScreen.tsx": "fullThemeColors",
    "CommunityProfileScreen.tsx": "fullThemeColors",
    "BabyFamilyCenterScreen.tsx": "themeColors",
}

# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

def _line_has_memo_decl(line: str, names: set) -> tuple | None:
    m = re.match(r'^(const\s+)(' + '|'.join(names) + r')(\s+=\s+React\.memo\()', line)
    if m:
        return m.group(1), m.group(2), m.group(3)
    return None


def _add_props_to_first_line(line: str) -> str:
    """
    Inside the first line of a React.memo component, find the prop
    destructuring `{ ... }` and append `, isDark = true, colors`.
    Also strips any existing aliased isDark such as `isDark: cardDark = true`.
    """
    # Strip existing isDark aliases like   isDark: cardDark = true
    line = re.sub(r',?\s*isDark\s*:\s*\w+\s*=\s*[^,}]+', '', line)

    # Find the outer prop-destructuring braces on this line.
    # We look for the first '{' after 'React.memo(('
    match = re.search(r'(React\.memo\(\(\s*\{)([^}]*)(\})', line)
    if not match:
        return line
    before, inside, after = match.group(1), match.group(2), match.group(3)
    # Append isDark / colors
    sep = '' if inside.strip().endswith(',') or not inside.strip() else ', '
    new_inside = f"{inside}{sep}isDark = true, colors"
    return line[:match.start()] + before + new_inside + after + line[match.end():]


def _find_component_end(lines: list[str], start_idx: int) -> int:
    """
    Heuristic: the component ends at the line just before the next top-level
    declaration (const, export, function, interface, type, default export).
    """
    for i in range(start_idx + 1, len(lines)):
        if re.match(r'^(const\s+|export\s+(?:default\s+)?(?:function|const|class)|function\s+|interface\s+|type\s+)', lines[i]):
            return i - 1
    return len(lines) - 1


def _body_type_and_line(lines: list[str], start_idx: int, end_idx: int):
    """
    Scan the first few lines of the component for the arrow body.
    Returns ('block', idx) for => {   or   ('paren', idx) for => (
    """
    for j in range(start_idx, min(start_idx + 6, end_idx + 1)):
        if re.search(r'=\>\s*\{', lines[j]):
            return 'block', j
        if re.search(r'=\>\s*\(', lines[j]):
            return 'paren', j
    return None, -1


def _transform_implicit_to_explicit(lines: list[str], start_idx: int, end_idx: int, paren_line: int) -> list[str]:
    """
    Convert => ( … ); to => { const styles = useMemo(...); return ( … ); };
    """
    out = lines[:paren_line]
    # Change => (  →  => {
    out.append(re.sub(r'(=\>\s*)\(', r'\1{', lines[paren_line]))
    out.append("  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);")
    out.append("  return (")

    # Everything between paren_line+1 and end_idx
    middle = lines[paren_line + 1:end_idx + 1]

    # If the very last line of the component is ));  or  );  we need to split it.
    if middle:
        last = middle[-1]
        # Replace the final )); with   );\n});
        # We look for a line that is just whitespace + )); or ends with )); after some content
        new_last = re.sub(r'\)\);\s*$', '  );\n});', last)
        if new_last == last:
            # Maybe it ends with just );  (rare)
            new_last = re.sub(r'\);\s*$', '  );\n});', last)
        middle[-1] = new_last
        out.extend(middle)
    else:
        out.append("  );\n});")

    return out


def _inject_useMemo_block(lines: list[str], block_line: int) -> list[str]:
    """
    Insert `const styles = useMemo(...)` immediately after the `=> {` line.
    """
    out = lines[:block_line + 1]
    out.append("  const styles = useMemo(() => getStyles(isDark, colors), [isDark, colors]);")
    out.extend(lines[block_line + 1:])
    return out


def _fix_theme_refs_inside(lines: list[str], start: int, end: int) -> list[str]:
    """
    Within a component block:
      - themeColors.primary  →  colors.primary
      - \bisDarkMode\b       →  isDark     (but NOT inside getStyles signature)
    """
    new_lines = lines[:]
    for i in range(start, end + 1):
        line = new_lines[i]
        # Skip the getStyles signature itself if it happens to be inside range
        if re.match(r'^const getStyles', line.strip()):
            continue
        line = re.sub(r'\bthemeColors\.primary\b', 'colors.primary', line)
        line = re.sub(r'\bisDarkMode\b', 'isDark', line)
        new_lines[i] = line
    return new_lines


def _add_jsx_props(content: str, components: list[str], colors_var: str) -> str:
    """
    For every JSX tag <ComponentName …> that does NOT already have isDark=,
    inject `isDark={isDark} colors={COLORS_VAR}` right before the closing `>` or `/>`.
    """
    for name in components:
        # Negative lookahead: don't touch if isDark= already present inside the tag
        pat = re.compile(rf'(<{re.escape(name)}\b)(?![^>]*\bisDark=)([^>]*?)(/?>)')
        repl = rf'\1\2 isDark={{isDark}} colors={{{colors_var}}}\3'
        content = pat.sub(repl, content)
    return content


# ---------------------------------------------------------------------------
# File-specific one-off fixes
# ---------------------------------------------------------------------------

def fix_community_member_profile(content: str) -> str:
    # Fix A – SCREEN_H
    content = content.replace(
        "const { width: SCREEN_W } = Dimensions.get('window');",
        "const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');"
    )
    return content


def fix_community_profile(content: str) -> str:
    # Fix A – ROLE_CONFIG uses hard-coded colour for member
    old_role = """const ROLE_CONFIG = {
  parent: { label: 'Parent', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'] as [string, string], icon: 'shield' },
  verified: { label: 'Verified', color: '#10b981', gradient: ['#10b981', '#34d399'] as [string, string], icon: 'checkmark-circle' },
  contributor: { label: 'Contributor', color: '#ec4899', gradient: ['#ec4899', '#f43f5e'] as [string, string], icon: 'heart' },
  member: { label: 'Member', color: isDark ? '#64748b' : '#94a3b8', gradient: ['#64748b', '#94a3b8'] as [string, string], icon: 'person' },
};"""
    new_role = """const ROLE_CONFIG = {
  parent: { label: 'Parent', color: '#6366f1', gradient: ['#6366f1', '#8b5cf6'] as [string, string], icon: 'shield' },
  verified: { label: 'Verified', color: '#10b981', gradient: ['#10b981', '#34d399'] as [string, string], icon: 'checkmark-circle' },
  contributor: { label: 'Contributor', color: '#ec4899', gradient: ['#ec4899', '#f43f5e'] as [string, string], icon: 'heart' },
  member: { label: 'Member', color: '#94a3b8', gradient: ['#64748b', '#94a3b8'] as [string, string], icon: 'person' },
};"""
    content = content.replace(old_role, new_role)
    return content


def fix_baby_family_center(content: str) -> str:
    # No specific one-offs beyond the generic pattern, but we ensure
    # NextMilestoneCountdown and FamilyConnectionHub aliases are handled.
    return content


# ---------------------------------------------------------------------------
# Main transformer
# ---------------------------------------------------------------------------

def transform_file(path: Path, names: list[str], colors_var: str) -> str:
    content = path.read_text(encoding='utf-8')
    original = content
    lines = content.split('\n')

    # --- file-specific literal fixes ---
    filename = path.name
    if filename == "CommunityMemberProfileScreen.tsx":
        content = fix_community_member_profile(content)
    elif filename == "CommunityProfileScreen.tsx":
        content = fix_community_profile(content)
    elif filename == "BabyFamilyCenterScreen.tsx":
        content = fix_baby_family_center(content)

    # Re-split after literal replacements
    lines = content.split('\n')
    names_set = set(names)

    # --- Pass 1: transform each module-level component ---
    i = 0
    while i < len(lines):
        decl = _line_has_memo_decl(lines[i], names_set)
        if decl is None:
            i += 1
            continue

        _, comp_name, _ = decl
        end_idx = _find_component_end(lines, i)
        body_type, body_line = _body_type_and_line(lines, i, end_idx)

        if body_type is None:
            i += 1
            continue

        # 1) Fix first line: add isDark / colors to destructuring
        lines[i] = _add_props_to_first_line(lines[i])

        # 2) Inject useMemo + fix body style
        if body_type == 'paren':
            # Convert implicit return to explicit block
            new_segment = _transform_implicit_to_explicit(lines, i, end_idx, body_line)
            lines = lines[:i] + new_segment + lines[end_idx + 1:]
            # Recalculate end_idx after mutation
            end_idx = i + len(new_segment) - 1
        else:
            lines = _inject_useMemo_block(lines, body_line)
            end_idx += 1  # we inserted one line

        # 3) Fix theme references inside the component block
        lines = _fix_theme_refs_inside(lines, i, end_idx)

        i = end_idx + 1

    content = '\n'.join(lines)

    # --- Pass 2: JSX call sites ---
    content = _add_jsx_props(content, names, colors_var)

    return content


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    # Discover project root (look for src/screens)
    start = Path.cwd()
    root = start
    for p in [start] + list(start.parents):
        if (p / "src" / "screens").is_dir():
            root = p
            break

    screens_dir = root / "src" / "screens"
    if not screens_dir.is_dir():
        print("ERROR: Could not find src/screens directory.")
        sys.exit(1)

    targets = [
        screens_dir / "community" / "CommunityMemberProfileScreen.tsx",
        screens_dir / "community" / "CommunityProfileScreen.tsx",
        screens_dir / "baby" / "BabyFamilyCenterScreen.tsx",
    ]

    for fp in targets:
        if not fp.exists():
            print(f"SKIP: {fp} not found")
            continue

        name = fp.name
        comps = COMPONENTS.get(name, [])
        colors = COLORS_VAR.get(name, "fullThemeColors")

        original = fp.read_text(encoding='utf-8')
        fixed = transform_file(fp, comps, colors)

        if fixed == original:
            print(f"UNCHANGED: {fp}")
            continue

        # Backup
        bak = fp.with_suffix(fp.suffix + '.bak')
        bak.write_text(original, encoding='utf-8')

        fp.write_text(fixed, encoding='utf-8')
        print(f"FIXED + BACKUP: {fp}")

    print("\nDone. Review the changes in your editor and run:")
    print("  npx tsc --noEmit")
    print("to verify type safety. If anything looks off, restore from .bak files.")


if __name__ == "__main__":
    main()