import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// POST - Send contact on vacation
export async function POST(request, { params }) {
  try {
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { contact_id, vacation_start, vacation_end, reason, replacement_contact_id, replacement_note } = body;

    if (!contact_id || !vacation_start || !vacation_end) {
      return NextResponse.json(
        { error: 'contact_id, vacation_start, and vacation_end required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('call_category_contacts')
      .update({
        on_vacation: true,
        vacation_start,
        vacation_end,
        vacation_reason: reason || 'חופש',
        replacement_contact_id: replacement_contact_id || null,
        replacement_note: replacement_note || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', contact_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'כונן נשלח לחופש',
      contact: data
    });

  } catch (error) {
    console.error('Error sending contact on vacation:', error);
    return NextResponse.json(
      { error: 'Failed to send contact on vacation', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Return contact from vacation
export async function DELETE(request, { params }) {
  try {
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');

    if (!contactId) {
      return NextResponse.json({ error: 'contact_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('call_category_contacts')
      .update({
        on_vacation: false,
        replacement_contact_id: null,
        replacement_note: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'כונן חזר מחופש',
      contact: data
    });

  } catch (error) {
    console.error('Error returning contact from vacation:', error);
    return NextResponse.json(
      { error: 'Failed to return contact from vacation', details: error.message },
      { status: 500 }
    );
  }
}
