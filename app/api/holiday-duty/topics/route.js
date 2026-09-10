import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';

const EDITORS = ['call_center_manager', 'admin'];
const FIELDS = ['call_category_id', 'name', 'display_order', 'instructions'];

export async function POST(request) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const body = await request.json();
  if (!body.holiday_period_id || !body.municipality_id) {
    return NextResponse.json(
      { success: false, error: 'holiday_period_id ו-municipality_id חובה' },
      { status: 400 }
    );
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ success: false, error: 'שם נושא חובה' }, { status: 400 });
  }

  const row = {
    holiday_period_id: body.holiday_period_id,
    municipality_id: body.municipality_id,
  };
  for (const f of FIELDS) if (body[f] !== undefined) row[f] = body[f];

  const { data, error } = await supabase
    .from('holiday_duty_topics')
    .insert(row)
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, topic: data });
}
