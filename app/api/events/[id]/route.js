import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - get single event with participants and journal
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const [eventRes, participantsRes, journalRes] = await Promise.all([
      supabase.from('emergency_events').select('*').eq('id', id).single(),
      supabase.from('event_participants').select('*').eq('event_id', id).order('joined_at'),
      supabase.from('event_journal').select('*').eq('event_id', id).order('created_at', { ascending: true }),
    ]);

    if (eventRes.error) throw eventRes.error;

    return NextResponse.json({
      success: true,
      data: {
        event: eventRes.data,
        participants: participantsRes.data || [],
        journal: journalRes.data || [],
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
