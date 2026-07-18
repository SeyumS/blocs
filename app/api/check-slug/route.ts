import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidSlug } from '@/lib/slug';

// Plain anon-key client rather than the browser client from lib/supabase.ts
// — this runs in a route handler, not a browser, so there's no window/
// localStorage to back session persistence.
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const { slug } = await req.json();

  if (!isValidSlug(slug)) {
    return NextResponse.json({ available: false, error: 'invalid_slug' }, { status: 400 });
  }

  // trainer_public_profiles is anon-readable by design (the booking page
  // already queries it the same way) — trainers itself is RLS-locked to
  // auth_user_id = auth.uid(), so it can't be used for this check.
  const { data } = await supabaseAnon
    .from('trainer_public_profiles')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  return NextResponse.json({ available: !data });
}
