'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { CalendarSlot } from '@/lib/scheduling';
import { getThemeCssVars } from '@/lib/theme';
import BlockedDatesList from '../blockedDatesList/page';

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
  slots: CalendarSlot[];
}

type PendingAction = { bookingId: string; kind: 'single' | 'series' } | null;

export default function TrainerDashboardView({ trainer, slots }: Props) {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [pending, setPending] = useState<PendingAction>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAllSessions, setShowAllSessions] = useState(true);
  const [activeDateIndex, setActiveDateIndex] = useState(0);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  const changeWeek = (delta: number) => {
    setWeekOffset((w) => w + delta);
    setActiveDateIndex(0);
    setExpandedBookingId(null);
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
    setExpandedBookingId(null);
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
    setExpandedBookingId(null);
    if (bookingsError || seriesError) {
      setErrorMsg('Could not cancel the series — please try again.');
      return;
    }
    router.refresh();
  };

  return (
    <div className="mx-auto blocs-theme flex flex-col gap-4 p-6 min-h-screen w-full box-border" style={getThemeCssVars(trainer.theme_color)}>
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

          <button className="blocs-day-chip" onClick={() => router.push('/account')} style={{ padding: '8px 16px' }}>
            Edit Profile
          </button>

          {errorMsg && <p className="blocs-error">{errorMsg}</p>}
          <div className="flex gap-2 justify-center md:justify-start">
            <button
              className={showAllSessions ? 'blocs-day-chip active' : 'blocs-day-chip'}
              style={{ flex: '0 0 auto', padding: '8px 16px' }}
              onClick={() => setShowAllSessions(true)}
            >
              All Sessions
            </button>
            <button
              className={!showAllSessions ? 'blocs-day-chip active' : 'blocs-day-chip'}
              style={{ flex: '0 0 auto', padding: '8px 16px' }}
              onClick={() => setShowAllSessions(false)}
            >
              Blocked Sessions
            </button>
          </div>
        </div>
      </div>

      {showAllSessions ? (
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
                      const isExpanded = !!booking && expandedBookingId === booking.id;
                      const isPending = pending?.bookingId === booking?.id;
                      const isBusy = busyBookingId === booking?.id;

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
                            <div className="flex flex-col gap-1.5 items-center">
                              <div
                                className={slotClass}
                                style={{ justifyContent: 'center', cursor: 'pointer' }}
                                onClick={() => {
                                  setExpandedBookingId(isExpanded ? null : booking.id);
                                  setPending(null);
                                }}
                              >
                                {booking.clientName}
                              </div>
                              {isExpanded && (
                                isPending ? (
                                  <>
                                    <span style={{ color: 'var(--blocs-text-60)', fontSize: '11.5px' }}>
                                      Cancel {pending!.kind === 'series' ? 'series' : 'session'}?
                                    </span>
                                    <div className="flex gap-1.5 justify-center flex-wrap">
                                      <button
                                        className="blocs-slot-action-danger"
                                        disabled={isBusy}
                                        onClick={() =>
                                          pending!.kind === 'series' && booking.seriesId
                                            ? cancelSeries(booking.seriesId, booking.id)
                                            : cancelSingle(booking.id)
                                        }
                                      >
                                        {isBusy ? '...' : 'Yes'}
                                      </button>
                                      <button className="blocs-slot-action-neutral" disabled={isBusy} onClick={() => setPending(null)}>
                                        No
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex gap-1.5 justify-center flex-wrap">
                                    <button className="blocs-slot-action-danger" onClick={() => setPending({ bookingId: booking.id, kind: 'single' })}>
                                      Cancel
                                    </button>
                                    {booking.seriesId && (
                                      <button className="blocs-slot-action-danger" onClick={() => setPending({ bookingId: booking.id, kind: 'series' })}>
                                        Cancel series
                                      </button>
                                    )}
                                  </div>
                                )
                              )}
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
                    setExpandedBookingId(null);
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
                const isExpanded = !!booking && expandedBookingId === booking.id;
                const isPending = !!booking && pending?.bookingId === booking.id;
                const isBusy = !!booking && busyBookingId === booking.id;

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
                  <div key={time} className="flex flex-col gap-1.5">
                    <div
                      className="blocs-slot-row"
                      onClick={() => {
                        if (!booking) return;
                        setExpandedBookingId(isExpanded ? null : booking.id);
                        setPending(null);
                      }}
                      style={{ cursor: booking ? 'pointer' : 'default' }}
                    >
                      <span className="blocs-slot-time">{time}</span>
                      <div className={slotClass}>
                        <span>{label}</span>
                        {booking && <span style={{ opacity: 0.5, fontSize: '11px' }}>▾</span>}
                      </div>
                    </div>

                    {isExpanded && booking && (
                      <div className="blocs-slot-actions">
                        {isPending ? (
                          <>
                            <span style={{ color: 'var(--blocs-text-60)', fontSize: '12px', width: '100%' }}>
                              Cancel {pending!.kind === 'series' ? 'whole series' : 'this session'}?
                            </span>
                            <button
                              className="blocs-slot-action-danger"
                              disabled={isBusy}
                              onClick={() =>
                                pending!.kind === 'series' && booking.seriesId
                                  ? cancelSeries(booking.seriesId, booking.id)
                                  : cancelSingle(booking.id)
                              }
                            >
                              {isBusy ? '...' : 'Yes, cancel'}
                            </button>
                            <button className="blocs-slot-action-neutral" disabled={isBusy} onClick={() => setPending(null)}>
                              No, keep it
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="blocs-slot-action-danger"
                              onClick={() => setPending({ bookingId: booking.id, kind: 'single' })}
                            >
                              Cancel session
                            </button>
                            {booking.seriesId && (
                              <button
                                className="blocs-slot-action-danger"
                                onClick={() => setPending({ bookingId: booking.id, kind: 'series' })}
                              >
                                Cancel series
                              </button>
                            )}
                            <button className="blocs-slot-action-neutral" onClick={() => setExpandedBookingId(null)}>
                              Keep
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
       <BlockedDatesList theme_color={trainer.theme_color} />
      )}
    </div>
  );
}
