import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // never expose this to the client
);

export async function POST(req: Request){
  const { email, phone, trainerId, start } = await req.json();
  let client = null;
  if(email){
  const { data: clientData, error: clientError } = await supabaseAdmin.from('clients').select('*').eq('trainer_id', trainerId).eq('email', email).maybeSingle();
  if(clientError){
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }
  if(clientData){
  client = clientData;
  }
  } else if(phone){
    const { data: clientData, error: clientError } = await supabaseAdmin.from('clients').select('*').eq('trainer_id', trainerId).eq('phone', phone).maybeSingle();
    if(clientError){
      console.log(clientError);
      return NextResponse.json({ error: 'Client already exists' }, { status: 400 });
    }
    if(clientData){
    client = clientData;
    }
  } 
  let notInDataBase = false;
  if(!client){
    const { data: clientData, error: clientError } = (await supabaseAdmin.from('clients').insert({ trainer_id: trainerId, email: email, phone: phone, name: "anonymous Client"}).select('*').single());
    if(clientError){
      console.log(clientError);
      return NextResponse.json({ error: clientError.message }, { status: 500 });
    }
    if(clientData){
      notInDataBase = true;
    client = clientData;
    }
  }
  const startIso = new Date(start).toISOString();

  const { data: waitListEntry, error: waitListEntryError } = await supabaseAdmin
    .from('waitlist_entries')
    .select('id')
    .eq('client_id', client.id)
    .eq('trainer_id', trainerId)
    .eq('desired_starts_at', startIso)
    .in('status', ['waiting', 'notified'])
    .maybeSingle();
  if(waitListEntryError){
    return NextResponse.json({ error: waitListEntryError.message }, { status: 500 });
  }
  if(waitListEntry){
    return NextResponse.json({ error: 'You are already in the waiting list' }, { status: 400 });
  }
  const { error: waitingListError } = await supabaseAdmin.from('waitlist_entries').insert({ client_id: client.id, trainer_id: trainerId, desired_starts_at: startIso }).select();
  if(waitingListError){
    console.log(waitingListError);
    return NextResponse.json({ error: waitingListError.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, inDataBase: notInDataBase, client: client },{status: 200});
}