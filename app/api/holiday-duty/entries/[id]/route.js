import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';

const EDITORS = ['call_center_manager', 'admin'];
const FIELDS = [
  'subtopic', 'contact_name', 'contact_phone', 'contact_role',
  'order_index', 'applies_dates', 'split_group', 'split_note',
  'requires_approval_from', 'note', 'active',
];

export async function PATCH(request, { params }) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const body = await request.json();
  const patch = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) if (body[f] !== undefined) patch[f] = body[f];

  const { data, error } = await supabase
    .from('holiday_duty_entries')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, entry: data });
}

export async function DELETE(request, { params }) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const { error } = await supabase.from('holiday_duty_entries').delete().eq('id', params.id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
