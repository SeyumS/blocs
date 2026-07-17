import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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

  // This is the key check: does a trainer profile already exist?
  const { data: trainer } = await supabase
    .from('trainers')
    .select('id')
    .eq('auth_user_id', userId)
    .single();

  if (!trainer) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  return NextResponse.redirect(new URL('/dashboard', req.url));
}