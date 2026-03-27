import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - קבלת סשנים פעילים
export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    // רק מוקדנים פעילים - סשן שהיה פעיל ב-15 דקות האחרונות
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('operator_sessions')
      .select(`
        *,
        user:user_id(
          id,
          full_name,
          role
        )
      `)
      .eq('is_active', true)
      .gte('last_activity', fifteenMinutesAgo)
      .order('last_activity', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ error: 'שגיאה בטעינת סשנים' }, { status: 500 });
    }

    return NextResponse.json({ sessions: data || [] });

  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 });
  }
}

// POST - יצירת/עדכון סשן (heartbeat)
export async function POST(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    // בדוק אם יש סשן פעיל
    const { data: existingSession } = await supabase
      .from('operator_sessions')
      .select('*')
      .eq('user_id', decoded.userId)
      .eq('is_active', true)
      .single();

    if (existingSession) {
      // עדכן last_activity
      const { data, error } = await supabase
        .from('operator_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', existingSession.id)
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
    const token = request.cookies.get('auth-token')?.value;
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

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
