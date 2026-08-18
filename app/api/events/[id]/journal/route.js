import { NextResponse } from 'next/server';
import { requireEventAccess } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

const MAX_CONTENT_LENGTH = 5000;
const ALLOWED_ENTRY_TYPES = ['update', 'urgent', 'decision', 'task', 'location', 'quick', 'map_marker'];

// POST - add journal entry (identity is derived server-side)
export async function POST(request, { params }) {
  try {
    const { id: event_id } = await params;

    const access = await requireEventAccess(request, event_id);
    if (access.error) return access.error;

    if (access.event.status === 'closed') {
      return NextResponse.json({ success: false, error: 'Event is closed' }, { status: 400 });
    }

    const body = await request.json();
    const { entry_type, content, participant_id, image_url, location_lat, location_lng, location_address, assigned_to, task_status } = body;

    if (!content && !image_url) {
      return NextResponse.json({ success: false, error: 'Content or image required' }, { status: 400 });
    }
    if (content && content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ success: false, error: `תוכן ארוך מדי (מקסימום ${MAX_CONTENT_LENGTH} תווים)` }, { status: 400 });
    }

    // זהות הכותב נקבעת בשרת - לא מה-body
    let author_name, author_role, author_field_status = null, resolvedParticipantId = null;

    if (access.user) {
      const { data: profile } = await supabase
        .from('user_profiles').select('full_name').eq('id', access.user.userId).single();
      author_name = profile?.full_name || access.user.fullName || 'לא ידוע';
      author_role = access.user.role;
      if (participant_id) {
        const { data: p } = await supabase
          .from('event_participants').select('id, field_status').eq('id', participant_id).eq('event_id', event_id).single();
        if (p) { resolvedParticipantId = p.id; author_field_status = p.field_status || null; }
      }
    } else {
      // אורח: חייב participant_id ששייך לאירוע הזה
      if (!participant_id) {
        return NextResponse.json({ success: false, error: 'participant_id required' }, { status: 400 });
      }
      const { data: p } = await supabase
        .from('event_participants')
        .select('id, display_name, role, department, field_status')
        .eq('id', participant_id).eq('event_id', event_id).single();
      if (!p) {
        return NextResponse.json({ success: false, error: 'משתתף לא נמצא באירוע' }, { status: 403 });
      }
      resolvedParticipantId = p.id;
      author_name = p.display_name;
      author_role = p.department || p.role || null;
      author_field_status = p.field_status || null;
    }

    const safeEntryType = ALLOWED_ENTRY_TYPES.includes(entry_type) ? entry_type : 'update';

    const { data, error } = await supabase
      .from('event_journal')
      .insert({
        event_id,
        participant_id: resolvedParticipantId,
        author_name,
        author_role,
        entry_type: safeEntryType,
        content: content || '',
        image_url: image_url || null,
        location_lat: location_lat || null,
        location_lng: location_lng || null,
        location_address: location_address || null,
        assigned_to: assigned_to || null,
        task_status: safeEntryType === 'task' ? (task_status || 'pending') : null,
        author_field_status,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
