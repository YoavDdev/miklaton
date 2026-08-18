import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { supabase } from '@/lib/supabase-server';

const normalizePhone = (p) => (p || '').replace(/[-\s]/g, '');

// GET - כל נתוני האירוע לדף האורח. הטוקן בנתיב הוא האישור.
export async function GET(request, { params }) {
  try {
    // מוגבל גבוה: מכשירים מאחורי CGNAT של ספקים סלולריים חולקים IP בין
    // עשרות אורחים בו-זמנית, והדף הזה פועל בפולינג של 6 בקשות לדקה למשתמש + כתיבות
    const limited = rateLimit(request, 'event-live', { limit: 300, windowMs: 60_000 });
    if (limited) return limited;

    const { token } = await params;
    const { searchParams } = new URL(request.url);
    const phone = normalizePhone(searchParams.get('phone'));

    const { data: event } = await supabase
      .from('emergency_events')
      .select('*')
      .eq('invite_token', token)
      .single();

    if (!event) {
      return NextResponse.json({ success: false, error: 'אירוע לא נמצא' }, { status: 404 });
    }

    const [participantsRes, journalRes] = await Promise.all([
      supabase.from('event_participants').select('*').eq('event_id', event.id).order('joined_at'),
      supabase.from('event_journal').select('*').eq('event_id', event.id).order('created_at', { ascending: true }),
    ]);

    const all = participantsRes.data || [];
    const myParticipant = phone
      ? all.find((p) => normalizePhone(p.phone) === phone || normalizePhone(p.guest_phone) === phone) || null
      : null;

    const participants = all.map(({ phone: _p, guest_phone: _g, ...rest }) => rest);

    return NextResponse.json({
      success: true,
      data: { event, journal: journalRes.data || [], participants, myParticipant },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
