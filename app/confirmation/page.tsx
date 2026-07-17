import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getThemeCssVars } from '@/lib/theme'

const Confirmation = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let themeColor: string | null = null
  if (user) {
    const { data: trainer } = await supabase
      .from('trainers')
      .select('theme_color')
      .eq('auth_user_id', user.id)
      .single()
    themeColor = trainer?.theme_color ?? null
  }

  return (
    <div className="blocs-theme blocs-page" style={{ justifyContent: 'center', ...getThemeCssVars(themeColor) }}>
      <div className="blocs-card" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 32px', gap: '24px' }}>
        <div className="blocs-check-circle">
          <div className="blocs-check-mark" />
        </div>
        <div className="flex flex-col gap-1.5" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h1 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '22px', fontWeight: 700 }}>You&apos;re all set</h1>
          <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>Your schedule is live and ready to take bookings.</p>
        </div>
        <Link href="/dashboard" className="blocs-btn-primary" style={{ width: '100%', textAlign: 'center', display: 'block', boxSizing: 'border-box' }}>
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}

export default Confirmation
