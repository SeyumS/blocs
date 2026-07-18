import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Public booking / waitlist pages call this without a logged-in user, so use
// the service role (same pattern as /api/book).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { name, clientId } = await req.json();

  if (!clientId || !name || !String(name).trim()) {
    return NextResponse.json({ error: 'Name and clientId required' }, { status: 400 });
  }

  const { data: clientData, error: clientError } = await supabaseAdmin
    .from('clients')
    .update({ name: String(name).trim() })
    .eq('id', clientId)
    .select()
    .single();

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, client: clientData }, { status: 200 });
}
