import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { computeCalendarSlots, type CalendarSlot } from '@/lib/scheduling';
import TrainerDashboardView from './TrainerDashboardView';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: trainer } = await supabase
    .from('trainers')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (!trainer) redirect('/onboarding');

  const { data: availabilityRules } = await supabase
    .from('availability_rules')
    .select('day_of_week, start_time, end_time')
    .eq('trainer_id', trainer.id);

  const { data: exceptions } = await supabase
    .from('availability_exceptions')
    .select('date, is_blocked, start_time, end_time')
    .eq('trainer_id', trainer.id);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, starts_at, ends_at, series_id, clients(name)')
    .eq('trainer_id', trainer.id)
    .eq('status', 'confirmed');

  const busySlots = (bookings || []).map((b) => {
    const client = Array.isArray(b.clients) ? b.clients[0] : b.clients;
    return {
      id: b.id,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      series_id: b.series_id,
      client_name: client?.name,
    };
  });

  const slots: CalendarSlot[] = computeCalendarSlots({
    rules: availabilityRules || [],
    exceptions: exceptions || [],
    busySlots,
    timezone: trainer.timezone || 'UTC',
    sessionLengthMinutes: trainer.session_length_minutes || 60,
    daysAhead: 56,
  });

  return <TrainerDashboardView trainer={trainer} slots={slots} />;
}
