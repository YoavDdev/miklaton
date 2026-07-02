import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - fetch daily order for a specific date
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');
    const orderDate = searchParams.get('order_date');

    if (!departmentId || !orderDate) {
      return NextResponse.json({ success: false, error: 'department_id and order_date required' }, { status: 400 });
    }

    // Get or create the daily order
    let { data: order, error } = await supabase
      .from('security_daily_orders')
      .select('*')
      .eq('department_id', departmentId)
      .eq('order_date', orderDate)
      .single();

    if (error && error.code === 'PGRST116') {
      // Not found - return empty
      return NextResponse.json({ success: true, data: null, entries: [] });
    }
    if (error) throw error;

    // Get entries
    const { data: entries, error: entriesError } = await supabase
      .from('security_daily_order_entries')
      .select(`
        *,
        staff:security_staff(*)
      `)
      .eq('order_id', order.id)
      .order('category')
      .order('display_order');

    if (entriesError) throw entriesError;

    return NextResponse.json({ success: true, data: order, entries: entries || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - create or update daily order with entries
export async function POST(request) {
  try {
    const body = await request.json();
    const { department_id, order_date, general_notes, signoff_message, entries } = body;

    if (!department_id || !order_date) {
      return NextResponse.json({ success: false, error: 'department_id and order_date required' }, { status: 400 });
    }

    // Upsert the daily order
    const { data: order, error: orderError } = await supabase
      .from('security_daily_orders')
      .upsert({
        department_id,
        order_date,
        general_notes: general_notes || '',
        signoff_message: signoff_message || 'יום טוב לכולם, סעו בזהירות, שמרו על עצמכם',
        updated_at: new Date().toISOString()
      }, { onConflict: 'department_id,order_date' })
      .select()
      .single();

    if (orderError) throw orderError;

    // If entries provided, delete old ones and insert new
    if (entries && Array.isArray(entries)) {
      // Delete existing entries
      await supabase
        .from('security_daily_order_entries')
        .delete()
        .eq('order_id', order.id);

      // Insert new entries
      if (entries.length > 0) {
        const entriesToInsert = entries.map((entry, idx) => ({
          order_id: order.id,
          staff_id: entry.staff_id || null,
          staff_name: entry.staff_name || null,
          category: entry.category || 'פיקוח',
          role_title: entry.role_title || 'פיקוח עירוני',
          vehicle: entry.vehicle || null,
          start_time: entry.start_time || '07:00',
          end_time: entry.end_time || '15:00',
          is_backup: entry.is_backup || false,
          tasks: entry.tasks || [],
          special_notes: entry.special_notes || null,
          display_order: idx
        }));

        const { error: insertError } = await supabase
          .from('security_daily_order_entries')
          .insert(entriesToInsert);

        if (insertError) throw insertError;
      }
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - update only the daily order metadata (notes, signoff)
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, general_notes, signoff_message } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (general_notes !== undefined) updateData.general_notes = general_notes;
    if (signoff_message !== undefined) updateData.signoff_message = signoff_message;

    const { data, error } = await supabase
      .from('security_daily_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
