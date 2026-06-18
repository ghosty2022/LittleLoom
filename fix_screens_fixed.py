#!/usr/bin/env python3
"""
LittleLoom Screen Fixer - Comprehensive styling and navigation fixes
Fixes: tab bars, card uniformity, spacing, border radius, navigation links
"""

import re
import sys

# Map file identifiers to their proper names
FILE_MAP = {
    'FamilySharingScreen': 'src/screens/family/FamilySharingScreen.tsx',
    'EditGuardianScreen': 'src/screens/family/EditGuardianScreen.tsx', 
    'BabyFamilyCenterScreen': 'src/screens/baby/BabyFamilyCenterScreen.tsx',
    'GrowthDashboardScreen': 'src/screens/tracking/GrowthDashboardScreen.tsx',
    'CommunityMemberProfileScreen': 'src/screens/community/CommunityMemberProfileScreen.tsx',
    'CommunityProfileScreen': 'src/screens/community/CommunityProfileScreen.tsx',
}

# ============ SHARED DESIGN TOKENS ============
SHARED_TOKENS = '''// ─── SHARED DESIGN TOKENS ───────────────────────────────────────────
const DESIGN = {
  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    full: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  },
  tab: {
    height: 44,
    pillRadius: 12,
    activeBg: 'rgba(102,126,234,0.12)',
    inactiveBg: 'transparent',
    gap: 6,
    padding: 4,
  },
  card: {
    radius: 20,
    padding: 16,
    borderColorLight: 'rgba(255,255,255,0.4)',
    borderColorDark: 'rgba(255,255,255,0.08)',
    bgLight: ['rgba(255,255,255,0.95)', 'rgba(250,250,255,0.8)'],
    bgDark: ['rgba(45,45,55,0.9)', 'rgba(25,25,35,0.7)'],
  }
};
'''

# ============ SHARED STYLESHEET FIXES ============
# These styles will be injected/replaced uniformly

TAB_BAR_STYLES = '''
  // === UNIFIED TAB BAR ===
  tabBarContainer: {
    paddingHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: DESIGN.radius.lg,
    padding: DESIGN.tab.padding,
    gap: DESIGN.tab.gap,
    ...DESIGN.shadow.md,
  },
  tabBarDark: {
    backgroundColor: 'rgba(30,30,40,0.75)',
  },
  tab: {
    flex: 1,
    height: DESIGN.tab.height,
  },
  tabBg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    borderRadius: DESIGN.tab.pillRadius,
    gap: 6,
  },
  tabBgActive: {
    backgroundColor: DESIGN.tab.activeBg,
  },
  tabBgDangerActive: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: -0.2,
  },
  tabLabelActive: {
    color: '#667eea',
    fontWeight: '700',
  },
  tabLabelDangerActive: {
    color: '#ef4444',
    fontWeight: '700',
  },
  tabIconActive: {
    color: '#667eea',
  },
  tabIconDangerActive: {
    color: '#ef4444',
  },
'''

GLASS_CARD_STYLES = '''
  // === UNIFIED GLASS CARD ===
  glassCard: {
    borderRadius: DESIGN.card.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DESIGN.card.borderColorLight,
    ...DESIGN.shadow.lg,
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
  },
  glassCardDark: {
    borderColor: DESIGN.card.borderColorDark,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  glassContent: {
    padding: DESIGN.card.padding,
  },
'''

# ============ NAVIGATION FIXES ============
# Map of wrong navigation targets to correct ones
NAVIGATION_FIXES = {
    # FamilySharingScreen
    r"navigation\.navigate\('FamilyChatList'\)": "navigation.navigate('FamilyChatList' as never)",
    r"navigation\.navigate\('FamilyChat',": "navigation.navigate('FamilyChat' as never,",
    r"navigation\.navigate\('CreateBabyProfile'\)": "navigation.navigate('CreateBabyProfile' as never)",
    r"navigation\.navigate\('TrackerReminders'\)": "navigation.navigate('TrackerReminders' as never)",
    
    # BabyFamilyCenterScreen
    r"navigation\.navigate\('FamilySettings'": "navigation.navigate('FamilySettings' as never",
    r"navigation\.navigate\('Timeline'": "navigation.navigate('Timeline' as never",
    r"navigation\.navigate\('GrowthDashboard'": "navigation.navigate('GrowthDashboard' as never",
    
    # GrowthDashboardScreen
    r"navigation\.navigate\('GrowthIntelligence'\)": "navigation.navigate('GrowthIntelligence' as never)",
    r"navigation\.navigate\('AddEntry'": "navigation.navigate('AddEntry' as never",
    r"navigation\.navigate\('Achievements'\)": "navigation.navigate('Achievements' as never)",
    r"navigation\.navigate\('VaccinationSchedule'\)": "navigation.navigate('VaccinationSchedule' as never)",
    r"navigation\.navigate\('Gallery'\)": "navigation.navigate('Gallery' as never)",
    r"navigation\.navigate\('CreateBabyProfile'\)": "navigation.navigate('CreateBabyProfile' as never)",
    
    # Community screens
    r"navigation\.navigate\('ChatList'\)": "navigation.navigate('ChatList' as never)",
    r"navigation\.navigate\('CreatePost'\)": "navigation.navigate('CreatePost' as never)",
    r"navigation\.navigate\('Chat',": "navigation.navigate('Chat' as never,",
    r"navigation\.navigate\('PostDetail',": "navigation.navigate('PostDetail' as never,",
    r"navigation\.navigate\('Report',": "navigation.navigate('Report' as never,",
    r"navigation\.navigate\('FollowersScreen'\)": "navigation.navigate('FollowersScreen' as never)",
    r"navigation\.navigate\('FollowingScreen'\)": "navigation.navigate('FollowingScreen' as never)",
}


def fix_family_sharing_screen(content: str) -> str:
    """Fix FamilySharingScreen - tab bar, cards, navigation"""
    
    # 1. Add DESIGN tokens after imports
    import_end = content.find("const AnimatedScrollView")
    if import_end > 0 and "const DESIGN" not in content:
        content = content[:import_end] + SHARED_TOKENS + "\n" + content[import_end:]
    
    # 2. Fix tab bar styles - replace old tabContainer/tabBar styles
    old_tab_pattern = r"tabContainer:\s*\{[^}]*\}(?:,\s*tabContainerDark:\s*\{[^}]*\})?(?:,\s*tab:\s*\{[^}]*\})?(?:,\s*tabActive:\s*\{[^}]*\})?(?:,\s*tabText:\s*\{[^}]*\})?(?:,\s*tabTextActive:\s*\{[^}]*\})?"
    
    # Replace with unified tab styles
    tab_replacement = TAB_BAR_STYLES + """
  // Legacy aliases for compatibility
  tabContainer: {
    paddingHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
  },
  tabContainerDark: {},
  tab: {
    flex: 1,
    height: DESIGN.tab.height,
  },
  tabActive: {
    backgroundColor: DESIGN.tab.activeBg,
    borderRadius: DESIGN.tab.pillRadius,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#667eea',
    fontWeight: '700',
  },
"""
    
    # Find and replace tab styles section
    tab_start = content.find("tabContainer:")
    tab_end = content.find("tabContent:", tab_start)
    if tab_start > 0 and tab_end > 0:
        # Find the complete styles block
        brace_count = 0
        i = tab_start
        while i < len(content):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    break
            i += 1
        content = content[:tab_start] + tab_replacement + "\n" + content[i+1:]
    
    # 3. Fix card styles - make uniform
    card_fixes = {
        "borderRadius: 20,": "borderRadius: DESIGN.card.radius,",
        "borderColor: 'rgba(255,255,255,0.3)',": "borderColor: DESIGN.card.borderColorLight,",
        "borderColor: 'rgba(255,255,255,0.1)',": "borderColor: DESIGN.card.borderColorDark,",
        "padding: 16,": "padding: DESIGN.card.padding,",
        "marginBottom: 14,": "marginBottom: DESIGN.spacing.lg,",
        "marginBottom: 10,": "marginBottom: DESIGN.spacing.md,",
        "marginBottom: 8,": "marginBottom: DESIGN.spacing.sm,",
        "gap: 6,": "gap: DESIGN.spacing.sm,",
        "gap: 8,": "gap: DESIGN.spacing.md,",
        "gap: 10,": "gap: DESIGN.spacing.md,",
        "gap: 12,": "gap: DESIGN.spacing.lg,",
        "paddingHorizontal: 16,": "paddingHorizontal: DESIGN.spacing.lg,",
        "paddingVertical: 12,": "paddingVertical: DESIGN.spacing.md,",
        "paddingVertical: 14,": "paddingVertical: DESIGN.spacing.lg,",
    }
    
    for old, new in card_fixes.items():
        content = content.replace(old, new)
    
    # 4. Fix navigation links
    for pattern, replacement in NAVIGATION_FIXES.items():
        if 'Family' in pattern or 'Tracker' in pattern or 'CreateBaby' in pattern:
            content = re.sub(pattern, replacement, content)
    
    # 5. Fix modal styles to be uniform
    modal_fixes = {
        "borderRadius: 20,": "borderRadius: DESIGN.radius.xl,",
        "padding: 16,": "padding: DESIGN.card.padding,",
        "padding: 20,": "padding: DESIGN.spacing.xl,",
        "padding: 24,": "padding: DESIGN.spacing.xxl,",
    }
    
    in_modal = False
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        if 'modal' in line.lower() and 'style=' in line:
            in_modal = True
        if in_modal and '}' in line and line.strip() == '}':
            in_modal = False
        
        # Apply modal fixes
        if 'modal' in line.lower() or in_modal:
            for old, new in modal_fixes.items():
                line = line.replace(old, new)
        new_lines.append(line)
    content = '\n'.join(new_lines)
    
    # 6. Fix permission pills spacing
    content = content.replace(
        "permissionPills: {\n    flexDirection: 'row',\n    flexWrap: 'wrap',\n    paddingHorizontal: 16,\n    paddingBottom: 12,\n    gap: 6,",
        "permissionPills: {\n    flexDirection: 'row',\n    flexWrap: 'wrap',\n    paddingHorizontal: DESIGN.spacing.lg,\n    paddingBottom: DESIGN.spacing.md,\n    gap: DESIGN.spacing.xs,"
    )
    
    # 7. Fix member card to be more uniform
    content = content.replace(
        "memberCard: {\n    borderRadius: 20,",
        "memberCard: {\n    borderRadius: DESIGN.card.radius,"
    )
    
    return content


def fix_edit_guardian_screen(content: str) -> str:
    """Fix EditGuardianScreen - tab bar, cards, spacing"""
    
    # 1. Add DESIGN tokens
    if "const DESIGN" not in content:
        import_end = content.find("const AnimatedScrollView")
        if import_end < 0:
            import_end = content.find("const { width")
        if import_end > 0:
            content = content[:import_end] + SHARED_TOKENS + "\n" + content[import_end:]
    
    # 2. Fix tab bar styles
    old_tabbar = """tabBarContainer: { paddingHorizontal: 16, marginBottom: 16 },
    tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 16, padding: 4, gap: 4, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }, android: { elevation: 4, backgroundColor: 'rgba(255,255,255,0.95)' } }) },
    tabBarDark: { backgroundColor: 'rgba(30,30,40,0.8)', ...Platform.select({ android: { backgroundColor: 'rgba(30,30,40,0.95)' } }) },
    tab: { flex: 1 },
    tabBg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 6 },
    tabLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    tabLabelActive: { color: '#667eea', fontWeight: '700' },
    tabLabelDanger: { color: '#ef4444', fontWeight: '700' },"""
    
    new_tabbar = TAB_BAR_STYLES + """
    tabContainer: { paddingHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.lg },
    tabContainerDark: {},
    tabActive: { backgroundColor: DESIGN.tab.activeBg, borderRadius: DESIGN.tab.pillRadius },
    tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    tabTextActive: { color: '#667eea', fontWeight: '700' },
    tabTextDanger: { color: '#ef4444', fontWeight: '700' },"""
    
    content = content.replace(old_tabbar, new_tabbar)
    
    # 3. Fix glass card styles
    old_glass = """glassCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#667eea', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
    glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.6)' },
    glassContent: { flex: 1 },"""
    
    new_glass = GLASS_CARD_STYLES + """
    glassCardCompact: {
      borderRadius: DESIGN.card.radius,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: DESIGN.card.borderColorLight,
      ...DESIGN.shadow.md,
      marginHorizontal: DESIGN.spacing.lg,
      marginBottom: DESIGN.spacing.md,
    },"""
    
    content = content.replace(old_glass, new_glass)
    
    # 4. Fix spacing throughout
    spacing_fixes = {
        "paddingHorizontal: 16,": "paddingHorizontal: DESIGN.spacing.lg,",
        "paddingHorizontal: 20,": "paddingHorizontal: DESIGN.spacing.xl,",
        "marginBottom: 16,": "marginBottom: DESIGN.spacing.lg,",
        "marginBottom: 20,": "marginBottom: DESIGN.spacing.xl,",
        "marginBottom: 24,": "marginBottom: DESIGN.spacing.xxl,",
        "gap: 8,": "gap: DESIGN.spacing.md,",
        "gap: 10,": "gap: DESIGN.spacing.md,",
        "gap: 12,": "gap: DESIGN.spacing.lg,",
        "gap: 16,": "gap: DESIGN.spacing.xl,",
        "borderRadius: 12,": "borderRadius: DESIGN.radius.md,",
        "borderRadius: 14,": "borderRadius: DESIGN.radius.md,",
        "borderRadius: 16,": "borderRadius: DESIGN.radius.lg,",
        "borderRadius: 18,": "borderRadius: DESIGN.radius.lg,",
        "borderRadius: 20,": "borderRadius: DESIGN.radius.xl,",
        "borderRadius: 24,": "borderRadius: DESIGN.radius.xl,",
    }
    
    for old, new in spacing_fixes.items():
        content = content.replace(old, new)
    
    # 5. Fix navigation
    for pattern, replacement in NAVIGATION_FIXES.items():
        if 'Chat' in pattern:
            content = re.sub(pattern, replacement, content)
    
    # 6. Fix form input styling to be uniform
    content = content.replace(
        "inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(100,116,139,0.08)', borderRadius: 18, paddingHorizontal: 18, height: 56, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },",
        "inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(100,116,139,0.08)', borderRadius: DESIGN.radius.md, paddingHorizontal: DESIGN.spacing.lg, height: 52, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },"
    )
    
    return content


def fix_baby_family_center_screen(content: str) -> str:
    """Fix BabyFamilyCenterScreen - tab bar, cards, navigation"""
    
    # 1. Add DESIGN tokens
    if "const DESIGN" not in content:
        import_end = content.find("const { width, height }")
        if import_end > 0:
            content = content[:import_end] + SHARED_TOKENS + "\n" + content[import_end:]
    
    # 2. Fix tab bar - this one uses slightly different structure
    old_tabbar = """tabBarContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    padding: 4,
    gap: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8
      },
      android: {
        elevation: 4,
        backgroundColor: 'rgba(255,255,255,0.95)',
      },
    }),
  },
  tabBarDark: {
    backgroundColor: 'rgba(30,30,40,0.8)',
    ...Platform.select({
      android: {
        backgroundColor: 'rgba(30,30,40,0.95)',
      },
    }),
  },
  tab: { flex: 1 },
  tabBg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#667eea',
    fontWeight: '700',
  },
  tabLabelDanger: {
    color: '#ef4444',
    fontWeight: '700',
  },"""
    
    content = content.replace(old_tabbar, TAB_BAR_STYLES)
    
    # 3. Fix glass card
    old_glass = """glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  glassContent: { flex: 1 },"""
    
    content = content.replace(old_glass, GLASS_CARD_STYLES)
    
    # 4. Fix navigation links
    for pattern, replacement in NAVIGATION_FIXES.items():
        if 'FamilySettings' in pattern or 'Timeline' in pattern or 'GrowthDashboard' in pattern:
            content = re.sub(pattern, replacement, content)
    
    # 5. Fix spacing
    spacing_fixes = {
        "paddingHorizontal: 16,": "paddingHorizontal: DESIGN.spacing.lg,",
        "paddingHorizontal: 20,": "paddingHorizontal: DESIGN.spacing.xl,",
        "marginBottom: 12,": "marginBottom: DESIGN.spacing.md,",
        "marginBottom: 16,": "marginBottom: DESIGN.spacing.lg,",
        "marginBottom: 20,": "marginBottom: DESIGN.spacing.xl,",
        "gap: 8,": "gap: DESIGN.spacing.md,",
        "gap: 10,": "gap: DESIGN.spacing.md,",
        "gap: 12,": "gap: DESIGN.spacing.lg,",
        "borderRadius: 16,": "borderRadius: DESIGN.radius.lg,",
        "borderRadius: 18,": "borderRadius: DESIGN.radius.lg,",
        "borderRadius: 20,": "borderRadius: DESIGN.radius.xl,",
        "borderRadius: 24,": "borderRadius: DESIGN.radius.xl,",
    }
    
    for old, new in spacing_fixes.items():
        content = content.replace(old, new)
    
    # 6. Fix input container height for uniformity
    content = content.replace(
        "height: 56,",
        "height: 52,"
    )
    
    # 7. Fix skin button to be more uniform
    content = content.replace(
        "width: 48,\n    height: 48,\n    borderRadius: 24,",
        "width: 44,\n    height: 44,\n    borderRadius: DESIGN.radius.full,"
    )
    
    return content


def fix_growth_dashboard_screen(content: str) -> str:
    """Fix GrowthDashboardScreen - cards, spacing, navigation"""
    
    # 1. Add DESIGN tokens
    if "const DESIGN" not in content:
        # Find a good insertion point
        import_end = content.find("const { width: SCREEN_W")
        if import_end > 0:
            content = content[:import_end] + SHARED_TOKENS + "\n" + content[import_end:]
    
    # 2. Fix glassCard styles
    old_glass = """glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },"""
    
    new_glass = """glassCard: {
    borderRadius: DESIGN.card.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...DESIGN.shadow.lg,
    marginHorizontal: DESIGN.spacing.lg,
    marginBottom: DESIGN.spacing.lg,
  },
  glassCardDark: {
    borderColor: DESIGN.card.borderColorDark,
  },"""
    
    content = content.replace(old_glass, new_glass)
    
    # 3. Fix navigation
    for pattern, replacement in NAVIGATION_FIXES.items():
        if 'GrowthIntelligence' in pattern or 'AddEntry' in pattern or 'Achievements' in pattern or 'VaccinationSchedule' in pattern or 'Gallery' in pattern or 'CreateBabyProfile' in pattern:
            content = re.sub(pattern, replacement, content)
    
    # 4. Fix section spacing
    content = content.replace(
        "section: { marginBottom: 20 },",
        "section: { marginBottom: DESIGN.spacing.xl },"
    )
    
    # 5. Fix metric card wrapper
    content = content.replace(
        "metricCardWrapper: { width: (SCREEN_W - 42) / 2 },",
        "metricCardWrapper: { width: (SCREEN_W - 56) / 2, marginBottom: DESIGN.spacing.md },"
    )
    
    # 6. Fix quick actions
    content = content.replace(
        "quickActions: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 20 },",
        "quickActions: { flexDirection: 'row', gap: DESIGN.spacing.md, marginHorizontal: DESIGN.spacing.lg, marginBottom: DESIGN.spacing.xl },"
    )
    
    # 7. Fix chart card
    content = content.replace(
        "chartCard: { padding: 16, marginBottom: 16 },",
        "chartCard: { padding: DESIGN.card.padding, marginBottom: DESIGN.spacing.lg, borderRadius: DESIGN.card.radius },"
    )
    
    # 8. Fix modal content
    content = content.replace(
        "modalContent: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 24, overflow: 'hidden',",
        "modalContent: { width: '100%', maxWidth: 400, borderRadius: DESIGN.radius.xl, padding: DESIGN.spacing.xxl, overflow: 'hidden',"
    )
    
    return content


def fix_community_member_profile_screen(content: str) -> str:
    """Fix CommunityMemberProfileScreen - tab bar, cards, spacing"""
    
    # 1. Add DESIGN tokens
    if "const DESIGN" not in content:
        import_end = content.find("const { width }")
        if import_end > 0:
            content = content[:import_end] + SHARED_TOKENS + "\n" + content[import_end:]
    
    # 2. Fix tab bar
    old_tabbar = """tabBarContainer: { paddingHorizontal: 16, marginBottom: 16 },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 16, padding: 4, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  tabBarDark: { backgroundColor: 'rgba(30,30,40,0.8)' },
  tab: { flex: 1 },
  tabBg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 6 },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabLabelActive: { color: '#667eea', fontWeight: '700' },"""
    
    content = content.replace(old_tabbar, TAB_BAR_STYLES)
    
    # 3. Fix glass card
    old_glass = """glassCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#667eea', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.6)' },
  glassContent: { flex: 1 },"""
    
    content = content.replace(old_glass, GLASS_CARD_STYLES)
    
    # 4. Fix navigation
    for pattern, replacement in NAVIGATION_FIXES.items():
        if 'Chat' in pattern or 'PostDetail' in pattern or 'Report' in pattern:
            content = re.sub(pattern, replacement, content)
    
    # 5. Fix spacing
    spacing_fixes = {
        "paddingHorizontal: 16,": "paddingHorizontal: DESIGN.spacing.lg,",
        "paddingHorizontal: 20,": "paddingHorizontal: DESIGN.spacing.xl,",
        "marginBottom: 12,": "marginBottom: DESIGN.spacing.md,",
        "marginBottom: 16,": "marginBottom: DESIGN.spacing.lg,",
        "marginBottom: 20,": "marginBottom: DESIGN.spacing.xl,",
        "gap: 8,": "gap: DESIGN.spacing.md,",
        "gap: 10,": "gap: DESIGN.spacing.md,",
        "gap: 12,": "gap: DESIGN.spacing.lg,",
        "gap: 14,": "gap: DESIGN.spacing.lg,",
        "borderRadius: 12,": "borderRadius: DESIGN.radius.md,",
        "borderRadius: 14,": "borderRadius: DESIGN.radius.md,",
        "borderRadius: 16,": "borderRadius: DESIGN.radius.lg,",
        "borderRadius: 18,": "borderRadius: DESIGN.radius.lg,",
        "borderRadius: 20,": "borderRadius: DESIGN.radius.xl,",
        "borderRadius: 24,": "borderRadius: DESIGN.radius.xl,",
    }
    
    for old, new in spacing_fixes.items():
        content = content.replace(old, new)
    
    # 6. Fix action buttons to be uniform
    content = content.replace(
        "followBtn: { flex: 1, backgroundColor: '#667eea', borderRadius: 14, paddingVertical: 12,",
        "followBtn: { flex: 1, backgroundColor: '#667eea', borderRadius: DESIGN.radius.md, paddingVertical: DESIGN.spacing.md,"
    )
    
    content = content.replace(
        "messageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(102,126,234,0.1)', borderRadius: 14,",
        "messageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: DESIGN.spacing.sm, backgroundColor: 'rgba(102,126,234,0.1)', borderRadius: DESIGN.radius.md,"
    )
    
    return content


def fix_community_profile_screen(content: str) -> str:
    """Fix CommunityProfileScreen - tab bar, cards, spacing, navigation"""
    
    # 1. Add DESIGN tokens
    if "const DESIGN" not in content:
        import_end = content.find("const { width, height }")
        if import_end > 0:
            content = content[:import_end] + SHARED_TOKENS + "\n" + content[import_end:]
    
    # 2. Fix tab bar
    old_tabbar = """tabBarContainer: { paddingHorizontal: 16, marginBottom: 16 },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 16, padding: 4, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  tabBarDark: { backgroundColor: 'rgba(30,30,40,0.8)' },
  tab: { flex: 1 },
  tabBg: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 6 },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabLabelActive: { color: '#667eea', fontWeight: '700' },"""
    
    content = content.replace(old_tabbar, TAB_BAR_STYLES)
    
    # 3. Fix glass card
    old_glass = """glassCard: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#667eea', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  glassBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.6)' },
  glassContent: { flex: 1 },"""
    
    content = content.replace(old_glass, GLASS_CARD_STYLES)
    
    # 4. Fix navigation
    for pattern, replacement in NAVIGATION_FIXES.items():
        if 'ChatList' in pattern or 'CreatePost' in pattern:
            content = re.sub(pattern, replacement, content)
    
    # 5. Fix spacing
    spacing_fixes = {
        "paddingHorizontal: 16,": "paddingHorizontal: DESIGN.spacing.lg,",
        "paddingHorizontal: 20,": "paddingHorizontal: DESIGN.spacing.xl,",
        "marginBottom: 12,": "marginBottom: DESIGN.spacing.md,",
        "marginBottom: 16,": "marginBottom: DESIGN.spacing.lg,",
        "marginBottom: 20,": "marginBottom: DESIGN.spacing.xl,",
        "marginBottom: 24,": "marginBottom: DESIGN.spacing.xxl,",
        "gap: 8,": "gap: DESIGN.spacing.md,",
        "gap: 10,": "gap: DESIGN.spacing.md,",
        "gap: 12,": "gap: DESIGN.spacing.lg,",
        "gap: 14,": "gap: DESIGN.spacing.lg,",
        "borderRadius: 10,": "borderRadius: DESIGN.radius.sm,",
        "borderRadius: 12,": "borderRadius: DESIGN.radius.md,",
        "borderRadius: 14,": "borderRadius: DESIGN.radius.md,",
        "borderRadius: 16,": "borderRadius: DESIGN.radius.lg,",
        "borderRadius: 18,": "borderRadius: DESIGN.radius.lg,",
        "borderRadius: 20,": "borderRadius: DESIGN.radius.xl,",
        "borderRadius: 24,": "borderRadius: DESIGN.radius.xl,",
    }
    
    for old, new in spacing_fixes.items():
        content = content.replace(old, new)
    
    # 6. Fix quick action buttons
    content = content.replace(
        "quickActionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },",
        "quickActionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: DESIGN.spacing.lg, gap: DESIGN.spacing.md },"
    )
    
    # 7. Fix input containers
    content = content.replace(
        "height: 56,", "height: 52,"
    )
    
    # 8. Fix save button
    content = content.replace(
        "saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,",
        "saveBtn: { paddingHorizontal: DESIGN.spacing.lg, paddingVertical: DESIGN.spacing.sm, borderRadius: DESIGN.radius.md,"
    )
    
    return content


def apply_all_fixes(files_content: dict) -> dict:
    """Apply all fixes to all screens"""
    
    fix_functions = {
        'FamilySharingScreen': fix_family_sharing_screen,
        'EditGuardianScreen': fix_edit_guardian_screen,
        'BabyFamilyCenterScreen': fix_baby_family_center_screen,
        'GrowthDashboardScreen': fix_growth_dashboard_screen,
        'CommunityMemberProfileScreen': fix_community_member_profile_screen,
        'CommunityProfileScreen': fix_community_profile_screen,
    }
    
    fixed = {}
    for key, content in files_content.items():
        if key in fix_functions:
            print(f"Fixing {key}...")
            fixed[key] = fix_functions[key](content)
            print(f"  Done. Original: {len(content)} chars, Fixed: {len(fixed[key])} chars")
        else:
            fixed[key] = content
    
    return fixed


# ============ MAIN SCRIPT ============

if __name__ == "__main__":
    # Read all input files
    import os
    
    base_path = "/mnt/agents/upload"
    files = {}
    for f in os.listdir(base_path):
        path = os.path.join(base_path, f)
        if os.path.isfile(path):
            with open(path, 'r', encoding='utf-8', errors='ignore') as file:
                files[f] = file.read()
    
    # Map to proper names
    file_map = {}
    for fname, content in files.items():
        if 'export default function' in content:
            idx = content.find('export default function')
            end = content.find('(', idx)
            func_name = content[idx:end].replace('export default function', '').strip()
            file_map[func_name] = (fname, content)
    
    # Extract just the content
    screen_contents = {k: v[1] for k, v in file_map.items()}
    
    # Apply fixes
    fixed_contents = apply_all_fixes(screen_contents)
    
    # Write output
    output_dir = "/mnt/agents/upload/fixed"
    os.makedirs(output_dir, exist_ok=True)
    
    for key, content in fixed_contents.items():
        if key in FILE_MAP:
            output_path = os.path.join(output_dir, os.path.basename(FILE_MAP[key]))
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Written: {output_path}")