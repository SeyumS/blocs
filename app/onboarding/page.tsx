'use client'
import React from 'react'
import { generateTimeSlots } from '@/lib/utils'
import { useState } from 'react'
import { clearLine } from 'readline'
import { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { eachMinuteOfInterval, eachMonthOfInterval } from 'date-fns'
import { useRouter } from 'next/navigation'
import { DEFAULT_THEME_COLOR, getThemeCssVars, type ThemeColorKey } from '@/lib/theme'
import { ThemeSwatchPicker } from '@/app/components/ThemeSwatchPicker'


function SlugInput({ name }: { name: string }) {
  const [value, setValue] = useState('')

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

const CustomSchedule = () => {

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

 const [themeColor, setThemeColor] = useState<ThemeColorKey>(DEFAULT_THEME_COLOR)
 const [workHours, setWorkHours] = useState("01:30")
 const [workBreak, setBreakHours] = useState("00:30")
 const [workBlocks, setWorkBlocks] = useState('0')
 const [workingDays, setWorkingDays] = useState(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
 const [cellIds, setCellIds] = useState<string[]>([])

 const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 const TIMES = generateTimeSlots('2026-06-06T06:00:00.000Z', '2026-06-06T22:00:00.000Z', 30); // 30-min increments
 const [calendarTIMES, setCalendarTIMES] = useState(TIMES)
 const [startTime, setStartTime] = useState('08:00')
 
   const [isDragging, setIsDragging] = useState(false);
   const [dragMode, setDragMode] = useState(true); // true = selecting, false = deselecting
 
  
   const handleMouseDown = (cellId: string) => {
     const mode = !selected.has(cellId);
     setDragMode(mode);
     setIsDragging(true);
     toggleCell(cellId, mode);
   };
 
   const handleMouseEnter = (cellId: string) => {
     if (isDragging) toggleCell(cellId, dragMode);
   };
 

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

  let cellsPerWorkHour = 3;
  let cellsPerWorkBreak = 1;
  const nextCellIds: string[] = [];

  DAYS.forEach(day => {
    if(days.includes(day)) {
      switch(hours) {
        case "00:30":
          cellsPerWorkHour = 1;
          break
        case "01:00":
          cellsPerWorkHour = 2;
          break
        case "01:30":
          cellsPerWorkHour = 3;
          break
        case "02:00":
          cellsPerWorkHour = 4;
          break
        case "02:30":
          cellsPerWorkHour = 5;
          break
        case "03:00":
          cellsPerWorkHour = 6;
          break
        default:
          cellsPerWorkHour = 3;
          break
      }
      switch(brk) {
        case "00:30":
          cellsPerWorkBreak = 1;
          break
        case "01:00":
          cellsPerWorkBreak = 2;
          break
        case "01:30":
          cellsPerWorkBreak = 3;
          break
        case "02:00":
          cellsPerWorkBreak = 4;
          break
        case "02:30":
          cellsPerWorkBreak = 5;
          break
        case "03:00":
          cellsPerWorkBreak = 6;
          break
        default:
          cellsPerWorkBreak = 1;
          break
      }
      let startIndex = 0
      for(let i = 0; i < Number(blocks); i++) {
        for(let j = 0; j < cellsPerWorkHour; j++) {
          nextCellIds.push(`${day}-${times[startIndex]}`)
          startIndex++
        }
        for(let k = 0; k < cellsPerWorkBreak; k++) {
            startIndex++
      }
      }
    }
  })
  setCellIds(nextCellIds)
  setSelected(new Set(nextCellIds))
}

const DAY_TO_INT: { [key: string]: number } = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Takes the Set of selected cellIds (e.g. "Mon-06:00")
 * and returns merged availability_rules rows ready for Supabase.
 */
function extractAvailabilityRules(selectedCells: string[], slotDurationMinutes = 30) {
  // Group selected times by day
  const byDay: { [key: string]: number[] } = {};
  for (const cellId of selectedCells) {
    const [day, time] = cellId.split('-');
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(timeToMinutes(time));
  }

  const rules = [];

  for (const [day, minutesList] of Object.entries(byDay)) {
    const sorted = [...minutesList].sort((a, b) => a - b);

    let rangeStart = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i <= sorted.length; i++) {
      const current = sorted[i];
      const isContiguous = current === prev + slotDurationMinutes;

      if (!isContiguous) {
        // close out the current range
        rules.push({
          day_of_week: DAY_TO_INT[day],
          start_time: minutesToTime(rangeStart),
          end_time: minutesToTime(prev + slotDurationMinutes), // end = last slot's end
        });
        rangeStart = current;
      }
      prev = current;
    }
  }

  return rules;
}

async function saveAvailability(trainerId: string, selectedCells: string[]) {
  const rules = extractAvailabilityRules(selectedCells);

  // Clear existing rules first (simplest approach — full replace on each save)
  const { error: deleteError } = await supabase
    .from('availability_rules')
    .delete()
    .eq('trainer_id', trainerId);

  if (deleteError) throw deleteError;

  const rowsToInsert = rules.map(rule => ({
    trainer_id: trainerId,
    day_of_week: rule.day_of_week,
    start_time: rule.start_time,
    end_time: rule.end_time,
  }));

  const { error: insertError } = await supabase
    .from('availability_rules')
    .insert(rowsToInsert);

  if (insertError) throw insertError;
}

const router = useRouter()
const [isLoading, setIsLoading] = useState(false)

const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  setIsLoading(true)
  const formData = new FormData(e.target as HTMLFormElement)
  const name = formData.get('name')
  const personalLink = formData.get('personalLink')
  const bio = formData.get('bio')
  console.log('1. ', name, personalLink)
  try {
  const { data, error } = await supabase.auth.getUser();
  const authUserId = data.user?.id;
  const email = data.user?.email;
  if (error) {
    console.error(error)
  }
  console.log('2. ', authUserId, email)
  // Starts the 30-day trial the billing middleware checks against
  // (app/src/middleware.ts) — subscription_status defaults to 'trial' in
  // the DB already, so it doesn't need to be set here.
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: trainerData, error: trainerError } = await supabase.from('trainers').insert({
    name: name,
    slug: personalLink,
    auth_user_id: authUserId,
    email: email,
    bio: bio,
    theme_color: themeColor,
    trial_ends_at: trialEndsAt
  }).select().single();
  console.log('3. ', trainerData)
  
  if (trainerError || !trainerData) {
    console.error(trainerError)
    setIsLoading(false)
    return
  }
  await saveAvailability(trainerData.id, cellIds)
  setIsLoading(false)
  router.push('/confirmation')
  } catch (error) {
    console.error(error)
    setIsLoading(false)
  }
}


return (
  <div className="blocs-theme blocs-page" style={getThemeCssVars(themeColor)}>
    <div className="blocs-brand">
      <div className="blocs-brand-row">
        <div className="blocs-brand-mark">
          <span /><span className="active" /><span /><span />
        </div>
        <span className="blocs-brand-name">Blocs</span>
      </div>
      <p className="blocs-brand-tagline">Book by the block.</p>
    </div>

    <div className="blocs-card blocs-form-shell" style={{ padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 4px', color: 'var(--blocs-text)', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>Set up your schedule</h1>
      <p style={{ margin: '0 0 20px', color: 'var(--blocs-text-50)', fontSize: '13px' }}>Two minutes, then you&apos;re bookable.</p>

      <form onSubmit={handleSubmit} className="blocs-form-grid">
        <div className="blocs-form-main flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="blocs-label">Your name</label>
            <input type="text" name="name" placeholder="Enter your name" className="blocs-input" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="blocs-label">Your booking link</label>
            <SlugInput name="personalLink" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bio" className="blocs-label">Short bio</label>
            <textarea
              name="bio"
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
              <select className="blocs-select" style={{ border: 'none', padding: '4px' }} value={startTime} onChange={e => {
                const nextTimes = TIMES.slice(TIMES.indexOf(e.target.value));
                setStartTime(e.target.value);
                setCalendarTIMES(nextTimes);
                ApplySchedule({ calendarTimes: nextTimes });
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

          <button type="submit" className="blocs-btn-primary" disabled={isLoading} style={{ marginTop: '6px' }}>
            {isLoading ? 'Loading...' : 'Generate my link'}
          </button>
        </div>

        <div className="blocs-form-aside flex flex-col gap-2">
          <label className="blocs-label">Fine-tune your week</label>
          <div onMouseUp={() => setIsDragging(false)} style={{ overflowX: 'auto' }}>
            <div className="grid grid-cols-8 gap-x-0.5 gap-y-0" style={{ minWidth: '480px' }}>
              <div /> {/* empty corner */}
              {DAYS.map(day => <div key={day} style={{ color: 'var(--blocs-text-45)', fontSize: '11px', fontWeight: 600, textAlign: 'center' }}>{day}</div>)}
              {calendarTIMES.map((time, i) => {
                const prevTime = calendarTIMES[i - 1];
                const nextTime = calendarTIMES[i + 1];
                // Cells that continue into the next 30-min slot on every day
                // merge into one uninterrupted block instead of showing as
                // separate stacked squares.
                const rowGapNeeded = !nextTime || DAYS.some(day => {
                  const curSelected = selected.has(`${day}-${time}`);
                  const nextSelected = selected.has(`${day}-${nextTime}`);
                  return !(curSelected && nextSelected);
                });
                const rowMarginBottom = rowGapNeeded ? '2px' : '0px';

                return (
                  <React.Fragment key={time}>
                    <div style={{ color: 'var(--blocs-text-40)', fontSize: '11px', fontWeight: 600, padding: '3px 4px 0 0', marginBottom: rowMarginBottom }}>{time}</div>
                    {DAYS.map(day => {
                      const cellId = `${day}-${time}`;
                      const isSelected = selected.has(cellId);
                      const topConnected = isSelected && !!prevTime && selected.has(`${day}-${prevTime}`);
                      const bottomConnected = isSelected && !!nextTime && selected.has(`${day}-${nextTime}`);
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
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
 )
}

const Onboarding = () => {

  return (
          <CustomSchedule />
  )
}

export default Onboarding
