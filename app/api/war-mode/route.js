import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireRole, requireRoleOrScreen } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
    const auth = await requireRole(request, ['operator', 'call_center_manager']);
    if (auth.error) return auth.error;

    const { is_active, activated_by, notes } = await request.json();

    const updateData = {
      is_active,
      notes: notes || null
    };

    if (is_active) {
      updateData.activated_at = new Date().toISOString();
      updateData.activated_by = activated_by;
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

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
