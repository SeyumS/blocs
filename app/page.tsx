'use client'
import { useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { DEFAULT_THEME_COLOR, getThemeCssVars, type ThemeColorKey } from '@/lib/theme'
import { ThemeSwatchPicker } from '@/app/components/ThemeSwatchPicker'
import { ScheduleBuilder, type ScheduleBuilderData } from '@/app/components/ScheduleBuilder'

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Client books',
    body: 'They open your link, see your real availability, and pick a slot. No texts back and forth.',
  },
  {
    step: '2',
    title: "You're notified",
    body: 'The session lands straight on your calendar, confirmed — nothing for you to approve or copy over.',
  },
  {
    step: '3',
    title: "No-shows don't cost you",
    body: 'Cancel a session and it automatically re-offers the slot to your waitlist, first come first served.',
  },
]

const FAQS = [
  {
    q: 'Do I need a card to start?',
    a: 'No. You get a full 30-day trial the moment you finish the form below — every feature unlocked, no card required. We’ll only ask for billing details if you decide to keep going after the trial.',
  },
  {
    q: 'Can clients book without creating an account?',
    a: 'Yes. Your booking link is public — clients just pick a time and confirm. They never need to sign up, log in, or download anything.',
  },
  {
    q: "What if I already use Instagram DMs to schedule?",
    a: 'You can keep doing that for existing clients while you try this out — nothing forces a switch on day one. Most trainers just start sharing their new link with new inquiries, since it replaces the “when are you free?” back-and-forth entirely.',
  },
]

type DemoStep = 'building' | 'sent'

export default function LandingPage() {
  const [pageAccent, setPageAccent] = useState<ThemeColorKey>(DEFAULT_THEME_COLOR)
  const [demoStep, setDemoStep] = useState<DemoStep>('building')
  const [isCreating, setIsCreating] = useState(false)
  const [claimError, setClaimError] = useState('')
  const [sentEmail, setSentEmail] = useState('')

  const handleCreateAccount = async (data: ScheduleBuilderData) => {
    const email = data.email
    if (!email) return

    setIsCreating(true)
    setClaimError('')

    try {
      const res = await fetch('/api/pending-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: data.name,
          slug: data.slug,
          bio: data.bio,
          selectedCells: data.cellIds,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setClaimError(
          res.status === 409
            ? 'That link was just claimed by someone else — please choose another.'
            : (body.error ?? 'Something went wrong. Please try again.')
        )
        setIsCreating(false)
        return
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (otpError) {
        setClaimError('Could not send the login link. Please try again.')
        setIsCreating(false)
        return
      }

      setSentEmail(email)
      setDemoStep('sent')
    } catch {
      setClaimError('Something went wrong. Please try again.')
      setIsCreating(false)
    }
  }

  return (
    <div className="blocs-theme" style={{ minHeight: '100vh', width: '100%', ...getThemeCssVars(pageAccent) }}>
      {/* 1. Sticky header */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between"
        style={{ padding: '16px 24px', background: 'var(--blocs-bg)', borderBottom: '1px solid var(--blocs-border)' }}
      >
        <div className="flex items-center gap-2" style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', justifyContent: 'space-between', display: 'flex' }}>
          <Image src="/blocs-logo.svg" alt="Blocs" width={32} height={32} />
          <a href="#demo" className="blocs-btn-primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '10px 20px', color: '#000' }}>
            Try Now
          </a>
        </div>
      </header>

      {/* 2. Hero */}
      <section style={{ maxWidth: '760px', margin: '0 auto', padding: '64px 20px 48px', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 16px', color: 'var(--blocs-text)', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          Never lose a booking to a no-show again.
        </h1>
        <p style={{ margin: '0 0 32px', color: 'var(--blocs-text-50)', fontSize: '16px', lineHeight: 1.55, maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>
          Set your hours once. Clients book themselves, cancellations refill from your waitlist
          automatically, and you keep every session paid.
        </p>

        <div className="flex flex-col items-center gap-2" style={{ marginBottom: '32px' }}>
          <span className="blocs-label">Pick your accent color</span>
          <ThemeSwatchPicker value={pageAccent} onChange={setPageAccent} />
        </div>

        <a href="#demo" className="blocs-btn-primary" style={{ display: 'inline-block', textDecoration: 'none', color: '#000' }}>
          Build your schedule ↓
        </a>
      </section>

      {/* 3. How it works */}
      <section style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 20px 64px' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="blocs-card" style={{ padding: '24px 22px', maxWidth: 'none' }}>
              <div
                className="flex items-center justify-center"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  fontWeight: 700,
                  fontSize: '14px',
                  color: 'var(--blocs-accent-text)',
                  background: 'linear-gradient(135deg, var(--blocs-accent), var(--blocs-accent-dark))',
                }}
              >
                {item.step}
              </div>
              <h3 style={{ margin: '0 0 8px', color: 'var(--blocs-text)', fontSize: '16px', fontWeight: 700 }}>{item.title}</h3>
              <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px', lineHeight: 1.5 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Interactive onboarding demo */}
      <section id="demo" className="blocs-page" style={{ paddingTop: '12px', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: '600px', textAlign: 'center', margin: '0 auto 28px' }}>
          <h2 style={{ margin: '0 0 8px', color: 'var(--blocs-text)', fontSize: '26px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Try it yourself
          </h2>
          <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '14px' }}>
            This isn&apos;t a sandbox — finish the form below and your account is live.
          </p>
        </div>

        {demoStep === 'building' ? (
          <ScheduleBuilder
            onSubmit={handleCreateAccount}
            submitLabel="Create my account"
            isSubmitting={isCreating}
            showEmailField
            error={claimError}
            themeColor={pageAccent}
            onThemeColorChange={setPageAccent}
          />
        ) : (
          <div className="blocs-card" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 32px', gap: '24px' }}>
            <div className="blocs-check-circle" style={{ margin: '0 auto' }} />
            <div className="flex flex-col gap-1.5" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '20px', fontWeight: 700 }}>Check your email</h3>
              <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>
                Click the link we sent to {sentEmail} to activate your schedule and go live.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 5. Pricing */}
      <section style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px 64px' }}>
        <div className="flex flex-col items-center gap-2" style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '26px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Simple pricing
          </h2>
          <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '14px' }}>Start free. Pay only if you keep using it.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="blocs-card" style={{ padding: '28px 24px', maxWidth: 'none' }}>
            <span className="blocs-label">Trial</span>
            <div style={{ margin: '10px 0 4px', color: 'var(--blocs-text)', fontSize: '32px', fontWeight: 700 }}>30 days</div>
            <p style={{ margin: '0 0 16px', color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>No card required</p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['Every feature unlocked', 'Unlimited clients & bookings', 'Waitlist auto-fill included'].map((f) => (
                <li key={f} style={{ color: 'var(--blocs-text-60)', fontSize: '13px' }}>✓ {f}</li>
              ))}
            </ul>
          </div>

          <div
            className="blocs-card"
            style={{
              padding: '28px 24px',
              maxWidth: 'none',
              border: '1px solid rgba(var(--blocs-accent-rgb), 0.4)',
              boxShadow: '0 0 0 1px rgba(var(--blocs-accent-rgb), 0.15), 0 30px 80px rgba(0,0,0,0.55)',
            }}
          >
            <span className="blocs-label">After your trial</span>
            <div style={{ margin: '10px 0 4px', color: 'var(--blocs-text)', fontSize: '32px', fontWeight: 700 }}>
              €12<span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--blocs-text-45)' }}> / month</span>
            </div>
            <p style={{ margin: '0 0 16px', color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>Cancel anytime, no contract</p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['Everything in the trial', 'Keeps your booking link live', 'Priority email support'].map((f) => (
                <li key={f} style={{ color: 'var(--blocs-text-60)', fontSize: '13px' }}>✓ {f}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 6. FAQ */}
      <section style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px 64px' }}>
        <h2 style={{ margin: '0 0 24px', color: 'var(--blocs-text)', fontSize: '26px', fontWeight: 700, letterSpacing: '-0.01em', textAlign: 'center' }}>
          Questions
        </h2>
        <div className="flex flex-col gap-4">
          {FAQS.map((faq) => (
            <div key={faq.q} className="blocs-card" style={{ padding: '20px 22px', maxWidth: 'none' }}>
              <h3 style={{ margin: '0 0 8px', color: 'var(--blocs-text)', fontSize: '14.5px', fontWeight: 700 }}>{faq.q}</h3>
              <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px', lineHeight: 1.55 }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Footer */}
      <footer style={{ borderTop: '1px solid var(--blocs-border)', padding: '28px 20px', textAlign: 'center' }}>
        <p style={{ margin: 0, color: 'var(--blocs-text-40)', fontSize: '12.5px' }}>
          Questions? <a href="mailto:support@blocsbooking.com">support@blocsbooking.com</a>
        </p>
      </footer>
    </div>
  )
}
