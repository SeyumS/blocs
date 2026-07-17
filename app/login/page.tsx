'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

  export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      console.log(email);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      console.log('error', error);
      if (!error) setSent(true);
    };
    console.log('sent', sent);

  return (
    <div className="blocs-theme blocs-page" style={{ justifyContent: 'center' }}>
      <div className="blocs-brand">
        <div className="blocs-brand-row">
          <Image src="/blocs-logo.svg" alt="Blocs" width={100} height={100} />
        </div>
        <p className="blocs-brand-tagline">The Schedule that Works for You.</p>
      </div>

      <div className="blocs-card" style={{ padding: '32px 24px' }}>
        {sent ? (
          <p style={{ margin: 0, color: 'var(--blocs-text-60)', fontSize: '14px', textAlign: 'center' }}>
            Check your email for a login link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="blocs-label">Email</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@work-email.com"
                className="blocs-input"
              />
            </div>
            <button type="submit" className="blocs-btn-primary">Login</button>
          </form>
        )}
      </div>
    </div>
  );
}
