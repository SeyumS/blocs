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
    <div className="blocs-theme blocs-page" style={{ justifyContent: 'center' }}>
      <div className="blocs-brand">
        <div className="blocs-brand-row">
          <div className="blocs-brand-mark">
            <span /><span className="active" /><span /><span />
          </div>
          <span className="blocs-brand-name">Blocs</span>
        </div>
        <p className="blocs-brand-tagline">Book by the block.</p>
      </div>

      <div className="blocs-card flex flex-col gap-4" style={{ padding: '32px 24px' }}>
        <h1 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '20px', fontWeight: 700 }}>Add your card</h1>
        <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>
          Your trial is still active — adding your card now just makes sure nothing interrupts
          your bookings when it ends. You won&apos;t be charged until your trial is over.
        </p>
        {status === 'error' && <p className="blocs-error">Something went wrong — please try again.</p>}
        <button className="blocs-btn-primary" onClick={handleAddCard} disabled={status === 'loading'}>
          {status === 'loading' ? 'Redirecting to checkout...' : 'Add card'}
        </button>
      </div>
    </div>
  );
}
