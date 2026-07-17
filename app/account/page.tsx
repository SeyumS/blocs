import React from 'react'
import { AccountView } from './accountView'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const Account = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if(!user) {
    redirect('/')
  }

  const { data: trainer } = await supabase.from('trainers').select('*').eq('auth_user_id', user?.id).single()
  console.log(trainer)
  if(!trainer) {
    redirect('/onboarding')
  }
  const {data: availability_rules} = await supabase.from('availability_rules').select('*').eq('trainer_id', trainer?.id).order('day_of_week', { ascending: true })
  
  return (
    <AccountView trainer={trainer} availability_rules={availability_rules ?? []} />
  )
}

export default Account