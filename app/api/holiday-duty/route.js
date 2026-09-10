import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';
import { loadPeriods } from '@/lib/holiday-duty-db';
import { findActivePeriod, findUpcomingPeriod } from '@/lib/holidays';

const READERS = [
  'operator', 'shift_supervisor', 'call_center_manager',
  'sector_manager', 'ceo', 'inspector', 'shelter_manager', 'admin',
];

export async function GET(request) {
  const auth = await requireRole(request, READERS);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const municipalityId = searchParams.get('municipality_id');
  const requested = searchParams.get('period'); // 'active' | 'upcoming' | uuid
  if (!municipalityId) {
    return NextResponse.json({ success: false, error: 'municipality_id חסר' }, { status: 400 });
  }

  const now = new Date();
  const periods = await loadPeriods(municipalityId);
  const active = findActivePeriod(periods, now);

  let period = null;
  if (!requested || requested === 'active') {
    // ברירת המחדל היא מה שהמוקדן צריך עכשיו: החג הנוכחי, ואם אין - הקרוב.
    period = active || findUpcomingPeriod(periods, now, 24 * 14);
  } else if (requested === 'upcoming') {
    period = findUpcomingPeriod(periods, now, 24 * 14);
  } else {
    period = periods.find((p) => p.id === requested) || null;
  }

  if (!period) {
    return NextResponse.json({ success: true, period: null, isActive: false, topics: [] });
  }

  const { data: topics, error } = await supabase
    .from('holiday_duty_topics')
    .select(
      'id, name, display_order, status, confirmed_by_name, confirmed_at, instructions,' +
        ' holiday_duty_entries(id, subtopic, contact_name, contact_phone, contact_role,' +
        ' order_index, applies_dates, split_group, split_note, requires_approval_from, note, active)'
    )
    .eq('holiday_period_id', period.id)
    .eq('active', true)
    .order('display_order');

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const shaped = (topics || []).map((t) => {
    const { holiday_duty_entries: rows, ...rest } = t;
    return {
      ...rest,
      entries: (rows || [])
        .filter((e) => e.active)
        .sort((a, b) => a.order_index - b.order_index),
    };
  });

  return NextResponse.json({
    success: true,
    period,
    isActive: active?.id === period.id,
    topics: shaped,
  });
}
