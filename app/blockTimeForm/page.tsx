'use client';

import { useState } from 'react';
import { getThemeCssVars } from '@/lib/theme';

export default function BlockTimeForm({
  onBlocked = () => {},
  theme_color,
}: {
  onBlocked?: () => void;
  theme_color?: string | null;
}) {
  const [mode, setMode] = useState<'fullDay' | 'partialDay'>('fullDay');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('14:00');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  const handleSubmit = async () => {
    setStatus('saving');
    const res = await fetch('/api/trainer/block-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate,
        endDate: mode === 'fullDay' ? (endDate || startDate) : startDate,
        startTime: mode === 'partialDay' ? startTime : null,
        endTime: mode === 'partialDay' ? endTime : null,
        reason,
      }),
    });

    if (!res.ok) {
      setStatus('error');
      return;
    }

    setStatus('idle');
    setStartDate('');
    setEndDate('');
    setReason('');
    onBlocked(); // refresh the parent's list of exceptions
  };

  return (
    <div className="blocs-theme flex flex-col gap-3" style={{ background: 'transparent', ...getThemeCssVars(theme_color) }}>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2" style={{ color: 'var(--blocs-text-60)', fontSize: '13px' }}>
          <input type="radio" checked={mode === 'fullDay'} onChange={() => setMode('fullDay')} />
          Block full day(s) — vacation, day off
        </label>
        <label className="flex items-center gap-2" style={{ color: 'var(--blocs-text-60)', fontSize: '13px' }}>
          <input type="radio" checked={mode === 'partialDay'} onChange={() => setMode('partialDay')} />
          Block part of a day
        </label>
      </div>

      <input type="date" className="blocs-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />

      {mode === 'fullDay' && (
        <div className="flex flex-col gap-1.5">
          <label className="blocs-label" style={{ textTransform: 'none' }}>to (optional, for multi-day)</label>
          <input type="date" className="blocs-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      )}

      {mode === 'partialDay' && (
        <div className="flex gap-2">
          <input type="time" className="blocs-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <input type="time" className="blocs-input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      )}

      <input
        className="blocs-input"
        placeholder="Reason (optional, e.g. 'Vacation')"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />

      <button className="blocs-btn-primary" onClick={handleSubmit} disabled={status === 'saving' || !startDate}>
        {status === 'saving' ? 'Saving...' : 'Block time'}
      </button>
      {status === 'error' && <p className="blocs-error">Something went wrong — try again.</p>}
    </div>
  );
}