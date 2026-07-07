import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - Get all on-call contacts
export async function GET(request) {
  try {
    const { data, error } = await supabase
      .from('on_call_contacts')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contacts: data || []
    });
  } catch (error) {
    console.error('Error fetching on-call contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch on-call contacts', details: error.message },
      { status: 500 }
    );
  }
}
