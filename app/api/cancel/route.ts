import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseAdmin = await createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

interface WaitlistEntry {
  id: string;
  client_id: string;
}

export async function POST(req: Request) {
  const { id, cancelledBy , mode }:{id:'string', cancelledBy: 'client' | 'trainer', mode: 'single' | 'series'} = await req.json()

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single()
  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }
  const nowIso = new Date().toISOString()
  if (mode === 'single') {
    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: nowIso, cancelled_by: 'trainer' })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (mode === 'series' && booking.series_id) {
    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: nowIso, cancelled_by: 'trainer' })
      .eq('series_id', booking.series_id)
      .eq('status', 'confirmed')
      .gte('starts_at', nowIso)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    
      const { error: seriesError } = await supabaseAdmin
      .from('booking_series')
      .update({ active: false })
      .eq('id', booking.series_id);

    if (seriesError) {
      return NextResponse.json({ error: seriesError.message }, { status: 500 });
    }
  }

  // 2. Find everyone waiting for this exact slot
  const { data: waitlistEntries } = await supabaseAdmin
    .from('waitlist_entries')
    .select('id, client_id, clients(name, email, phone)')
    .eq('trainer_id', booking.trainer_id)
    .eq('desired_starts_at', booking.starts_at)
    .eq('status', 'waiting');

  if (!waitlistEntries || waitlistEntries.length === 0) {
    return NextResponse.json({ booking, notified: 0 });
  }
  

  // 3. Notify all of them, in parallel
  await Promise.all(
    waitlistEntries.map(async (entry: WaitlistEntry) => {
      const claimToken = crypto.randomUUID();

      const { data: clientData, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('name, email, phone')
        .in('id', waitlistEntries.map(entry=>entry.client_id));

      if (clientError) {
        return NextResponse.json({ error: clientError.message }, { status: 500 });
      }
      const client = Array.isArray(clientData) ? clientData[0] : clientData

      await supabaseAdmin
        .from('waitlist_entries')
        .update({ status: 'notified', notified_at: new Date().toISOString() })
        .eq('id', entry.id);

      // Store the claim token so /claim can verify it
      await supabaseAdmin
        .from('waitlist_entries')
        .update({ claim_token: claimToken }) // add this column, see note below
        .eq('id', entry.id);

      if (client?.email) {
        await resend.emails.send({
          from: 'noreply@blocsbooking.com',
          to: client.email,
          subject: 'A slot just opened up!',
          html: `
            <p>Hi ${client.name},</p>
            <p>The ${new Date(booking.starts_at).toLocaleString()} slot you were waiting for just opened up.</p>
            <p><a href="http://localhost:3000/waitlist/claim?token=${claimToken}">
              Claim this slot
            </a></p>
            <p>First come, first served — if someone else claims it first, you'll stay on the waitlist for future openings.</p>
          `,
        });
      }
    })
  );

  return NextResponse.json({ booking, notified: waitlistEntries.length });
}