'use client';

import { useState } from 'react';

export default function CancelSubscriptionButton({
  currentStatus,
}: {
  currentStatus: string;
}) {
  const [status, setStatus] = useState<'idle' | 'confirming' | 'loading' | 'done'>('idle');
  const [cancelsAt, setCancelsAt] = useState<string | null>(null);

  const handleCancel = async () => {
    setStatus('loading');
    const res = await fetch('/api/billing/cancel', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      setStatus('idle');
      alert(data.error ?? 'Something went wrong');
      return;
    }

    setCancelsAt(data.cancelsAt);
    setStatus('done');
  };

  if (currentStatus === 'cancelling') {
    return (
      <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13px' }}>
        Your subscription is set to end at your next billing date. You still have full access until then.
      </p>
    );
  }

  if (status === 'done') {
    return (
      <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13px' }}>
        Your subscription will end on {new Date(cancelsAt!).toLocaleDateString()}.
        You&apos;ll keep full access until then.
      </p>
    );
  }

  if (status === 'confirming' || status === 'loading') {
    return (
      <div className="flex flex-col gap-2">
        <p style={{ margin: 0, color: 'var(--blocs-text-60)', fontSize: '13px' }}>
          Are you sure? You&apos;ll keep access until the end of your current billing period, then lose it.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button className="blocs-slot-action-danger" onClick={handleCancel} disabled={status === 'loading'}>
            {status === 'loading' ? 'Cancelling...' : 'Yes, cancel my subscription'}
          </button>
          <button className="blocs-slot-action-neutral" onClick={() => setStatus('idle')} disabled={status === 'loading'}>
            Never mind
          </button>
        </div>
      </div>
    );
  }

  return (
    <button className="blocs-slot-action-danger" onClick={() => setStatus('confirming')}>
      Cancel subscription
    </button>
  );
}
