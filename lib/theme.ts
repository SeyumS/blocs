import type { CSSProperties } from 'react';

export type ThemeColorKey = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink';

export const THEME_COLOR_KEYS: ThemeColorKey[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];

export const DEFAULT_THEME_COLOR: ThemeColorKey = 'blue';

export const THEME_PALETTES: Record<ThemeColorKey, { label: string; base: string; dark: string; bright: string; text: string }> = {
  red: { label: 'Red', base: '#FF3B5C', dark: '#E01346', bright: '#FF93A8', text: '#210007' },
  orange: { label: 'Orange', base: '#FF8A3D', dark: '#E8641A', bright: '#FFC694', text: '#241000' },
  yellow: { label: 'Yellow', base: '#FFD23A', dark: '#F0AC0A', bright: '#FFF0A8', text: '#241900' },
  green: { label: 'Green', base: '#2FE083', dark: '#12B869', bright: '#94FFC8', text: '#00210f' },
  blue: { label: 'Blue', base: '#3AA0FF', dark: '#1E6BFF', bright: '#7FD8FF', text: '#04121f' },
  purple: { label: 'Purple', base: '#A855F7', dark: '#7C3AED', bright: '#DDBBFF', text: '#1a0733' },
  pink: { label: 'Pink', base: '#FF3DC4', dark: '#E01AA0', bright: '#FFA0E8', text: '#240016' },
};

export function isThemeColorKey(value: string | null | undefined): value is ThemeColorKey {
  return !!value && (THEME_COLOR_KEYS as string[]).includes(value);
}

function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// CSS custom-property overrides for `.blocs-theme` — spread onto the themed
// root element's `style` so it picks up the trainer's chosen accent instead
// of the class's default blue. `--blocs-accent-rgb` feeds the `rgba(var(...))`
// tints used for translucent backgrounds/borders/glows throughout globals.css.
export function getThemeCssVars(key?: string | null): CSSProperties {
  const palette = THEME_PALETTES[isThemeColorKey(key) ? key : DEFAULT_THEME_COLOR];
  return {
    '--blocs-accent': palette.base,
    '--blocs-accent-dark': palette.dark,
    '--blocs-accent-bright': palette.bright,
    '--blocs-accent-text': palette.text,
    '--blocs-accent-rgb': hexToRgbTriplet(palette.base),
  } as CSSProperties;
}
