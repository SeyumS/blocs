'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { extractAvailabilityRules } from '@/lib/scheduling'
import { useRouter } from 'next/navigation'
import { getThemeCssVars, DEFAULT_THEME_COLOR } from '@/lib/theme'
import { ScheduleBuilder, type ScheduleBuilderData } from '@/app/components/ScheduleBuilder'
import Image from 'next/image'

async function saveAvailability(trainerId: string, selectedCells: string[]) {
  const rules = extractAvailabilityRules(selectedCells)

  // Clear existing rules first (simplest approach — full replace on each save)
  const { error: deleteError } = await supabase
    .from('availability_rules')
    .delete()
    .eq('trainer_id', trainerId)

  if (deleteError) throw deleteError

  const rowsToInsert = rules.map(rule => ({
    trainer_id: trainerId,
    day_of_week: rule.day_of_week,
    start_time: rule.start_time,
    end_time: rule.end_time,
  }))

  const { error: insertError } = await supabase
    .from('availability_rules')
    .insert(rowsToInsert)

  if (insertError) throw insertError
}

const Onboarding = () => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: ScheduleBuilderData) => {
    setIsLoading(true)
    try {
      const { data: userData, error } = await supabase.auth.getUser()
      const authUserId = userData.user?.id
      const email = userData.user?.email
      if (error) {
        console.error(error)
      }

      // Starts the 30-day trial the billing gate in proxy.ts checks against —
      // subscription_status defaults to 'trial' in the DB already, so it
      // doesn't need to be set here.
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: trainerData, error: trainerError } = await supabase.from('trainers').insert({
        name: data.name,
        slug: data.slug,
        auth_user_id: authUserId,
        email: email,
        bio: data.bio,
        theme_color: data.themeColor,
        trial_ends_at: trialEndsAt,
      }).select().single()

      if (trainerError || !trainerData) {
        console.error(trainerError)
        setIsLoading(false)
        return
      }
      await saveAvailability(trainerData.id, data.cellIds)
      router.push('/confirmation')
    } catch (error) {
      console.error(error)
      setIsLoading(false)
    }
  }

  return (
    <div className="blocs-theme blocs-page" style={getThemeCssVars(DEFAULT_THEME_COLOR)}>
      <div className="blocs-brand">
        <div className="blocs-brand-row">
          <Image src="/blocs-logo.svg" alt="Blocs" width={100} height={100} />
        </div>
        <p className="blocs-brand-tagline">The Schedule that Works For You.</p>
      </div>

      <ScheduleBuilder onSubmit={handleSubmit} submitLabel="Generate my link" isSubmitting={isLoading} />
    </div>
  )
}

export default Onboarding
