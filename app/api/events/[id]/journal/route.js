import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// POST - add journal entry
export async function POST(request, { params }) {
  try {
    const { id: event_id } = await params;
    const body = await request.json();
    
    // Extract all fields including author_field_status for historical tracking
    const { author_name, author_role, entry_type, content, participant_id, image_url, location_lat, location_lng, location_address, assigned_to, task_status, author_field_status } = body;

    if ((!content && !image_url) || !author_name) {
      return NextResponse.json({ success: false, error: 'Content or image and author required' }, { status: 400 });
    }

    // Verify event exists and is active
    const { data: event } = await supabase
      .from('emergency_events')
      .select('status')
      .eq('id', event_id)
      .single();

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    if (event.status === 'closed') {
      return NextResponse.json({ success: false, error: 'Event is closed' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('event_journal')
      .insert({
        event_id,
        participant_id: participant_id || null,
        author_name,
        author_role: author_role || null,
        entry_type: entry_type || 'update',
        content: content || '',
        image_url: image_url || null,
        location_lat: location_lat || null,
        location_lng: location_lng || null,
        location_address: location_address || null,
        assigned_to: assigned_to || null,
        task_status: entry_type === 'task' ? (task_status || 'pending') : null,
        author_field_status: author_field_status || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
