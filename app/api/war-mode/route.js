import { NextResponse } from 'next/server';
import { requireRole, requireRoleOrScreen } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

export async function GET(request) {
  try {
    const auth = await requireRoleOrScreen(request);
    if (auth.error) return auth.error;

    const { data, error } = await supabase
      .from('war_mode')
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    // מוקדן אינו מעביר את הרשות למצב חירום. זו החלטה של מי שמנהל את
    // המשמרת - אחמ״ש או מנהלת המוקד. שינוי מדיניות מאושר, לא באג.
    const auth = await requireRole(request, ['shift_supervisor', 'call_center_manager']);
    if (auth.error) return auth.error;

    const { is_active, notes } = await request.json();

    // מי שינה נגזר מהטוקן ולא מגוף הבקשה. קודם השרת קרא `activated_by`
    // בזמן שהלקוח שלח `updated_by`, ולכן השדה נשאר ריק תמיד - אף פעם לא
    // היה תיעוד של מי העביר את הרשות למצב חירום (YOA-25).
    const actor = auth.user.name || auth.user.email || auth.user.userId;

    const updateData = {
      is_active,
      notes: notes || null
    };

    if (is_active) {
      updateData.activated_at = new Date().toISOString();
      updateData.activated_by = actor;
    } else {
      updateData.deactivated_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('war_mode')
      .update(updateData)
      .eq('id', (await supabase.from('war_mode').select('id').single()).data.id)
      .select()
      .single();

    if (error) throw error;

    // שינוי מצב חירום הוא הפעולה בעלת ההשלכות הרחבות ביותר במערכת.
    // נרשם ב-audit_log כדי שתהיה תשובה לשאלה מי ומתי - הטבלה שומרת
    // היסטוריה, בעוד war_mode עצמה נדרסת בכל מעבר.
    const { error: auditError } = await supabase.from('audit_log').insert({
      user_id: auth.user.userId,
      action: is_active ? 'war_mode_activated' : 'war_mode_deactivated',
      details: { by: actor, notes: notes || null },
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent'),
    });
    if (auditError) console.error('war-mode audit write failed:', auditError);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
