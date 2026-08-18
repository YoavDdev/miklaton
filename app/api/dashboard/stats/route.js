import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';
import shelters from '@/data/shelters.json';

/**
 * מספרים אמיתיים ל-/dashboard, לפי תפקיד.
 *
 * קודם הדף הציג ארבעה מספרים קשיחים לכל תפקיד (150 מקלטים, 12 משימות,
 * 5 אישורים, 3 התראות) עם הערה "לעכשיו נציג נתונים דמה". במערכת חירום
 * עירונית מספר שנראה אמיתי ואינו אמיתי הוא סיכון (YOA-24).
 *
 * העיקרון כאן: מחזירים רק מה שאפשר לחשב באמת ורק למי שזה רלוונטי לו.
 * כרטיס בלי נתון פשוט לא מוצג - עדיף אחד אמיתי מארבעה מומצאים.
 */
export async function GET(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    const { role, userId } = auth.user;
    const stats = {};

    // מקלטים - מקור האמת הוא קובץ סטטי, זהה לכל תפקיד
    stats.totalShelters = Array.isArray(shelters) ? shelters.length : null;

    // משימות ממתינות. הסטטוסים בעברית, כך אוכף ה-CHECK על operator_tasks.
    if (role === 'operator' || role === 'call_center_manager' || role === 'admin') {
      let query = supabase
        .from('operator_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ממתין');
      if (role === 'operator') query = query.eq('assigned_to', userId);
      const { count, error } = await query;
      if (!error) stats.pendingTasks = count ?? 0;
    }

    // הרשמות שממתינות לאישור - רלוונטי לאדמין בלבד, הוא היחיד שמאשר
    if (role === 'admin') {
      const { count, error } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (!error) stats.pendingApprovals = count ?? 0;
    }

    // הודעות פעילות - אותו סינון תאריכים כמו ב-/api/notifications
    const now = new Date().toISOString();
    const { data: notifications, error: notifError } = await supabase
      .from('general_notifications')
      .select('id')
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .or(`expires_at.is.null,expires_at.gte.${now}`);
    if (!notifError) stats.activeNotifications = notifications?.length ?? 0;

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
