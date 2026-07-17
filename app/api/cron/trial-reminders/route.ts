import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { addDays, format } from 'date-fns';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: Request) {
  // Protect this route — only your scheduler should be able to trigger it
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find trainers whose trial ends in exactly 5 days, still on trial, haven't been reminded yet
  const targetDate = format(addDays(new Date(), 5), 'yyyy-MM-dd');

  const { data: trainers, error } = await supabaseAdmin
    .from('trainers')
    .select('id, name, email, trial_ends_at, trial_reminder_sent')
    .eq('subscription_status', 'trial')
    .eq('trial_reminder_sent', false)
    .gte('trial_ends_at', `${targetDate}T00:00:00`)
    .lt('trial_ends_at', `${targetDate}T23:59:59`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!trainers || trainers.length === 0) return NextResponse.json({ sent: 0 });

  await Promise.all(
    trainers.map(async (trainer) => {
      await resend.emails.send({
        from: 'noreply@blocksbooking.com',
        to: trainer.email,
        subject: 'Your trial ends in 5 days',
        html: `
          <p>Hi ${trainer.name},</p>
          <p>Your free trial ends on ${format(new Date(trainer.trial_ends_at), 'EEEE, MMM d')}.</p>
          <p>Add your card now so your booking page and dashboard keep running without interruption —
             you won't be charged until your trial actually ends.</p>
          <p><a href="localhost:3000/billing/add-card-early">
            Add your card now
          </a></p>
        `,
      });

      await supabaseAdmin
        .from('trainers')
        .update({ trial_reminder_sent: true })
        .eq('id', trainer.id);
    })
  );

  return NextResponse.json({ sent: trainers.length });
}