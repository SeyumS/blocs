import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidSlug } from '@/lib/slug';

// Service role required: pending_onboarding has RLS enabled with zero
// policies, so anon/authenticated get no access at all — only this key
// can read or write it.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { email, name, slug, bio, selectedCells } = await req.json();

  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
  }
  if (!Array.isArray(selectedCells)) {
    return NextResponse.json({ error: 'invalid_schedule' }, { status: 400 });
  }

  // The client already checked /api/check-slug, but that was against a
  // point-in-time snapshot — re-check here against the real table (bypassing
  // the RLS-restricted anon view) right before we persist anything.
  const { data: existingTrainer } = await supabaseAdmin
    .from('trainers')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existingTrainer) {
    return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
  }

  // Replace any earlier unclaimed attempt from this email so a re-submitted
  // demo doesn't leave stale rows behind.
  await supabaseAdmin.from('pending_onboarding').delete().eq('email', email);

  const { error: insertError } = await supabaseAdmin.from('pending_onboarding').insert({
    email,
    name: name.trim(),
    slug,
    bio: typeof bio === 'string' ? bio.trim() : null,
    schedule_data: { selectedCells },
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
