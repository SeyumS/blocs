import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { extractAvailabilityRules } from '@/lib/scheduling';

// Service role required: pending_onboarding has RLS enabled with zero
// policies, so even this request's authenticated session can't read it.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', req.url));
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  // Exchange the magic link code for a real session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', req.url));
  }

  const userId = data.session.user.id;
  const email = data.session.user.email;

  // This is the key check: does a trainer profile already exist?
  const { data: trainer } = await supabase
    .from('trainers')
    .select('id')
    .eq('auth_user_id', userId)
    .single();

  if (trainer) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // No trainer yet — check whether this email has an account queued up from
  // the landing-page demo (built before the user ever authenticated).
  const { data: pending } = email
    ? await supabaseAdmin
        .from('pending_onboarding')
        .select('*')
        .eq('email', email)
        .maybeSingle()
    : { data: null };

  if (!pending) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Insert via the cookie-authenticated client (not supabaseAdmin) so RLS's
  // `auth.uid() = auth_user_id` check applies exactly like a normal
  // onboarding submission — this isn't a service-role bypass of that rule.
  const { data: newTrainer, error: trainerError } = await supabase
    .from('trainers')
    .insert({
      name: pending.name,
      slug: pending.slug,
      auth_user_id: userId,
      email,
      bio: pending.bio,
      trial_ends_at: trialEndsAt,
    })
    .select()
    .single();

  if (trainerError || !newTrainer) {
    // Most likely cause: someone else claimed this slug between the demo
    // and the magic-link click landing here. Leave the pending row in place
    // so the user doesn't lose their demo data — /onboarding lets them pick
    // a new slug and finish manually.
    return NextResponse.redirect(new URL('/onboarding?error=slug_taken', req.url));
  }

  const selectedCells = Array.isArray(pending.schedule_data?.selectedCells)
    ? pending.schedule_data.selectedCells
    : [];
  const rules = extractAvailabilityRules(selectedCells);

  if (rules.length > 0) {
    const { error: rulesError } = await supabase.from('availability_rules').insert(
      rules.map((rule) => ({
        trainer_id: newTrainer.id,
        day_of_week: rule.day_of_week,
        start_time: rule.start_time,
        end_time: rule.end_time,
      }))
    );
    // Non-fatal — the account itself is created either way, and the trainer
    // can still fill in a schedule from the dashboard.
    if (rulesError) console.error('Failed to save demo availability rules:', rulesError);
  }

  await supabaseAdmin.from('pending_onboarding').delete().eq('id', pending.id);

  return NextResponse.redirect(new URL('/dashboard?welcome=true', req.url));
}