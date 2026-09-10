import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';
import { loadPeriods } from '@/lib/holiday-duty-db';

const EDITORS = ['call_center_manager', 'admin'];

export async function GET(request) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const municipalityId = searchParams.get('municipality_id');
  if (!municipalityId) {
    return NextResponse.json({ success: false, error: 'municipality_id חסר' }, { status: 400 });
  }
  const periods = await loadPeriods(municipalityId);
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const visible = periods.filter((p) => new Date(p.ends_at).getTime() >= cutoff);

  // אילו חגים כבר מולאו. העורך מציע את האחרון שמולא כברירת המחדל לשכפול,
  // כדי שמנהל המוקד לא יחזור על עבודת הדיוק בכל חג מחדש.
  const { data: filled } = await supabase
    .from('holiday_duty_topics')
    .select('holiday_period_id')
    .eq('municipality_id', municipalityId)
    .eq('active', true);
  const filledIds = new Set((filled || []).map((r) => r.holiday_period_id));

  return NextResponse.json({
    success: true,
    periods: visible.map((p) => ({ ...p, has_board: filledIds.has(p.id) })),
  });
}
