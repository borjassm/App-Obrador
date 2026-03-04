import { TextStyle } from 'react-native';

export const Colors = {
  // Primary — warm brown (bread crust)
  primary: '#8B5E3C',
  primaryLight: '#A67B5B',
  primaryDark: '#6B4226',

  // Secondary — muted teal (freshness)
  secondary: '#2A9D8F',
  secondaryLight: '#4EC6B8',

  // Background hierarchy
  bgBase: '#FDF8F3',
  bgCard: '#FFFFFF',
  bgElevated: '#FFFAF5',
  bgDark: '#3D2B1F',

  // Text hierarchy
  textPrimary: '#2C1810',
  textSecondary: '#6B5B4E',
  textMuted: '#A89888',
  textOnDark: '#FDF8F3',
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#4CAF50',
  successLight: '#E8F5E9',
  warning: '#FF9800',
  warningLight: '#FFF3E0',
  danger: '#E53935',
  dangerLight: '#FFEBEE',
  info: '#42A5F5',
  infoLight: '#E3F2FD',

  // Product family colors
  familyPanaderia: '#D4A574',
  familyLaminado: '#E8C97A',
  familyNavidad: '#C44D4D',

  // Borders
  border: '#E8DDD2',
  borderLight: '#F0E8DE',
  divider: '#F0E8DE',

  // Overlay
  overlay: 'rgba(44, 24, 16, 0.5)',
} as const;

export const Typography: Record<string, TextStyle> = {
  displayLarge: { fontSize: 32, fontWeight: '700', lineHeight: 40, letterSpacing: -0.5 },
  displayMedium: { fontSize: 28, fontWeight: '700', lineHeight: 36 },

  headingLarge: { fontSize: 24, fontWeight: '600', lineHeight: 32 },
  headingMedium: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  headingSmall: { fontSize: 18, fontWeight: '600', lineHeight: 24 },

  bodyLarge: { fontSize: 17, fontWeight: '400', lineHeight: 24 },
  bodyMedium: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400', lineHeight: 18 },

  labelLarge: { fontSize: 17, fontWeight: '600', lineHeight: 24, letterSpacing: 0.3 },
  labelMedium: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  labelSmall: { fontSize: 13, fontWeight: '600', lineHeight: 16, letterSpacing: 0.5 },

  numberLarge: { fontSize: 40, fontWeight: '700', lineHeight: 48 },
  numberMedium: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  numberSmall: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#2C1810',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

export const TOUCH_TARGET_MIN = 56;

export function getFamilyColor(family: string): string {
  switch (family.toLowerCase()) {
    case 'panaderia': return Colors.familyPanaderia;
    case 'laminado': return Colors.familyLaminado;
    case 'navidad': return Colors.familyNavidad;
    default: return Colors.primaryLight;
  }
}
