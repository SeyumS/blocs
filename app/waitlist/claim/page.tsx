'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function ClaimPage() {
  const params = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleClaim = async () => {
    setStatus('loading');
    const res = await fetch('/api/waitlist/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      setStatus('error');
      return;
    }
    setStatus('success');
  };

  if (status === 'success') {
    return (
      <div className="blocs-theme blocs-page" style={{ justifyContent: 'center' }}>
        <div className="blocs-card" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 32px', gap: '24px' }}>
          <div className="blocs-check-circle">
            <div className="blocs-check-mark" />
          </div>
          <p style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '15px', fontWeight: 600, textAlign: 'center' }}>
            You&apos;re booked! Check your email for confirmation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="blocs-theme blocs-page" style={{ justifyContent: 'center' }}>
      <div className="blocs-card flex flex-col gap-4" style={{ padding: '32px 24px' }}>
        <h1 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '20px', fontWeight: 700 }}>Claim this slot</h1>
        {status === 'error' && <p className="blocs-error">{message}</p>}
        <button className="blocs-btn-primary" onClick={handleClaim} disabled={status === 'loading'}>
          {status === 'loading' ? 'Claiming...' : 'Claim now'}
        </button>
      </div>
    </div>
  );
}