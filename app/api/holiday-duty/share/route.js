import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { verifyHolidayBoardToken } from '@/lib/auth';
import { dutyWindow } from '@/lib/holidays';

/**
 * לוח כוננות החג לצפייה ציבורית, לפי קישור חתום.
 *
 * ראוט ציבורי בכוונה: מנהל המוקד והמוקדנים שולחים את הקישור בוואטסאפ לגורמים
 * שאין להם חשבון. הגישה נשענת כולה על ה-HMAC שבכתובת, ולכן הראוט קורא בלבד
 * ואינו מקבל שום פעולת כתיבה.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const periodId = searchParams.get('period');
  const token = searchParams.get('t');

  if (!periodId) {
    return NextResponse.json({ success: false, error: 'חסר מזהה חג' }, { status: 400 });
  }
  if (!verifyHolidayBoardToken(periodId, token)) {
    return NextResponse.json({ success: false, error: 'קישור לא תקין' }, { status: 403 });
  }

  const { data: period, error: pErr } = await supabase
    .from('holiday_periods')
    .select('id, name, starts_at, ends_at, notes, duty_start_date, duty_end_date')
    .eq('id', periodId)
    .single();
  if (pErr || !period) {
    return NextResponse.json({ success: false, error: 'החג לא נמצא' }, { status: 404 });
  }

  const { data: topics, error } = await supabase
    .from('holiday_duty_topics')
    .select(
      'id, name, display_order, status, instructions,' +
        ' holiday_duty_entries(id, subtopic, contact_name, contact_phone, contact_role,' +
        ' order_index, applies_dates, split_note, requires_approval_from, note, active)'
    )
    .eq('holiday_period_id', periodId)
    .eq('active', true)
    .order('display_order');
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const shaped = (topics || []).map((t) => {
    const { holiday_duty_entries: rows, ...rest } = t;
    return {
      ...rest,
      entries: (rows || []).filter((e) => e.active).sort((a, b) => a.order_index - b.order_index),
    };
  });

  const w = dutyWindow(period);
  return NextResponse.json({
    success: true,
    period: { ...period, duty_start: w.start, duty_end: w.end },
    topics: shaped,
  });
}
