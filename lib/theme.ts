import type { CSSProperties } from 'react';

export type ThemeColorKey = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink';
export type ThemeSurface = 'dark' | 'light';

export const THEME_COLOR_KEYS: ThemeColorKey[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
export const THEME_SURFACES: ThemeSurface[] = ['dark', 'light'];

export const DEFAULT_THEME_COLOR: ThemeColorKey = 'blue';
export const DEFAULT_THEME_SURFACE: ThemeSurface = 'dark';

type Palette = { label: string; base: string; dark: string; bright: string; text: string };

// Two rows of the same 7 hues — "dark" (bold, sits on the app's default dark
// surface) and "light" (pastel, sits on the cream surface below). Picking a
// swatch from either row switches both the accent and the surface together.
export const THEME_PALETTES: Record<ThemeSurface, Record<ThemeColorKey, Palette>> = {
  dark: {
    red: { label: 'Red', base: '#FF3B5C', dark: '#E01346', bright: '#FF93A8', text: '#210007' },
    orange: { label: 'Orange', base: '#FF8A3D', dark: '#E8641A', bright: '#FFC694', text: '#241000' },
    yellow: { label: 'Yellow', base: '#FFD23A', dark: '#F0AC0A', bright: '#FFF0A8', text: '#241900' },
    green: { label: 'Green', base: '#2FE083', dark: '#12B869', bright: '#94FFC8', text: '#00210f' },
    blue: { label: 'Blue', base: '#3AA0FF', dark: '#1E6BFF', bright: '#7FD8FF', text: '#04121f' },
    purple: { label: 'Purple', base: '#A855F7', dark: '#7C3AED', bright: '#DDBBFF', text: '#1a0733' },
    pink: { label: 'Pink', base: '#FF3DC4', dark: '#E01AA0', bright: '#FFA0E8', text: '#240016' },
  },
  light: {
    red: { label: 'Red', base: '#F5A3A8', dark: '#EE8B92', bright: '#FBD4D6', text: '#4A1418' },
    orange: { label: 'Orange', base: '#F5C199', dark: '#EFAE7B', bright: '#FCE3CB', text: '#4A2A0F' },
    yellow: { label: 'Yellow', base: '#F2DD9A', dark: '#ECD077', bright: '#FBF2CE', text: '#453A0C' },
    green: { label: 'Green', base: '#AEE0C4', dark: '#93D5AF', bright: '#DCF5E7', text: '#0F3A24' },
    blue: { label: 'Blue', base: '#A9CDEF', dark: '#8FBBEA', bright: '#DBEBFB', text: '#0F2C46' },
    purple: { label: 'Purple', base: '#CBB6EC', dark: '#B79CE3', bright: '#EBE0F9', text: '#2E1B47' },
    pink: { label: 'Pink', base: '#F2B8E0', dark: '#EC9FD5', bright: '#FBE1F3', text: '#451332' },
  },
};

type SurfaceTokens = {
  bg: string;
  panel: string;
  panelAlt: string;
  inputBg: string;
  border: string;
  borderSoft: string;
  borderFaint: string;
  text: string;
  text60: string;
  text50: string;
  text45: string;
  text40: string;
  text35: string;
  text30: string;
};

// Mirrors the default values baked into `.blocs-theme` in globals.css (the
// `dark` row) plus the cream counterpart from the design file's pastel
// screens. Returned as inline CSS vars so they win over the class defaults.
const SURFACE_TOKENS: Record<ThemeSurface, SurfaceTokens> = {
  dark: {
    bg: '#050608',
    panel: '#0d0f13',
    panelAlt: '#0a0c10',
    inputBg: '#14171d',
    border: 'rgba(255, 255, 255, 0.08)',
    borderSoft: 'rgba(255, 255, 255, 0.1)',
    borderFaint: 'rgba(255, 255, 255, 0.06)',
    text: '#f5f7fa',
    text60: 'rgba(245, 247, 250, 0.6)',
    text50: 'rgba(245, 247, 250, 0.5)',
    text45: 'rgba(245, 247, 250, 0.45)',
    text40: 'rgba(245, 247, 250, 0.4)',
    text35: 'rgba(245, 247, 250, 0.35)',
    text30: 'rgba(245, 247, 250, 0.3)',
  },
  light: {
    bg: '#F3ECE0',
    panel: '#FBF6EC',
    panelAlt: '#F1E9DA',
    inputBg: '#F1E9DA',
    border: 'rgba(30, 20, 10, 0.08)',
    borderSoft: 'rgba(30, 20, 10, 0.1)',
    borderFaint: 'rgba(30, 20, 10, 0.06)',
    text: '#2B2118',
    text60: 'rgba(43, 33, 24, 0.6)',
    text50: 'rgba(43, 33, 24, 0.5)',
    text45: 'rgba(43, 33, 24, 0.45)',
    text40: 'rgba(43, 33, 24, 0.4)',
    text35: 'rgba(43, 33, 24, 0.35)',
    text30: 'rgba(43, 33, 24, 0.3)',
  },
};

export function isThemeColorKey(value: string | null | undefined): value is ThemeColorKey {
  return !!value && (THEME_COLOR_KEYS as string[]).includes(value);
}

export function isThemeSurface(value: string | null | undefined): value is ThemeSurface {
  return !!value && (THEME_SURFACES as string[]).includes(value);
}

function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// CSS custom-property overrides for `.blocs-theme` — spread onto the themed
// root element's `style` so it picks up the trainer's chosen accent and
// surface (dark or light/cream) instead of the class's dark-mode defaults.
export function getThemeCssVars(colorKey?: string | null, surfaceKey?: string | null): CSSProperties {
  const surface = isThemeSurface(surfaceKey) ? surfaceKey : DEFAULT_THEME_SURFACE;
  const palette = THEME_PALETTES[surface][isThemeColorKey(colorKey) ? colorKey : DEFAULT_THEME_COLOR];
  const tokens = SURFACE_TOKENS[surface];
  return {
    '--blocs-bg': tokens.bg,
    '--blocs-panel': tokens.panel,
    '--blocs-panel-alt': tokens.panelAlt,
    '--blocs-input-bg': tokens.inputBg,
    '--blocs-border': tokens.border,
    '--blocs-border-soft': tokens.borderSoft,
    '--blocs-border-faint': tokens.borderFaint,
    '--blocs-text': tokens.text,
    '--blocs-text-60': tokens.text60,
    '--blocs-text-50': tokens.text50,
    '--blocs-text-45': tokens.text45,
    '--blocs-text-40': tokens.text40,
    '--blocs-text-35': tokens.text35,
    '--blocs-text-30': tokens.text30,
    '--blocs-accent': palette.base,
    '--blocs-accent-dark': palette.dark,
    '--blocs-accent-bright': palette.bright,
    '--blocs-accent-text': palette.text,
    '--blocs-accent-rgb': hexToRgbTriplet(palette.base),
  } as CSSProperties;
}
