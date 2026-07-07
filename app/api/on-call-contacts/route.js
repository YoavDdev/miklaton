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

// POST - Create new on-call contact
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, phone, municipality_id, department_id } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'name and phone are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('on_call_contacts')
      .insert({
        name,
        phone,
        municipality_id,
        department_id,
        active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contact: data
    });
  } catch (error) {
    console.error('Error creating on-call contact:', error);
    return NextResponse.json(
      { error: 'Failed to create on-call contact', details: error.message },
      { status: 500 }
    );
  }
}
