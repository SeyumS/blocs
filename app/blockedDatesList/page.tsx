'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { format } from 'date-fns';
import BlockedTimeForm from '../blockTimeForm/page';
import { getThemeCssVars } from '@/lib/theme';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Exception {
  id: string;
  date: string;
  is_blocked: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export default function BlockedDatesList({ theme_color }: { theme_color?: string | null } = {}) {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddBlockedDateModal, setShowAddBlockedDateModal] = useState(false);
  
  useEffect(() => {
    let cancelled = false;

    async function loadExceptions() {
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('availability_exceptions')
        .select('*')
        .eq('is_blocked', true)
        .gte('date', today)
        .order('date', { ascending: true });

      if (cancelled) return;

      if (!error && data) {
        setExceptions(data);
      }

      setLoading(false);
    }

    loadExceptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRemove = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('availability_exceptions').delete().eq('id', id);
    if (!error) {
      setExceptions((prev) => prev.filter((e) => e.id !== id));
    }
    setDeletingId(null);
  };

  // Group consecutive full-day blocks into ranges for cleaner display
  // e.g. Dec 20, 21, 22 (all full-day, same reason) -> "Dec 20 - Dec 22"
  const groupedRanges = groupConsecutiveFullDayBlocks(exceptions);

  if (loading) return <p className="blocs-theme" style={{ background: 'transparent', color: 'var(--blocs-text-45)', fontSize: '13px', ...getThemeCssVars(theme_color) }}>Loading blocked dates...</p>;
  if (exceptions.length === 0) return <p className="blocs-theme" style={{ background: 'transparent', color: 'var(--blocs-text-45)', fontSize: '13px', ...getThemeCssVars(theme_color) }}>No upcoming blocked dates.</p>;

  return (
    <div className="blocs-theme flex flex-col gap-3" style={{ background: 'transparent', ...getThemeCssVars(theme_color) }}>
      <h3 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '15px', fontWeight: 700 }}>Upcoming blocked time</h3>
      <button className="blocs-day-chip active" style={{ padding: '8px 16px' }} onClick={() => setShowAddBlockedDateModal(!showAddBlockedDateModal)}>Block Time</button>
      {showAddBlockedDateModal && <BlockedTimeForm theme_color={theme_color} />}
      <ul className="flex flex-col gap-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {groupedRanges.map((group) => (
          <li
            key={group.ids[0]}
            className="flex items-center justify-between gap-3"
            style={{ background: 'var(--blocs-input-bg)', border: '1px solid var(--blocs-border-soft)', borderRadius: '10px', padding: '10px 12px' }}
          >
            <span style={{ color: 'var(--blocs-text-60)', fontSize: '13px' }}>
              {group.isFullDay ? (
                <>
                  {group.startDate === group.endDate
                    ? format(new Date(group.startDate), 'EEE, MMM d')
                    : `${format(new Date(group.startDate), 'MMM d')} – ${format(new Date(group.endDate), 'MMM d')}`}
                  {' '}(full day)
                </>
              ) : (
                <>
                  {format(new Date(group.startDate), 'EEE, MMM d')}: {group.startTime}–{group.endTime}
                </>
              )}
              {group.reason && <span style={{ color: 'var(--blocs-text-40)' }}> — {group.reason}</span>}
            </span>
            <button
              className="blocs-slot-action-danger"
              onClick={() => group.ids.forEach(handleRemove)}
              disabled={deletingId !== null}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Merges consecutive-date full-day blocks (same reason) into a single displayed range
function groupConsecutiveFullDayBlocks(exceptions: Exception[]) {
  const groups: {
    ids: string[];
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    reason: string | null;
    isFullDay: boolean;
  }[] = [];

  for (const ex of exceptions) {
    const isFullDay = !ex.start_time;
    const last = groups[groups.length - 1];

    const isConsecutive =
      last &&
      last.isFullDay === isFullDay &&
      last.reason === ex.reason &&
      isNextDay(last.endDate, ex.date);

    if (isConsecutive) {
      last.endDate = ex.date;
      last.ids.push(ex.id);
    } else {
      groups.push({
        ids: [ex.id],
        startDate: ex.date,
        endDate: ex.date,
        startTime: ex.start_time,
        endTime: ex.end_time,
        reason: ex.reason,
        isFullDay,
      });
    }
  }

  return groups;
}

function isNextDay(dateStr: string, nextDateStr: string): boolean {
  const date = new Date(dateStr);
  const nextDate = new Date(nextDateStr);
  const diffDays = (nextDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays === 1;
}