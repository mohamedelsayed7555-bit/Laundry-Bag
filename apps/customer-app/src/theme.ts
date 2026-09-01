export const colors = {
  navy: {
    900: '#0a0e1a',
    800: '#121829',
    700: '#1a2138',
    600: '#222b48',
    500: '#2d3867',
    400: '#3d4b89',
    300: '#5765a3',
    200: '#818bba',
    100: '#abb2d1',
  },
  primary: '#00c966',
  primaryLight: '#33d480',
  primaryDark: '#00a352',
  primaryGlow: 'rgba(0, 201, 102, 0.15)',
  accent: '#7c5cfc',
  accentLight: '#9b80fd',
  accentGlow: 'rgba(124, 92, 252, 0.15)',
  white: '#ffffff',
  gray: {
    100: '#f0f2f5',
    200: '#e2e4e9',
    300: '#c1c5d0',
    400: '#8b8fa5',
    500: '#6b7085',
  },
  danger: '#ef4444',
  dangerGlow: 'rgba(239, 68, 68, 0.15)',
  warning: '#f59e0b',
  warningGlow: 'rgba(245, 158, 11, 0.15)',
  success: '#10b981',
  successGlow: 'rgba(16, 185, 129, 0.15)',
  gold: '#fbbf24',
  goldGlow: 'rgba(251, 191, 36, 0.15)',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
} as const

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  }),
} as const
