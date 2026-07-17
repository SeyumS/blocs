import React from 'react'
import { createClient } from '@/lib/supabase/server';
import { CancelButtons } from './cancelButtons';
import { getThemeCssVars } from '@/lib/theme';



const Cancel = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from('bookings').select('*').eq('id', slug).single();
  const { data: trainerData, error: trainerError } = await supabase.from('trainers').select('*').eq('id', data.trainer_id).single();


  return (
    <div className="blocs-theme blocs-page" style={{ justifyContent: 'center', ...getThemeCssVars(trainerData?.theme_color) }}>
      <div className="blocs-card flex flex-col gap-4" style={{ padding: '32px 24px' }}>
        <h1 style={{ margin: 0, color: 'var(--blocs-text)', fontSize: '20px', fontWeight: 700 }}>Cancel booking</h1>
        <p style={{ margin: 0, color: 'var(--blocs-text-50)', fontSize: '13.5px' }}>
          Are you sure you want to cancel your booking? You can rebook afterwards.
        </p>
        <CancelButtons data={data} slug={trainerData.slug} />
      </div>
    </div>
  )
}

export default Cancel