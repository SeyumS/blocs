import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

export async function POST(req: Request) {
  const { token } = await req.json();
  const resend = new Resend(process.env.RESEND_API_KEY);

  // 1. Find the waitlist entry by token
  const { data: entry, error: entryError } = await supabaseAdmin
    .from('waitlist_entries')
    .select('*')
    .eq('claim_token', token)
    .single();

  if (entryError || !entry) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
  }

  if (entry.status === 'claimed') {
    return NextResponse.json({ error: 'You already claimed this slot' }, { status: 400 });
  }
  if (entry.status === 'expired') {
    return NextResponse.json({ error: 'This offer has expired' }, { status: 400 });
  }

  // 2. Try to insert the booking — the UNIQUE(trainer_id, starts_at) constraint
  //    is the actual race-condition guard. Whoever's insert lands first wins.
  const sessionLength = 60; // TODO: pull from trainers.session_length_minutes
  const endsAt = new Date(new Date(entry.desired_starts_at).getTime() + sessionLength * 60000);

  const { data: newBooking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .insert({
      trainer_id: entry.trainer_id,
      client_id: entry.client_id,
      starts_at: entry.desired_starts_at,
      ends_at: endsAt.toISOString(),
      status: 'confirmed',
    })
    .select()
    .single();

  if (bookingError) {
    if (bookingError.code === '23505') {
      // Someone else claimed it first — mark this entry as expired, not claimed
      await supabaseAdmin
        .from('waitlist_entries')
        .update({ status: 'expired' })
        .eq('id', entry.id);

      return NextResponse.json(
        { error: 'Sorry, someone else just claimed this slot.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  // 3. Success — mark this entry claimed
  await supabaseAdmin
    .from('waitlist_entries')
    .update({ status: 'claimed' })
    .eq('id', entry.id);

  // 4. Optional: mark everyone else's entry for this slot back to 'waiting'
  //    so they stay eligible for the *next* opening, rather than stuck as 'notified'
  await supabaseAdmin
    .from('waitlist_entries')
    .update({ status: 'waiting' })
    .eq('trainer_id', entry.trainer_id)
    .eq('desired_starts_at', entry.desired_starts_at)
    .eq('status', 'notified')
    .neq('id', entry.id);

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('name, email')
      .eq('id', entry.client_id)
      .single();
    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 500 });
    }

    await resend.emails.send({
      from: 'noreply@blocsbooking.com',
      to: client.email,
      subject: 'Congratulations! You claimed the slot!',
      html: `
        <h1>Booking confirmed</h1>
        <p>Hi ${client.name},</p>
        <p>Your session is confirmed.</p>
        <p><strong>Start:</strong> ${new Date(newBooking.starts_at).toLocaleString()}</p>
        <p><strong>End:</strong> ${new Date(endsAt).toLocaleString()}</p>
        <p>if you want to cancel or reschedule, follow the link below:</p>
        <a href="${APP_URL}/cancel/${newBooking.id}">
          Cancel or Reschedule
        </a>
      `,
    });

  return NextResponse.json({ booking: newBooking });
}