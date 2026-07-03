import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function syncShabbatObserverToContacts(supabase, name, phone, isObserver) {
  if (!name || !phone) return;
  try {
    const normalizedPhone = phone.replace(/\D/g, '');
    const { data: matches } = await supabase
      .from('contacts')
      .select('id, phone')
      .ilike('full_name', name.trim());
    const contact = matches?.find(c => c.phone.replace(/\D/g, '') === normalizedPhone);
    if (contact) {
      await supabase.from('contacts').update({ shabbat_observer: !!isObserver }).eq('id', contact.id);
    }
  } catch (err) {
    console.error('Failed to sync shabbat_observer to contacts:', err);
  }
}

// PUT - Update contact
export async function PUT(request, { params }) {
  try {
    const { id: categoryId, contactId } = params;
    const body = await request.json();
    const shabbatObserver = body.shabbat_observer || false;

    const { error } = await supabase
      .from('call_category_contacts')
      .update({
        external_name: body.external_name,
        external_phone: body.external_phone,
        external_role: body.external_role,
        escalation_order: body.escalation_order,
        note: body.note,
        hours: body.hours,
        is_primary: body.is_primary,
        available_days: body.available_days,
        available_hours_start: body.available_hours_start || null,
        available_hours_end: body.available_hours_end || null,
        priority_order: body.priority_order,
        contact_type: body.contact_type,
        notes_for_operator: body.notes_for_operator,
        shabbat_observer: shabbatObserver,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .eq('call_category_id', categoryId);

    if (error) throw error;

    await syncShabbatObserverToContacts(supabase, body.external_name, body.external_phone, shabbatObserver);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete contact
export async function DELETE(request, { params }) {
  try {
    const { id: categoryId, contactId } = params;

    const { error } = await supabase
      .from('call_category_contacts')
      .delete()
      .eq('id', contactId)
      .eq('call_category_id', categoryId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
