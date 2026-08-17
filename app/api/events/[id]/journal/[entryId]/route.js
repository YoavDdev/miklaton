import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireEventAccess } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
    if (body.task_status !== undefined) updates.task_status = body.task_status;
    if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to;

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
