import { NextResponse } from 'next/server';
import { requireEventAccess } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

// PATCH - update journal entry (pin, task status, assignment)
export async function PATCH(request, { params }) {
  try {
    const { id: eventId, entryId } = await params;

    const access = await requireEventAccess(request, eventId);
    if (access.error) return access.error;
    if (access.event.status === 'closed') {
      return NextResponse.json({ success: false, error: 'Event is closed' }, { status: 400 });
    }

    const body = await request.json();
    const updates = {};
    if (typeof body.is_pinned === 'boolean') updates.is_pinned = body.is_pinned;
    if (body.task_status !== undefined) updates.task_status = String(body.task_status).slice(0, 40);
    if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to === null ? null : String(body.assigned_to).slice(0, 120);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('event_journal')
      .update(updates)
      .eq('id', entryId)
      .eq('event_id', eventId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - remove a map marker entry only
export async function DELETE(request, { params }) {
  try {
    const { id: eventId, entryId } = await params;

    const access = await requireEventAccess(request, eventId);
    if (access.error) return access.error;
    if (access.event.status === 'closed') {
      return NextResponse.json({ success: false, error: 'Event is closed' }, { status: 400 });
    }

    const { error } = await supabase
      .from('event_journal')
      .delete()
      .eq('id', entryId)
      .eq('event_id', eventId)
      .eq('entry_type', 'map_marker');

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
