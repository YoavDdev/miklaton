import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth';

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
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { name, phone, municipality_id, department_id, on_vacation, vacation_start, vacation_end, vacation_reason, replacement_contact_id, replacement_note } = body;

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
        active: true,
        ...(on_vacation !== undefined && { on_vacation }),
        ...(vacation_start && { vacation_start }),
        ...(vacation_end && { vacation_end }),
        ...(vacation_reason && { vacation_reason }),
        ...(replacement_contact_id && { replacement_contact_id }),
        ...(replacement_note && { replacement_note })
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
