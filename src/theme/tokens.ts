export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  title: {fontSize: 18, fontWeight: '800' as const},
  subtitle: {fontSize: 13, fontWeight: '700' as const},
  body: {fontSize: 14, fontWeight: '600' as const},
  bodyRegular: {fontSize: 14, fontWeight: '500' as const},
  caption: {fontSize: 12, fontWeight: '600' as const},
  tiny: {fontSize: 11, fontWeight: '600' as const},
} as const;

export const shadows = {
  card: {
    elevation: 2,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 6},
  },
} as const;
