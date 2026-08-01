'use client'

import { THEME_COLOR_KEYS, THEME_PALETTES, THEME_SURFACES, type ThemeColorKey, type ThemeSurface } from '@/lib/theme'

export function ThemeSwatchPicker({
  color,
  surface,
  onChange,
}: {
  color: ThemeColorKey
  surface: ThemeSurface
  onChange: (color: ThemeColorKey, surface: ThemeSurface) => void
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {THEME_SURFACES.map((rowSurface) => (
        <div key={rowSurface} className="flex gap-2.5 flex-wrap">
          {THEME_COLOR_KEYS.map((key) => {
            const palette = THEME_PALETTES[rowSurface][key]
            const active = key === color && rowSurface === surface
            return (
              <div
                key={key}
                className="blocs-swatch"
                title={palette.label}
                onClick={() => onChange(key, rowSurface)}
                style={{
                  background: `linear-gradient(135deg, ${palette.base}, ${palette.dark})`,
                  boxShadow: active
                    ? `0 0 0 3px var(--blocs-panel), 0 0 0 5px ${palette.base}, 0 0 12px ${palette.base}99`
                    : '0 0 0 1px rgba(255,255,255,0.1)',
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
