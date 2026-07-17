import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// For Server Components / Route Handlers that need the signed-in trainer's
// own session (so RLS policies scoped to auth.uid() apply). The plain
// `supabase` client in lib/supabase.ts is browser-only and has no access to
// the request's cookies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components can't write cookies (no response to attach
            // them to) — only Route Handlers/Server Actions can. Harmless
            // here since we're only reading the session, not refreshing it.
          }
        },
      },
    }
  );
}
