export const CommunityColors = {
  // Primary Palette - Warm Social Energy
  primary: '#FF6B6B',
  primaryLight: '#FF8E8E',
  primaryDark: '#EE5A5A',
  
  // Secondary - Ocean Trust (complementary to primary)
  secondary: '#4ECDC4',
  secondaryLight: '#7EDDD7',
  secondaryDark: '#3DBBB4',
  
  // Accent - Sunshine Yellow for highlights
  accent: '#FFD93D',
  accentLight: '#FFE066',
  accentDark: '#F4C430',
  
  // Semantic Colors
  success: '#6BCB77',
  warning: '#FFD93D',
  error: '#FF6B6B',
  info: '#4D96FF',
  
  // Background Layers - Warm Social Feed vibes
  background: {
    main: '#FFF5F5',        // Warm white
    card: '#FFFFFF',
    elevated: '#FFFAFA',
    overlay: 'rgba(255, 107, 107, 0.05)',
    gradient: ['#FFF5F5', '#FFF0F0', '#FFE8E8'] as const,
  },
  
  // Text Colors
  text: {
    primary: '#2D3436',
    secondary: '#636E72',
    tertiary: '#B2BEC3',
    inverse: '#FFFFFF',
    link: '#FF6B6B',
  },
  
  // UI Elements
  border: 'rgba(255, 107, 107, 0.2)',
  divider: 'rgba(0, 0, 0, 0.05)',
  shadow: 'rgba(255, 107, 107, 0.15)',
  
  // Topic Colors (for community categories)
  topics: {
    potty: '#FF6B6B',
    sleep: '#4ECDC4',
    feeding: '#FFD93D',
    milestones: '#A29BFE',
    health: '#FD79A8',
    hacks: '#00B894',
  },
};

export const CommunityGradients = {
  // Main Header - Sunset vibes
  header: ['#FF6B6B', '#FF8E8E', '#FFB4B4'] as const,
  
  // Action Buttons - Energetic
  primary: ['#FF6B6B', '#EE5A5A'] as const,
  secondary: ['#4ECDC4', '#3DBBB4'] as const,
  accent: ['#FFD93D', '#F4C430'] as const,
  
  // Cards - Subtle warm glow
  card: ['#FFFFFF', '#FFF5F5'] as const,
  glass: ['rgba(255,255,255,0.95)', 'rgba(255,250,250,0.85)'] as const,
  
  // Social Proof/Engagement
  trending: ['#FF6B6B', '#FFD93D'] as const,
  verified: ['#4ECDC4', '#00B894'] as const,
  
  // Dark mode variants (if needed)
  darkHeader: ['#2D3436', '#636E72'] as const,
};

export const CommunitySpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const CommunityBorderRadius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const CommunityTypography = {
  header: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500',
  },
  small: {
    fontSize: 11,
    fontWeight: '600',
  },
};

export const CommunityShadows = {
  sm: {
    shadowColor: CommunityColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: CommunityColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: CommunityColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  glow: {
    shadowColor: CommunityColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
};
