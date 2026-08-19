import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - קבלת סשנים פעילים (רשימת כל המוקדנים המחוברים - למנהלת המוקד)
export async function GET(request) {
  try {
    const auth = await requireRole(request, ['shift_supervisor', 'call_center_manager']);
    if (auth.error) return auth.error;

    // רק מוקדנים פעילים - סשן שהיה פעיל ב-15 דקות האחרונות
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: sessions, error } = await supabase
      .from('operator_sessions')
      .select('*')
      .eq('is_active', true)
      .gte('last_activity', fifteenMinutesAgo)
      .order('last_activity', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ error: 'שגיאה בטעינת סשנים' }, { status: 500 });
    }

    // שלוף מידע משתמשים בנפרד - עם דה-דופליקציה לפי user_id
    if (sessions && sessions.length > 0) {
      // שמור רק את הסשן האחרון לכל user (כבר ממוין לפי last_activity desc)
      const uniqueSessionsMap = new Map();
      for (const session of sessions) {
        if (!uniqueSessionsMap.has(session.user_id)) {
          uniqueSessionsMap.set(session.user_id, session);
        }
      }
      const uniqueSessions = Array.from(uniqueSessionsMap.values());

      const userIds = uniqueSessions.map(s => s.user_id);
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .in('id', userIds);

      // צרף מידע משתמש לכל סשן
      const enrichedSessions = uniqueSessions.map(session => ({
        ...session,
        user: users?.find(u => u.id === session.user_id) || null
      }));

      return NextResponse.json({ sessions: enrichedSessions });
    }

    return NextResponse.json({ sessions: [] });

  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// POST - יצירת/עדכון סשן (heartbeat)
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['operator', 'shift_supervisor', 'call_center_manager']);
    if (auth.error) return auth.error;
    const decoded = auth.user;

    // בדוק אם יש סשנים פעילים (שימוש ב-limit במקום single כדי למנוע שגיאה בכפילויות)
    const { data: activeSessions } = await supabase
      .from('operator_sessions')
      .select('*')
      .eq('user_id', decoded.userId)
      .eq('is_active', true)
      .order('last_activity', { ascending: false });

    if (activeSessions && activeSessions.length > 0) {
      const latestSession = activeSessions[0];

      // סגור כפילויות - השאר רק את הסשן האחרון
      if (activeSessions.length > 1) {
        const duplicateIds = activeSessions.slice(1).map(s => s.id);
        const { error: closeError } = await supabase
          .from('operator_sessions')
          .update({ is_active: false, session_end: new Date().toISOString() })
          .in('id', duplicateIds);
        if (closeError) console.error('duplicate session close failed:', closeError);
      }

      // עדכן last_activity בסשן האחרון
      const { data, error } = await supabase
        .from('operator_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', latestSession.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating session:', error);
        return NextResponse.json({ error: 'שגיאה בעדכון סשן' }, { status: 500 });
      }

      return NextResponse.json({ session: data });
    } else {
      // צור סשן חדש
      const { data, error } = await supabase
        .from('operator_sessions')
        .insert({
          user_id: decoded.userId,
          is_active: true,
          last_activity: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        return NextResponse.json({ error: 'שגיאה ביצירת סשן' }, { status: 500 });
      }

      return NextResponse.json({ session: data });
    }

  } catch (error) {
    console.error('Create/update session error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// DELETE - סיום סשן
export async function DELETE(request) {
  try {
    const auth = await requireRole(request, ['operator', 'shift_supervisor', 'call_center_manager']);
    if (auth.error) return auth.error;
    const decoded = auth.user;

    const { error } = await supabase
      .from('operator_sessions')
      .update({
        is_active: false,
        session_end: new Date().toISOString()
      })
      .eq('user_id', decoded.userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error ending session:', error);
      return NextResponse.json({ error: 'שגיאה בסיום סשן' }, { status: 500 });
    }

    return NextResponse.json({ message: 'סשן הסתיים' });

  } catch (error) {
    console.error('End session error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}
