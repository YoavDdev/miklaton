import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// POST - Add contact to category
export async function POST(request, { params }) {
  try {
    // TODO: Re-enable authentication after testing
    // const authResult = await verifyAuth(request);
    // if (!authResult.valid) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { id: categoryId } = params;
    const body = await request.json();
    
    const {
      contact_id,
      external_name,
      external_phone,
      external_role,
      escalation_order,
      note,
      hours,
      is_primary,
      available_days,
      available_hours_start,
      available_hours_end,
      priority_order,
      contact_type,
      notes_for_operator
    } = body;

    if (!escalation_order) {
      return NextResponse.json(
        { error: 'escalation_order is required' },
        { status: 400 }
      );
    }

    const insertData = {
      call_category_id: categoryId,
      contact_id: contact_id || null,
      external_name: external_name || null,
      external_phone: external_phone || null,
      external_role: external_role || null,
      escalation_order,
      note: note || null,
      hours: hours || null,
      is_primary: is_primary || false,
      active: true,
      priority_order: priority_order || escalation_order,
      contact_type: contact_type || 'escalation',
      notes_for_operator: notes_for_operator || null,
      available_days: available_days?.length > 0 ? available_days : null,
      available_hours_start: available_hours_start || null,
      available_hours_end: available_hours_end || null,
    };

    const { data, error } = await supabase
      .from('call_category_contacts')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'כונן נוסף לקטגוריה בהצלחה',
      contact: data
    });

  } catch (error) {
    console.error('Error adding contact to category:', error);
    return NextResponse.json(
      { error: 'Failed to add contact', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update contact in category
export async function PUT(request, { params }) {
  try {
    // TODO: Re-enable authentication after testing
    // const authResult = await verifyAuth(request);
    // if (!authResult.valid) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const { contact_id, ...updates } = body;

    if (!contact_id) {
      return NextResponse.json({ error: 'contact_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('call_category_contacts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', contact_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'כונן עודכן בהצלחה',
      contact: data
    });

  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Failed to update contact', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove contact from category
export async function DELETE(request, { params }) {
  try {
    // TODO: Re-enable authentication after testing
    // const authResult = await verifyAuth(request);
    // if (!authResult.valid) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');

    if (!contactId) {
      return NextResponse.json({ error: 'contact_id required' }, { status: 400 });
    }

    // Soft delete
    const { error } = await supabase
      .from('call_category_contacts')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', contactId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'כונן הוסר מהקטגוריה בהצלחה'
    });

  } catch (error) {
    console.error('Error removing contact:', error);
    return NextResponse.json(
      { error: 'Failed to remove contact', details: error.message },
      { status: 500 }
    );
  }
}
