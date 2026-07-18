'use client'
import React, { useEffect, useRef, useState } from 'react'
import { generateTimeSlots } from '@/lib/utils'
import { DEFAULT_THEME_COLOR, getThemeCssVars, type ThemeColorKey } from '@/lib/theme'
import { ThemeSwatchPicker } from '@/app/components/ThemeSwatchPicker'

export interface ScheduleBuilderData {
  name: string
  slug: string
  bio: string
  themeColor: ThemeColorKey
  cellIds: string[]
  email?: string
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'

function SlugInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Only the *result* of the last completed check is state — "checking" for
  // the current value is derived below, so no setState runs synchronously
  // in the effect body (every update happens inside the debounced callback).
  const [checkedSlug, setCheckedSlug] = useState<string | null>(null)
  const [checkedStatus, setCheckedStatus] = useState<'available' | 'taken' | 'invalid' | 'error'>('invalid')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value) return

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/check-slug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: value }),
        })
        if (res.status === 400) {
          setCheckedStatus('invalid')
        } else {
          const data = await res.json()
          setCheckedStatus(data.available ? 'available' : 'taken')
        }
      } catch {
        setCheckedStatus('error')
      }
      setCheckedSlug(value)
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  const status: SlugStatus = !value ? 'idle' : checkedSlug !== value ? 'checking' : checkedStatus

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 blocs-input" style={{ padding: '13px 14px' }}>
        <span style={{ color: 'var(--blocs-text-40)', fontSize: '15px' }}>blocsbooking/</span>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--blocs-accent)', fontSize: '15px', fontWeight: 600, flex: 1 }}
        />
      </div>
      {status === 'checking' && <span style={{ fontSize: '12px', color: 'var(--blocs-text-40)' }}>Checking availability…</span>}
      {status === 'available' && <span style={{ fontSize: '12px', color: 'var(--blocs-accent-bright)' }}>Available</span>}
      {status === 'taken' && <span className="blocs-error">That link is already taken</span>}
      {status === 'invalid' && <span className="blocs-error">Use lowercase letters, numbers, and hyphens</span>}
      {status === 'error' && <span className="blocs-error">Couldn&apos;t check availability — try again</span>}
    </div>
  )
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ScheduleBuilder({
  onSubmit,
  submitLabel,
  isSubmitting,
  showEmailField = false,
  error,
  themeColor: controlledThemeColor,
  onThemeColorChange,
}: {
  onSubmit: (data: ScheduleBuilderData) => void | Promise<void>
  submitLabel: string
  isSubmitting: boolean
  showEmailField?: boolean
  error?: string
  // Optional controlled theme color — pass both to keep this in sync with a
  // picker elsewhere on the page (e.g. the landing page's hero accent
  // picker). Omit both to let the component manage its own state, as
  // onboarding does.
  themeColor?: ThemeColorKey
  onThemeColorChange?: (key: ThemeColorKey) => void
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [bio, setBio] = useState('')
  const [email, setEmail] = useState('')
  const [internalThemeColor, setInternalThemeColor] = useState<ThemeColorKey>(DEFAULT_THEME_COLOR)
  const themeColor = controlledThemeColor ?? internalThemeColor
  const setThemeColor = onThemeColorChange ?? setInternalThemeColor
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleCell = (cellId: string, forceMode?: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      const mode = forceMode ?? !next.has(cellId)

      if (mode) {
        next.add(cellId)
      } else {
        next.delete(cellId)
      }

      return next
    })
  }

  const [workHours, setWorkHours] = useState('01:30')
  const [workBreak, setBreakHours] = useState('00:30')
  const [workBlocks, setWorkBlocks] = useState('0')
  const [workingDays, setWorkingDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  const [cellIds, setCellIds] = useState<string[]>([])

  const TIMES = generateTimeSlots('2026-06-06T06:00:00.000Z', '2026-06-06T22:00:00.000Z', 30) // 30-min increments
  const [calendarTIMES, setCalendarTIMES] = useState(TIMES)
  const [startTime, setStartTime] = useState('08:00')

  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState(true) // true = selecting, false = deselecting

  const handleMouseDown = (cellId: string) => {
    const mode = !selected.has(cellId)
    setDragMode(mode)
    setIsDragging(true)
    toggleCell(cellId, mode)
  }

  const handleMouseEnter = (cellId: string) => {
    if (isDragging) toggleCell(cellId, dragMode)
  }

  const ApplySchedule = (overrides?: {
    workHours?: string
    workBreak?: string
    workBlocks?: string
    workingDays?: string[]
    calendarTimes?: string[]
  }) => {
    // Use the just-changed value directly instead of reading state (which
    // hasn't re-rendered yet at the moment this is called from an onChange).
    const hours = overrides?.workHours ?? workHours
    const brk = overrides?.workBreak ?? workBreak
    const blocks = overrides?.workBlocks ?? workBlocks
    const days = overrides?.workingDays ?? workingDays
    const times = overrides?.calendarTimes ?? calendarTIMES

    let cellsPerWorkHour = 3
    let cellsPerWorkBreak = 1
    const nextCellIds: string[] = []

    DAYS.forEach(day => {
      if (days.includes(day)) {
        switch (hours) {
          case '00:30': cellsPerWorkHour = 1; break
          case '01:00': cellsPerWorkHour = 2; break
          case '01:30': cellsPerWorkHour = 3; break
          case '02:00': cellsPerWorkHour = 4; break
          case '02:30': cellsPerWorkHour = 5; break
          case '03:00': cellsPerWorkHour = 6; break
          default: cellsPerWorkHour = 3; break
        }
        switch (brk) {
          case '00:30': cellsPerWorkBreak = 1; break
          case '01:00': cellsPerWorkBreak = 2; break
          case '01:30': cellsPerWorkBreak = 3; break
          case '02:00': cellsPerWorkBreak = 4; break
          case '02:30': cellsPerWorkBreak = 5; break
          case '03:00': cellsPerWorkBreak = 6; break
          default: cellsPerWorkBreak = 1; break
        }
        let startIndex = 0
        for (let i = 0; i < Number(blocks); i++) {
          for (let j = 0; j < cellsPerWorkHour; j++) {
            nextCellIds.push(`${day}-${times[startIndex]}`)
            startIndex++
          }
          for (let k = 0; k < cellsPerWorkBreak; k++) {
            startIndex++
          }
        }
      }
    })
    setCellIds(nextCellIds)
    setSelected(new Set(nextCellIds))
  }

  const canSubmit =
    name.trim().length > 0 &&
    slug.length > 0 &&
    (!showEmailField || EMAIL_PATTERN.test(email)) &&
    !isSubmitting

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      name: name.trim(),
      slug,
      bio: bio.trim(),
      themeColor,
      cellIds,
      ...(showEmailField ? { email } : {}),
    })
  }

  return (
    <div className="blocs-card blocs-form-shell" style={{ padding: '32px 24px', ...getThemeCssVars(themeColor) }}>
      <h1 style={{ margin: '0 0 4px', color: 'var(--blocs-text)', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>Set up your schedule</h1>
      <p style={{ margin: '0 0 20px', color: 'var(--blocs-text-50)', fontSize: '13px' }}>Two minutes, then you&apos;re bookable.</p>

      <form onSubmit={handleSubmit} className="blocs-form-grid">
        <div className="blocs-form-main flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="blocs-label">Your name</label>
            <input
              type="text"
              id="name"
              placeholder="Enter your name"
              className="blocs-input"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="blocs-label">Your booking link</label>
            <SlugInput value={slug} onChange={setSlug} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bio" className="blocs-label">Short bio</label>
            <textarea
              id="bio"
              placeholder="Tell customers a bit about yourself"
              rows={3}
              className="blocs-input"
              style={{ resize: 'vertical' }}
              value={bio}
              onChange={e => setBio(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="blocs-label">Theme color</label>
            <ThemeSwatchPicker value={themeColor} onChange={setThemeColor} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="blocs-label">Available days</label>
            <div className="flex flex-row gap-1.5">
              {DAYS.map(day => (
                <div
                  key={day}
                  className={workingDays.includes(day) ? 'blocs-day-chip active' : 'blocs-day-chip'}
                  onClick={() => {
                    const nextDays = workingDays.includes(day)
                      ? workingDays.filter(wday => wday !== day)
                      : [...workingDays, day]
                    setWorkingDays(nextDays)
                    ApplySchedule({ workingDays: nextDays })
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="blocs-label">Basic schedule</label>
            <div className="flex flex-row flex-wrap justify-around gap-2 items-center blocs-input" style={{ padding: '10px 12px', overflow: 'auto' }}>
              <select className="blocs-select" style={{ border: 'none', padding: '4px' }} value={startTime} onChange={e => {
                const nextTimes = TIMES.slice(TIMES.indexOf(e.target.value))
                setStartTime(e.target.value)
                setCalendarTIMES(nextTimes)
                ApplySchedule({ calendarTimes: nextTimes })
              }}>
                <option value="08:30">begin</option>
                {TIMES.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>

              <div className="flex flex-col gap-1.5 flex-1">
                <div className="flex flex-row gap-2 items-center">
                  <select className="blocs-select" style={{ border: 'none', padding: '4px' }} value={workHours} onChange={e => { setWorkHours(e.target.value); ApplySchedule({ workHours: e.target.value }) }}>
                    <option value="00:30">00:30</option>
                    <option value="01:00">01:00</option>
                    <option value="01:30">01:30</option>
                    <option value="02:00">02:00</option>
                    <option value="02:30">02:30</option>
                    <option value="03:00">03:00</option>
                  </select>
                  <label className="blocs-label" style={{ textTransform: 'none' }}>h work</label>
                </div>
                <div className="flex flex-row gap-2 items-center">
                  <select className="blocs-select" style={{ border: 'none', padding: '4px' }} value={workBreak} onChange={e => { setBreakHours(e.target.value); ApplySchedule({ workBreak: e.target.value }) }}>
                    <option value="00:30">00:30</option>
                    <option value="01:00">01:00</option>
                    <option value="01:30">01:30</option>
                    <option value="02:00">02:00</option>
                    <option value="02:30">02:30</option>
                    <option value="03:00">03:00</option>
                  </select>
                  <label className="blocs-label" style={{ textTransform: 'none' }}>h break</label>
                </div>
              </div>

              <div className="flex flex-row gap-2 items-center">
                <input type="number" value={workBlocks} onChange={e => { setWorkBlocks(e.target.value); ApplySchedule({ workBlocks: e.target.value }) }} className="blocs-select" style={{ width: '50px', border: 'none', padding: '4px', background: 'transparent', color: 'var(--blocs-text)' }} />
                <label className="blocs-label" style={{ textTransform: 'none' }}>blocks</label>
              </div>
            </div>
          </div>

          {showEmailField && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="blocs-label">Email</label>
              <input
                type="email"
                id="email"
                placeholder="your@work-email.com"
                className="blocs-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          )}

          {error && <p className="blocs-error">{error}</p>}

          <button type="submit" className="blocs-btn-primary" disabled={!canSubmit} style={{ marginTop: '6px' }}>
            {isSubmitting ? 'Loading...' : submitLabel}
          </button>
        </div>

        <div className="blocs-form-aside flex flex-col gap-2">
          <label className="blocs-label">Fine-tune your week</label>
          <div onMouseUp={() => setIsDragging(false)} style={{ overflowX: 'auto' }}>
            <div className="grid grid-cols-8 gap-x-0.5 gap-y-0" style={{ minWidth: '480px' }}>
              <div /> {/* empty corner */}
              {DAYS.map(day => <div key={day} style={{ color: 'var(--blocs-text-45)', fontSize: '11px', fontWeight: 600, textAlign: 'center' }}>{day}</div>)}
              {calendarTIMES.map((time, i) => {
                const prevTime = calendarTIMES[i - 1]
                const nextTime = calendarTIMES[i + 1]
                // Cells that continue into the next 30-min slot on every day
                // merge into one uninterrupted block instead of showing as
                // separate stacked squares.
                const rowGapNeeded = !nextTime || DAYS.some(day => {
                  const curSelected = selected.has(`${day}-${time}`)
                  const nextSelected = selected.has(`${day}-${nextTime}`)
                  return !(curSelected && nextSelected)
                })
                const rowMarginBottom = rowGapNeeded ? '2px' : '0px'

                return (
                  <React.Fragment key={time}>
                    <div style={{ color: 'var(--blocs-text-40)', fontSize: '11px', fontWeight: 600, padding: '3px 4px 0 0', marginBottom: rowMarginBottom }}>{time}</div>
                    {DAYS.map(day => {
                      const cellId = `${day}-${time}`
                      const isSelected = selected.has(cellId)
                      const topConnected = isSelected && !!prevTime && selected.has(`${day}-${prevTime}`)
                      const bottomConnected = isSelected && !!nextTime && selected.has(`${day}-${nextTime}`)
                      return (
                        <div
                          key={cellId}
                          onMouseDown={() => handleMouseDown(cellId)}
                          onMouseEnter={() => handleMouseEnter(cellId)}
                          style={{
                            height: '16px',
                            marginBottom: rowMarginBottom,
                            borderRadius: `${topConnected ? 0 : 3}px ${topConnected ? 0 : 3}px ${bottomConnected ? 0 : 3}px ${bottomConnected ? 0 : 3}px`,
                            cursor: 'pointer',
                            background: isSelected
                              ? 'linear-gradient(180deg, var(--blocs-accent), var(--blocs-accent-dark))'
                              : 'var(--blocs-input-bg)',
                          }}
                        />
                      )
                    })}
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
