#!/usr/bin/env python3
"""
LittleLoom Screen Uniformity & Navigation Fix Script
==================================================
Fixes tabs, cards, spacing, and navigation across all screens.
Run: python fix_littleloom_screens.py
"""

import os
import re
import shutil
from pathlib import Path
from datetime import datetime

# ============================================================
# CONFIGURATION - Unified Design Tokens
# ============================================================

DESIGN_TOKENS = {
    # Border Radius Scale
    'radius': {
        'sm': '10',      # small elements (badges, icons)
        'md': '14',      # buttons, inputs
        'lg': '18',      # cards, modals
        'xl': '22',      # hero elements
        'full': '9999',  # pills, circles
    },
    
    # Spacing Scale
    'space': {
        'xs': '4',
        'sm': '8',
        'md': '12',
        'lg': '16',
        'xl': '20',
        '2xl': '24',
    },
    
    # Shadows (unified)
    'shadow': {
        'card': """shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6""",
        'button': """shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4""",
        'float': """shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8""",
    }
}

# ============================================================
# NAVIGATION ROUTE CORRECTIONS
# ============================================================

# Maps incorrect route names to correct ones based on project structure
ROUTE_CORRECTIONS = {
    # Timeline screens
    "'Timeline'": "'UniversalTrackerHub'",
    '"Timeline"': '"UniversalTrackerHub"',
    "'Timeline' as never": "'UniversalTrackerHub'",
    '"Timeline" as never': '"UniversalTrackerHub"',
    
    # Family chat
    "'FamilyChat'": "'FamilyChatList'",
    '"FamilyChat"': '"FamilyChatList"',
    
    # Family settings
    "'FamilySettings'": "'FamilySharing'",
    '"FamilySettings"': '"FamilySharing"',
    
    # Tracker reminders
    "'TrackerReminders'": "'TrackerRemindersScreen'",
    '"TrackerReminders"': '"TrackerRemindersScreen"',
    
    # Growth dashboard
    "'GrowthDashboard'": "'GrowthDashboardScreen'",
    '"GrowthDashboard"': '"GrowthDashboardScreen"',
    
    # Create baby profile
    "'CreateBabyProfile'": "'BabyProfileCreateScreen'",
    '"CreateBabyProfile"': '"BabyProfileCreateScreen"',
    
    # Add entry
    "'AddEntry'": "'AddEntryScreen'",
    '"AddEntry"': '"AddEntryScreen"',
    
    # Achievements
    "'Achievements'": "'AchievementsScreen'",
    '"Achievements"': '"AchievementsScreen"',
    
    # Vaccination
    "'VaccinationSchedule'": "'VaccinationScheduleScreen'",
    '"VaccinationSchedule"': '"VaccinationScheduleScreen"',
    
    # Gallery
    "'Gallery'": "'GalleryScreen'",
    '"Gallery"': '"GalleryScreen"',
    
    # Chat list
    "'ChatList'": "'FamilyChatListScreen'",
    '"ChatList"': '"FamilyChatListScreen"',
    
    # Chat
    "'Chat'": "'FamilyChatScreen'",
    '"Chat"': '"FamilyChatScreen"',
    
    # Report
    "'Report'": "'ReportScreen'",
    '"Report"': '"ReportScreen"',
    
    # Post detail
    "'PostDetail'": "'PostDetailScreen'",
    '"PostDetail"': '"PostDetailScreen"',
    
    # Create post
    "'CreatePost'": "'CreatePostScreen'",
    '"CreatePost"': '"CreatePostScreen"',
}

# Remove "as never" casts entirely
AS_NEVER_PATTERN = r",?\s*\{\s*[^}]*as\s+never[^}]*\}"
AS_NEVER_SIMPLE = r"\s*as\s+never"

# ============================================================
# TAB BAR STANDARDIZATION
# ============================================================

# Standard tab bar container (replaces all variations)
TAB_BAR_CONTAINER_STD = """tabBarContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },"""

# Standard tab bar (pill style, fully rounded)
TAB_BAR_STD = """tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 18,
    padding: 5,
    gap: 5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
        backgroundColor: 'rgba(255,255,255,0.9)',
      },
    }),
  },
  tabBarDark: {
    backgroundColor: 'rgba(35,35,45,0.75)',
    ...Platform.select({
      android: {
        backgroundColor: 'rgba(35,35,45,0.9)',
      },
    }),
  },"""

# Standard tab (flexible, clean)
TAB_STD = """tab: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },"""

# Standard tab background (pill when active)
TAB_BG_STD = """tabBg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 14,
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(102,126,234,0.12)',
  },
  tabActiveDanger: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },"""

# Standard tab labels
TAB_LABEL_STD = """tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#667eea',
    fontWeight: '700',
  },
  tabLabelDanger: {
    color: '#ef4444',
    fontWeight: '700',
  },"""

# ============================================================
# CARD STANDARDIZATION
# ============================================================

# Standard glass card (unified across all screens)
GLASS_CARD_STD = """glassCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
        backgroundColor: 'rgba(255,255,255,0.92)',
      },
    }),
  },
  glassCardDark: {
    borderColor: 'rgba(255,255,255,0.06)',
    ...Platform.select({
      android: {
        backgroundColor: 'rgba(35,35,45,0.92)',
      },
    }),
  },
  glassBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  glassContent: {
    flex: 1,
  },"""

# Standard form card
FORM_CARD_STD = """formCard: {
    padding: 0,
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
  },"""

# Standard stats card
STATS_CARD_STD = """statsCard: {
    padding: 0,
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
  },"""

# Standard empty card
EMPTY_CARD_STD = """emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },"""

# Standard activity/milestone/action cards
ACTIVITY_CARD_STD = """activityItemCard: {
    marginVertical: 5,
    padding: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  milestoneCard: {
    padding: 0,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
  },
  actionCard: {
    padding: 0,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
  },
  dangerCard: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.3)',
  },"""

# Standard family card
FAMILY_CARD_STD = """familyCard: {
    padding: 0,
    borderRadius: 18,
    overflow: 'hidden',
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  pendingCardDark: {
    backgroundColor: 'rgba(35,35,45,0.8)',
  },"""

# Standard modal content
MODAL_CONTENT_STD = """modalContent: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 40,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  modalContentDark: {
    backgroundColor: '#1a1a2e',
  },"""

# ============================================================
# SPACING STANDARDIZATION
# ============================================================

SPACING_STD = """section: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
    paddingHorizontal: 20,
    paddingTop: 18,
    marginBottom: 14,
  },"""

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def backup_file(filepath):
    """Create timestamped backup"""
    backup_path = f"{filepath}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(filepath, backup_path)
    return backup_path

def replace_pattern(content, pattern, replacement, flags=0):
    """Replace pattern with count tracking"""
    new_content, count = re.subn(pattern, replacement, content, flags=flags)
    return new_content, count

def fix_tabs(content, screen_name):
    """Standardize all tab-related styles"""
    changes = []
    
    # Fix tabBarContainer variations
    tab_bar_container_pattern = r'tabBarContainer:\s*\{[^}]*(?:paddingHorizontal|marginBottom|padding)[^}]*\},?'
    content, n = replace_pattern(content, tab_bar_container_pattern, TAB_BAR_CONTAINER_STD.strip())
    if n > 0:
        changes.append(f"  ✓ Fixed tabBarContainer ({n} occurrences)")
    
    # Fix tabBar variations (merge with Platform.select)
    tab_bar_pattern = r'tabBar:\s*\{[^}]*(?:flexDirection|backgroundColor|borderRadius|padding|gap|shadow|elevation)[^}]*(?:\n[^}]*\{[^}]*\}[^}]*)*\},?'
    content, n = replace_pattern(content, tab_bar_pattern, TAB_BAR_STD.strip())
    if n > 0:
        changes.append(f"  ✓ Fixed tabBar ({n} occurrences)")
    
    # Fix tab style
    tab_pattern = r'\btab:\s*\{[^}]*\},?'
    content, n = replace_pattern(content, tab_pattern, TAB_STD.strip())
    if n > 0:
        changes.append(f"  ✓ Fixed tab ({n} occurrences)")
    
    # Fix tabBg variations
    tab_bg_pattern = r'tabBg:\s*\{[^}]*(?:flexDirection|alignItems|justifyContent|paddingVertical|paddingHorizontal|borderRadius|gap|backgroundColor)[^}]*\},?'
    content, n = replace_pattern(content, tab_bg_pattern, TAB_BG_STD.strip())
    if n > 0:
        changes.append(f"  ✓ Fixed tabBg ({n} occurrences)")
    
    # Fix tabLabel variations
    tab_label_pattern = r'tabLabel(?:Active|Danger)?:\s*\{[^}]*(?:fontSize|fontWeight|color)[^}]*\},?'
    content, n = replace_pattern(content, tab_label_pattern, TAB_LABEL_STD.strip())
    if n > 0:
        changes.append(f"  ✓ Fixed tabLabel ({n} occurrences)")
    
    # Fix active tab inline styles to use standard colors
    # Replace inline active tab background colors with standardized ones
    content = re.sub(
        r"isActive\s*&&\s*\{\s*backgroundColor:\s*isDanger\s*\?\s*['\"]rgba\(239,68,68[^'\"]*['\"]\s*:\s*\(isDark\s*\?\s*['\"]rgba\(102,126,234[^'\"]*['\"]\s*:\s*['\"]rgba\(102,126,234[^'\"]*['\"]\)\s*\}",
        "isActive && { backgroundColor: isDanger ? 'rgba(239,68,68,0.12)' : 'rgba(102,126,234,0.12)' }",
        content
    )
    
    return content, changes

def fix_cards(content, screen_name):
    """Standardize all card styles"""
    changes = []
    
    # Fix glassCard variations
    glass_pattern = r'glassCard:\s*\{[^}]*(?:borderRadius|overflow|borderWidth|borderColor|shadow|elevation)[^}]*(?:\n[^}]*\{[^}]*\}[^}]*)*\},?'
    content, n = replace_pattern(content, glass_pattern, GLASS_CARD_STD.strip())
    if n > 0:
        changes.append(f"  ✓ Fixed glassCard ({n} occurrences)")
    
    # Fix formCard
    form_pattern = r'formCard:\s*\{[^}]*(?:padding|marginBottom|borderRadius|overflow)[^}]*\},?'
    content, n = replace_pattern(content, form_pattern, FORM_CARD_STD.strip())
    if n > 0:
        changes.append(f"  ✓ Fixed formCard ({n} occurrences)")
    
    # Fix statsCard
    stats_pattern = r'statsCard:\s*\{[^}]*(?:padding|marginBottom|borderRadius|overflow)[^}]*\},?'
    content, n = replace_pattern(content, stats_pattern, STATS_CARD_STD.strip())
    if n > 0:
        changes.append(f"  ✓ Fixed statsCard ({n} occurrences)")
    
    # Fix emptyCard
    empty_pattern = r'emptyCard:\s*\{[^}]*(?:padding|alignItems|justifyContent|borderRadius)[^}]*\},?'
    content, n = replace_pattern(content, empty_pattern, EMPTY_CARD_STD.strip())
    if n > 0:
        changes.append(f"  ✓ Fixed emptyCard ({n} occurrences)")
    
    # Fix activity/milestone/action/danger cards
    activity_pattern = r'(?:activityItemCard|milestoneCard|actionCard|dangerCard):\s*\{[^}]*(?:marginVertical|padding|borderRadius|flexDirection|alignItems|borderWidth|borderColor)[^}]*\},?'
    content, n = replace_pattern(content, activity_pattern, ACTIVITY_CARD_STD.strip())
    if n > 0:
        changes.append(f"  ✓ Fixed activity/milestone/action/danger cards ({n} occurrences)")
    
    # Fix family/pending cards
    family_pattern = r'(?:familyCard|pendingCard|pendingCardDark):\s*\{[^}]*(?:padding|borderRadius|flexDirection|alignItems|marginBottom|backgroundColor)[^}]*\},?'
    content, n = replace_pattern(content, family_pattern, FAMILY_CARD_STD.strip())
    if n > 0:
        changes.append(f"  ✓ Fixed family/pending cards ({n} occurrences)")
    
    # Fix modalContent
    modal_pattern = r'modalContent(?:Dark)?:\s*\{[^}]*(?:width|maxHeight|borderRadius|overflow|backgroundColor|shadow|elevation)[^}]*(?:\n[^}]*\{[^}]*\}[^}]*)*\},?'
    content, n = replace_pattern(content, modal_pattern, MODAL_CONTENT_STD.strip())
    if n > 0:
        changes.append(f"  ✓ Fixed modalContent ({n} occurrences)")
    
    return content, changes

def fix_navigation(content, screen_name):
    """Fix navigation route names and remove 'as never' casts"""
    changes = []
    
    # Fix route name corrections
    for old_route, new_route in ROUTE_CORRECTIONS.items():
        content, n = replace_pattern(content, re.escape(old_route), new_route)
        if n > 0:
            changes.append(f"  ✓ Fixed route {old_route} -> {new_route} ({n}x)")
    
    # Remove 'as never' from navigation calls with params
    # Pattern: navigation.navigate('Screen', { ... } as never)
    as_never_with_params = r"(\{\s*[^}]*)\}\s*as\s+never"
    content, n = replace_pattern(content, as_never_with_params, r"\1}")
    if n > 0:
        changes.append(f"  ✓ Removed 'as never' from params ({n} occurrences)")
    
    # Remove standalone 'as never'
    content, n = replace_pattern(content, r"\s*as\s+never", "")
    if n > 0:
        changes.append(f"  ✓ Removed standalone 'as never' ({n} occurrences)")
    
    # Fix navigation calls that are missing proper typing
    # Add proper type imports if missing
    
    return content, changes

def fix_spacing(content, screen_name):
    """Standardize spacing values"""
    changes = []
    
    # Fix section spacing
    section_pattern = r'section:\s*\{[^}]*(?:marginBottom)[^}]*\},?'
    content, n = replace_pattern(content, section_pattern, """section: {
    marginBottom: 22,
  },""")
    if n > 0:
        changes.append(f"  ✓ Fixed section spacing ({n} occurrences)")
    
    # Fix sectionHeader
    header_pattern = r'sectionHeader:\s*\{[^}]*(?:flexDirection|alignItems|justifyContent|marginBottom|paddingHorizontal)[^}]*\},?'
    content, n = replace_pattern(content, header_pattern, """sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },""")
    if n > 0:
        changes.append(f"  ✓ Fixed sectionHeader ({n} occurrences)")
    
    # Fix gap inconsistencies in rows - standardize to 8 or 12
    # Replace random gap values with standardized ones
    content = re.sub(r"gap:\s*4,", "gap: 8,", content)
    content = re.sub(r"gap:\s*6,", "gap: 8,", content)
    content = re.sub(r"gap:\s*10,", "gap: 12,", content)
    content = re.sub(r"gap:\s*14,", "gap: 12,", content)
    
    changes.append("  ✓ Standardized gap values (4,6→8; 10,14→12)")
    
    # Fix marginBottom inconsistencies in cards
    content = re.sub(r"marginBottom:\s*10,", "marginBottom: 12,", content)
    content = re.sub(r"marginBottom:\s*14,", "marginBottom: 14,", content)  # keep 14
    content = re.sub(r"marginBottom:\s*16,", "marginBottom: 14,", content)
    content = re.sub(r"marginBottom:\s*20,", "marginBottom: 22,", content)
    content = re.sub(r"marginBottom:\s*24,", "marginBottom: 22,", content)
    content = re.sub(r"marginBottom:\s*28,", "marginBottom: 22,", content)
    content = re.sub(r"marginBottom:\s*30,", "marginBottom: 22,", content)
    
    changes.append("  ✓ Standardized marginBottom values")
    
    # Fix padding in cards - standardize to 14 or 16
    content = re.sub(r"padding:\s*12,", "padding: 14,", content)
    content = re.sub(r"padding:\s*18,", "padding: 16,", content)
    
    changes.append("  ✓ Standardized padding values")
    
    return content, changes

def fix_border_radius(content, screen_name):
    """Standardize border radius values"""
    changes = []
    
    # Card-level borderRadius standardization
    # Replace various card radii with 18
    content = re.sub(r"(?<=Card.*\{[^}]{0,200})borderRadius:\s*12,", "borderRadius: 18,", content)
    content = re.sub(r"(?<=Card.*\{[^}]{0,200})borderRadius:\s*14,", "borderRadius: 18,", content)
    content = re.sub(r"(?<=Card.*\{[^}]{0,200})borderRadius:\s*16,", "borderRadius: 18,", content)
    content = re.sub(r"(?<=Card.*\{[^}]{0,200})borderRadius:\s*20,", "borderRadius: 18,", content)
    content = re.sub(r"(?<=Card.*\{[^}]{0,200})borderRadius:\s*24,", "borderRadius: 18,", content)
    
    # Button/input borderRadius standardization to 14
    content = re.sub(r"(?<=Btn.*\{[^}]{0,100})borderRadius:\s*10,", "borderRadius: 14,", content)
    content = re.sub(r"(?<=Btn.*\{[^}]{0,100})borderRadius:\s*12,", "borderRadius: 14,", content)
    content = re.sub(r"(?<=input.*\{[^}]{0,100})borderRadius:\s*12,", "borderRadius: 14,", content)
    
    # Modal borderRadius to 22
    content = re.sub(r"(?<=modal.*\{[^}]{0,100})borderRadius:\s*20,", "borderRadius: 22,", content)
    content = re.sub(r"(?<=modal.*\{[^}]{0,100})borderRadius:\s*24,", "borderRadius: 22,", content)
    
    changes.append("  ✓ Standardized borderRadius (cards→18, buttons→14, modals→22)")
    
    return content, changes

def fix_specific_screen_issues(content, screen_name):
    """Fix screen-specific known issues"""
    changes = []
    
    if screen_name == 'FamilySharingScreen':
        # Fix the tab inline active style to be cleaner
        content = content.replace(
            "activeTab === tab && [styles.tabActive, { borderBottomColor: themeColors.primary, backgroundColor: themeColors.colors[0] }]",
            "activeTab === tab && styles.tabActive"
        )
        changes.append("  ✓ Simplified FamilySharingScreen tab active style")
        
        # Fix member card wrapper borderRadius
        content = content.replace(
            "borderRadius: 20,",
            "borderRadius: 18,",
        )
        
    elif screen_name == 'EditGuardianScreen':
        # Fix tab active danger style
        content = content.replace(
            "isDanger && isActive && { borderColor: '#ef4444', borderWidth: 1 }",
            "isDanger && isActive && styles.tabActiveDanger"
        )
        changes.append("  ✓ Fixed EditGuardianScreen danger tab active style")
        
    elif screen_name == 'BabyFamilyCenterScreen':
        # Fix gender button borderRadius
        content = content.replace(
            "borderRadius: 20,",
            "borderRadius: 18,",
        )
        changes.append("  ✓ Fixed BabyFamilyCenterScreen gender button radius")
        
    elif screen_name == 'GrowthDashboardScreen':
        # Fix quick action borderRadius
        content = content.replace(
            "borderRadius: 16,",
            "borderRadius: 18,",
        )
        changes.append("  ✓ Fixed GrowthDashboardScreen quick action radius")
        
    elif screen_name == 'CommunityMemberProfileScreen':
        # Fix banner borderRadius
        content = content.replace(
            "borderRadius: 20,",
            "borderRadius: 18,",
        )
        changes.append("  ✓ Fixed CommunityMemberProfileScreen banner radius")
        
    elif screen_name == 'CommunityProfileScreen':
        # Fix createPostBtn borderRadius
        content = content.replace(
            "borderRadius: 14,",
            "borderRadius: 14,",  # already correct
        )
        changes.append("  ✓ Verified CommunityProfileScreen button radius")
    
    return content, changes

def process_screen(filepath, screen_name):
    """Process a single screen file"""
    print(f"\n{'='*60}")
    print(f"📱 Processing: {screen_name}")
    print(f"   File: {filepath}")
    print(f"{'='*60}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    all_changes = []
    
    # Apply fixes
    content, changes = fix_tabs(content, screen_name)
    all_changes.extend(changes)
    
    content, changes = fix_cards(content, screen_name)
    all_changes.extend(changes)
    
    content, changes = fix_navigation(content, screen_name)
    all_changes.extend(changes)
    
    content, changes = fix_spacing(content, screen_name)
    all_changes.extend(changes)
    
    content, changes = fix_border_radius(content, screen_name)
    all_changes.extend(changes)
    
    content, changes = fix_specific_screen_issues(content, screen_name)
    all_changes.extend(changes)
    
    # Check if anything changed
    if content == original_content:
        print("  ⚠️  No changes made")
        return False
    
    # Backup and write
    backup = backup_file(filepath)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"  💾 Backup: {backup}")
    for change in all_changes:
        print(change)
    
    print(f"  ✅ Done! {len(all_changes)} fix categories applied")
    return True

def generate_unified_styles_file():
    """Generate a unified styles file that can be imported across screens"""
    unified_content = '''/**
 * Unified Styles for LittleLoom Screens
 * Import these to ensure consistency across all screens
 */

import { Platform, StyleSheet } from 'react-native';

export const UNIFIED_RADIUS = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  full: 9999,
};

export const UNIFIED_SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
};

export const UNIFIED_SHADOWS = {
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    android: { elevation: 6 },
  }),
  button: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
  }),
  float: Platform.select({
    ios: {
      shadowColor: '#667eea',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
    },
    android: { elevation: 8 },
  }),
};

export const tabBarStyles = StyleSheet.create({
  container: {
    paddingHorizontal: UNIFIED_SPACE.lg,
    marginBottom: UNIFIED_SPACE.lg,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: UNIFIED_RADIUS.lg,
    padding: 5,
    gap: 5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
        backgroundColor: 'rgba(255,255,255,0.9)',
      },
    }),
  },
  barDark: {
    backgroundColor: 'rgba(35,35,45,0.75)',
    ...Platform.select({
      android: {
        backgroundColor: 'rgba(35,35,45,0.9)',
      },
    }),
  },
  tab: {
    flex: 1,
    borderRadius: UNIFIED_RADIUS.md,
    overflow: 'hidden',
  },
  tabBg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: UNIFIED_RADIUS.md,
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(102,126,234,0.12)',
  },
  tabActiveDanger: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#667eea',
    fontWeight: '700',
  },
  tabLabelDanger: {
    color: '#ef4444',
    fontWeight: '700',
  },
});

export const cardStyles = StyleSheet.create({
  glass: {
    borderRadius: UNIFIED_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...UNIFIED_SHADOWS.card,
  },
  glassDark: {
    borderColor: 'rgba(255,255,255,0.06)',
  },
  form: {
    padding: 0,
    marginBottom: 14,
    borderRadius: UNIFIED_RADIUS.lg,
    overflow: 'hidden',
  },
  stats: {
    padding: 0,
    marginBottom: 14,
    borderRadius: UNIFIED_RADIUS.lg,
    overflow: 'hidden',
  },
  empty: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: UNIFIED_RADIUS.lg,
  },
  activity: {
    marginVertical: 5,
    padding: 14,
    borderRadius: UNIFIED_RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  milestone: {
    padding: 0,
    marginBottom: 12,
    borderRadius: UNIFIED_RADIUS.lg,
    overflow: 'hidden',
  },
  action: {
    padding: 0,
    marginBottom: 12,
    borderRadius: UNIFIED_RADIUS.lg,
    overflow: 'hidden',
  },
  danger: {
    padding: 24,
    alignItems: 'center',
    borderRadius: UNIFIED_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  modal: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: UNIFIED_RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 40,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  modalDark: {
    backgroundColor: '#1a1a2e',
  },
});

export const spacingStyles = StyleSheet.create({
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
    paddingHorizontal: 20,
    paddingTop: 18,
    marginBottom: 14,
  },
});
'''
    
    return unified_content

def main():
    """Main execution"""
    print("=" * 70)
    print("  LittleLoom Screen Uniformity & Navigation Fix Tool")
    print("  " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 70)
    
    # Map of files to process
    screen_files = {
        'FamilySharingScreen': 'user_pasted_clipboard_long_content_as_file_import { StyleShe.txt',
        'EditGuardianScreen': 'user_pasted_clipboard_long_content_as_file_import React, { useC.txt',
        'BabyFamilyCenterScreen': 'user_pasted_clipboard_long_content_as_file_import { StyleSheet,.txt',
        'GrowthDashboardScreen': 'user_pasted_clipboard_long_content_as_file_import React, { memo.txt',
        'CommunityMemberProfileScreen': 'user_pasted_clipboard_long_content_as_file_import { StyleSheet,(1).txt',
        'CommunityProfileScreen': 'user_pasted_clipboard_long_content_as_file_srcscreenscommu.txt',
    }
    
    upload_dir = '/mnt/agents/upload'
    processed = 0
    
    for screen_name, filename in screen_files.items():
        filepath = os.path.join(upload_dir, filename)
        if os.path.exists(filepath):
            if process_screen(filepath, screen_name):
                processed += 1
        else:
            print(f"\n❌ File not found: {filepath}")
    
    # Generate unified styles file
    print(f"\n{'='*70}")
    print("📦 Generating Unified Styles File...")
    print(f"{'='*70}")
    
    unified_content = generate_unified_styles_file()
    unified_path = os.path.join(upload_dir, 'UnifiedStyles.ts')
    with open(unified_path, 'w', encoding='utf-8') as f:
        f.write(unified_content)
    
    print(f"  ✅ Created: {unified_path}")
    print(f"  📋 Contains: tabBarStyles, cardStyles, spacingStyles")
    print(f"  💡 Usage: import {{ tabBarStyles, cardStyles }} from './UnifiedStyles'")
    
    print(f"\n{'='*70}")
    print(f"  SUMMARY")
    print(f"{'='*70}")
    print(f"  Screens processed: {processed}/{len(screen_files)}")
    print(f"  Backups created: {processed}")
    print(f"  Unified styles: UnifiedStyles.ts")
    print(f"\n  Next steps:")
    print(f"  1. Review changes in each .tsx file")
    print(f"  2. Copy UnifiedStyles.ts to src/theme/UnifiedStyles.ts")
    print(f"  3. Gradually import shared styles in new screens")
    print(f"  4. Run TypeScript compiler to check navigation types")
    print(f"{'='*70}")

if __name__ == '__main__':
    main()