'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type { CalendarSlot } from '@/lib/scheduling';
import { getThemeCssVars } from '@/lib/theme';


interface Props {
  trainer: {
    id: string;
    name: string;
    slug: string;
    bio: string | null;
    photo_url: string | null;
    session_length_minutes: number;
    theme_color?: string | null;
  };
  slots: CalendarSlot[]; // pre-computed server-side, grouped-ready
}

type UiStatus =
  | 'idle'
  | 'submitting'
  | 'needs_name'
  | 'booked'
  | 'waitlisted'
  | 'error'
  | 'slot_taken';

export default function CustomerView({ trainer, slots }: Props) {
  const router = useRouter();
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [selectedWaitlistSlot, setSelectedWaitlistSlot] = useState<CalendarSlot | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone] = useState('');
  const [status, setStatus] = useState<UiStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [tappedWaitlistSlot, setTappedWaitlistSlot] = useState<boolean>(false);
  const [notInDataBase, setNotInDataBase] = useState<boolean>(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [activeDateIndex, setActiveDateIndex] = useState(0);
  const [waitlistToastHiding, setWaitlistToastHiding] = useState(false);
  const [waitlistInfo, setWaitlistInfo] = useState<boolean>(false);
  const [nameInfo, setNameInfo] = useState<boolean>(false);
  const showWaitlistToast = status === 'waitlisted' && !waitlistToastHiding;

  // On a successful waitlist entry, flash a confirmation toast for a couple
  // seconds and then return to the normal schedule view.
  useEffect(() => {
    if (status !== 'waitlisted') return;
    const hideTimer = setTimeout(() => setWaitlistToastHiding(true), 2500);
    const resetTimer = setTimeout(() => {
      setStatus('idle');
      setNotInDataBase(false);
      setWaitlistToastHiding(false);
    }, 2900);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(resetTimer);
    };
  }, [status]);

  // On a successful booking, show the confirmation just long enough to read
  // it, then return to the schedule. Refresh so the slot that was just
  // booked shows as taken instead of the stale server-rendered snapshot.
  useEffect(() => {
    if (status !== 'booked') return;
    const resetTimer = setTimeout(() => {
      setStatus('idle');
      setSelectedSlot(null);
      setName('');
      setEmail('');
      setClientId(null);
      router.refresh();
    }, 5000);
    return () => clearTimeout(resetTimer);
  }, [status, router]);

  // Group slots by date for display
  const slotsByDate = slots.reduce<Record<string, CalendarSlot[]>>((acc, slot) => {
    const dateKey = format(new Date(slot.start), 'yyyy-MM-dd');
    (acc[dateKey] ??= []).push(slot);
    return acc;
  }, {});

  // Grid axes: dates as columns (in chronological order, same as slots),
  // times-of-day as rows (deduped across all days, sorted). Breaks are an
  // internal scheduling detail — customers only need to see bookable vs.
  // not-bookable sessions, so break slots never become their own row.
  const allDates = Object.keys(slotsByDate);
  const times = Array.from(
    new Set(slots.filter((slot) => !slot.isBreak).map((slot) => format(new Date(slot.start), 'HH:mm')))
  ).sort();

  // Row label shows the full start–end span of the session (not just the
  // start time) so the customer can see exactly how long it runs.
  const timeRangeLabel = (time: string) => {
    const match = slots.find((slot) => !slot.isBreak && format(new Date(slot.start), 'HH:mm') === time);
    return match ? `${time}–${format(new Date(match.end), 'HH:mm')}` : time;
  };

  const totalWeeks = Math.ceil(allDates.length / 7);
  const dates = allDates.slice(weekOffset * 7, weekOffset * 7 + 7);
  const activeDate = dates[activeDateIndex] ?? dates[0];

  const changeWeek = (delta: number) => {
    setWeekOffset((w) => w + delta);
    setActiveDateIndex(0);
  };

  const slotByDateAndTime = new Map<string, CalendarSlot>();
  for (const slot of slots) {
    const dateKey = format(new Date(slot.start), 'yyyy-MM-dd');
    const timeKey = format(new Date(slot.start), 'HH:mm');
    slotByDateAndTime.set(`${dateKey}_${timeKey}`, slot);
  }

  const handleSubmit = async () => {
    if (!selectedSlot || !email.trim()) return;

    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainerId: trainer.id,
          startsAt: selectedSlot.start,
          endsAt: selectedSlot.end,
          isRecurring,
          client: { name: name.trim() || undefined, email: email.trim(), phone },
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setStatus('slot_taken');
        return;
      }
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong');
        setStatus('error');
        return;
      }

      setClientId(data.clientId ?? data.booking?.client_id ?? null);

      if (data.isNew) {
        setName('');
        setNameInfo(false);
        setStatus('needs_name');
      } else {
        setStatus('booked');
      }
    } catch {
      setErrorMsg('Network error — please try again');
      setStatus('error');
    }
  };

  const saveBookingName = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!clientId || !name.trim()) return;

    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/save-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), clientId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? 'Something went wrong');
        setStatus('needs_name');
        return;
      }
      setStatus('booked');
    } catch {
      setErrorMsg('Network error — please try again');
      setStatus('needs_name');
    }
  };

  if (status === 'needs_name') {
    return (
      <div className="blocs-theme blocs-page" style={{ justifyContent: 'center', ...getThemeCssVars(trainer.theme_color) }}>
        <div className="blocs-confirm-panel blocs-modal-panel w-full" style={{ maxWidth: '480px' }}>
          <span className="blocs-confirm-panel-title">What should I call you?</span>
          <form onSubmit={saveBookingName} className="flex flex-col gap-2">
            <input
              className="blocs-input"
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameInfo(e.target.value.trim().length > 0);
              }}
              autoFocus
            />
            {errorMsg && <p className="blocs-error">{errorMsg}</p>}
            <button type="submit" className="blocs-btn-primary" disabled={!nameInfo}>
              Save
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (status === 'booked') {
    return (
      <div className="blocs-theme blocs-page" style={{ justifyContent: 'center', ...getThemeCssVars(trainer.theme_color) }}>
        <div className="blocs-card" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 32px', gap: '24px' }}>
          <div className="blocs-check-circle">
            <div className="blocs-check-mark" />
          </div>
          <div className="flex flex-col gap-1.5" style={{ alignItems: 'center', textAlign: 'center' }}>
            <h1 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '22px', fontWeight: 700 }}>You&apos;re booked</h1>
            <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>A confirmation has been sent to your email.</p>
          </div>
          <div className="blocs-summary-card">
            <div className="blocs-summary-row">
              <span className="blocs-summary-key">Coach</span>
              <span className="blocs-summary-value">{trainer.name}</span>
            </div>
            <div className="blocs-summary-row">
              <span className="blocs-summary-key">Date</span>
              <span className="blocs-summary-value">{format(new Date(selectedSlot!.start), 'EEE, MMM d')}</span>
            </div>
            <div className="blocs-summary-row">
              <span className="blocs-summary-key">Time</span>
              <span className="blocs-summary-value">
                {format(new Date(selectedSlot!.start), 'HH:mm')} · {trainer.session_length_minutes}-min
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getIntoWaitingList = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('submitting');
    setWaitlistInfo(false);
    try {
      const res = await fetch('/api/get-into-waiting-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, phone: phone, trainerId: trainer.id, start: selectedWaitlistSlot?.start }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong');
        setStatus('error');
        return;
      }
      setClientId(data.client.id);
      setTappedWaitlistSlot(false);
      // API `inDataBase` means "was newly created / needs a name".
      setNotInDataBase(!!data.inDataBase);
      if (data.inDataBase) {
        setName('');
        setNameInfo(false);
        setStatus('idle');
      } else {
        setStatus('waitlisted');
      }
    } catch {
      setErrorMsg('Network error — please try again');
      setStatus('error');
    }
  };

  const saveName = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!clientId || !name.trim()) return;
    setStatus('submitting');
    try {
      const res = await fetch('/api/save-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), clientId }),
      });
      if (!res.ok) {
        setErrorMsg('Something went wrong');
        setStatus('error');
        return;
      }
      setNotInDataBase(false);
      setStatus('waitlisted');
    } catch {
      setErrorMsg('Network error — please try again');
      setStatus('error');
    }
  };

  const slotLabel = (slot: CalendarSlot) =>
    slot.blocked ? 'Blocked' : slot.booking ? 'Booked' : slot.available ? 'Open' : 'Unavailable';

  return (
    <div className="blocs-theme blocs-page" style={getThemeCssVars(trainer.theme_color)}>
      <div className="flex items-center flex-col justify-center gap-1 w-full max-w-[640px] md:max-w-4xl md:items-start" style={{ marginBottom: '20px' }}>
        <div className="flex flex-col md:flex-row items-center md:items-end md:gap-3 align-bottom gap-3.5">
          {trainer.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={trainer.photo_url}
              alt={trainer.name}
              style={{ width: '100px', height: '100px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
            />
          )}
          <div>
            <h1 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '18px', fontWeight: 700,}}>{trainer.name}</h1>
            {trainer.bio && <p style={{ margin: '2px 0 0', color: 'var(--blocs-text-45)', fontSize: '12.5px' }}>{trainer.bio}</p>}
          </div>
        </div>
        <p style={{ margin: '6px 0 0', color: 'var(--blocs-text-60)', fontSize: '13px' }}>
          Book a {trainer.session_length_minutes}-min session below.
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-[640px] md:max-w-4xl">
          {slots.every((slot) => !slot.available) && (
            <p style={{ color: 'var(--blocs-text-45)', fontSize: '13px' }}>No open slots right now — check back soon.</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <button className="blocs-slot-action-neutral" onClick={() => changeWeek(-1)} disabled={weekOffset === 0}>
              ← Previous week
            </button>
            <span style={{ color: 'var(--blocs-text-60)', fontSize: '13px' }}>
              {dates[0] && format(new Date(dates[0]), 'MMM d')} – {dates[dates.length - 1] && format(new Date(dates[dates.length - 1]), 'MMM d')}
            </span>
            <button className="blocs-slot-action-neutral" onClick={() => changeWeek(1)} disabled={weekOffset >= totalWeeks - 1}>
              Next week →
            </button>
          </div>

          {/* Desktop: full weekly grid */}
          <div className="hidden md:block blocs-grid-wrap">
            <table className="blocs-grid-table">
              <thead>
                <tr>
                  <th></th>
                  {dates.map((date) => (
                    <th key={date} className="blocs-grid-head">
                      {format(new Date(date), 'EEE')}<br />{format(new Date(date), 'MMM d')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {times.map((time) => (
                  <tr key={time}>
                    <td className="blocs-grid-time">{timeRangeLabel(time)}</td>
                    {dates.map((date) => {
                      const slot = slotByDateAndTime.get(`${date}_${time}`);
                      if (!slot) return <td key={date} className="blocs-grid-cell" />;

                      const isSelected = selectedSlot === slot;
                      let slotClass = 'blocs-slot blocs-slot--free';
                      if (slot.blocked) slotClass = 'blocs-slot blocs-slot--blocked';
                      else if (slot.booking) slotClass = 'blocs-slot blocs-slot--booked-out';
                      else if (slot.available) slotClass = isSelected ? 'blocs-slot blocs-slot--filled' : 'blocs-day-chip active';

                      return (
                        <td key={date} className="blocs-grid-cell">
                          <div
                            className={slotClass}
                            style={{ justifyContent: 'center', cursor: slot.available ? 'pointer' : 'default' }}
                            onClick={() => {
                              if (slot.isBreak) return;
                              if (slot.available) { setSelectedSlot(slot) } else { setSelectedWaitlistSlot(slot); setTappedWaitlistSlot(true) }
                            }}
                          >
                            {isSelected ? 'Selected' : slotLabel(slot)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: daily view */}
          <div className="md:hidden flex flex-col gap-3">
            <div className="blocs-day-tabs">
              {dates.map((date, i) => (
                <div
                  key={date}
                  className={i === activeDateIndex ? 'blocs-day-tab active' : 'blocs-day-tab'}
                  onClick={() => setActiveDateIndex(i)}
                >
                  <span className="blocs-day-tab-dow">{format(new Date(date), 'EEE').toUpperCase()}</span>
                  <span className="blocs-day-tab-date">{format(new Date(date), 'd')}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {activeDate && times.map((time) => {
                const slot = slotByDateAndTime.get(`${activeDate}_${time}`);
                if (!slot) return null;

                const isSelected = selectedSlot === slot;
                let slotClass = 'blocs-slot blocs-slot--free';
                if (slot.blocked) slotClass = 'blocs-slot blocs-slot--blocked';
                else if (slot.booking) slotClass = 'blocs-slot blocs-slot--booked-out';
                else if (slot.available) slotClass = isSelected ? 'blocs-slot blocs-slot--filled' : 'blocs-day-chip active';

                return (
                  <div
                    key={time}
                    className="blocs-slot-row"
                    onClick={() => {
                      if (slot.isBreak) return;
                      if (slot.available) { setSelectedSlot(slot) } 
                      else if (slot.blocked) { setSelectedWaitlistSlot(slot); }
                      else { setSelectedWaitlistSlot(slot); setTappedWaitlistSlot(true) }
                    }}
                  >
                    <span className="blocs-slot-time">{timeRangeLabel(time)}</span>
                    <div className={slotClass}>
                      <span>{isSelected ? 'Selected' : slotLabel(slot)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
      </div>

      {selectedSlot && (
        <div className="blocs-modal-overlay" onClick={() => setSelectedSlot(null)}>
          <div
            className="blocs-confirm-panel blocs-modal-panel w-full"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="blocs-slot-action-neutral" style={{ alignSelf: 'flex-start' }} onClick={() => setSelectedSlot(null)}>
              Back
            </button>
            <span className="blocs-confirm-panel-title">
              Confirm {format(new Date(selectedSlot.start), 'EEE, MMM d')} · {format(new Date(selectedSlot.start), 'HH:mm')} · {trainer.session_length_minutes}-min
            </span>

            <label className="flex items-center gap-2" style={{ color: 'var(--blocs-text-60)', fontSize: '13px', accentColor: 'var(--blocs-accent)' }}>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              Make this a weekly recurring slot
            </label>

            {/*<input
              className="blocs-input"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />*/}
            <input
              className="blocs-input"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {/*<input
              className="blocs-input"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />*/}

            {status === 'slot_taken' && (
              <p className="blocs-error">Sorry, someone just booked this slot. Please pick another time.</p>
            )}
            {status === 'error' && <p className="blocs-error">{errorMsg}</p>}

            <button
              className="blocs-btn-primary"
              onClick={handleSubmit}
              disabled={status === 'submitting' || !email.trim()}
            >
              {status === 'submitting' ? 'Booking...' : 'Confirm booking'}
            </button>
          </div>
        </div>
      )}

      {tappedWaitlistSlot && (
        <div className="blocs-modal-overlay" onClick={() => setTappedWaitlistSlot(false)}>
          <div
            className="blocs-confirm-panel blocs-modal-panel w-full"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="blocs-slot-action-neutral" style={{ alignSelf: 'flex-start' }} onClick={() => setTappedWaitlistSlot(false)}>
              Back
            </button>
            <span className="blocs-confirm-panel-title">I want to be notified when this slot is available</span>
            <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '12.5px' }}>I want to be notified via</p>
            <form onSubmit={getIntoWaitingList} className="flex flex-col gap-2">
              <input className="blocs-input" type="email" placeholder="Email" value={email} onChange={(e) =>{ setEmail(e.target.value); if(e.target.value.length > 0) { setWaitlistInfo(true) } else { setWaitlistInfo(false) }}} />
              {/*<input className="blocs-input" type="tel" placeholder="Phone" value={phone} onChange={(e) =>{ setPhone(e.target.value); if(e.target.value.length > 0) { setWaitlistInfo(true) } else { setWaitlistInfo(false) }}} />*/}
              <button type="submit" className="blocs-btn-primary" disabled={status === 'submitting' || !waitlistInfo}>get into waiting list</button>
            </form>
          </div>
        </div>
      )}

      <div className={showWaitlistToast ? 'blocs-toast visible' : 'blocs-toast'}>
        <span className="blocs-toast-check" />
        You&apos;re on the waitlist
      </div>

      {notInDataBase && (
        <div className="blocs-modal-overlay">
          <div className="blocs-confirm-panel blocs-modal-panel w-full" style={{ maxWidth: '480px' }}>
            <span className="blocs-confirm-panel-title">What should I call you?</span>
            <form onSubmit={saveName} className="flex flex-col gap-2">
              <input
                className="blocs-input"
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameInfo(e.target.value.trim().length > 0);
                }}
              />
              {status === 'error' && <p className="blocs-error">{errorMsg}</p>}
              <button type="submit" className="blocs-btn-primary" disabled={status === 'submitting' || !nameInfo}>
                Save
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
