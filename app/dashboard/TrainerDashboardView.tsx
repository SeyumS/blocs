'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { CalendarSlot } from '@/lib/scheduling';
import { getThemeCssVars } from '@/lib/theme';
import BlockedDatesList from '../blockedDatesList/page';
import IntakeFormBuilder from './intake-form/IntakeFormBuilder';

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[]; // only for 'select'
}


interface Props {
  trainer: {
    id: string;
    name: string;
    slug: string;
    bio: string | null;
    photo_url: string | null;
    session_length_minutes: number;
    theme_color?: string | null;
    theme_surface?: string | null;
    intake_form_schema?: FormField[] | null;
  };
  slots: CalendarSlot[];
  welcome?: boolean;
}

type PendingAction = { bookingId: string; kind: 'single' | 'series' } | null;

export default function TrainerDashboardView({ trainer, slots, welcome }: Props) {
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(!!welcome);
  const [weekOffset, setWeekOffset] = useState(0);
  const [pending, setPending] = useState<PendingAction>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [screenShown, setScreenShown] = useState<'sessions'|'blocks'|'form'>('sessions');
  const [activeDateIndex, setActiveDateIndex] = useState(0);
  const [openSlot, setOpenSlot] = useState<CalendarSlot | null>(null);

  const changeWeek = (delta: number) => {
    setWeekOffset((w) => w + delta);
    setActiveDateIndex(0);
    setOpenSlot(null);
    setPending(null);
  };

  const slotsByDate = slots.reduce<Record<string, CalendarSlot[]>>((acc, slot) => {
    const dateKey = format(new Date(slot.start), 'yyyy-MM-dd');
    (acc[dateKey] ??= []).push(slot);
    return acc;
  }, {});

  const allDates = Object.keys(slotsByDate);
  const times = Array.from(
    new Set(slots.map((slot) => format(new Date(slot.start), 'HH:mm')))
  ).sort();

  const totalWeeks = Math.ceil(allDates.length / 7);
  const dates = allDates.slice(weekOffset * 7, weekOffset * 7 + 7);
  const activeDate = dates[activeDateIndex] ?? dates[0];

  const slotByDateAndTime = new Map<string, CalendarSlot>();
  for (const slot of slots) {
    const dateKey = format(new Date(slot.start), 'yyyy-MM-dd');
    const timeKey = format(new Date(slot.start), 'HH:mm');
    slotByDateAndTime.set(`${dateKey}_${timeKey}`, slot);
  }

  const cancelSingle = async (bookingId: string) => {
    setBusyBookingId(bookingId);
    setErrorMsg('');
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: 'trainer' })
      .eq('id', bookingId);

    setBusyBookingId(null);
    setPending(null);
    setOpenSlot(null);
    if (error) {
      setErrorMsg('Could not cancel that session — please try again.');
      return;
    }
    router.refresh();
  };

  const cancelSeries = async (seriesId: string, bookingId: string) => {
    setBusyBookingId(bookingId);
    setErrorMsg('');
    const nowIso = new Date().toISOString();

    // Cancel this and every future confirmed session in the series — past
    // sessions stay as-is, they already happened.
    const { error: bookingsError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: nowIso, cancelled_by: 'trainer' })
      .eq('series_id', seriesId)
      .eq('status', 'confirmed')
      .gte('starts_at', nowIso);

    const { error: seriesError } = await supabase
      .from('booking_series')
      .update({ active: false })
      .eq('id', seriesId);

    setBusyBookingId(null);
    setPending(null);
    setOpenSlot(null);
    if (bookingsError || seriesError) {
      setErrorMsg('Could not cancel the series — please try again.');
      return;
    }
    router.refresh();
  };

  return (
    <div className="mx-auto blocs-theme flex flex-col gap-4 p-6 min-h-screen w-full box-border" style={getThemeCssVars(trainer.theme_color, trainer.theme_surface)}>
      {showWelcome && (
        <div className="blocs-confirm-panel" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex flex-col gap-0.5">
            <span className="blocs-confirm-panel-title">You&apos;re all set, {trainer.name}</span>
            <span style={{ color: 'var(--blocs-text-50)', fontSize: '12.5px' }}>Your schedule from the demo is live — start taking bookings.</span>
          </div>
          <button className="blocs-slot-action-neutral" onClick={() => setShowWelcome(false)}>Dismiss</button>
        </div>
      )}
      {/* Outer: places the column in the page (center on mobile, left on desktop). */}
      <div className="w-full flex justify-center md:justify-start">
        <div className="w-full max-w-xs md:max-w-md flex flex-col items-center md:items-start gap-2">
          {/* Photo + greeting: stacked on mobile; on desktop greeting sits
              bottom-right of the picture (items-end). */}
          <div className="flex flex-col items-center gap-2 md:flex-row md:items-end md:gap-3">
            {trainer.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trainer.photo_url}
                alt={trainer.name}
                style={{ width: '100px', height: '100px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
              />
            )}
            <h1
              className="text-center md:text-left"
              style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '19px', fontWeight: 700 }}
            >
              Welcome back, {trainer.name}
            </h1>
          </div>

          <div className="flex gap-2">
            <button className="blocs-day-chip" onClick={() => router.push('/account')} style={{ padding: '8px 16px' }}>
              Edit Profile
            </button>
            <button className="blocs-day-chip" onClick={() => router.push('/dashboard/intake-form')} style={{ padding: '8px 16px' }}>
              Intake Form
            </button>
          </div>

          {errorMsg && <p className="blocs-error">{errorMsg}</p>}
          <div className="flex gap-2 justify-center md:justify-start">
            <button
              className={screenShown === 'sessions' ? 'blocs-day-chip active' : 'blocs-day-chip'}
              style={{ flex: '0 0 auto', padding: '8px 16px' }}
              onClick={() => setScreenShown('sessions')}
            >
              All Sessions
            </button>
            <button
              className={screenShown === 'blocks' ? 'blocs-day-chip active' : 'blocs-day-chip'}
              style={{ flex: '0 0 auto', padding: '8px 16px' }}
              onClick={() => setScreenShown('blocks')}
            >
              Blocked Sessions
            </button>
          </div>
        </div>
      </div>

      {screenShown === 'sessions' ? (
        <>
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
                    <td className="blocs-grid-time">{time}</td>
                    {dates.map((date) => {
                      const slot = slotByDateAndTime.get(`${date}_${time}`);
                      if (!slot) return <td key={date} className="blocs-grid-cell" />;

                      const booking = slot.booking;
                      const blocked = slot.blocked

                      let slotClass = slot.available
                        ? 'blocs-slot blocs-slot--open'
                        : 'blocs-slot blocs-slot--free';
                      if (slot.isBreak) slotClass = 'blocs-slot blocs-slot--break';
                      else if (blocked) slotClass = 'blocs-slot blocs-slot--blocked';
                      else if (booking) slotClass = 'blocs-slot blocs-slot--filled';

                      return (
                        <td key={date} className="blocs-grid-cell">
                          {slot.isBreak ? (
                            <div className={slotClass} style={{ justifyContent: 'center' }}>Break</div>
                          ) : blocked ? (
                            <div className={slotClass} style={{ justifyContent: 'center' }}>Blocked</div>
                          ) : booking ? (
                            <div
                              className={slotClass}
                              style={{ justifyContent: 'center', cursor: 'pointer' }}
                              onClick={() => {
                                setOpenSlot(slot);
                                setPending(null);
                              }}
                            >
                              {booking.clientName}
                            </div>
                          ) : (
                            <div className={slotClass} style={{ justifyContent: 'center', opacity: slot.available ? 1 : 0.4,}}>
                              {slot.available ? 'Free' : '—'}
                            </div>
                          )}
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
                  onClick={() => {
                    setActiveDateIndex(i);
                    setOpenSlot(null);
                    setPending(null);
                  }}
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

                const booking = slot.booking;
                const blocked = slot.blocked;

                let slotClass = slot.available
                  ? 'blocs-slot blocs-slot--open'
                  : 'blocs-slot blocs-slot--free';
                let label = slot.available ? 'Free' : 'Unavailable';
                if (slot.isBreak) {
                  slotClass = 'blocs-slot blocs-slot--break';
                  label = 'Break';
                } else if (blocked) {
                  slotClass = 'blocs-slot blocs-slot--blocked';
                  label = 'Blocked';
                } else if (booking) {
                  slotClass = 'blocs-slot blocs-slot--filled';
                  label = booking.clientName;
                }

                return (
                  <div
                    key={time}
                    className="blocs-slot-row"
                    onClick={() => {
                      if (!booking) return;
                      setOpenSlot(slot);
                      setPending(null);
                    }}
                    style={{ cursor: booking ? 'pointer' : 'default' }}
                  >
                    <span className="blocs-slot-time">{time}</span>
                    <div className={slotClass}>
                      <span>{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : screenShown === 'blocks' ? (
       <BlockedDatesList theme_color={trainer.theme_color} theme_surface={trainer.theme_surface} />
      ) : screenShown === 'form' ? (
        <IntakeFormBuilder 
        initialFields={trainer.intake_form_schema ?? []}
        themeColor={trainer.theme_color} themeSurface={trainer.theme_surface} />
      ) : (
        <div>No screen shown</div>
      )}

      {openSlot?.booking && (
        <div
          className="blocs-modal-overlay"
          onClick={() => {
            setOpenSlot(null);
            setPending(null);
          }}
        >
          <div
            className="blocs-confirm-panel blocs-modal-panel w-full flex flex-col gap-3"
            style={{ maxWidth: '420px', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setOpenSlot(null);
                setPending(null);
              }}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'transparent',
                border: 'none',
                color: 'var(--blocs-text-50)',
                fontSize: '22px',
                lineHeight: 1,
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              ×
            </button>

            <span className="blocs-confirm-panel-title">Session details</span>

            <div className="blocs-summary-card">
              <div className="blocs-summary-row">
                <span className="blocs-summary-key">Client</span>
                <span className="blocs-summary-value">{openSlot.booking.clientName}</span>
              </div>
              <div className="blocs-summary-row">
                <span className="blocs-summary-key">Date</span>
                <span className="blocs-summary-value">{format(new Date(openSlot.start), 'EEE, MMM d')}</span>
              </div>
              <div className="blocs-summary-row">
                <span className="blocs-summary-key">Time</span>
                <span className="blocs-summary-value">
                  {format(new Date(openSlot.start), 'HH:mm')}–{format(new Date(openSlot.end), 'HH:mm')}
                </span>
              </div>
            </div>

            {!!trainer.intake_form_schema?.length && (
              <div className="flex flex-col gap-2">
                <span className="blocs-label">Client details</span>
                {openSlot.booking.intakeFormResponses ? (
                  <div className="blocs-summary-card">
                    {trainer.intake_form_schema.map((field) => {
                      const value = openSlot.booking!.intakeFormResponses?.[field.id];
                      const display =
                        field.type === 'checkbox'
                          ? value === true ? 'Yes' : 'No'
                          : (value ? String(value) : '—');
                      return (
                        <div key={field.id} className="blocs-summary-row">
                          <span className="blocs-summary-key">{field.label}</span>
                          <span className="blocs-summary-value">{display}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: 'var(--blocs-text-40)', fontSize: '13px' }}>
                    No intake form responses on file.
                  </p>
                )}
              </div>
            )}

            {pending?.bookingId === openSlot.booking.id ? (
              <>
                <span style={{ color: 'var(--blocs-text-60)', fontSize: '13px' }}>
                  Cancel {pending.kind === 'series' ? 'the whole series' : 'this session'}?
                </span>
                <div className="flex gap-2 flex-wrap">
                  <button
                    className="blocs-slot-action-danger"
                    disabled={busyBookingId === openSlot.booking.id}
                    onClick={() =>
                      pending.kind === 'series' && openSlot.booking!.seriesId
                        ? cancelSeries(openSlot.booking!.seriesId, openSlot.booking!.id)
                        : cancelSingle(openSlot.booking!.id)
                    }
                  >
                    {busyBookingId === openSlot.booking.id ? '...' : 'Yes, cancel'}
                  </button>
                  <button
                    className="blocs-slot-action-neutral"
                    disabled={busyBookingId === openSlot.booking.id}
                    onClick={() => setPending(null)}
                  >
                    No, keep it
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <button
                  className="blocs-slot-action-danger"
                  onClick={() => setPending({ bookingId: openSlot.booking!.id, kind: 'single' })}
                >
                  Cancel session
                </button>
                {openSlot.booking.seriesId && (
                  <button
                    className="blocs-slot-action-danger"
                    onClick={() => setPending({ bookingId: openSlot.booking!.id, kind: 'series' })}
                  >
                    Cancel series
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
