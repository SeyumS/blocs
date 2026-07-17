import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
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
    .select('id, stripe_subscription_id, subscription_status')
    .eq('auth_user_id', user.id)
    .single();

  if (!trainer?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
  }

  if (trainer.subscription_status !== 'cancelling') {
    return NextResponse.json({ error: 'Subscription is not pending cancellation' }, { status: 400 });
  }

  await stripe.subscriptions.update(trainer.stripe_subscription_id, {
    cancel_at_period_end: false,
  });

  // Reflect it immediately, webhook will confirm shortly after
  await supabase
    .from('trainers')
    .update({ subscription_status: 'active' })
    .eq('id', trainer.id);

  return NextResponse.json({ resumed: true });
}