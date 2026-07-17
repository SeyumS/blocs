import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import CustomerView from './customerView';
import { computeCalendarSlots, type CalendarSlot } from '@/lib/scheduling';

// Booked/free slots change from other pages (cancellations, other
// customers booking) — this page has no dynamic APIs of its own to force
// fresh rendering, so without this it can get cached and keep serving a
// stale snapshot of availability.
export const dynamic = 'force-dynamic';

export default async function TrainerBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {

  const { slug } = await params;
  // Look up the trainer by slug via the public view — anon has no read access to the base table
  const { data: trainer, error } = await supabase
    .from('trainer_public_profiles')
    .select('id, name, slug, bio, photo_url, session_length_minutes, timezone, theme_color')
    .eq('slug', slug)
    .single();

  if (error || !trainer) {
    notFound(); // renders Next.js's built-in 404 page
  }

  // Fetch availability rules + busy slots to compute open times
  const { data: availabilityRules } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('trainer_id', trainer.id);

  const { data: busySlots } = await supabase
    .from('public_busy_slots')
    .select('*')
    .eq('trainer_id', trainer.id);

  const { data: exceptions } = await supabase
    .from('availability_exceptions')
    .select('date, is_blocked, start_time, end_time')
    .eq('trainer_id', trainer.id);

  const slots: CalendarSlot[] = computeCalendarSlots({
    rules: availabilityRules || [],
    exceptions: exceptions || [],
    busySlots: busySlots || [],
    timezone: trainer.timezone || 'UTC',
    sessionLengthMinutes: trainer.session_length_minutes || 60,
    daysAhead: 56, // 8 weeks, so there's enough range for the customer to page through several weeks
  });

  return (
    <div>
      <CustomerView trainer={trainer} slots={slots} />
    </div>
  );
}
