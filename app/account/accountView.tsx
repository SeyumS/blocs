'use client'

import React, { useRef, useState } from 'react'
import { generateTimeSlots } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { DEFAULT_THEME_COLOR, getThemeCssVars, isThemeColorKey, type ThemeColorKey } from '@/lib/theme'
import { ThemeSwatchPicker } from '@/app/components/ThemeSwatchPicker'
import CancelSubscriptionButton from './cancelSubscriptionButton'

interface Trainer {
  id: string
  name: string
  email: string
  phone: string
  image: string
  slug: string
  session_length_minutes: number
  break_length_minutes: number
  default_start_time: string
  default_number_blocks: number
  theme_color: string
  photo_url: string | null
  bio: string | null
  subscription_status: string
}

interface AvailabilityRules {
  id: string
  trainer_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TIMES = generateTimeSlots('2026-06-06T06:00:00.000Z', '2026-06-06T22:00:00.000Z', 30)

const DAY_TO_INT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function minutesToDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function durationToMinutes(duration: string): number {
  const [h, m] = duration.split(':').map(Number)
  return h * 60 + m
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number): string {
  const h = String(Math.floor(mins / 60)).padStart(2, '0')
  const m = String(mins % 60).padStart(2, '0')
  return `${h}:${m}`
}

function generateDays(rules: AvailabilityRules[]): string[] {
  if (!rules.length) return [...DAYS]
  const dayInts = new Set(rules.map(rule => rule.day_of_week))
  return DAYS.filter(day => dayInts.has(DAY_TO_INT[day]))
}

function buildScheduleCells(
  workHours: string,
  workBreak: string,
  workBlocks: string,
  workingDays: string[],
  calendarTimes: string[]
): string[] {
  let cellsPerWorkHour = 3
  let cellsPerWorkBreak = 1
  const nextCellIds: string[] = []

  DAYS.forEach(day => {
    if (!workingDays.includes(day)) return

    switch (workHours) {
      case '00:30':
        cellsPerWorkHour = 1
        break
      case '01:00':
        cellsPerWorkHour = 2
        break
      case '01:30':
        cellsPerWorkHour = 3
        break
      case '02:00':
        cellsPerWorkHour = 4
        break
      case '02:30':
        cellsPerWorkHour = 5
        break
      case '03:00':
        cellsPerWorkHour = 6
        break
      default:
        cellsPerWorkHour = 3
        break
    }

    switch (workBreak) {
      case '00:30':
        cellsPerWorkBreak = 1
        break
      case '01:00':
        cellsPerWorkBreak = 2
        break
      case '01:30':
        cellsPerWorkBreak = 3
        break
      case '02:00':
        cellsPerWorkBreak = 4
        break
      case '02:30':
        cellsPerWorkBreak = 5
        break
      case '03:00':
        cellsPerWorkBreak = 6
        break
      default:
        cellsPerWorkBreak = 1
        break
    }

    let startIndex = 0
    for (let i = 0; i < Number(workBlocks); i++) {
      for (let j = 0; j < cellsPerWorkHour; j++) {
        if (calendarTimes[startIndex]) {
          nextCellIds.push(`${day}-${calendarTimes[startIndex]}`)
        }
        startIndex++
      }
      for (let k = 0; k < cellsPerWorkBreak; k++) {
        startIndex++
      }
    }
  })

  return nextCellIds
}

function expandRulesToCellIds(
  rules: AvailabilityRules[],
  slotDurationMinutes = 30
): string[] {
  const cellIds: string[] = []

  for (const rule of rules) {
    const day = Object.entries(DAY_TO_INT).find(([, int]) => int === rule.day_of_week)?.[0]
    if (!day) continue

    let current = timeToMinutes(rule.start_time)
    const end = timeToMinutes(rule.end_time)

    while (current < end) {
      cellIds.push(`${day}-${minutesToTime(current)}`)
      current += slotDurationMinutes
    }
  }

  return cellIds
}

function extractAvailabilityRules(selectedCells: string[], slotDurationMinutes = 30) {
  const byDay: Record<string, number[]> = {}

  for (const cellId of selectedCells) {
    const [day, time] = cellId.split('-')
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(timeToMinutes(time))
  }

  const rules = []

  for (const [day, minutesList] of Object.entries(byDay)) {
    const sorted = [...minutesList].sort((a, b) => a - b)

    let rangeStart = sorted[0]
    let prev = sorted[0]

    for (let i = 1; i <= sorted.length; i++) {
      const current = sorted[i]
      const isContiguous = current === prev + slotDurationMinutes

      if (!isContiguous) {
        rules.push({
          day_of_week: DAY_TO_INT[day],
          start_time: minutesToTime(rangeStart),
          end_time: minutesToTime(prev + slotDurationMinutes),
        })
        rangeStart = current
      }
      prev = current
    }
  }

  return rules
}

function SlugInput({ name, trainer }: { name: string; trainer: string }) {
  const [value, setValue] = useState(trainer)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    if (!next.includes('/')) {
      setValue(next)
    }
  }

  return (
    <div className="flex items-center gap-2 blocs-input" style={{ padding: '13px 14px' }}>
      <span style={{ color: 'var(--blocs-text-40)', fontSize: '15px' }}>blocs.app/</span>
      <input
        type="text"
        name={name}
        value={value}
        onChange={handleChange}
        style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--blocs-accent)', fontSize: '15px', fontWeight: 600, flex: 1 }}
      />
    </div>
  )
}

export const AccountView = ({
  trainer,
  availability_rules,
}: {
  trainer: Trainer
  availability_rules: AvailabilityRules[]
}) => {
  const router = useRouter()

  const initialWorkingDays = generateDays(availability_rules)
  const initialWorkHours = minutesToDuration(trainer.session_length_minutes || 90)
  const initialWorkBreak = minutesToDuration(trainer.break_length_minutes || 30)
  const initialWorkBlocks = (trainer.default_number_blocks ?? 0).toString()
  const initialStartTime = trainer.default_start_time || '08:00'
  const startIndex = Math.max(0, TIMES.indexOf(initialStartTime))
  const initialCalendarTimes = TIMES.slice(startIndex)

  const savedCellIds = expandRulesToCellIds(availability_rules)
  const initialCellIds =
    savedCellIds.length > 0
      ? savedCellIds
      : buildScheduleCells(
          initialWorkHours,
          initialWorkBreak,
          initialWorkBlocks,
          initialWorkingDays,
          initialCalendarTimes
        )

  const [trainerName, setTrainerName] = useState(trainer.name)
  const [bio, setBio] = useState(trainer.bio ?? '')
  const [themeColor, setThemeColor] = useState<ThemeColorKey>(
    isThemeColorKey(trainer.theme_color) ? trainer.theme_color : DEFAULT_THEME_COLOR
  )
  const [photoUrl, setPhotoUrl] = useState<string | null>(trainer.photo_url)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [workHours, setWorkHours] = useState(initialWorkHours)
  const [workBreak, setBreakHours] = useState(initialWorkBreak)
  const [workBlocks, setWorkBlocks] = useState(initialWorkBlocks)
  const [startTime, setStartTime] = useState(initialStartTime)
  const [workingDays, setWorkingDays] = useState(initialWorkingDays)
  const [calendarTIMES, setCalendarTIMES] = useState(initialCalendarTimes)
  const [cellIds, setCellIds] = useState<string[]>(initialCellIds)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialCellIds))
  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

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
    const nextCellIds = buildScheduleCells(
      overrides?.workHours ?? workHours,
      overrides?.workBreak ?? workBreak,
      overrides?.workBlocks ?? workBlocks,
      overrides?.workingDays ?? workingDays,
      overrides?.calendarTimes ?? calendarTIMES
    )

    setCellIds(nextCellIds)
    setSelected(new Set(nextCellIds))
  }

  async function saveAvailability(trainerId: string, selectedCells: string[]) {
    const rules = extractAvailabilityRules(selectedCells)

    const { error: deleteError } = await supabase
      .from('availability_rules')
      .delete()
      .eq('trainer_id', trainerId)

    if (deleteError) throw deleteError

    if (rules.length === 0) return

    const rowsToInsert = rules.map(rule => ({
      trainer_id: trainerId,
      day_of_week: rule.day_of_week,
      start_time: rule.start_time,
      end_time: rule.end_time,
    }))

    const { error: insertError } = await supabase
      .from('availability_rules')
      .insert(rowsToInsert)

    if (insertError) throw insertError
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    setPhotoError('')
    setIsUploadingPhoto(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const authUserId = userData.user?.id
      if (!authUserId) throw new Error('Not signed in')

      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${authUserId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('trainers')
        .update({ photo_url: publicUrlData.publicUrl })
        .eq('id', trainer.id)
      if (updateError) throw updateError

      setPhotoUrl(publicUrlData.publicUrl)
    } catch (error) {
      console.error(error)
      setPhotoError('Could not upload photo — please try again.')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.target as HTMLFormElement)
    const name = formData.get('name')
    const personalLink = formData.get('personalLink')

    try {
      const { data, error } = await supabase.auth.getUser()
      const authUserId = data.user?.id
      const email = data.user?.email

      if (error) {
        console.error(error)
        setIsLoading(false)
        return
      }

      const { data: trainerData, error: trainerError } = await supabase
        .from('trainers')
        .update({
          name,
          slug: personalLink,
          auth_user_id: authUserId,
          email,
          session_length_minutes: durationToMinutes(workHours),
          break_length_minutes: durationToMinutes(workBreak),
          default_number_blocks: Number(workBlocks),
          default_start_time: startTime,
          theme_color: themeColor,
          bio,
        })
        .eq('id', trainer.id)
        .select()
        .single()

      if (trainerError || !trainerData) {
        console.error(trainerError)
        setIsLoading(false)
        return
      }

      await saveAvailability(trainerData.id, Array.from(selected))
      setIsLoading(false)
      router.push('/confirmation')
    } catch (error) {
      console.error(error)
      setIsLoading(false)
    }
  }

  return (
    <div className="blocs-theme blocs-page" style={getThemeCssVars(themeColor)}>
      <div className="blocs-form-shell" style={{ padding: '32px 24px'}}>
        <form onSubmit={handleSubmit} className="blocs-form-grid">
          <div className="blocs-form-main flex flex-col gap-5">
            {/* Centered to the screen on mobile (card is already page-centered);
                centered within the left column on desktop. */}
            <div className="flex flex-col items-center text-center gap-2" style={{ marginBottom: '4px' }}>
              <h1 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Account settings
              </h1>
              <div
                onClick={() => photoInputRef.current?.click()}
                className="flex items-center justify-center"
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  color: 'var(--blocs-text-40)',
                  fontSize: '12px',
                  textAlign: 'center',
                  border: photoUrl ? '1px solid var(--blocs-border-soft)' : '1px dashed var(--blocs-border-soft)',
                  backgroundImage: photoUrl ? `url(${photoUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {!photoUrl && (isUploadingPhoto ? 'Uploading...' : 'Image upload')}
                {photoUrl && isUploadingPhoto && (
                  <div
                    className="flex items-center justify-center"
                    style={{ width: '100%', height: '100%', background: 'rgba(5,6,8,0.6)', color: 'var(--blocs-text)' }}
                  >
                    Uploading...
                  </div>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
              {photoError && <p className="blocs-error">{photoError}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="blocs-label">Your name</label>
              <input
                type="text"
                value={trainerName}
                onChange={e => setTrainerName(e.target.value)}
                name="name"
                placeholder="Enter your name"
                className="blocs-input"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="blocs-label">Your booking link</label>
              <SlugInput name="personalLink" trainer={trainer.slug ?? ''} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bio" className="blocs-label">Short bio</label>
              <textarea
                name="bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell customers a bit about yourself"
                rows={3}
                className="blocs-input"
                style={{ resize: 'vertical' }}
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
                <select
                  className="blocs-select"
                  style={{ border: 'none', padding: '4px' }}
                  value={startTime}
                  onChange={e => {
                    const nextStart = e.target.value
                    const nextCalendarTimes = TIMES.slice(TIMES.indexOf(nextStart))
                    setStartTime(nextStart)
                    setCalendarTIMES(nextCalendarTimes)
                    ApplySchedule({ calendarTimes: nextCalendarTimes })
                  }}
                >
                  {TIMES.map(time => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>

                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex flex-row gap-2 items-center">
                    <select
                      className="blocs-select"
                      style={{ border: 'none', padding: '4px' }}
                      value={workHours}
                      onChange={e => {
                        setWorkHours(e.target.value)
                        ApplySchedule({ workHours: e.target.value })
                      }}
                    >
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
                    <select
                      className="blocs-select"
                      style={{ border: 'none', padding: '4px' }}
                      value={workBreak}
                      onChange={e => {
                        setBreakHours(e.target.value)
                        ApplySchedule({ workBreak: e.target.value })
                      }}
                    >
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
                  <input
                    type="number"
                    value={workBlocks}
                    onChange={e => {
                      setWorkBlocks(e.target.value)
                      ApplySchedule({ workBlocks: e.target.value })
                    }}
                    className="blocs-select"
                    style={{ width: '50px', border: 'none', padding: '4px', background: 'transparent', color: 'var(--blocs-text)' }}
                  />
                  <label className="blocs-label" style={{ textTransform: 'none' }}>blocks</label>
                </div>
              </div>
            </div>

            <button type="submit" className="blocs-btn-primary" disabled={isLoading} style={{ marginTop: '6px' }}>
              {isLoading ? 'Loading...' : 'Save changes'}
            </button>

            {/* Desktop: bottom of the form (left column) */}
            <div
              className="hidden md:flex flex-col gap-2"
              style={{ borderTop: '1px solid var(--blocs-border-faint)', paddingTop: '20px' }}
            >
              <label className="blocs-label">Subscription</label>
              <CancelSubscriptionButton currentStatus={trainer.subscription_status} />
            </div>
          </div>

          <div className="blocs-form-aside flex flex-col gap-2">
            <label className="blocs-label">Fine-tune your week</label>
            <div onMouseUp={() => setIsDragging(false)} style={{ overflowX: 'auto' }}>
              <div className="grid grid-cols-8 gap-x-0.5 gap-y-0" style={{ minWidth: '480px' }}>
                <div />
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

        {/* Mobile: bottom of the page */}
        <div
          className="md:hidden flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--blocs-border-faint)', marginTop: '24px', paddingTop: '20px' }}
        >
          <label className="blocs-label">Subscription</label>
          <CancelSubscriptionButton currentStatus={trainer.subscription_status} />
        </div>
      </div>
    </div>
  )
}

export default AccountView