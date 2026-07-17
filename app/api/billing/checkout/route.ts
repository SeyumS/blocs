import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const cookieStore = await  cookies();
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
    .select('id, email, stripe_customer_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!trainer) return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });

  // Reuse existing Stripe customer if we already made one (e.g. failed payment retry)
  let customerId = trainer.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: trainer.email,
      metadata: { trainer_id: trainer.id },
    });
    customerId = customer.id;

    await supabase
      .from('trainers')
      .update({ stripe_customer_id: customerId })
      .eq('id', trainer.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?checkout=cancelled`,
    // Since this is post-trial, charge immediately — no need for Stripe's own trial period here,
    // your app already tracked the 30-day trial itself
  });

  return NextResponse.json({ url: session.url });
}