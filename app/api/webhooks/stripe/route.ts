import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await supabaseAdmin
        .from('trainers')
        .update({
          subscription_status: 'active',
          stripe_subscription_id: session.subscription as string,
        })
        .eq('stripe_customer_id', session.customer as string);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      let status = 'active';
      if (sub.cancel_at_period_end) status = 'cancelling';
      else if (sub.status !== 'active') status = 'past_due';

      await supabaseAdmin
        .from('trainers')
        .update({ subscription_status: status })
        .eq('stripe_customer_id', sub.customer as string);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabaseAdmin
        .from('trainers')
        .update({ subscription_status: 'cancelled' })
        .eq('stripe_customer_id', sub.customer as string);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await supabaseAdmin
        .from('trainers')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', invoice.customer as string);
      break;
    }
  }

  return NextResponse.json({ received: true });
}