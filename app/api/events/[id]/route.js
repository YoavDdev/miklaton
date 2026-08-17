import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireEventAccess } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const stripPhones = (p) => {
  const { phone, guest_phone, ...rest } = p;
  return rest;
};

// GET - get single event with participants and journal
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const access = await requireEventAccess(request, id);
    if (access.error) return access.error;

    const [participantsRes, journalRes] = await Promise.all([
      supabase.from('event_participants').select('*').eq('event_id', id).order('joined_at'),
      supabase.from('event_journal').select('*').eq('event_id', id).order('created_at', { ascending: true }),
    ]);

    const participants = access.guest
      ? (participantsRes.data || []).map(stripPhones)
      : (participantsRes.data || []);

    return NextResponse.json({
      success: true,
      data: {
        event: access.event,
        participants,
        journal: journalRes.data || [],
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
