import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// PATCH - update a single entry (change times, remove, etc.) + log the change
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { 
      entry_id, 
      change_type,    // 'end_time_change', 'time_change', 'removed', 'restored'
      new_start_time, 
      new_end_time,
      reason,
      requested_by,
      changed_by 
    } = body;

    if (!entry_id || !change_type) {
      return NextResponse.json({ success: false, error: 'entry_id and change_type required' }, { status: 400 });
    }

    // Fetch current entry
    const { data: entry, error: fetchError } = await supabase
      .from('security_daily_order_entries')
      .select('*')
      .eq('id', entry_id)
      .single();

    if (fetchError) throw fetchError;

    // Prepare update data
    const updateData = {
      is_modified: true,
      modification_note: reason || ''
    };

    // Store originals if not already stored
    if (!entry.original_start_time) {
      updateData.original_start_time = entry.start_time;
    }
    if (!entry.original_end_time) {
      updateData.original_end_time = entry.end_time;
    }

    // Apply changes based on type
    switch (change_type) {
      case 'end_time_change':
        if (!new_end_time) {
          return NextResponse.json({ success: false, error: 'new_end_time required for end_time_change' }, { status: 400 });
        }
        updateData.end_time = new_end_time;
        break;

      case 'time_change':
        if (new_start_time) updateData.start_time = new_start_time;
        if (new_end_time) updateData.end_time = new_end_time;
        break;

      case 'removed':
        updateData.is_removed = true;
        break;

      case 'restored':
        updateData.is_removed = false;
        updateData.is_modified = false;
        // Restore original times if they were saved
        if (entry.original_start_time) updateData.start_time = entry.original_start_time;
        if (entry.original_end_time) updateData.end_time = entry.original_end_time;
        updateData.original_start_time = null;
        updateData.original_end_time = null;
        updateData.modification_note = null;
        break;

      default:
        return NextResponse.json({ success: false, error: `Unknown change_type: ${change_type}` }, { status: 400 });
    }

    // Update the entry
    const { data: updated, error: updateError } = await supabase
      .from('security_daily_order_entries')
      .update(updateData)
      .eq('id', entry_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log the change in audit table
    const { error: logError } = await supabase
      .from('security_shift_changes')
      .insert({
        entry_id,
        order_id: entry.order_id,
        staff_id: entry.staff_id,
        staff_name: entry.staff_name,
        change_type,
        original_start_time: entry.original_start_time || entry.start_time,
        original_end_time: entry.original_end_time || entry.end_time,
        new_start_time: updateData.start_time || entry.start_time,
        new_end_time: updateData.end_time || entry.end_time,
        reason: reason || '',
        requested_by: requested_by || 'מחלקת ביטחון',
        changed_by: changed_by || 'מוקד עירוני'
      });

    if (logError) {
      console.error('Failed to log shift change:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET - get change history for an entry or order
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get('entry_id');
    const orderId = searchParams.get('order_id');

    let query = supabase
      .from('security_shift_changes')
      .select('*')
      .order('created_at', { ascending: false });

    if (entryId) {
      query = query.eq('entry_id', entryId);
    } else if (orderId) {
      query = query.eq('order_id', orderId);
    } else {
      return NextResponse.json({ success: false, error: 'entry_id or order_id required' }, { status: 400 });
    }

    const { data, error } = await query.limit(50);
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
