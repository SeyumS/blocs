import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { eachDayOfInterval, format } from 'date-fns';

export async function POST(req: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });

  const body = await req.json();
  // body: { startDate: '2026-12-20', endDate: '2026-12-27', startTime: null, endTime: null, reason: 'Vacation' }
  const { startDate, endDate, startTime, endTime, reason } = body;

  if (!startDate) {
    return NextResponse.json({ error: 'startDate is required' }, { status: 400 });
  }

  // Expand the range into one row per day (covers both single-day and multi-day vacation)
  const days = eachDayOfInterval({
    start: new Date(startDate),
    end: new Date(endDate ?? startDate),
  });

  const rows = days.map((day) => ({
    trainer_id: trainer.id,
    date: format(day, 'yyyy-MM-dd'),
    is_blocked: true,
    start_time: startTime ?? null, // null = full day
    end_time: endTime ?? null,
    reason: reason ?? null,
  }));

  const { data, error } = await supabase
    .from('availability_exceptions')
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ blocked: data });
}