import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';

const EDITORS = ['call_center_manager', 'admin'];
const FIELDS = [
  'name', 'display_order', 'instructions', 'status',
  'confirmed_by_name', 'confirmed_at', 'active',
];

export async function PATCH(request, { params }) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const body = await request.json();
  const patch = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) if (body[f] !== undefined) patch[f] = body[f];

  const { data, error } = await supabase
    .from('holiday_duty_topics')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, topic: data });
}

export async function DELETE(request, { params }) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  // מחיקת נושא מוחקת את שורותיו דרך on delete cascade.
  const { error } = await supabase.from('holiday_duty_topics').delete().eq('id', params.id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
