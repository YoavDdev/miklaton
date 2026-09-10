import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';
import { clearHolidayCache } from '@/lib/holiday-duty-db';

const EDITORS = ['call_center_manager', 'admin'];
const FIELDS = ['duty_start_date', 'duty_end_date', 'notes', 'status'];

/**
 * עדכון חלון הכוננות של החג, ההערה הכללית והסטטוס.
 *
 * שליחת null לשני שדות התאריך מחזירה לברירת המחדל - ימי החג עצמם.
 */
export async function PATCH(request, { params }) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const body = await request.json();
  const patch = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) if (body[f] !== undefined) patch[f] = body[f] || null;

  const { duty_start_date: start, duty_end_date: end } = patch;
  if (start && end && end < start) {
    return NextResponse.json(
      { success: false, error: 'תאריך הסיום מוקדם מתאריך ההתחלה' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('holiday_periods')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // התקופות במטמון ל-60 שניות; בלי הניקוי הזה השינוי לא ייראה מיד.
  clearHolidayCache();
  return NextResponse.json({ success: true, period: data });
}
