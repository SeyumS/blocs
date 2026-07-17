'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getThemeCssVars } from '@/lib/theme'

interface Trainer {
  subscription_status: string
  trial_ends_at: string | null
  theme_color: string
}

function BillingPage({ trainer }: { trainer: Trainer }) {
  const searchParams = useSearchParams()
  const cancelled = searchParams.get('checkout') === 'cancelled'
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const trialEndsAt = trainer.trial_ends_at ? new Date(trainer.trial_ends_at) : null
  const trialExpired = !!trialEndsAt && trialEndsAt < new Date()
  const isActive = trainer.subscription_status === 'active'

  const handleSubscribe = async () => {
    setIsLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setErrorMsg(data.error ?? 'Something went wrong — please try again.')
        setIsLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setErrorMsg('Network error — please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="blocs-theme blocs-page" style={{ justifyContent: 'center', ...getThemeCssVars(trainer.theme_color) }}>
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
        <h1 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '20px', fontWeight: 700 }}>Billing</h1>

        {isActive ? (
          <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>
            Your subscription is active — you&apos;re all set.
          </p>
        ) : trialExpired ? (
          <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>
            Your free trial has ended. Subscribe to keep your booking page live.
          </p>
        ) : trialEndsAt ? (
          <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>
            Your free trial runs until {trialEndsAt.toLocaleDateString()}. Subscribe any time to continue after that.
          </p>
        ) : (
          <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>
            Subscribe to keep your booking page live.
          </p>
        )}

        {cancelled && <p className="blocs-error">Checkout was cancelled — no charge was made.</p>}
        {errorMsg && <p className="blocs-error">{errorMsg}</p>}

        {!isActive && (
          <button className="blocs-btn-primary" onClick={handleSubscribe} disabled={isLoading}>
            {isLoading ? 'Redirecting...' : 'Subscribe'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Billing() {
  const router = useRouter()
  const [trainer, setTrainer] = useState<Trainer | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data } = await supabase
        .from('trainers')
        .select('subscription_status, trial_ends_at, theme_color')
        .eq('auth_user_id', user.id)
        .single()

      if (cancelled) return
      if (!data) {
        router.push('/onboarding')
        return
      }
      setTrainer(data)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [router])

  if (!trainer) return null

  return <BillingPage trainer={trainer} />
}
