import { TextStyle } from 'react-native';

// Rediseño v1 — tokens según design_handoff_rediseno_v1/README.md
export const Colors = {
  // Primary — espresso
  primary: '#6F4A26',
  primaryLight: '#8A6239',
  primaryDark: '#5A3B1E',
  primaryTint: '#F1E7D9', // fondos suaves / estado activo

  // Secondary — teal refinado
  secondary: '#17766B',
  secondaryLight: '#7BC4A8',
  secondaryTint: '#E1F0ED',

  // Background hierarchy
  bgBase: '#F6F1E9',
  bgCard: '#FFFFFF',
  bgElevated: '#FFFFFF',
  bgDark: '#2A1F14',

  // Text hierarchy
  textPrimary: '#2A1F14',
  textSecondary: '#6E5D4B',
  textMuted: '#A3927D',
  textOnDark: '#F6F1E9',
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#2E7D4F',
  successLight: '#E4F2E9',
  warning: '#C77B21',
  warningLight: '#FBF0DF',
  danger: '#C24B33',
  dangerLight: '#F9E8E3',
  info: '#17766B',
  infoLight: '#E1F0ED',

  // Product family colors
  familyPanaderia: '#C99B62',
  familyLaminado: '#DDBE6C',
  familyNavidad: '#B34A44',

  // Borders
  border: '#E7DCCC',
  borderLight: '#EDE3D3',
  divider: '#F1E9DC',

  // Overlay
  overlay: 'rgba(42, 31, 20, 0.5)',
} as const;

// Manrope (expo-google-fonts). En RN cada peso es una familia propia.
export const Fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
} as const;

const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

export const Typography: Record<string, TextStyle> = {
  // Display — títulos de pantalla / hero de login
  displayLarge: { fontFamily: Fonts.extraBold, fontSize: 38, lineHeight: 46, letterSpacing: -0.5 },
  displayMedium: { fontFamily: Fonts.extraBold, fontSize: 30, lineHeight: 38, letterSpacing: -0.5 },

  // Headings — títulos de card y de sección de card
  headingLarge: { fontFamily: Fonts.extraBold, fontSize: 19, lineHeight: 26 },
  headingMedium: { fontFamily: Fonts.extraBold, fontSize: 16, lineHeight: 22 },
  headingSmall: { fontFamily: Fonts.extraBold, fontSize: 15, lineHeight: 20 },

  // Label de sección (uppercase, muted)
  sectionLabel: {
    fontFamily: Fonts.extraBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },

  // Body
  bodyLarge: { fontFamily: Fonts.semiBold, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: Fonts.semiBold, fontSize: 14, lineHeight: 20 },
  bodySmall: { fontFamily: Fonts.semiBold, fontSize: 13, lineHeight: 18 },
  meta: { fontFamily: Fonts.semiBold, fontSize: 12, lineHeight: 16, color: Colors.textMuted },

  // Labels (botones, inputs, chips)
  labelLarge: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22 },
  labelMedium: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 20 },
  labelSmall: { fontFamily: Fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, textTransform: 'uppercase' },

  // Números (siempre tabulares)
  numberLarge: { fontFamily: Fonts.extraBold, fontSize: 26, lineHeight: 32, ...TABULAR },
  numberMedium: { fontFamily: Fonts.extraBold, fontSize: 24, lineHeight: 30, ...TABULAR },
  numberSmall: { fontFamily: Fonts.extraBold, fontSize: 20, lineHeight: 26, ...TABULAR },
  numberCounter: { fontFamily: Fonts.extraBold, fontSize: 56, lineHeight: 62, ...TABULAR },
  numberHero: { fontFamily: Fonts.extraBold, fontSize: 72, lineHeight: 78, ...TABULAR },
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
  sm: 12, // icon-tiles
  md: 14, // botones / inputs
  lg: 16, // cards
  xl: 20, // cards grandes
  full: 9999,
} as const;

// Sombras casi planas: cards con borde 1px + sombra sutil; CTA primario más marcada
export const Shadows = {
  sm: {
    shadowColor: '#2A1F14',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#2A1F14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#2A1F14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cta: {
    shadowColor: '#6F4A26',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const TOUCH_TARGET_MIN = 56;

// Breakpoint tablet: >= 768px → sidebar lateral, layouts de dos paneles
export const TABLET_BREAKPOINT = 768;

export function getFamilyColor(family: string): string {
  switch (family.toLowerCase()) {
    case 'panaderia': return Colors.familyPanaderia;
    case 'laminado': return Colors.familyLaminado;
    case 'navidad': return Colors.familyNavidad;
    default: return Colors.primaryLight;
  }
}

// Tinte al 25% para chips de familia (fondo suave del color de familia)
export function getFamilyTint(family: string): string {
  return getFamilyColor(family) + '40';
}
