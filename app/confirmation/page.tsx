import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { getThemeCssVars } from '@/lib/theme'
import { ConfirmationRedirect } from './ConfirmationRedirect'

const Confirmation = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let themeColor: string | null = null
  let slug: string | null = null
  if (user) {
    const { data: trainer } = await supabase
      .from('trainers')
      .select('theme_color, slug')
      .eq('auth_user_id', user.id)
      .single()
    themeColor = trainer?.theme_color ?? null
    slug = trainer?.slug ?? null
  }

  return (
    <div className="blocs-theme blocs-page" style={{ justifyContent: 'center', ...getThemeCssVars(themeColor) }}>
      <ConfirmationRedirect redirectTo={slug ? `/${slug}` : '/dashboard'} />
      <div className="blocs-card" style={{ alignItems: 'center', justifyContent: 'center', padding: '40px 32px', gap: '24px' }}>
        <div className="blocs-check-circle blocs-check-circle--celebrate">
          <div className="blocs-check-mark blocs-check-mark--celebrate" />
        </div>
        <div className="flex flex-col gap-1.5" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h1 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '22px', fontWeight: 700 }}>You&apos;re all set</h1>
          <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>Your schedule is live and ready to take bookings.</p>
        </div>
      </div>
    </div>
  )
}

export default Confirmation
