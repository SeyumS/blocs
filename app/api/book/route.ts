import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Service role client — bypasses RLS, used only here on the server
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // never expose this to the client
);

export async function POST(req: Request) {
  const body = await req.json();
  const { trainerId, startsAt, endsAt, isRecurring, client } = body;

  if (!trainerId || !startsAt || !endsAt || !client?.name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!client.email && !client.phone) {
    return NextResponse.json({ error: 'Email or phone required' }, { status: 400 });
  }

  // 1. Find or create the client record
  let clientId: string;
  if (client.email) {
    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('trainer_id', trainerId)
      .eq('email', client.email)
      .maybeSingle();

    if (existing) {
      clientId = existing.id;
    } else {
      const { data: newClient, error } = await supabaseAdmin
        .from('clients')
        .insert({ trainer_id: trainerId, name: client.name, email: client.email, phone: client.phone })
        .select('id')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      clientId = newClient.id;
    }
  } else {
    const { data: newClient, error } = await supabaseAdmin
      .from('clients')
      .insert({ trainer_id: trainerId, name: client.name, phone: client.phone })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    clientId = newClient.id;
  }

  // 2. If recurring, create the series first
  let seriesId: string | null = null;
  if (isRecurring) {
    const startDate = new Date(startsAt);
    const { data: series, error: seriesError } = await supabaseAdmin
      .from('booking_series')
      .insert({
        trainer_id: trainerId,
        client_id: clientId,
        day_of_week: startDate.getDay(),
        start_time: startDate.toTimeString().slice(0, 5),
        frequency: 'weekly',
        starts_on: startDate.toISOString().slice(0, 10),
      })
      .select('id')
      .single();
    if (seriesError) return NextResponse.json({ error: seriesError.message }, { status: 500 });
    seriesId = series.id;
  }

  // 3. Insert the actual booking — the UNIQUE(trainer_id, starts_at) constraint
  //    is what actually prevents double-booking races here
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .insert({
      trainer_id: trainerId,
      client_id: clientId,
      series_id: seriesId,
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'confirmed',
    })
    .select()
    .single();

  if (bookingError) {
    // 23505 = unique_violation in Postgres — someone else grabbed this slot first
    if (bookingError.code === '23505') {
      return NextResponse.json({ error: 'Slot already booked' }, { status: 409 });
    }
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  if (client.email) {
    await resend.emails.send({
      from: 'noreply@blocsmanaged.com',
      to: client.email,
      subject: 'Your booking is confirmed',
      html: `
        <h1>Booking confirmed</h1>
        <p>Hi ${client.name},</p>
        <p>Your session is confirmed.</p>
        <p><strong>Start:</strong> ${new Date(startsAt).toLocaleString()}</p>
        <p><strong>End:</strong> ${new Date(endsAt).toLocaleString()}</p>
        <p>if you want to candel or reschedule, follow the link below:</p>
        <a href="http://localhost:3000/cancel/${booking.id}">
          Cancel or Reschedule
        </a>
      `,
    });
  }

  return NextResponse.json({ booking }, { status: 201 });
}