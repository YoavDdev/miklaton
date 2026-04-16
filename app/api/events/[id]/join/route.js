import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// POST - join event for authenticated user
export async function POST(request, { params }) {
  try {
    const { id: eventId } = params;
    const body = await request.json();
    const { user_id, display_name, role, department, phone } = body;

    if (!user_id) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_id)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID format' }, { status: 400 });
    }

    // If display_name is a UUID or empty, fetch real name from user_profiles
    let finalDisplayName = display_name;
    if (!display_name || uuidRegex.test(display_name)) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user_id)
        .single();
      
      if (profile?.full_name) {
        finalDisplayName = profile.full_name;
      } else {
        finalDisplayName = 'משתמש'; // Fallback
      }
    }

    // Check if event exists
    const { data: event, error: eventError } = await supabase
      .from('emergency_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    // Check if already a participant
    const { data: existingParticipant } = await supabase
      .from('event_participants')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user_id)
      .single();

    if (existingParticipant) {
      return NextResponse.json({
        success: true,
        data: existingParticipant,
        message: 'already_joined',
      });
    }

    // Add new participant
    const participantData = {
      event_id: eventId,
      user_id,
      display_name: finalDisplayName,
      role: role || 'participant',
      department: department || null,
      phone: phone || null,
      status: 'confirmed',
      field_status: null, // No default - user must choose initial status
      joined_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('event_participants')
      .insert(participantData)
      .select()
      .single();

    if (error) throw error;

    // Add journal entry
    await supabase.from('event_journal').insert({
      event_id: eventId,
      participant_id: data.id,
      author_name: finalDisplayName,
      author_role: role || 'participant',
      entry_type: 'system',
      content: `${finalDisplayName} הצטרף/ה לאירוע`,
    });

    return NextResponse.json({ 
      success: true, 
      data, 
      message: 'joined' 
    });

  } catch (error) {
    console.error('Join event error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
