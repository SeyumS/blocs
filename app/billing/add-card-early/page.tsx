'use client';

import { useState } from 'react';

export default function AddCardEarlyPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const handleAddCard = async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/billing/add-card-early', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        return;
      }
      window.location.href = data.url;
    } catch {
      setStatus('error');
    }
  };

  return (
    <div>
      <h1>Add your card</h1>
      <p>
        Your trial is still active — adding your card now just makes sure nothing interrupts
        your bookings when it ends. You won&apos;t be charged until your trial is over.
      </p>
      <button onClick={handleAddCard} disabled={status === 'loading'}>
        {status === 'loading' ? 'Redirecting to checkout...' : 'Add card'}
      </button>
      {status === 'error' && <p>Something went wrong — please try again.</p>}
    </div>
  );
}