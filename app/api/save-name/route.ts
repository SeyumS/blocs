import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST (req: Request){
  const { name, clientId } = await req.json();
  const supabase = await createClient();
  const { data: clientData, error: clientError } = await supabase.from('clients').update({ name: name }).eq('id', clientId).select();
  if(clientError){
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, client: clientData },{status: 200});
}