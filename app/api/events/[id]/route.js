import { NextResponse } from 'next/server';
import { requireEventAccess } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

const stripPhones = (p) => {
  const { phone, guest_phone, ...rest } = p;
  return rest;
};

// GET - get single event with participants and journal.
// ?light=1 - גרסה קלה לבאנר: בלי משתתפים, רק 20 רשומות היומן האחרונות
// (מונע משיכת אירוע שלם + טלפונים כל 30 שניות מכל דשבורד פתוח)
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const access = await requireEventAccess(request, id);
    if (access.error) return access.error;

    const light = new URL(request.url).searchParams.get('light') === '1';

    if (light) {
      const { data: recent } = await supabase
        .from('event_journal')
        .select('id, author_name, content, entry_type, created_at')
        .eq('event_id', id)
        .order('created_at', { ascending: false })
        .limit(20);

      const { id: eventId, title, severity, status, event_type, created_at } = access.event;
      return NextResponse.json({
        success: true,
        data: {
          event: { id: eventId, title, severity, status, event_type, created_at },
          journal: (recent || []).reverse(),
        },
      });
    }

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
