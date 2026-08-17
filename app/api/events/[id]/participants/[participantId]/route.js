import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireEventAccess } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// PATCH - update participant (field status / display name)
export async function PATCH(request, { params }) {
  try {
    const { id: eventId, participantId } = await params;

    const access = await requireEventAccess(request, eventId);
    if (access.error) return access.error;

    if (access.event.status === 'closed') {
      return NextResponse.json({ success: false, error: 'Event is closed' }, { status: 400 });
    }

    const body = await request.json();
    const updates = {};
    if (body.field_status !== undefined) {
      updates.field_status = body.field_status;
      updates.field_status_updated_at = new Date().toISOString();
    }
    if (body.display_name !== undefined) {
      if (!access.user) {
        return NextResponse.json({ success: false, error: 'אין הרשאה לשינוי שם' }, { status: 403 });
      }
      if (body.display_name.length > 80) {
        return NextResponse.json({ success: false, error: 'שם ארוך מדי' }, { status: 400 });
      }
      updates.display_name = body.display_name;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('event_participants')
      .update(updates)
      .eq('id', participantId)
      .eq('event_id', eventId)
      .select()
      .single();

    if (error) throw error;

    if (access.guest && data) {
      const { phone, guest_phone, ...rest } = data;
      return NextResponse.json({ success: true, data: rest });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
