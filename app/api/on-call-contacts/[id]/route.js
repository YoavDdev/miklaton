import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// PATCH - Update on-call contact (e.g., return from vacation)
export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('on_call_contacts')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contact: data
    });
  } catch (error) {
    console.error('Error updating on-call contact:', error);
    return NextResponse.json(
      { error: 'Failed to update on-call contact', details: error.message },
      { status: 500 }
    );
  }
}
