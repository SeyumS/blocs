'use client'

import { THEME_COLOR_KEYS, THEME_PALETTES, type ThemeColorKey } from '@/lib/theme'

export function ThemeSwatchPicker({
  value,
  onChange,
}: {
  value: ThemeColorKey
  onChange: (key: ThemeColorKey) => void
}) {
  return (
    <div className="flex gap-2.5 flex-wrap">
      {THEME_COLOR_KEYS.map((key) => {
        const palette = THEME_PALETTES[key]
        const active = key === value
        return (
          <div
            key={key}
            className="blocs-swatch"
            title={palette.label}
            onClick={() => onChange(key)}
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
  )
}
