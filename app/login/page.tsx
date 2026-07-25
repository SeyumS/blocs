'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);


  export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [step, setStep] = useState<'email' | 'code'>('email');
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const handleSendCode = async (e: React.FormEvent) => {
      e.preventDefault();
      setStatus('loading');
      setErrorMsg('');

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setStatus('error');
        return;
      }

      setStatus('idle');
      setStep('code');
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
      e.preventDefault();
      setStatus('loading');
      setErrorMsg('');
  
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });
  
      if (error || !data.session) {
        setErrorMsg('Invalid or expired code. Please try again.');
        setStatus('error');
        return;
      }
    // Same "does a trainer row exist" check your callback route used to do
    const { data: trainer } = await supabase
    .from('trainers')
    .select('id')
    .eq('auth_user_id', data.session.user.id)
    .single();

  router.push(trainer ? '/dashboard' : '/onboarding');
};

if (step === 'code') {
  return (
    <div className="blocs-theme blocs-page" style={{ justifyContent: 'center' }}>
    <div className="blocs-brand">
      <div className="blocs-brand-row">
        <Image src="/blocs-logo.svg" alt="Blocs" width={100} height={100} />
      </div>
      <p className="blocs-brand-tagline">The Schedule that Works for You.</p>
    </div>

    <div className="blocs-card" style={{ padding: '32px 24px' }}>
    <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
      <h1 className="blocs-h1">Enter your code</h1>
      <p className="blocs-p">We sent a 6-digit code to {email}.</p>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        autoFocus
        required
      className="blocs-input"
      />
  {status === 'error' && <p>{errorMsg}</p>}

<button type="submit" disabled={status === 'loading' || code.length !== 6} className='blocs-btn-primary'
  style={{ background: 'white', color: 'black', boxShadow: '0 0 0 1px rgba(#f5f7fa, 0.35), 0 8px 24px rgba(#f5f7fa, 0.35)'}}>
  {status === 'loading' ? 'Verifying...' : 'Verify & log in'}
  
</button>

<button type="button" onClick={() => setStep('email')}>
  Use a different email
</button>
</form>
</div>
</div>
);
}


  return (
    <div className="blocs-theme blocs-page" style={{ justifyContent: 'center' }}>
      <div className="blocs-brand">
        <div className="blocs-brand-row">
          <Image src="/blocs-logo.svg" alt="Blocs" width={100} height={100} />
        </div>
        <p className="blocs-brand-tagline">The Schedule that Works for You.</p>
      </div>

      <div className="blocs-card" style={{ padding: '32px 24px' }}>
          <form onSubmit={handleSendCode} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="blocs-label">Email</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@work-email.com"
                required
                className="blocs-input"
              />
            </div>
            <button type="submit"
             disabled={status === 'loading'}
            className="blocs-btn-primary"
            style={{ background: 'white', color: 'black', boxShadow: '0 0 0 1px rgba(#f5f7fa, 0.35), 0 8px 24px rgba(#f5f7fa, 0.35)'}}
            >send code</button>
          </form>
      </div>
    </div>
  );
}
