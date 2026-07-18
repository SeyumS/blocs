import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { isTimeWithinAvailability } from '@/lib/scheduling';

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

// Service role client — bypasses RLS, used only here on the server
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // never expose this to the client
);

export async function POST(req: Request) {
  const body = await req.json();
  const { trainerId, startsAt, endsAt, isRecurring, client } = body;

  if (!trainerId || !startsAt || !endsAt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!client?.email && !client?.phone) {
    return NextResponse.json({ error: 'Email or phone required' }, { status: 400 });
  }

  // The UI only ever renders clickable slots that are already known-open —
  // this is the actual server-side enforcement that a request can't book
  // an arbitrary time outside the trainer's hours or during a blocked date.
  const { data: trainer } = await supabaseAdmin
    .from('trainers')
    .select('timezone')
    .eq('id', trainerId)
    .single();
  if (!trainer) {
    return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
  }

  const [{ data: rules }, { data: exceptions }] = await Promise.all([
    supabaseAdmin.from('availability_rules').select('day_of_week, start_time, end_time').eq('trainer_id', trainerId),
    supabaseAdmin.from('availability_exceptions').select('date, is_blocked, start_time, end_time').eq('trainer_id', trainerId),
  ]);

  const isAvailable = isTimeWithinAvailability({
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    rules: rules ?? [],
    exceptions: exceptions ?? [],
    timezone: trainer.timezone || 'UTC',
  });
  if (!isAvailable) {
    return NextResponse.json({ error: 'That time is not available' }, { status: 400 });
  }

  // Name is optional at booking time — new clients get a placeholder and
  // the UI asks for a real name in a follow-up step.
  const clientName = (client?.name && String(client.name).trim()) || 'anonymous Client';

  // 1. Find or create the client record
  let clientId: string;
  let isNew = false;
  if (client.email) {
    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id, name')
      .eq('trainer_id', trainerId)
      .eq('email', client.email)
      .maybeSingle();
       
    if (existing) {
      clientId = existing.id;
      // Returning clients with only a placeholder still need the name step.
      isNew =
        !existing.name ||
        existing.name === 'anonymous Client' ||
        existing.name.toLowerCase() === 'anonymous client';
    } else {
      const { data: newClient, error } = await supabaseAdmin
        .from('clients')
        .insert({ trainer_id: trainerId, name: clientName, email: client.email, phone: client.phone })
        .select('id')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      clientId = newClient.id;
      isNew = true;
    }
  } else {
    const { data: newClient, error } = await supabaseAdmin
      .from('clients')
      .insert({ trainer_id: trainerId, name: clientName, phone: client.phone })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    clientId = newClient.id;
    isNew = true;
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
      from: 'noreply@blocsbooking.com',
      to: client.email,
      subject: 'Your booking is confirmed',
      html: `
        <h1>Booking confirmed</h1>
        <p>Hi ${clientName},</p>
        <p>Your session is confirmed.</p>
        <p><strong>Start:</strong> ${new Date(startsAt).toLocaleString()}</p>
        <p><strong>End:</strong> ${new Date(endsAt).toLocaleString()}</p>
        <p>if you want to cancel or reschedule, follow the link below:</p>
        <a href="${APP_URL}/cancel/${booking.id}">
          Cancel or Reschedule
        </a>
      `,
    });
  }

  return NextResponse.json({ booking, isNew, clientId }, { status: 201 });
}