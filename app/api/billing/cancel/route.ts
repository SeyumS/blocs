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
    .select('id, stripe_subscription_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!trainer?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
  }

  const subscription = await stripe.subscriptions.update(trainer.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  // Reflect the "pending cancellation" state right away, don't wait for the webhook
  await supabase
    .from('trainers')
    .update({ subscription_status: 'cancelling' })
    .eq('id', trainer.id);

  // Stripe Basil+: period end lives on subscription items; cancel_at is set
  // when cancel_at_period_end is true.
  const periodEnd =
    subscription.cancel_at ?? subscription.items.data[0]?.current_period_end;

  if (!periodEnd) {
    return NextResponse.json(
      { error: 'Could not determine cancellation date' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    cancelsAt: new Date(periodEnd * 1000).toISOString(),
  });
}