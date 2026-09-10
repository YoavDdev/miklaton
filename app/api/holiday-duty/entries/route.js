import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';

const EDITORS = ['call_center_manager', 'admin'];

const FIELDS = [
  'subtopic', 'contact_name', 'contact_phone', 'contact_role',
  'source_contact_id', 'source_table', 'order_index', 'applies_dates',
  'split_group', 'split_note', 'requires_approval_from', 'note',
];

export async function POST(request) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const body = await request.json();
  if (!body.topic_id || !body.municipality_id) {
    return NextResponse.json(
      { success: false, error: 'topic_id ו-municipality_id חובה' },
      { status: 400 }
    );
  }
  if (!body.contact_name?.trim()) {
    return NextResponse.json({ success: false, error: 'שם איש קשר חובה' }, { status: 400 });
  }

  const row = { topic_id: body.topic_id, municipality_id: body.municipality_id };
  for (const f of FIELDS) if (body[f] !== undefined) row[f] = body[f];

  const { data, error } = await supabase
    .from('holiday_duty_entries')
    .insert(row)
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, entry: data });
}
