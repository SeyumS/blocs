import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refreshes the Supabase auth session on every matched request and writes
// the renewed cookies back onto the response. Without this, a session that
// expires mid-visit just fails silently in Server Components (which can't
// write cookies themselves) instead of being renewed.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching getUser() is what actually triggers the refresh-token exchange
  // when the access token has expired.
  const { data: { user } } = await supabase.auth.getUser();

  // Trial/billing gate. Scoped to these two prefixes (not the whole site,
  // even though this proxy runs on nearly every request) so an expired
  // trial doesn't block the public booking page, login, etc. — only the
  // authenticated app surface where it matters.
  const isGatedPath =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/onboarding');

  if (user && isGatedPath) {
    const { data: trainer } = await supabase
      .from('trainers')
      .select('trial_ends_at, subscription_status')
      .eq('auth_user_id', user.id)
      .single();

    const trialExpired = !!trainer?.trial_ends_at && new Date(trainer.trial_ends_at) < new Date();
    const needsPayment = trialExpired && trainer?.subscription_status !== 'active';

    if (needsPayment) {
      const redirectResponse = NextResponse.redirect(new URL('/billing', request.url));
      // Carry over any refreshed session cookies so the redirect doesn't
      // silently drop the just-renewed session.
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
      return redirectResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
