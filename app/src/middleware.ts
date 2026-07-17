import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

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
  if (!user) return res; // let the existing auth guard handle unauthenticated cases

  const { data: trainer } = await supabase
    .from('trainers')
    .select('trial_ends_at, subscription_status')
    .eq('auth_user_id', user.id)
    .single();

  if (!trainer) return res;

  const trialExpired = trainer.trial_ends_at && new Date(trainer.trial_ends_at) < new Date();
  const needsPayment = trialExpired && trainer.subscription_status !== 'active';

  if (needsPayment && !req.nextUrl.pathname.startsWith('/billing')) {
    return NextResponse.redirect(new URL('/billing', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding/:path*'],
};