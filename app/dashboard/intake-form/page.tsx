import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import IntakeFormBuilder from './IntakeFormBuilder'

export default async function IntakeFormPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('trainers')
    .select('intake_form_schema, theme_color, theme_surface')
    .eq('auth_user_id', user.id)
    .single()

  return (
    <IntakeFormBuilder
      initialFields={data?.intake_form_schema ?? []}
      themeColor={data?.theme_color}
      themeSurface={data?.theme_surface}
    />
  )
}
