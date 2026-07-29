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
      change_type,    // 'end_time_change', 'time_change', 'replaced', 'removed', 'restored'
      new_start_time,
      new_end_time,
      new_staff_name,
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
    const updateData = {};
    let auditReason = reason || '';

    // Apply changes based on type
    switch (change_type) {
      // Time edits are plain updates: just change the time, keep the shift as-is.
      // No "modified" flag / strikethrough — history is still kept in the audit table below.
      case 'end_time_change':
        if (!new_end_time) {
          return NextResponse.json({ success: false, error: 'new_end_time required for end_time_change' }, { status: 400 });
        }
        updateData.end_time = new_end_time;
        updateData.is_modified = false;
        updateData.modification_note = null;
        updateData.original_start_time = null;
        updateData.original_end_time = null;
        break;

      case 'time_change':
        if (new_start_time) updateData.start_time = new_start_time;
        if (new_end_time) updateData.end_time = new_end_time;
        updateData.is_modified = false;
        updateData.modification_note = null;
        updateData.original_start_time = null;
        updateData.original_end_time = null;
        break;

      case 'replaced':
        if (!new_staff_name || !new_staff_name.trim()) {
          return NextResponse.json({ success: false, error: 'new_staff_name required for replaced' }, { status: 400 });
        }
        // Remember who was originally assigned (only on the first replacement)
        if (!entry.original_staff_name) {
          updateData.original_staff_name = entry.staff_name;
          updateData.original_staff_id = entry.staff_id;
        }
        updateData.staff_name = new_staff_name.trim();
        updateData.staff_id = null; // replacement is entered as free text
        updateData.is_modified = true;
        updateData.modification_note = reason || '';
        auditReason = `החלפה: ${entry.staff_name || '—'} ← ${new_staff_name.trim()}${reason ? ' · ' + reason : ''}`;
        break;

      case 'removed':
        updateData.is_removed = true;
        updateData.is_modified = true;
        updateData.modification_note = reason || '';
        // Keep the original times so the removed shift stays visible / restorable
        if (!entry.original_start_time) updateData.original_start_time = entry.start_time;
        if (!entry.original_end_time) updateData.original_end_time = entry.end_time;
        break;

      case 'restored':
        updateData.is_removed = false;
        updateData.is_modified = false;
        // Restore original times if they were saved
        if (entry.original_start_time) updateData.start_time = entry.original_start_time;
        if (entry.original_end_time) updateData.end_time = entry.original_end_time;
        // Restore original staff member if this was a replacement
        if (entry.original_staff_name) {
          updateData.staff_name = entry.original_staff_name;
          updateData.staff_id = entry.original_staff_id;
        }
        updateData.original_start_time = null;
        updateData.original_end_time = null;
        updateData.original_staff_name = null;
        updateData.original_staff_id = null;
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
        reason: auditReason,
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
