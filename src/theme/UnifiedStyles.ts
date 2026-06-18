/**
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